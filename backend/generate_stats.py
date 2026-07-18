"""
One-time (or periodic) build of data/word_stats.json: mean/std of cosine distances
from each word to a random sample of other vocabulary words.

  python generate_stats.py

Optional: STATS_MAX_WORDS (default 3000) limits how many anchor words to process.
"""
import json
import os
import random

from model_loader import ModelLoader

SAMPLE_SIZE = 500
MAX_WORDS = int(os.environ.get("STATS_MAX_WORDS", "3000"))


def cosine_distance(loader: ModelLoader, w1: str, w2: str):
    d, _sim = loader.calculate_distance(w1, w2)
    return d


def main():
    random.seed(42)
    loader = ModelLoader()
    vocab = list(loader._filtered_vocab_list or [])
    if not vocab:
        print("No vocabulary loaded.")
        return

    if len(vocab) > MAX_WORDS:
        vocab = random.sample(vocab, MAX_WORDS)

    stats = {}
    n = len(vocab)
    for i, word in enumerate(vocab):
        if i % 200 == 0:
            print(f"{i}/{n} ...")

        others = [w for w in vocab if w != word]
        if len(others) < SAMPLE_SIZE:
            sample = others
        else:
            sample = random.sample(others, SAMPLE_SIZE)

        distances = []
        for w2 in sample:
            d = cosine_distance(loader, word, w2)
            if d is not None:
                distances.append(d)

        if not distances:
            continue

        mean = sum(distances) / len(distances)
        var = sum((x - mean) ** 2 for x in distances) / len(distances)
        std = var ** 0.5
        stats[word] = {"mean": mean, "std": std}

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "word_stats.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(stats, f)
    print(f"Wrote {len(stats)} entries to {out_path}")


if __name__ == "__main__":
    main()
