import gensim.downloader as api
import json
import numpy as np
import re
import os
import pickle
from difflib import get_close_matches
from sklearn.metrics.pairwise import cosine_similarity

class ModelLoader:
    _instance = None
    _model = None
    _vocab_set = None
    _filtered_vocab_set = None
    _filtered_vocab_list = None
    _filtered_vectors = None  # Dictionary mapping words to vectors
    _vector_matrix = None  # NumPy matrix for vectorized operations
    _word_to_matrix_idx = None  # Mapping from word to matrix row index
    
    # Cache file paths (50D model has its own cache to avoid loading old 100D cache)
    CACHE_DIR = 'model_cache_50d'
    VOCAB_CACHE_FILE = os.path.join(CACHE_DIR, 'filtered_vocab.pkl')
    MATRIX_CACHE_FILE = os.path.join(CACHE_DIR, 'vector_matrix.npy')  # Store as raw matrix
    VECTORS_INDEX_FILE = os.path.join(CACHE_DIR, 'word_to_idx.pkl')

    # Coarse domain buckets used to reduce false triggers like "apple" vs "laptop".
    # If both words fall into the same bucket, we consider them "too close" sooner.
    # If they fall into different buckets, we consider them "far enough" sooner.
    #
    # These are curated starter sets; expand over time based on gameplay.
    DOMAIN_EDIBLE = {
        # Fruits
        "apple", "banana", "orange", "pear", "peach", "plum", "mango", "grape",
        "lemon", "lime", "kiwi", "avocado", "apricot", "cherry",
        "strawberry", "blueberry", "raspberry", "blackberry",
        "watermelon", "melon", "coconut", "fig", "date",

        # Vegetables
        "carrot", "potato", "tomato", "onion", "garlic", "lettuce", "spinach",
        "broccoli", "cauliflower", "cabbage", "cucumber", "pepper",
        "eggplant", "zucchini", "corn", "peas", "bean", "beans", "mushroom",

        # Proteins / meats / fish
        "chicken", "beef", "pork", "lamb", "fish", "salmon", "tuna", "shrimp", "crab",
        "duck", "turkey",

        # Dairy / staples
        "rice", "pasta", "noodles", "bread", "butter", "cheese", "milk", "yogurt", "cream", "egg",

        # Meals / prepared food
        "pizza", "burger", "sandwich", "wrap", "taco", "burrito",
        "soup", "stew", "curry", "chili", "salsa", "guacamole", "salad",

        # Sweets
        "pudding", "cake", "pie", "cookie", "cookies", "chocolate", "candy",
        "sugar", "honey", "jam",

        # Drinks / beverages
        "water", "coffee", "tea", "juice", "soda", "lemonade", "beer", "wine",
        "whiskey", "vodka", "rum", "coke", "sprite", "smoothie", "cocktail",

        # Category words
        "food", "fruit", "vegetable", "drink", "beverage",
    }

    DOMAIN_TECH = {
        "laptop", "computer", "desktop", "notebook", "tablet",
        "phone", "smartphone", "cellphone",
        "keyboard", "mouse",
        "screen", "monitor", "display",
        "processor", "chip", "server", "router", "switch", "modem",
        "internet", "network", "wifi", "ethernet",
        "software", "hardware", "program", "code", "coding", "algorithm",
        "database", "application", "app", "system", "device", "digital", "technology",
    }

    DOMAIN_ANIMAL = {
        "dog", "cat", "horse", "cow", "pig", "sheep", "goat", "bird",
        "fish", "rabbit",
        "tiger", "lion", "bear", "monkey", "fox", "wolf",
        "zebra", "giraffe", "eagle", "hawk", "owl", "snake",
    }

    # Plants, landscape, weather — keeps "tree" vs "laptop" in different buckets
    # (embedding-only fallback was a major source of false "too close" losses).
    DOMAIN_NATURE = {
        "tree", "trees", "oak", "pine", "maple", "cedar", "birch", "willow", "palm", "bamboo",
        "forest", "woods", "jungle", "meadow", "field", "garden",
        "leaf", "leaves", "branch", "branches", "root", "roots", "bark", "trunk",
        "flower", "flowers", "rose", "grass", "moss", "fern", "vine", "plant", "plants", "seed",
        "river", "lake", "ocean", "sea", "stream", "pond", "waterfall", "wave", "tide",
        "mountain", "hill", "valley", "canyon", "cliff", "cave", "island", "beach", "desert",
        "sky", "cloud", "sun", "moon", "star", "wind", "rain", "snow", "storm", "thunder",
        "fire", "ice", "earth", "soil", "sand", "rock", "stone",
    }

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(ModelLoader, cls).__new__(cls)
            cls._instance._load_model()
        return cls._instance

    def _load_model(self):
        """Load GloVe model once, using cache if available"""
        # Check if already loaded
        if self._filtered_vocab_set is not None:
            return
        
        try:
            # Try to load from cache first
            if self._load_from_cache():
                print("Loaded vocabulary and vector matrix from cache!")
                return
            
            # If cache doesn't exist, load from API (50D model for lower memory on 512MB)
            print("Loading GloVe model (50D, lower memory)...")
            self._model = api.load('glove-wiki-gigaword-50')
            self._vocab_set = set(self._model.index_to_key)
            print(f"Model loaded. Vocabulary size: {len(self._vocab_set)}")
            
            # Filter vocabulary (capped for 512MB Render free tier)
            self._filter_vocabulary()
            
            # Build initial matrix from model
            self._build_vector_matrix_from_model()
            
            # Free full model to reduce memory (we only need the matrix now)
            self._model = None
            
            # Save to cache for next time
            self._save_to_cache()

        except Exception as e:
            print(f"An error occurred: {e}")
            raise
    
    def _load_from_cache(self):
        """Load filtered vocabulary and vector matrix from cache files"""
        try:
            if not os.path.exists(self.VOCAB_CACHE_FILE):
                return False
            if not os.path.exists(self.MATRIX_CACHE_FILE):
                return False
            if not os.path.exists(self.VECTORS_INDEX_FILE):
                return False
            
            # Load filtered vocabulary
            with open(self.VOCAB_CACHE_FILE, 'rb') as f:
                self._filtered_vocab_list = pickle.load(f)
                self._filtered_vocab_set = set(self._filtered_vocab_list)
            
            # Load word vectors matrix (fast); ensure float32 for memory
            self._vector_matrix = np.load(self.MATRIX_CACHE_FILE, allow_pickle=False)
            if self._vector_matrix.dtype != np.float32:
                self._vector_matrix = self._vector_matrix.astype(np.float32)
            
            # Load index
            with open(self.VECTORS_INDEX_FILE, 'rb') as f:
                self._word_to_matrix_idx = pickle.load(f)
            
            # Normalize vectors (re-compute or save? fast to compute)
            self._compute_normalized_matrix()

            self._write_glove_subset_json()

            self._model = None  # Don't need full model
            return True
        except Exception as e:
            print(f"Error loading cache: {e}")
            return False
    
    def _save_to_cache(self):
        """Save filtered vocabulary and vector matrix to cache files"""
        try:
            # Create cache directory if it doesn't exist
            os.makedirs(self.CACHE_DIR, exist_ok=True)
            
            # Save filtered vocabulary
            with open(self.VOCAB_CACHE_FILE, 'wb') as f:
                pickle.dump(self._filtered_vocab_list, f)
            
            # Save vector matrix (pure binary, very fast)
            np.save(self.MATRIX_CACHE_FILE, self._vector_matrix)
            
            # Save word to index mapping
            with open(self.VECTORS_INDEX_FILE, 'wb') as f:
                pickle.dump(self._word_to_matrix_idx, f)

            self._write_glove_subset_json()

            print(f"Cache saved! Next load will be much faster.")

        except Exception as e:
            print(f"Error saving cache: {e}")

    def _write_glove_subset_json(self):
        """Single source for vocab.ALLOWED_VOCAB — must match filtered matrix rows."""
        if not self._filtered_vocab_list:
            return
        path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "glove_subset.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump([{"word": w} for w in self._filtered_vocab_list], f)

    def _build_vector_matrix_from_model(self):
        """Build NumPy matrix from Gensim model"""
        if self._filtered_vocab_list is None:
            return
        
        print("Building vector matrix (float32 for memory)...")
        self._word_to_matrix_idx = {word: idx for idx, word in enumerate(self._filtered_vocab_list)}
        # Extract vectors into matrix (float32 halves memory vs float64)
        self._vector_matrix = np.vstack(
            [self._model[word] for word in self._filtered_vocab_list]
        ).astype(np.float32)
        self._compute_normalized_matrix()
        
    def _compute_normalized_matrix(self):
        """Compute normalized matrix for cosine similarity (float32 for memory)."""
        norms = np.linalg.norm(self._vector_matrix, axis=1, keepdims=True)
        norms[norms == 0] = 1
        self._vector_matrix_normalized = (self._vector_matrix / norms).astype(np.float32)
        
    def _build_vector_matrix(self):
        # Legacy stub
        pass

    # Cap vocab size to stay under 512MB on Render free tier (50D × N × 4 bytes × 2 matrices)
    VOCAB_SIZE_LIMIT = 100_000

    def _filter_vocabulary(self):
        """Filter vocabulary to only common, well-known English words (capped for memory)."""
        if self._vocab_set is None:
            return
        
        # Configuration for filtering - relaxed for larger vocabulary
        MAX_WORD_LENGTH = 20  # Allow longer words
        MAX_HYPHENS = 1  # Exclude words with multiple hyphens (compound technical terms)
        
        filtered = []
        
        # URL patterns to exclude
        url_patterns = ['http', 'www', '.com', '.org', '.net', '.edu', '.gov', '://']
        
        # Get vocabulary list (ordered by frequency in GloVe) - only top N to limit memory
        vocab_list = list(self._model.index_to_key)[: self.VOCAB_SIZE_LIMIT]
        
        vocab_to_check = vocab_list
        
        for word in vocab_to_check:
            word_lower = word.lower()
            
            # Minimum length: 3 characters (allow common short words like "dog", "cat", etc.)
            if len(word) < 2:
                continue
            
            # Maximum length: exclude very long words
            if len(word) > MAX_WORD_LENGTH:
                continue
            
            # Exclude purely numeric strings
            if word.isdigit():
                continue
            
            # Exclude words with URL patterns
            if any(pattern in word_lower for pattern in url_patterns):
                continue
            
            # Only allow letters and hyphens (no special characters, numbers mixed in, etc.)
            if not re.match(r'^[a-z-]+$', word_lower):
                continue
            
            # Exclude words that are just numbers with letters (like "123abc")
            if re.search(r'\d', word):
                continue
            
            # Exclude words with too many hyphens (often technical compound terms)
            if word_lower.count('-') > MAX_HYPHENS:
                continue
            
            # Exclude words that start or end with hyphen
            if word_lower.startswith('-') or word_lower.endswith('-'):
                continue
            
            # Exclude words with consecutive hyphens
            if '--' in word_lower:
                continue
            
            # Exclude words that look like abbreviations (all caps or mixed case)
            # Keep only lowercase words (common words are lowercase in GloVe)
            if word != word_lower:
                continue
            
            # Exclude words with unusual letter patterns (e.g., too many consonants/vowels)
            # This helps filter out technical terms and obscure words
            if len(word) >= 8:
                # For longer words, check for unusual patterns
                consonants = sum(1 for c in word_lower if c.isalpha() and c not in 'aeiou')
                vowels = sum(1 for c in word_lower if c in 'aeiou')
                if vowels > 0:
                    consonant_ratio = consonants / (consonants + vowels)
                    # Exclude words with very high consonant ratio (often technical)
                    if consonant_ratio > 0.75:
                        continue
            
            filtered.append(word)
        
        self._filtered_vocab_set = set(filtered)
        self._filtered_vocab_list = filtered
        print(f"Filtered vocabulary size: {len(self._filtered_vocab_set)} (from {len(self._vocab_set)})")
        print(f"Using all valid words (no frequency limit), max length {MAX_WORD_LENGTH}")

    def search_vocab(self, query, limit=10):
        """Search vocabulary for autocomplete"""
        if not query:
            return []
        
        if self._filtered_vocab_set is None:
            return []
        
        matches = [word for word in self._filtered_vocab_set if word.startswith(query)]
        return sorted(matches)[:limit]

    def get_random_common_word(self):
        """Pick a random word from the game vocabulary (same pool as validation)."""
        from vocab import ALLOWED_VOCAB

        pool = list(ALLOWED_VOCAB)
        if not pool:
            return "elsewhere"
        return pool[np.random.randint(0, len(pool))]

    def is_valid_word(self, word):
        from vocab import is_valid_word as _ok

        return _ok(word)

    def get_closest_word(self, word, cutoff=0.5, n=1):
        """
        If word is not in vocab, return the closest vocab word (typos, spelling).
        Uses difflib (stdlib). Returns None if no good match.
        """
        if not word or self._filtered_vocab_list is None:
            return None
        if word in self._filtered_vocab_set:
            return None  # already valid
        matches = get_close_matches(word, self._filtered_vocab_list, n=n, cutoff=cutoff)
        return matches[0] if matches else None

    def _get_vector(self, word):
        """Get word vector"""
        if self._vector_matrix is not None and self._word_to_matrix_idx is not None:
             if word in self._word_to_matrix_idx:
                 idx = self._word_to_matrix_idx[word]
                 return self._vector_matrix[idx]
        
        # Fallback to model if matrix not ready (only during initial load before matrix build)
        if self._model is not None:
            return self._model[word]
            
        raise ValueError("Model/Matrix not loaded")
    
    def calculate_distance(self, word1, word2):
        """Calculate cosine distance between two words"""
        if self._filtered_vocab_set is None:
            return None, None
        if word1 not in self._filtered_vocab_set or word2 not in self._filtered_vocab_set:
            return None, None
        
        vec1 = self._get_vector(word1).reshape(1, -1)
        vec2 = self._get_vector(word2).reshape(1, -1)
        
        similarity = float(cosine_similarity(vec1, vec2)[0][0])
        distance = 1 - similarity
        
        return distance, similarity

    def _normalize_for_domain(self, word: str) -> str:
        w = (word or "").strip().lower()
        if not w:
            return w

        # Very small normalization so common plurals match our curated sets.
        if w.endswith("ies") and len(w) > 4:
            cand = w[:-3] + "y"
            if cand in self.DOMAIN_EDIBLE or cand in self.DOMAIN_NATURE:
                return cand
            return w
        if w.endswith("s") and len(w) > 3:
            cand = w[:-1]
            if cand in self.DOMAIN_EDIBLE or cand in self.DOMAIN_TECH or cand in self.DOMAIN_ANIMAL or cand in self.DOMAIN_NATURE:
                return cand
        return w

    def coarse_domain(self, word: str):
        """
        Return a coarse domain label for gameplay rules.
        If the word is unknown to our buckets, return None to fall back to embeddings-only.
        """
        w = self._normalize_for_domain(word)
        if w in self.DOMAIN_EDIBLE:
            return "edible"
        if w in self.DOMAIN_TECH:
            return "tech"
        if w in self.DOMAIN_ANIMAL:
            return "animal"
        if w in self.DOMAIN_NATURE:
            return "nature"
        return None

    def same_cluster(self, word1: str, word2: str) -> bool:
        """Soft domain grouping for z-score adjustment (both words must map to the same bucket)."""
        d1 = self.coarse_domain(word1)
        d2 = self.coarse_domain(word2)
        return d1 is not None and d2 is not None and d1 == d2

    def get_normalized_vector(self, word: str):
        """Return a copy of the L2-normalized embedding row, or None if unknown."""
        if (
            self._vector_matrix_normalized is None
            or self._word_to_matrix_idx is None
            or word not in self._word_to_matrix_idx
        ):
            return None
        idx = self._word_to_matrix_idx[word]
        return np.asarray(self._vector_matrix_normalized[idx], dtype=np.float64)

    def find_distant_word(self, user_word, num_candidates=100):
        """
        Find a word that is maximally distant from the user's word.
        Uses vectorized operations for speed.
        """
        results = self.find_distant_words_batch(user_word, num_candidates, top_k=1)
        if results:
            return results[0]
        return None, None, None
    
    def find_distant_words_batch(self, user_word, num_candidates=100, top_k=10):
        """
        Find multiple words that are maximally distant from the user's word.
        Uses vectorized NumPy operations for speed.
        Returns list of (word, distance, similarity) tuples sorted by distance descending.
        """
        if self._filtered_vocab_set is None or self._filtered_vocab_list is None:
            return []
        
        if user_word not in self._filtered_vocab_set:
            return []
        
        # Use vectorized approach if matrix is available
        if self._vector_matrix_normalized is not None and self._word_to_matrix_idx is not None:
            return self._find_distant_vectorized(user_word, num_candidates, top_k)
        
        # Fallback to loop-based approach
        return self._find_distant_loop(user_word, num_candidates, top_k)
    def _find_distant_vectorized(self, user_word, num_candidates, top_k):
        """Vectorized implementation using matrix operations"""
        from vocab import ALLOWED_VOCAB

        user_idx = self._word_to_matrix_idx[user_word]
        user_vec_normalized = self._vector_matrix_normalized[user_idx]

        pool = [w for w in ALLOWED_VOCAB if w in self._word_to_matrix_idx and w != user_word]
        if not pool:
            return []

        sample_size = min(num_candidates, len(pool))
        sample_words = np.random.choice(pool, size=sample_size, replace=False)
        sample_indices = np.array(
            [self._word_to_matrix_idx[w] for w in sample_words], dtype=np.intp
        )
        
        candidate_vecs = self._vector_matrix_normalized[sample_indices]
        
        # Compute all similarities at once via dot product (vectors are normalized)
        similarities = candidate_vecs @ user_vec_normalized
        distances = 1 - similarities
        
        # Get top_k most distant
        top_indices = np.argsort(distances)[-top_k:][::-1]  # Sort descending
        
        results = []
        for idx in top_indices:
            word = sample_words[idx]
            results.append((word, float(distances[idx]), float(similarities[idx])))
        
        return results
    
    def _find_distant_loop(self, user_word, num_candidates, top_k):
        """Fallback loop-based implementation"""
        from vocab import ALLOWED_VOCAB

        user_vec = self._get_vector(user_word)

        pool = [w for w in ALLOWED_VOCAB if w in self._word_to_matrix_idx and w != user_word]
        if not pool:
            return []
        sample_size = min(num_candidates, len(pool))
        candidates = np.random.choice(pool, size=sample_size, replace=False)

        results = []
        for candidate in candidates:
            candidate_vec = self._get_vector(candidate)
            similarity = float(cosine_similarity(
                user_vec.reshape(1, -1), 
                candidate_vec.reshape(1, -1)
            )[0][0])
            distance = 1 - similarity
            results.append((candidate, distance, similarity))
        
        # Sort by distance descending and return top_k
        results.sort(key=lambda x: x[1], reverse=True)
        return results[:top_k]
