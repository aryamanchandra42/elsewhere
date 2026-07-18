import numpy as np
import gensim.downloader as api

# -----------------------------
# CONFIG
# -----------------------------

MIN_WORDS = 3
TOP_K = 7
MAX_VOCAB = 50000   # limits memory usage

# -----------------------------
# LOAD WORD VECTORS
# -----------------------------

def load_model():
    print("Loading word vectors (this may take a moment on first run)...")
    model = api.load("glove-wiki-gigaword-100")  # 100D vectors
    vocab = list(model.index_to_key)[:MAX_VOCAB]
    word_set = set(vocab)
    print(f"Ready! Vocabulary: {len(vocab)} words.\n")
    return model, vocab, word_set


# -----------------------------
# CORE FUNCTIONS
# -----------------------------

def print_welcome():
    print("=" * 50)
    print("  Word Guesser — \"What are you thinking of?\"")
    print("=" * 50)
    print("\nEnter 3 or more words that describe something you're")
    print("thinking of (e.g. dog, furry, bark, pet).")
    print("The app will guess related words.\n")


def get_user_words(word_set):
    while True:
        raw = input("Your words (comma-separated): ").strip()
        if not raw:
            print("  → Please type at least one word.\n")
            continue
        if raw.lower() in ("quit", "q", "exit"):
            return None

        words = [w.strip().lower() for w in raw.split(",")]
        words = [w for w in words if w]

        unknown = [w for w in words if w not in word_set]
        known = [w for w in words if w in word_set]

        if unknown:
            print(f"  → Skipped (not in dictionary): {', '.join(unknown)}")
        if known:
            print(f"  → Using: {', '.join(known)}\n")
        words = known
        if len(words) >= MIN_WORDS:
            return words
        print(f"  → Need at least {MIN_WORDS} valid words. You have {len(words)}.\n")


def average_vector(words):
    vectors = [model[w] for w in words]
    return np.mean(vectors, axis=0)


def cosine_distance(a, b):
    return 1 - np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))


def guess_words(user_vector, exclude_words):
    distances = []

    for word in vocab:
        if word in exclude_words:
            continue
        d = cosine_distance(user_vector, model[word])
        distances.append((word, d))

    distances.sort(key=lambda x: x[1])
    return distances[:TOP_K]


def compute_confidence(distances):
    dists = np.array([d for _, d in distances])
    scores = 1 / (dists + 1e-6)
    scores = scores / scores.sum()
    return scores


# -----------------------------
# MAIN LOOP
# -----------------------------

def run_one_round(model, vocab, word_set):
    words = get_user_words(word_set)
    if words is None:
        return False

    user_vector = average_vector(words)
    guesses = guess_words(user_vector, words)
    confidences = compute_confidence(guesses)

    print("\nYou might be thinking of:\n")
    for i, ((word, _), conf) in enumerate(zip(guesses, confidences), 1):
        print(f"  {i}. {word:<15} {conf * 100:.1f}%")

    spread = np.mean([d for _, d in guesses])
    if spread < 0.25:
        level = "high"
    elif spread < 0.4:
        level = "medium"
    else:
        level = "low"
    print(f"\nOverall confidence: {level}")
    return True


def main():
    global model, vocab
    try:
        model, vocab, word_set = load_model()
    except Exception as e:
        print(f"Could not load word vectors: {e}")
        print("Check your internet connection and try again.")
        return

    print_welcome()

    while True:
        if not run_one_round(model, vocab, word_set):
            print("\nBye!")
            break
        again = input("\nTry again? (y/n): ").strip().lower()
        if again not in ("y", "yes"):
            print("Bye!")
            break
        print()


if __name__ == "__main__":
    main()
