import numpy as np
import networkx as nx

class LinearAlgebraModel:
    def __init__(self):
        self.themes = {
            "politics": ["government", "election", "power", "law", "nation"],
            "science": ["physics", "math", "theory", "experiment", "proof"],
            "emotion": ["fear", "hope", "anger", "love", "anxiety"],
            "sports": ["game", "team", "win", "loss", "player"]
        }
        self.words = sorted(set(w for group in self.themes.values() for w in group))
        self.word_to_idx = {w: i for i, w in enumerate(self.words)}
        self.idx_to_word = {i: w for w, i in self.word_to_idx.items()}
        self.n = len(self.words)
        self._build_graph()
        self._compute_spectral_embeddings()

    def _build_graph(self):
        G = nx.Graph()
        for w in self.words:
            G.add_node(w)
        
        # Strong intra-theme connections
        for group in self.themes.values():
            for i in group:
                for j in group:
                    if i != j:
                        G.add_edge(i, j, weight=3.0)
        
        # Weak random connections
        rng = np.random.default_rng(42)
        for i in self.words:
            for j in self.words:
                if i != j and rng.random() < 0.05:
                    G.add_edge(i, j, weight=0.5)
        
        self.A = np.zeros((self.n, self.n))
        for i, j, data in G.edges(data=True):
            ii, jj = self.word_to_idx[i], self.word_to_idx[j]
            self.A[ii, jj] += data["weight"]
            self.A[jj, ii] += data["weight"]
            
        # Row-normalize for transition matrix P
        row_sums = self.A.sum(axis=1, keepdims=True)
        # Avoid division by zero if any
        row_sums[row_sums == 0] = 1
        self.P = self.A / row_sums
        
        # Add small self-loops for aperiodicity
        eps = 0.01
        self.P = (1 - eps) * self.P + eps * np.eye(self.n)

    def _compute_spectral_embeddings(self):
        eigvals, eigvecs = np.linalg.eig(self.P.T)
        
        # Sort by magnitude of eigenvalues
        order = np.argsort(-np.abs(eigvals))
        self.eigvals = eigvals[order]
        self.eigvecs = eigvecs[:, order]
        
        # Embeddings (skip trivial 1st eigenvector which corresponds to stationary distribution)
        # We take the next k eigenvectors
        k = 4
        # Use real part (eigenvalues/vectors can be complex due to numerical noise or asymmetry, 
        # though P is similar to symmetric)
        self.Phi = np.real(self.eigvecs[:, 1:k+1])
        
        self.centroids = {}
        for topic, group in self.themes.items():
            indices = [self.word_to_idx[w] for w in group]
            self.centroids[topic] = self.Phi[indices].mean(axis=0)

    def get_vocabulary(self):
        return self.words

    def predict(self, user_words):
        valid = [w for w in user_words if w in self.word_to_idx]
        if not valid:
            return None, {}, []
            
        # 1. User Signature (Mean of embeddings)
        indices = [self.word_to_idx[w] for w in valid]
        signature = self.Phi[indices].mean(axis=0)
        
        # 2. Topic Guess (Distance to Centroids)
        distances = {}
        for topic, c in self.centroids.items():
            distances[topic] = float(np.linalg.norm(signature - c))
            
        best_topic = min(distances, key=distances.get)
        
        # 3. "Autocomplete" / Recommendation (Nearest neighbors in embedding space)
        # Suggest words that are close to the *current signature* but not in the input
        word_dists = []
        for w in self.words:
            if w in valid: continue
            idx = self.word_to_idx[w]
            vec = self.Phi[idx]
            dist = np.linalg.norm(signature - vec)
            word_dists.append((w, dist))
            
        # Sort by distance (smallest is best)
        word_dists.sort(key=lambda x: x[1])
        suggestions = [w for w, d in word_dists[:3]]
        
        return best_topic, distances, suggestions
