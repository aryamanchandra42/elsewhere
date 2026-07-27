import os
import atexit
import json
import ssl
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

from dotenv import load_dotenv

# Local: put secrets in `.env` (gitignored). Render/production: set env vars in the dashboard.
load_dotenv()

import re

from flask import Flask, abort, request, jsonify
from flask_cors import CORS
from model_loader import ModelLoader
from models import db, Room
from relation_explainer import (
    TEMPLATES as RELATION_TEMPLATES,
    explain_relation,
)
from semantic_scoring import evaluate_move_cached, map_score
from sqlalchemy import inspect, text

app = Flask(__name__)


def _cors_origins():
    """Allowed browser origins. Env ALLOWED_ORIGINS adds/overrides; production domains are always included."""
    production = [
        "https://playelsewhere.xyz",
        "https://www.playelsewhere.xyz",
        "https://elsewhere-beta.vercel.app",
    ]
    local = ["http://localhost:5173", "http://127.0.0.1:5173"]
    raw = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if raw == "*":
        return "*"
    extra = [o.strip() for o in raw.split(",") if o.strip()] if raw else []
    return list(dict.fromkeys(extra + production + local))


CORS(app, origins=_cors_origins())
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-in-production")
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL",
    "sqlite:///elsewhere.db",
)
if app.config["SQLALCHEMY_DATABASE_URI"].startswith("postgres://"):
    app.config["SQLALCHEMY_DATABASE_URI"] = app.config["SQLALCHEMY_DATABASE_URI"].replace(
        "postgres://", "postgresql://", 1
    )
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)


def _migrate_room_outcome_columns():
    """SQLite/Postgres: add loser_role and end_reason if missing."""
    try:
        insp = inspect(db.engine)
        if not insp.has_table("rooms"):
            return
        cols = {c["name"] for c in insp.get_columns("rooms")}
        stmts = []
        if "loser_role" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN loser_role VARCHAR(10)")
        if "end_reason" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN end_reason VARCHAR(20)")
        for sql in stmts:
            db.session.execute(text(sql))
        if stmts:
            db.session.commit()
    except Exception:
        db.session.rollback()


def _migrate_room_rematch_columns():
    """SQLite/Postgres: add rematch_vote_host / rematch_vote_guest if missing."""
    try:
        insp = inspect(db.engine)
        if not insp.has_table("rooms"):
            return
        cols = {c["name"] for c in insp.get_columns("rooms")}
        stmts = []
        if "rematch_vote_host" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN rematch_vote_host INTEGER")
        if "rematch_vote_guest" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN rematch_vote_guest INTEGER")
        for sql in stmts:
            db.session.execute(text(sql))
        if stmts:
            db.session.commit()
    except Exception:
        db.session.rollback()


def _migrate_room_strike_columns():
    """SQLite/Postgres: add host_strikes / guest_strikes if missing."""
    try:
        insp = inspect(db.engine)
        if not insp.has_table("rooms"):
            return
        cols = {c["name"] for c in insp.get_columns("rooms")}
        stmts = []
        if "host_strikes" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN host_strikes INTEGER DEFAULT 0")
        if "guest_strikes" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN guest_strikes INTEGER DEFAULT 0")
        for sql in stmts:
            db.session.execute(text(sql))
        if stmts:
            db.session.commit()
    except Exception:
        db.session.rollback()


def _migrate_room_multiplayer_columns():
    """Add max_players, players_json, rematch_votes_json for up to 4 players."""
    try:
        insp = inspect(db.engine)
        if not insp.has_table("rooms"):
            return
        cols = {c["name"] for c in insp.get_columns("rooms")}
        stmts = []
        if "max_players" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN max_players INTEGER DEFAULT 4")
        if "players_json" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN players_json TEXT")
        if "rematch_votes_json" not in cols:
            stmts.append("ALTER TABLE rooms ADD COLUMN rematch_votes_json TEXT")
        for sql in stmts:
            db.session.execute(text(sql))
        if stmts:
            db.session.commit()
    except Exception:
        db.session.rollback()


def _backfill_room_players_json():
    """Persist legacy host/guest rows into players_json once."""
    try:
        rooms = Room.query.filter(Room.players_json.is_(None)).all()
        if not rooms:
            return
        for room in rooms:
            pl = room.get_players()
            room.set_players(pl)
            if room.max_players is None or room.max_players < 2:
                room.max_players = 4
        db.session.commit()
    except Exception:
        db.session.rollback()


STRIKE_LIMIT = 3

WAITING_ROOM_MAX_AGE_HOURS = 24


def _prune_stale_waiting_rooms():
    """Remove abandoned lobbies so codes do not accumulate forever."""
    try:
        cutoff = datetime.utcnow() - timedelta(hours=WAITING_ROOM_MAX_AGE_HOURS)
        deleted = Room.query.filter(Room.status == "waiting", Room.created_at < cutoff).delete(
            synchronize_session=False
        )
        if deleted:
            db.session.commit()
    except Exception:
        db.session.rollback()


with app.app_context():
    db.create_all()
    _migrate_room_outcome_columns()
    _migrate_room_rematch_columns()
    _migrate_room_strike_columns()
    _migrate_room_multiplayer_columns()
    _backfill_room_players_json()

loader = ModelLoader()
from vocab import is_valid_word  # noqa: E402 — after cache builds data/glove_subset.json


def _compute_pool_workers() -> int:
    raw = (os.environ.get("ELSEWHERE_COMPUTE_THREADS") or "8").strip()
    try:
        return max(1, min(32, int(raw)))
    except ValueError:
        return 8


_COMPUTE_POOL = ThreadPoolExecutor(
    max_workers=_compute_pool_workers(),
    thread_name_prefix="ew_compute",
)
atexit.register(_COMPUTE_POOL.shutdown, wait=False)

# In-memory cache for dictionary lookups
_meaning_cache = {}

def _normalize_history_payload(raw):
    """Accept list of strings or list of dicts with 'word' keys."""
    if not raw:
        return []
    out = []
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                w = item.strip().lower()
                if w:
                    out.append(w)
            elif isinstance(item, dict) and item.get("word"):
                w = str(item["word"]).strip().lower()
                if w:
                    out.append(w)
    return out


def build_word_relation(loader, ev, anchor_fallback, played_word):
    """
    Structured embedding stats for the pair that triggered the evaluation (esp. losses).
    `ev` should include `anchor_word` when produced by evaluate_move (strictest anchor vs played).
    """
    losing_anchor = (ev.get("anchor_word") or anchor_fallback or "").strip().lower()
    played = (played_word or "").strip().lower()
    cd = float(ev.get("cosine_distance", 0.0))
    z = float(ev.get("z", 0.0))
    d_anchor = loader.coarse_domain(losing_anchor)
    d_played = loader.coarse_domain(played)
    same_b = loader.same_cluster(losing_anchor, played)
    syn = ev.get("reason") == "synonym"
    # Synonym-band losses must stay labeled synonym; skip explain_relation so CACHE
    # is not filled with a different relation for the same pair.
    if syn:
        hybrid = {
            "relation": "synonym",
            "explanation": RELATION_TEMPLATES["synonym"].format(
                w1=losing_anchor, w2=played, dist=cd
            ),
            "source": "rule",
        }
    else:
        hybrid = explain_relation(losing_anchor, played)
    return {
        "anchor": losing_anchor,
        "played": played,
        "relation": hybrid["relation"],
        "explanation": hybrid["explanation"],
        "source": hybrid["source"],
        "cosine_distance": round(cd, 4),
        "cosine_similarity": round(1.0 - cd, 4),
        "z_score": round(z, 3),
        "game_score": round(map_score(z), 2),
        "synonym_band": syn,
        "domain_anchor": d_anchor,
        "domain_played": d_played,
        "same_bucket": same_b,
        "summary": semantic_reason_from_eval(ev, cd),
    }


def semantic_reason_from_eval(ev, cosine_distance):
    """Learning-oriented copy from evaluate_move output."""
    if ev.get("reason") == "synonym":
        return "These words are too close in embedding space (synonym band) — try a bigger semantic jump."
    z = float(ev.get("z", 0.0))
    if z < -0.5:
        return "This move sits below the expected difficulty for this anchor — too safe or tangled."
    if z > 1.2:
        return "A strong move — clearly past the typical gap for this anchor."
    cd = float(cosine_distance)
    if cd < 0.5:
        return "These words often appear in similar contexts, which pulls them together."
    if cd < 0.9:
        return "These words share some semantic overlap, keeping them relatively close."
    if cd < 1.3:
        return "These words are from tangential domains, creating a significant gap."
    return "These words are semantically orthogonal, reaching the furthest edges of the vector space."


def pick_best_candidate_by_z(anchor_word, candidates, history_words, executor=None):
    """Choose (word, embedding_distance, similarity, ev) with highest z among non-INVALID, non-LOSE."""
    if not candidates:
        return None
    ex = executor or _COMPUTE_POOL
    futures = {}
    for candidate_word, embedding_distance, similarity in candidates:
        fut = ex.submit(
            evaluate_move_cached,
            loader,
            anchor_word,
            candidate_word,
            history_words,
            None,
            None,
        )
        futures[fut] = (candidate_word, embedding_distance, similarity)
    best = None
    best_z = None
    for fut in as_completed(futures):
        candidate_word, embedding_distance, similarity = futures[fut]
        try:
            ev = fut.result()
        except Exception:
            continue
        if ev.get("result") == "INVALID":
            continue
        if ev.get("result") == "LOSE":
            continue
        z = float(ev.get("z", -1e9))
        if best_z is None or z > best_z:
            best_z = z
            best = (candidate_word, embedding_distance, similarity, ev)
    return best


def _rank_ai_candidates_parallel(user_word, candidates, history_words, move_number):
    """Parallel evaluate_move for computer-move; bounded by _COMPUTE_POOL."""
    if not candidates:
        return []
    futures = {}
    for candidate_word, candidate_distance, candidate_similarity in candidates:
        fut = _COMPUTE_POOL.submit(
            evaluate_move_cached,
            loader,
            user_word,
            candidate_word,
            history_words,
            None,
            move_number,
        )
        futures[fut] = (candidate_word, candidate_distance, candidate_similarity)
    ranked = []
    for fut in as_completed(futures):
        candidate_word, candidate_distance, candidate_similarity = futures[fut]
        try:
            ev = fut.result()
        except Exception:
            continue
        if ev.get("result") in ("INVALID", "LOSE"):
            continue
        ranked.append(
            (
                float(ev.get("z", -1e9)),
                candidate_word,
                candidate_distance,
                candidate_similarity,
                ev,
            )
        )
    ranked.sort(key=lambda x: x[0], reverse=True)
    return ranked


def _parse_move_number(raw):
    if raw is None:
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        return None


def _room_setting_int(raw, default, lo, hi):
    try:
        v = int(raw)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def _room_response(room, token):
    return {
        "room": {
            **room.to_dict(token),
            "rematch": room.rematch_api_dict(),
        }
    }


def _extract_room_token(payload=None):
    payload = payload or {}
    return (
        request.headers.get("X-Room-Token")
        or request.args.get("token")
        or payload.get("token")
        or ""
    ).strip()


# ---------- Token room multiplayer ----------
def _maybe_autostart_waiting_room(room):
    """When the room is full (player_count == max_players), begin the match."""
    if room.status != "waiting":
        return
    n = len(room.get_players())
    cap = max(2, min(4, int(room.max_players or 4)))
    if n >= 2 and n >= cap:
        room.status = "active"
        room.set_turn_slot(0)


@app.route("/api/rooms", methods=["POST"])
def create_room():
    _prune_stale_waiting_rooms()
    data = request.json or {}
    host_name = (data.get("name") or "Host").strip()[:32] or "Host"
    max_rounds = _room_setting_int(data.get("max_rounds"), 15, 5, 30)
    turn_time_limit = _room_setting_int(data.get("turn_time_limit"), 10, 5, 30)
    max_players = _room_setting_int(data.get("max_players"), 4, 2, 4)

    host_token = Room.generate_token()
    players = [{"name": host_name, "token": host_token, "score": 0.0, "strikes": 0}]

    room = Room(
        code=Room.generate_code(),
        host_name=host_name,
        host_token=host_token,
        guest_name=None,
        guest_token=None,
        guest_score=0.0,
        guest_strikes=0,
        status="waiting",
        max_rounds=max_rounds,
        turn_time_limit=turn_time_limit,
        max_players=max_players,
        players_json=json.dumps(players),
        turn="0",
        current_round=1,
    )
    db.session.add(room)
    db.session.commit()
    return jsonify({
        "room": _room_response(room, host_token)["room"],
        "code": room.code,
        "token": host_token,
        "role": "host",
        "slot": 0,
    })


@app.route("/api/rooms/join", methods=["POST"])
def join_room():
    _prune_stale_waiting_rooms()
    data = request.json or {}
    code = (data.get("code") or "").strip().upper()
    join_name = (data.get("name") or "Guest").strip()[:32] or "Guest"
    if not code:
        return jsonify({"error": "Code required"}), 400

    room = Room.query.filter_by(code=code).first()
    if not room:
        return jsonify({"error": "Room not found or expired"}), 404
    if room.status == "finished":
        return jsonify({"error": "Room is already finished"}), 400

    provided_token = _extract_room_token(data)
    if provided_token:
        role = room.role_for_token(provided_token)
        if role:
            slot = int(role)
            dr = room.slot_to_display_role(slot)
            return jsonify({
                "room": _room_response(room, provided_token)["room"],
                "code": room.code,
                "token": provided_token,
                "role": dr,
                "slot": slot,
            })

    if room.status != "waiting":
        return jsonify({"error": "Game already in progress"}), 400

    players = room.get_players()
    cap = max(2, min(4, int(room.max_players or 4)))
    if len(players) >= cap:
        return jsonify({"error": "Room is full"}), 400

    new_token = Room.generate_token()
    players.append({"name": join_name, "token": new_token, "score": 0.0, "strikes": 0})
    room.set_players(players)
    new_slot = len(players) - 1
    _maybe_autostart_waiting_room(room)
    db.session.commit()
    return jsonify({
        "room": _room_response(room, new_token)["room"],
        "code": room.code,
        "token": new_token,
        "role": room.slot_to_display_role(new_slot),
        "slot": new_slot,
    })


@app.route("/api/rooms/<code>/start", methods=["POST"])
def room_start(code):
    """Host (slot 0) starts the match when at least 2 players have joined."""
    data = request.json or {}
    room = Room.query.filter_by(code=code.upper()).first_or_404()
    token = _extract_room_token(data)
    role = room.role_for_token(token)
    if role != "0":
        return jsonify({"error": "Only the host can start the game"}), 403
    if room.status != "waiting":
        return jsonify({"error": "Game has already started"}), 400
    players = room.get_players()
    if len(players) < 2:
        return jsonify({"error": "Need at least 2 players to start"}), 400
    room.status = "active"
    room.set_turn_slot(0)
    db.session.commit()
    return jsonify({"room": _room_response(room, token)["room"], "started": True})


@app.route("/api/rooms/<code>")
def get_room(code):
    room = Room.query.filter_by(code=code.upper()).first_or_404()
    token = _extract_room_token()
    role = room.role_for_token(token)
    if not role:
        return jsonify({"error": "Invalid room token"}), 403
    return jsonify(_room_response(room, token))


@app.route("/api/rooms/<code>/move", methods=["POST"])
def room_move(code):
    data = request.json or {}
    room = Room.query.filter_by(code=code.upper()).first_or_404()
    token = _extract_room_token(data)
    role = room.role_for_token(token)
    if role is None:
        return jsonify({"error": "Invalid room token"}), 403
    slot = int(role)
    if room.status != "active":
        return jsonify({"error": "Room is not active"}), 400
    if room.turn_slot_int() != slot:
        return jsonify({"error": "Not your turn"}), 400

    word = (data.get("word") or "").strip().lower()
    if not word:
        return jsonify({"error": "Word required"}), 400
    if not is_valid_word(word):
        suggestion = loader.get_closest_word(word)
        return jsonify({"error": "Word not in game dictionary", "suggestion": suggestion}), 400

    players = room.get_players()
    n = len(players)
    if n < 2:
        return jsonify({"error": "Not enough players"}), 400

    hist = room.get_history()
    move_number = len(hist) + 1
    # Online moves must stay fast: do not block on the external dictionary API
    # (can add hundreds of ms–seconds per move). Use cache hit only; optional
    # definitions can still be fetched via /api/word-meaning.
    meaning = _meaning_cache.get(word)
    player_key = slot

    # Move 1: implicit anchor — never evaluate, never lose, no score
    if move_number == 1:
        room.last_word = word
        room.append_history(word, player_key, None, meaning, z=None, eval_result="SEED")
        room.set_turn_slot((slot + 1) % n)
        if slot == n - 1:
            room.current_round += 1
        if room.current_round > room.max_rounds:
            room.status = "finished"
            room.end_reason = "max_rounds"
            room.loser_role = None
            room.clear_rematch_votes()
        db.session.commit()
        return jsonify({
            "room": _room_response(room, token)["room"],
            "distance": None,
            "z": None,
            "eval_result": "CONTINUE",
            "message": "Anchor set",
            "reason": None,
            "meaning": meaning,
            "too_close": False,
        })

    distance = None
    z_val = None
    eval_result = None
    reason = None
    history_words = [h.get("word") for h in hist if h.get("word")]
    ev = evaluate_move_cached(loader, room.last_word, word, history_words, move_number=move_number)
    eval_result = ev.get("result")
    if eval_result == "INVALID":
        return jsonify({"error": "Embedding lookup failed"}), 400
    z_val = float(ev.get("z", 0.0))
    distance = map_score(z_val)
    cd = float(ev.get("cosine_distance", 0.0))
    reason = semantic_reason_from_eval(ev, cd)
    if eval_result == "LOSE":
        plist = room.get_players()
        plist[slot]["strikes"] = int(plist[slot].get("strikes", 0) or 0) + 1
        strikes_after = plist[slot]["strikes"]
        room.set_players(plist)

        relation_payload = build_word_relation(loader, ev, room.last_word, word)
        if strikes_after >= STRIKE_LIMIT:
            room.append_history(
                word, player_key, distance, meaning, z=z_val, relation=relation_payload, reason=reason
            )
            room.last_word = word
            room.status = "finished"
            room.loser_role = str(slot)
            room.end_reason = "too_close"
            room.clear_rematch_votes()
            db.session.commit()
            return jsonify({
                "room": _room_response(room, token)["room"],
                "distance": distance,
                "z": z_val,
                "eval_result": eval_result,
                "reason": reason,
                "meaning": meaning,
                "too_close": True,
                "foul_only": False,
                "strikes": strikes_after,
                "strike_limit": STRIKE_LIMIT,
                "relation": relation_payload,
            })

        room.append_history(
            word,
            player_key,
            distance,
            meaning,
            z=z_val,
            eval_result="STRIKE",
            relation=relation_payload,
            reason=reason,
        )
        db.session.commit()
        return jsonify({
            "room": _room_response(room, token)["room"],
            "distance": distance,
            "z": z_val,
            "eval_result": "STRIKE",
            "reason": reason,
            "meaning": meaning,
            "too_close": True,
            "foul_only": True,
            "strikes": strikes_after,
            "strike_limit": STRIKE_LIMIT,
            "relation": relation_payload,
        })

    plist = room.get_players()
    plist[slot]["score"] = float(plist[slot].get("score", 0) or 0) + distance
    room.set_players(plist)

    room.append_history(word, player_key, distance, meaning, z=z_val)
    room.last_word = word
    room.set_turn_slot((slot + 1) % n)
    if slot == n - 1:
        room.current_round += 1
    if room.current_round > room.max_rounds:
        room.status = "finished"
        room.end_reason = "max_rounds"
        room.loser_role = None
        room.clear_rematch_votes()
    db.session.commit()

    return jsonify({
        "room": _room_response(room, token)["room"],
        "distance": distance,
        "z": z_val,
        "eval_result": eval_result,
        "reason": reason,
        "meaning": meaning,
        "too_close": False,
    })


@app.route("/api/rooms/<code>/timeout", methods=["POST"])
def room_timeout(code):
    data = request.json or {}
    room = Room.query.filter_by(code=code.upper()).first_or_404()
    token = _extract_room_token(data)
    role = room.role_for_token(token)
    if role is None:
        return jsonify({"error": "Invalid room token"}), 403
    slot = int(role)
    if room.status != "active":
        return jsonify({"error": "Room is not active"}), 400
    if room.turn_slot_int() != slot:
        return jsonify({"error": "Not your turn"}), 400

    n = len(room.get_players())
    room.status = "finished"
    room.set_turn_slot((slot + 1) % max(1, n))
    room.loser_role = str(slot)
    room.end_reason = "timeout"
    room.clear_rematch_votes()
    db.session.commit()
    return jsonify({
        "room": _room_response(room, token)["room"],
        "timed_out_by": str(slot),
    })


@app.route("/api/rooms/<code>/rematch", methods=["POST"])
def room_rematch(code):
    data = request.json or {}
    room = Room.query.filter_by(code=code.upper()).first_or_404()
    token = _extract_room_token(data)
    role = room.role_for_token(token)
    if role is None:
        return jsonify({"error": "Invalid room token"}), 403
    slot = int(role)

    accept = bool(data.get("accept", True))

    # Second client's "accept" can arrive after the first rematch commit already set status
    # to active — otherwise they get 400, never start polling, and appear stuck.
    if room.status == "active":
        hist = room.get_history()
        if len(hist) == 0 and accept:
            return jsonify(
                {
                    "room": _room_response(room, token)["room"],
                    "started": True,
                    "sync": True,
                }
            )
        if len(hist) == 0:
            return jsonify({"error": "Game already restarted"}), 400
        return jsonify({"error": "Game already in progress"}), 400

    if room.status != "finished":
        return jsonify({"error": "Rematch only available after game ends"}), 400

    vote_val = 1 if accept else 0
    room.set_rematch_vote_slot(slot, vote_val)

    if room.all_rematch_accepted():
        plist = room.get_players()
        for p in plist:
            p["score"] = 0.0
            p["strikes"] = 0
        room.set_players(plist)
        room.status = "active"
        room.set_turn_slot(0)
        room.current_round = 1
        room.loser_role = None
        room.end_reason = None
        room.last_word = None
        room.set_history([])
        room.clear_rematch_votes()
        db.session.commit()
        return jsonify({
            "room": _room_response(room, token)["room"],
            "started": True,
        })

    db.session.commit()
    return jsonify({
        "room": _room_response(room, token)["room"],
        "started": False,
    })


@app.route("/api/ping")
def api_ping():
    """Keep-alive endpoint — hit by UptimeRobot every 10 min to prevent Render cold starts."""
    return jsonify({"pong": True})


@app.route("/api/health")
def api_health():
    """Lightweight check for load balancers and `scripts/probe_apis.py --app-url`."""
    return jsonify(
        {
            "status": "ok",
            "model": "glove-50d",
        }
    )


_JOIN_CODE_PATTERN = re.compile(r"^[A-Za-z0-9]{6,12}$")


@app.route('/')
def index():
    return jsonify({"status": "ok", "service": "elsewhere-backend"})


@app.route('/join/<code>')
def join_room_landing(code):
    """Kept for backwards compat — frontend handles the actual join flow."""
    if not _JOIN_CODE_PATTERN.match(code or ''):
        abort(404)
    return jsonify({"code": code})


@app.route('/api/search', methods=['GET'])
def search():
    """Autocomplete endpoint"""
    query = request.args.get('q', '').strip().lower()
    if not query:
        return jsonify([])
    
    results = loader.search_vocab(query)
    return jsonify(results)


@app.route("/api/anchor", methods=["POST"])
def validate_anchor():
    """First-move anchor: must be in the game dictionary (same as AI vocabulary)."""
    data = request.json or {}
    word = (data.get("word") or "").strip().lower()
    if not word:
        return jsonify({"error": "Word required"}), 400
    if not is_valid_word(word):
        suggestion = loader.get_closest_word(word)
        return jsonify({"error": "Word not in game dictionary", "suggestion": suggestion}), 400
    return jsonify({"ok": True, "word": word})


@app.route('/api/distance', methods=['POST'])
def calculate_distance():
    """Evaluate a move from word1 to word2 (hybrid z + projection scoring)."""
    data = request.json or {}
    word1 = data.get('word1', '').strip().lower()
    word2 = data.get('word2', '').strip().lower()
    history_words = _normalize_history_payload(data.get('history'))
    move_number = _parse_move_number(data.get("move_number"))

    if not is_valid_word(word1):
        suggestion = loader.get_closest_word(word1)
        return jsonify({
            "error": "Word not in game dictionary",
            "suggestion": suggestion
        }), 400
    if not is_valid_word(word2):
        suggestion = loader.get_closest_word(word2)
        return jsonify({
            "error": "Word not in game dictionary",
            "suggestion": suggestion
        }), 400

    ev = evaluate_move_cached(loader, word1, word2, history_words, move_number=move_number)
    if ev.get("result") == "INVALID":
        return jsonify({"error": "Embedding lookup failed"}), 400

    embedding_distance = float(ev.get("cosine_distance", 0.0))
    similarity = 1.0 - embedding_distance
    z_val = float(ev.get("z", 0.0))
    display_distance = map_score(z_val)
    reason = semantic_reason_from_eval(ev, embedding_distance)
    lose = ev.get("result") == "LOSE"
    relation_payload = build_word_relation(loader, ev, word1, word2) if lose else None

    payload = {
        "word1": word1,
        "word2": word2,
        "distance": display_distance,
        "z": z_val,
        "eval_result": ev.get("result"),
        "embedding_distance": embedding_distance,
        "similarity": similarity,
        "reason": reason,
        "too_close": lose,
        "domain1": loader.coarse_domain(word1),
        "domain2": loader.coarse_domain(word2),
        "best_move": None,
        "best_move_pending": True,
    }
    if relation_payload is not None:
        payload["relation"] = relation_payload
    return jsonify(payload)


def _best_move_payload(best):
    if not best:
        return None
    bw, bed, _sim, bev = best
    best_z = float(bev.get("z", 0.0))
    return {
        "word": bw,
        "distance": map_score(best_z),
        "z": best_z,
        "embedding_distance": float(bed),
        "eval_result": bev.get("result"),
    }


@app.route("/api/distance/best-move", methods=["POST"])
def distance_best_move():
    """
    Hint path: expensive candidate search + parallel scoring.
    Call after /api/distance for low-latency "show score first, hint second."
    """
    data = request.json or {}
    anchor = (data.get("anchor") or data.get("word1") or "").strip().lower()
    history_words = _normalize_history_payload(data.get("history"))

    if not anchor:
        return jsonify({"error": "anchor required"}), 400
    if not is_valid_word(anchor):
        suggestion = loader.get_closest_word(anchor)
        return jsonify(
            {"error": "Word not in game dictionary", "suggestion": suggestion}
        ), 400

    candidates = loader.find_distant_words_batch(anchor, num_candidates=500, top_k=80)
    best = pick_best_candidate_by_z(anchor, candidates, history_words)
    return jsonify({"best_move": _best_move_payload(best)})


@app.route('/api/computer-move', methods=['POST'])
def computer_move():
    """Computer picks a high-z candidate with a dictionary definition."""
    data = request.json or {}
    user_word = data.get('word', '').strip().lower()
    history_words = _normalize_history_payload(data.get('history'))
    move_number = _parse_move_number(data.get("move_number"))

    if not is_valid_word(user_word):
        suggestion = loader.get_closest_word(user_word)
        return jsonify({
            "error": "Word not in game dictionary",
            "suggestion": suggestion
        }), 400

    candidates = loader.find_distant_words_batch(user_word, num_candidates=100, top_k=20)
    if not candidates:
        return jsonify({"error": "Could not find distant words"}), 500

    ranked = _rank_ai_candidates_parallel(user_word, candidates, history_words, move_number)

    for _z, candidate_word, candidate_embedding_distance, candidate_similarity, ev in ranked:
        meaning = get_word_meaning(candidate_word)
        if meaning:
            z_val = float(ev.get("z", 0.0))
            return jsonify({
                "word": candidate_word,
                "distance": map_score(z_val),
                "z": z_val,
                "eval_result": ev.get("result"),
                "embedding_distance": float(ev.get("cosine_distance", candidate_embedding_distance)),
                "similarity": float(1.0 - ev.get("cosine_distance", candidate_embedding_distance)),
                "meaning": meaning,
                "reason": semantic_reason_from_eval(ev, float(ev.get("cosine_distance", 0.0))),
                "too_close": False,
            })

    candidates = loader.find_distant_words_batch(user_word, num_candidates=500, top_k=50)
    ranked = _rank_ai_candidates_parallel(user_word, candidates, history_words, move_number)

    for _z, candidate_word, candidate_embedding_distance, candidate_similarity, ev in ranked:
        meaning = get_word_meaning(candidate_word)
        if meaning:
            z_val = float(ev.get("z", 0.0))
            return jsonify({
                "word": candidate_word,
                "distance": map_score(z_val),
                "z": z_val,
                "eval_result": ev.get("result"),
                "embedding_distance": float(ev.get("cosine_distance", candidate_embedding_distance)),
                "similarity": float(1.0 - ev.get("cosine_distance", candidate_embedding_distance)),
                "meaning": meaning,
                "reason": semantic_reason_from_eval(ev, float(ev.get("cosine_distance", 0.0))),
                "too_close": False,
            })

    return jsonify({"error": "Could not find a word with meaning"}), 500


@app.route('/api/distances-batch', methods=['POST'])
def calculate_distances_batch():
    """Calculate distances for multiple word pairs at once - for graph visualization"""
    data = request.json
    pairs = data.get('pairs', [])
    
    if not pairs or len(pairs) > 100:  # Limit to 100 pairs
        return jsonify({"error": "Invalid pairs list"}), 400

    def _one_pair(idx, pair):
        word1 = pair.get("word1", "").strip().lower()
        word2 = pair.get("word2", "").strip().lower()
        if is_valid_word(word1) and is_valid_word(word2):
            embedding_distance, similarity = loader.calculate_distance(word1, word2)
            return idx, {
                "word1": word1,
                "word2": word2,
                "distance": embedding_distance,
                "embedding_distance": embedding_distance,
                "similarity": similarity,
            }
        return idx, {
            "word1": word1,
            "word2": word2,
            "distance": None,
            "similarity": None,
        }

    futs = [_COMPUTE_POOL.submit(_one_pair, i, p) for i, p in enumerate(pairs)]
    results = [None] * len(pairs)
    for fut in as_completed(futs):
        idx, row = fut.result()
        results[idx] = row

    return jsonify({"results": results})

@app.route('/api/word-meaning', methods=['GET'])
def word_meaning():
    """Get meaning of a word"""
    word = request.args.get('word', '').strip().lower()
    if not word:
        return jsonify({"error": "Word required"}), 400
    
    meaning = get_word_meaning(word)
    return jsonify({"word": word, "meaning": meaning})

def get_word_meaning(word):
    """Get word meaning from Free Dictionary API (no heavy deps). Results cached in memory."""
    if word in _meaning_cache:
        return _meaning_cache[word]
    definition = _fetch_definition(word)
    _meaning_cache[word] = definition
    return definition


def _fetch_definition(word):
    """Fetch first definition from api.dictionaryapi.dev. Returns None on failure or not found."""
    url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{urllib.parse.quote(word)}"
    try:
        ctx = ssl.create_default_context()
        req = urllib.request.Request(url, headers={"User-Agent": "word-game/1.0"})
        with urllib.request.urlopen(req, timeout=3, context=ctx) as resp:
            data = json.load(resp)
        if data and isinstance(data, list) and len(data) > 0:
            meanings = data[0].get("meanings") or []
            if meanings and meanings[0].get("definitions"):
                return meanings[0]["definitions"][0].get("definition")
    except Exception:
        pass
    return None

if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=port, debug=debug)
