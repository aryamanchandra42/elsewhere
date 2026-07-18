"""
Move evaluation: cosine distance + z-score from semantic_stats (synonym band + thresholds).
"""
from __future__ import annotations

import math
import os
import threading
from collections import OrderedDict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from semantic_stats import get_stats


def map_score(z: float) -> float:
    """Display-only mapping to a bounded scale (~25–75)."""
    return 50.0 + 25.0 * math.tanh(z)


def evaluate_move_decision(
    prev_word: str,
    new_word: str,
    distance: float,
    same_cluster: bool,
    move_number: Optional[int] = None,
) -> Dict[str, Any]:
    stats = get_stats(prev_word)
    mu = float(stats["mean"])
    sigma = max(float(stats["std"]), 0.05)

    z = (distance - mu) / sigma

    if same_cluster:
        z -= 0.5

    if move_number == 2:
        z -= 0.2

    if os.environ.get("SEMANTIC_SCORE_DEBUG", "").lower() in ("1", "true", "yes"):
        print(
            {
                "prev": prev_word,
                "new": new_word,
                "distance": distance,
                "mu": mu,
                "sigma": sigma,
                "z": z,
            },
            flush=True,
        )

    # In this embedding setup, cosine "distance" is typically around ~0.8–1.1
    # for random pairs, while near/related pairs can dip into the ~0.6 range.
    # The previous fixed threshold (0.30) was effectively unreachable, causing
    # "too_close" to rarely (or never) trigger.
    too_close_distance = float(os.environ.get("SEMANTIC_TOO_CLOSE_DISTANCE", "0.65"))
    if distance <= too_close_distance:
        return {"result": "LOSE", "reason": "synonym", "z": z, "cosine_distance": distance}

    if z < -0.5:
        return {"result": "LOSE", "z": z, "cosine_distance": distance}

    if z > 1.2:
        return {"result": "STRONG", "z": z, "cosine_distance": distance}

    return {"result": "CONTINUE", "z": z, "cosine_distance": distance}


def evaluate_move(
    loader: Any,
    prev_word: str,
    new_word: str,
    history: Optional[List[str]] = None,
    word_stats: Any = None,
    move_number: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Embedding lookup + decision. `history` / `word_stats` kept for call-site compatibility.
    """
    _ = word_stats
    _ = word_stats
    # Compare the candidate word against the recent context window, not only
    # the immediate anchor. This makes "2-3 moves ago counts" work.
    context_window = int(os.environ.get("SEMANTIC_CONTEXT_WINDOW", "3"))
    history_words = history or []
    tail = history_words[-max(0, context_window - 1):] if history_words else []

    anchors = [prev_word, *tail]
    # De-dup while preserving order (handles cases where prev_word already
    # appears in history).
    seen = set()
    anchors = [a for a in anchors if a and not (a in seen or seen.add(a))]

    w = loader.get_normalized_vector(new_word)
    if w is None:
        return {"result": "INVALID"}

    decisions = []
    for anchor in anchors:
        v = loader.get_normalized_vector(anchor)
        if v is None:
            continue
        distance = float(1.0 - np.dot(v, w))
        same_cluster = loader.same_cluster(anchor, new_word)
        ev = evaluate_move_decision(
            anchor, new_word, distance, same_cluster, move_number=move_number
        )
        ev["anchor_word"] = anchor
        decisions.append(ev)

    if not decisions:
        return {"result": "INVALID"}

    lose = [d for d in decisions if d.get("result") == "LOSE"]
    if lose:
        # Pick the "closest / riskiest" LOSE outcome.
        best = min(
            lose,
            key=lambda d: (
                0 if d.get("reason") == "synonym" else 1,
                float(d.get("z", 1e9)),
                float(d.get("cosine_distance", 1e9)),
            ),
        )
        best["z"] = float(best.get("z", 0.0))
        best["cosine_distance"] = float(best.get("cosine_distance", 0.0))
        return best

    strong = [d for d in decisions if d.get("result") == "STRONG"]
    if strong:
        best = max(strong, key=lambda d: float(d.get("z", -1e9)))
        best["z"] = float(best.get("z", 0.0))
        best["cosine_distance"] = float(best.get("cosine_distance", 0.0))
        return best

    # CONTINUE: choose the best (safest / furthest) outcome for scoring.
    best = max(decisions, key=lambda d: float(d.get("z", -1e9)))
    best["z"] = float(best.get("z", 0.0))
    best["cosine_distance"] = float(best.get("cosine_distance", 0.0))
    best["result"] = best.get("result", "CONTINUE")
    return best


def _eval_cache_key(
    prev_word: str,
    new_word: str,
    history: Optional[List[str]],
    move_number: Optional[int],
) -> Tuple[str, str, Tuple[str, ...], Optional[int]]:
    """Key aligned with evaluate_move's use of history (context tail only)."""
    context_window = int(os.environ.get("SEMANTIC_CONTEXT_WINDOW", "3"))
    history_words = history or []
    n_tail = max(0, context_window - 1)
    tail = tuple(history_words[-n_tail:])
    return (prev_word, new_word, tail, move_number)


class _MoveEvalCache:
    def __init__(self, maxsize: int) -> None:
        self._max = maxsize
        self._od: "OrderedDict[Any, Dict[str, Any]]" = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: Tuple[str, str, Tuple[str, ...], Optional[int]]) -> Optional[Dict[str, Any]]:
        with self._lock:
            if key not in self._od:
                return None
            self._od.move_to_end(key)
            return self._od[key]

    def set(self, key: Tuple[str, str, Tuple[str, ...], Optional[int]], val: Dict[str, Any]) -> None:
        with self._lock:
            if key in self._od:
                self._od.move_to_end(key)
            self._od[key] = val
            while len(self._od) > self._max:
                self._od.popitem(last=False)


_move_eval_cache = _MoveEvalCache(
    maxsize=max(1024, int(os.environ.get("EVAL_MOVE_CACHE_SIZE", "65536")))
)


def evaluate_move_cached(
    loader: Any,
    prev_word: str,
    new_word: str,
    history: Optional[List[str]] = None,
    word_stats: Any = None,
    move_number: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Same as evaluate_move with an in-process LRU cache (hot paths: AI + hints).
    Returns a fresh dict so callers cannot mutate cached entries.
    """
    _ = word_stats
    key = _eval_cache_key(prev_word, new_word, history, move_number)
    hit = _move_eval_cache.get(key)
    if hit is not None:
        return dict(hit)
    out = evaluate_move(loader, prev_word, new_word, history, word_stats, move_number)
    _move_eval_cache.set(key, dict(out))
    return dict(out)
