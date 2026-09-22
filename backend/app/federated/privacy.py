from typing import List, Tuple, Dict, Any
import numpy as np

class DifferentialPrivacyMechanism:
    """
    Local Differential Privacy (LDP) mechanism applied to model updates
    prior to transmission to the central coordinator.
    
    1. Norm Clipping: Prevents individual extreme updates from dominating the aggregation
       by bounding the L2-norm of the weight update delta: ||Delta W||_2 <= C.
    2. Gaussian Noise Addition: Adds calibrated Gaussian noise scaled by (C * sigma) / sqrt(n),
       where sigma depends on privacy parameter epsilon and delta.
    """
    def __init__(self, epsilon: float = 1.5, clip_norm: float = 1.0, delta: float = 1e-5):
        self.epsilon = epsilon
        self.clip_norm = clip_norm
        self.delta = delta

    def apply_differential_privacy(
        self,
        local_weights: List[float],
        local_bias: float,
        global_weights: List[float],
        global_bias: float,
        n_samples: int
    ) -> Tuple[List[float], float, Dict[str, Any]]:
        w_local = np.array(local_weights, dtype=float)
        w_global = np.array(global_weights, dtype=float)
        delta_w = w_local - w_global
        delta_b = local_bias - global_bias

        # 1. Gradient/Update Clipping
        l2_norm = np.linalg.norm(delta_w)
        if l2_norm > self.clip_norm and l2_norm > 0:
            scale_factor = self.clip_norm / l2_norm
            delta_w = delta_w * scale_factor
            delta_b = delta_b * scale_factor
            clipped = True
        else:
            clipped = False

        # 2. Gaussian Noise Calibration
        # Standard deviation for (epsilon, delta)-DP: sigma = sqrt(2 * ln(1.25 / delta)) / epsilon
        sigma = np.sqrt(2 * np.log(1.25 / self.delta)) / max(0.1, self.epsilon)
        effective_noise_scale = (self.clip_norm * sigma) / np.sqrt(max(1, n_samples))

        noise_w = np.random.normal(0, effective_noise_scale, size=delta_w.shape)
        noise_b = np.random.normal(0, effective_noise_scale)

        private_w = w_global + delta_w + noise_w
        private_b = global_bias + delta_b + noise_b

        metadata = {
            "dp_applied": True,
            "epsilon": self.epsilon,
            "clip_norm": self.clip_norm,
            "delta": self.delta,
            "noise_std": float(effective_noise_scale),
            "clipped": clipped,
            "original_l2_norm": float(l2_norm)
        }

        return private_w.tolist(), float(private_b), metadata
