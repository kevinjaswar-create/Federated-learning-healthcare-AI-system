from typing import Dict, Any, List, Optional, Tuple
import numpy as np
from sklearn.linear_model import LogisticRegression, SGDClassifier
from backend.app.ml.evaluator import compute_metrics

class LinearDiseaseClassifier:
    """
    Parametric Linear Model for Federated Disease Prediction.
    Maintains explicit weight vectors and bias to allow mathematical
    parameter extraction, update transmission, and Federated Averaging.
    """
    def __init__(self, num_features: int = 10, learning_rate: float = 0.05):
        self.num_features = num_features
        self.learning_rate = learning_rate
        # Initialize zero or small random weights
        self.weights = np.zeros(num_features, dtype=float)
        self.bias = 0.0

    def get_parameters(self) -> Dict[str, Any]:
        return {
            "weights": self.weights.tolist(),
            "bias": float(self.bias),
            "num_features": self.num_features
        }

    def set_parameters(self, weights: List[float], bias: float):
        self.weights = np.array(weights, dtype=float)
        self.bias = float(bias)
        self.num_features = len(weights)

    def sigmoid(self, z: np.ndarray) -> np.ndarray:
        return 1.0 / (1.0 + np.exp(-np.clip(z, -25.0, 25.0)))

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        z = np.dot(X, self.weights) + self.bias
        p1 = self.sigmoid(z)
        p0 = 1.0 - p1
        return np.column_stack([p0, p1])

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        probs = self.predict_proba(X)[:, 1]
        return (probs >= threshold).astype(int)

    def fit_local(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_val: Optional[np.ndarray] = None,
        y_val: Optional[np.ndarray] = None,
        epochs: int = 10,
        batch_size: int = 32,
        lr: float = 0.05
    ) -> Dict[str, Any]:
        """
        Runs local gradient descent training on client private data,
        updating weights from the starting model state.
        """
        n_samples = X_train.shape[0]
        n_features = X_train.shape[1]
        
        if len(self.weights) != n_features:
            self.weights = np.zeros(n_features, dtype=float)
            self.bias = 0.0

        w = self.weights.copy()
        b = self.bias

        epoch_losses = []
        indices = np.arange(n_samples)

        for epoch in range(epochs):
            np.random.shuffle(indices)
            epoch_loss = 0.0
            n_batches = 0

            for start_idx in range(0, n_samples, batch_size):
                batch_idx = indices[start_idx:start_idx + batch_size]
                xb = X_train[batch_idx]
                yb = y_train[batch_idx]
                m = len(yb)

                # Forward pass
                z = np.dot(xb, w) + b
                p = self.sigmoid(z)

                # Binary cross entropy loss with L2 regularization
                eps = 1e-12
                batch_loss = -np.mean(yb * np.log(p + eps) + (1 - yb) * np.log(1 - p + eps))
                epoch_loss += batch_loss
                n_batches += 1

                # Backward pass (Gradients)
                dz = (p - yb) / m
                dw = np.dot(xb.T, dz) + 0.001 * w  # L2 regularization
                db = np.sum(dz)

                # Gradient descent step
                w -= lr * dw
                b -= lr * db

            avg_loss = float(epoch_loss / max(1, n_batches))
            epoch_losses.append(round(avg_loss, 4))

        self.weights = w
        self.bias = b

        # Evaluate on local validation set (or training set if no val)
        eval_X = X_val if X_val is not None else X_train
        eval_y = y_val if y_val is not None else y_train
        y_prob = self.predict_proba(eval_X)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)

        metrics = compute_metrics(eval_y, y_pred, y_prob)
        metrics["epoch_losses"] = epoch_losses
        metrics["training_samples"] = n_samples

        return metrics
