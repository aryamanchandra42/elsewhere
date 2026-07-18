"""Room models for token-based multiplayer."""
from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
import json
import random
import string
import secrets

db = SQLAlchemy()


def _random_code(length=6):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


class Room(db.Model):
    __tablename__ = "rooms"
    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(12), unique=True, nullable=False, index=True)
    host_name = db.Column(db.String(64), nullable=False, default="Host")
    guest_name = db.Column(db.String(64), nullable=True)
    host_token = db.Column(db.String(64), unique=True, nullable=False, index=True)
    guest_token = db.Column(db.String(64), unique=True, nullable=True, index=True)
    status = db.Column(db.String(20), nullable=False, default="waiting")  # waiting | active | finished
    max_rounds = db.Column(db.Integer, default=15)
    turn_time_limit = db.Column(db.Integer, default=10)
    # Turn holder: "0".."3" (player index). Legacy DB may still have "host"|"guest".
    turn = db.Column(db.String(10), default="0")
    last_word = db.Column(db.String(64), nullable=True)
    host_score = db.Column(db.Float, default=0.0)
    guest_score = db.Column(db.Float, default=0.0)
    # Set when status is finished: who lost (timeout or played too close to prior word)
    loser_role = db.Column(db.String(10), nullable=True)
    # too_close | max_rounds | timeout
    end_reason = db.Column(db.String(20), nullable=True)
    current_round = db.Column(db.Integer, default=1)
    host_strikes = db.Column(db.Integer, default=0)
    guest_strikes = db.Column(db.Integer, default=0)
    word_history = db.Column(db.Text, default="[]")
    # Rematch votes: NULL = no vote, 1 = accept, 0 = decline (persisted; replaces in-memory dict)
    rematch_vote_host = db.Column(db.Integer, nullable=True)
    rematch_vote_guest = db.Column(db.Integer, nullable=True)
    # Up to 4 players: JSON list of {name, token, score, strikes}; authoritative for 3+ players.
    players_json = db.Column(db.Text, nullable=True)
    max_players = db.Column(db.Integer, default=4)
    rematch_votes_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def generate_code():
        for _ in range(10):
            code = _random_code(6)
            if not Room.query.filter_by(code=code).first():
                return code
        return _random_code(8)

    @staticmethod
    def generate_token():
        return secrets.token_urlsafe(24)

    def get_players(self):
        """Return ordered player dicts: name, token, score, strikes."""
        if self.players_json:
            try:
                pl = json.loads(self.players_json)
                if isinstance(pl, list) and pl:
                    return pl
            except Exception:
                pass
        pl = [
            {
                "name": self.host_name,
                "token": self.host_token,
                "score": float(self.host_score or 0),
                "strikes": int(self.host_strikes or 0),
            }
        ]
        if self.guest_token:
            pl.append(
                {
                    "name": self.guest_name or "Guest",
                    "token": self.guest_token,
                    "score": float(self.guest_score or 0),
                    "strikes": int(self.guest_strikes or 0),
                }
            )
        return pl

    def set_players(self, players):
        self.players_json = json.dumps(players)
        self._sync_legacy_columns_from_players(players)

    def _sync_legacy_columns_from_players(self, players):
        """Keep first two players mirrored in legacy columns (ORM / old queries)."""
        if not players:
            return
        p0 = players[0]
        self.host_name = p0.get("name") or "Host"
        self.host_token = p0["token"]
        self.host_score = float(p0.get("score", 0) or 0)
        self.host_strikes = int(p0.get("strikes", 0) or 0)
        if len(players) > 1:
            p1 = players[1]
            self.guest_name = p1.get("name") or "Guest"
            self.guest_token = p1["token"]
            self.guest_score = float(p1.get("score", 0) or 0)
            self.guest_strikes = int(p1.get("strikes", 0) or 0)
        else:
            self.guest_name = None
            self.guest_token = None
            self.guest_score = 0.0
            self.guest_strikes = 0

    def turn_slot_int(self):
        t = self.turn
        if t is None or t == "":
            return 0
        s = str(t).lower()
        if s == "host":
            return 0
        if s == "guest":
            return 1
        try:
            return int(float(s))
        except (TypeError, ValueError):
            return 0

    def set_turn_slot(self, idx):
        n = len(self.get_players())
        if n <= 0:
            self.turn = "0"
            return
        self.turn = str(int(idx) % n)

    def role_for_token(self, token):
        if not token:
            return None
        for i, p in enumerate(self.get_players()):
            if p.get("token") == token:
                return str(i)
        return None

    def slot_to_display_role(self, slot: int) -> str:
        if slot == 0:
            return "host"
        if slot == 1:
            return "guest"
        return f"p{slot}"

    def clear_rematch_votes(self):
        self.rematch_vote_host = None
        self.rematch_vote_guest = None
        self.rematch_votes_json = None

    @staticmethod
    def _vote_db_to_bool(v):
        if v is None:
            return None
        return True if int(v) == 1 else False

    def _get_rematch_votes_map(self):
        """slot int -> raw int vote (None, 0, 1)."""
        n = len(self.get_players())
        out = {i: None for i in range(n)}
        if self.rematch_votes_json:
            try:
                raw = json.loads(self.rematch_votes_json)
                for k, v in raw.items():
                    si = int(k)
                    if 0 <= si < n and v is not None:
                        out[si] = int(v)
            except Exception:
                pass
        else:
            if n > 0:
                out[0] = self.rematch_vote_host
            if n > 1:
                out[1] = self.rematch_vote_guest
        return out

    def set_rematch_vote_slot(self, slot: int, vote_val):
        n = len(self.get_players())
        votes = self._get_rematch_votes_map()
        votes[int(slot)] = vote_val
        self.rematch_votes_json = json.dumps({str(k): votes[k] for k in sorted(votes.keys())})
        self.rematch_vote_host = votes.get(0)
        self.rematch_vote_guest = votes.get(1) if n > 1 else None

    def all_rematch_accepted(self):
        n = len(self.get_players())
        if n < 2:
            return False
        v = self._get_rematch_votes_map()
        return all(v.get(i) == 1 for i in range(n))

    def rematch_api_dict(self):
        n = len(self.get_players())
        votes = self._get_rematch_votes_map()
        bool_votes = {str(i): self._vote_db_to_bool(votes.get(i)) for i in range(n)}
        declined_slot = None
        for i in range(n):
            if votes.get(i) == 0:
                declined_slot = i
                break
        ready = n >= 2 and all(votes.get(i) == 1 for i in range(n))
        declined_by = self.slot_to_display_role(declined_slot) if declined_slot is not None else None
        return {
            "votes": bool_votes,
            "votes_raw": {str(i): votes.get(i) for i in range(n)},
            "ready": ready,
            "declined_by_slot": str(declined_slot) if declined_slot is not None else None,
            "declined_by": declined_by,
            "host": bool_votes.get("0"),
            "guest": bool_votes.get("1") if n > 1 else None,
        }

    def get_history(self):
        try:
            return json.loads(self.word_history) if self.word_history else []
        except Exception:
            return []

    def set_history(self, lst):
        self.word_history = json.dumps(lst)

    def append_history(
        self,
        word,
        player,
        distance,
        meaning=None,
        z=None,
        eval_result=None,
        relation=None,
        reason=None,
    ):
        hist = self.get_history()
        entry = {"word": word, "player": player, "distance": distance, "meaning": meaning}
        if z is not None:
            entry["z"] = z
        if eval_result is not None:
            entry["eval_result"] = eval_result
        if relation is not None:
            entry["relation"] = relation
        if reason is not None:
            entry["reason"] = reason
        hist.append(entry)
        self.set_history(hist)

    def loser_slot_parsed(self):
        if not self.loser_role:
            return None
        r = str(self.loser_role).lower()
        if r == "host":
            return 0
        if r == "guest":
            return 1
        try:
            return int(float(r))
        except (TypeError, ValueError):
            return None

    def to_dict(self, viewer_token=None):
        players = self.get_players()
        n = len(players)
        role = self.role_for_token(viewer_token)
        slot = int(role) if role is not None and role.isdigit() else None
        is_host = role == "0"
        turn_s = str(self.turn_slot_int())
        public_players = [
            {"slot": i, "name": (p.get("name") or f"Player {i + 1}").strip()[:32], "score": round(float(p.get("score", 0) or 0), 4), "strikes": int(p.get("strikes", 0) or 0)}
            for i, p in enumerate(players)
        ]
        return {
            "id": self.id,
            "code": self.code,
            "status": self.status,
            "max_rounds": self.max_rounds,
            "turn_time_limit": self.turn_time_limit,
            "current_round": self.current_round,
            "turn": turn_s,
            "last_word": self.last_word,
            "host_score": round(self.host_score, 4),
            "guest_score": round(self.guest_score, 4),
            "host_strikes": int(self.host_strikes or 0),
            "guest_strikes": int(self.guest_strikes or 0),
            "loser_role": self.loser_role,
            "loser_slot": self.loser_slot_parsed(),
            "end_reason": self.end_reason,
            "word_history": self.get_history(),
            "host_username": self.host_name,
            "guest_username": self.guest_name,
            "players": public_players,
            "player_count": n,
            "max_players": int(self.max_players or 4),
            "my_role": self.slot_to_display_role(slot) if slot is not None else None,
            "my_slot": slot,
            "is_my_turn": role is not None and turn_s == str(role),
            "is_host": is_host,
        }
