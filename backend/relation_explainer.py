"""
Word-pair strike explanations using rule-based classification + GloVe distance.
No external API calls — everything is derived from the embedding data already computed.
"""

from __future__ import annotations

import logging

_log = logging.getLogger(__name__)

CACHE: dict = {}

# Explanation templates — {w1}, {w2}, {dist} are substituted at runtime.
TEMPLATES = {
    "synonym": (
        '"{w1}" and "{w2}" have nearly identical meanings (similarity distance: {dist:.3f}). '
        "They appear in almost identical contexts, making the jump too small."
    ),
    "antonym": (
        '"{w1}" and "{w2}" are opposites (similarity distance: {dist:.3f}). '
        "Antonyms are semantically tethered — the model sees them as closely related by design."
    ),
    "same_domain": (
        '"{w1}" and "{w2}" belong to the same conceptual domain (similarity distance: {dist:.3f}). '
        "They are frequently grouped together in language and share many contextual neighbours."
    ),
    "functional": (
        '"{w1}" and "{w2}" often appear in similar contexts (similarity distance: {dist:.3f}). '
        "Their shared usage patterns make them closer than they might seem."
    ),
    "unrelated": (
        '"{w1}" and "{w2}" occupy overlapping semantic space (similarity distance: {dist:.3f}). '
        "Despite appearing unrelated, the embedding model found them too close to score a valid jump."
    ),
}

# Curated antonym pairs (both lowercased).
_ANTONYM_PAIRS: frozenset[frozenset[str]] = frozenset(
    frozenset(pair)
    for pair in (
        ("hot", "cold"), ("big", "small"), ("large", "small"), ("tall", "short"),
        ("wide", "narrow"), ("thick", "thin"), ("heavy", "light"), ("fast", "slow"),
        ("early", "late"), ("high", "low"), ("up", "down"), ("in", "out"),
        ("inside", "outside"), ("yes", "no"), ("good", "bad"), ("love", "hate"),
        ("war", "peace"), ("light", "dark"), ("day", "night"), ("happy", "sad"),
        ("full", "empty"), ("wet", "dry"), ("hard", "soft"), ("rough", "smooth"),
        ("loud", "quiet"), ("young", "old"), ("new", "old"), ("begin", "end"),
        ("start", "finish"), ("win", "lose"), ("give", "take"), ("buy", "sell"),
        ("north", "south"), ("east", "west"), ("man", "woman"), ("boy", "girl"),
        ("heaven", "hell"), ("truth", "lie"), ("alive", "dead"),
    )
)

_loader = None


def _get_loader():
    global _loader
    if _loader is None:
        from model_loader import ModelLoader
        _loader = ModelLoader()
    return _loader


def get_distance(w1: str, w2: str, loader=None) -> float:
    ld = loader or _get_loader()
    d, _sim = ld.calculate_distance(w1, w2)
    return float(d) if d is not None else 1.0


def same_cluster(w1: str, w2: str, loader=None) -> bool:
    ld = loader or _get_loader()
    return ld.same_cluster(w1, w2)


def check_antonym(w1: str, w2: str) -> bool:
    a, b = w1.strip().lower(), w2.strip().lower()
    if not a or not b or a == b:
        return False
    return frozenset((a, b)) in _ANTONYM_PAIRS


def classify_relation(distance: float, cluster_same: bool, is_antonym: bool) -> str:
    d = float(distance)
    if d <= 0.30:
        return "synonym"
    if is_antonym:
        return "antonym"
    if cluster_same:
        return "same_domain"
    if d < 0.55:
        return "functional"
    return "unrelated"


def explain_relation(w1: str, w2: str) -> dict:
    """
    Returns:
    {
      "relation": str,
      "explanation": str,
      "source": "rule"
    }
    """
    a = (w1 or "").strip().lower()
    b = (w2 or "").strip().lower()
    if not a or not b:
        return {
            "relation": "unrelated",
            "explanation": TEMPLATES["unrelated"].format(w1=a or "—", w2=b or "—", dist=1.0),
            "source": "rule",
        }

    key = tuple(sorted((a, b)))
    if key in CACHE:
        return dict(CACHE[key])

    loader = _get_loader()
    distance = get_distance(a, b, loader)
    cluster_same = same_cluster(a, b, loader)
    is_antonym = check_antonym(a, b)

    relation = classify_relation(distance, cluster_same, is_antonym)
    explanation = TEMPLATES[relation].format(w1=a, w2=b, dist=distance)

    result = {"relation": relation, "explanation": explanation, "source": "rule"}
    CACHE[key] = dict(result)
    return dict(result)
