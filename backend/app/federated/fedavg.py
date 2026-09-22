from typing import List, Dict, Any, Tuple
import numpy as np

def federated_averaging(client_updates: List[Dict[str, Any]]) -> Tuple[List[float], float]:
    """
    Implements Federated Averaging (FedAvg) algorithm:
    W_global = sum_{k=1}^K (n_k / n) * W_k
    b_global = sum_{k=1}^K (n_k / n) * b_k

    Where:
    - K is the number of participating clients in this round
    - n_k is the number of local training samples at client k
    - n is the total number of training samples across all participating clients: n = sum(n_k)
    - W_k is the local model weights vector from client k
    - b_k is the local model bias from client k
    """
    if not client_updates:
        raise ValueError("Cannot perform FedAvg aggregation: No client updates received.")

    total_samples = sum(u["sample_count"] for u in client_updates)
    if total_samples <= 0:
        raise ValueError("Total sample count across participating clients must be greater than zero.")

    first_update = client_updates[0]
    num_features = len(first_update["weights"])

    # Verify dimensional consistency across all client updates
    for idx, update in enumerate(client_updates):
        if len(update["weights"]) != num_features:
            raise ValueError(
                f"Client update {idx} dimension mismatch: expected {num_features}, got {len(update['weights'])}"
            )

    aggregated_weights = np.zeros(num_features, dtype=float)
    aggregated_bias = 0.0

    # Weighted sum according to sample count ratio (n_k / n)
    for update in client_updates:
        weight_k = np.array(update["weights"], dtype=float)
        bias_k = float(update["bias"])
        sample_count_k = update["sample_count"]

        fraction = sample_count_k / total_samples
        aggregated_weights += fraction * weight_k
        aggregated_bias += fraction * bias_k

    return aggregated_weights.tolist(), float(aggregated_bias)
