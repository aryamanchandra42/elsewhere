"""Precomputed per-anchor distance statistics for z-scoring."""
import json
import os

_base = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_PATH = os.path.join(_base, "data", "word_stats.json")

try:
    with open(_DEFAULT_PATH, encoding="utf-8") as f:
        WORD_STATS = json.load(f)
    if not isinstance(WORD_STATS, dict):
        WORD_STATS = {}
except (OSError, json.JSONDecodeError):
    WORD_STATS = {}


def get_stats(word: str):
    return WORD_STATS.get(word, {"mean": 0.5, "std": 0.1})
