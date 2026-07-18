import json
import os
import pickle

_base = os.path.dirname(os.path.abspath(__file__))
_json_path = os.path.join(_base, "data", "glove_subset.json")
_pickle_path = os.path.join(_base, "model_cache_50d", "filtered_vocab.pkl")

if os.path.isfile(_json_path):
    with open(_json_path, encoding="utf-8") as f:
        data = json.load(f)
elif os.path.isfile(_pickle_path):
    with open(_pickle_path, "rb") as f:
        words = pickle.load(f)
    data = [{"word": w} for w in words]
else:
    raise FileNotFoundError(
        f"Need {_json_path} (built on startup) or {_pickle_path} from the embedding cache."
    )

ALLOWED_VOCAB = set(entry["word"] for entry in data)


def is_valid_word(word: str) -> bool:
    return word in ALLOWED_VOCAB
