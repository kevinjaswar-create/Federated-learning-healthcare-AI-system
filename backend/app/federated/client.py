import os
from typing import Dict, Any, Optional, Tuple
import pandas as pd
import numpy as np

from backend.app.core.config import settings
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG, DatasetConfig
from backend.app.ml.preprocessor import DataPreprocessor
from backend.app.ml.models import LinearDiseaseClassifier
from backend.app.federated.privacy import DifferentialPrivacyMechanism
from backend.app.federated.serializer import compute_update_checksum

class HospitalFLClient:
    """
    Simulated Hospital Federated Learning Client.
    Holds local private dataset, performs local preprocessing and training,
    and returns protected model updates.
    """
    def __init__(self, hospital_id: int, hospital_name: str, data_dir: Optional[str] = None):
        self.hospital_id = hospital_id
        self.hospital_name = hospital_name
        self.data_dir = data_dir or os.path.join(settings.DATA_DIR, f"hospital_{hospital_id}")
        self.dataset_path = os.path.join(self.data_dir, "dataset.csv")
        self.config = DEFAULT_HEART_DISEASE_CONFIG
        self.preprocessor = DataPreprocessor(self.config)
        self.model = LinearDiseaseClassifier(num_features=len(self.config.feature_columns))
        
        self.X_train: Optional[np.ndarray] = None
        self.X_val: Optional[np.ndarray] = None
        self.y_train: Optional[np.ndarray] = None
        self.y_val: Optional[np.ndarray] = None
        self.is_data_loaded = False

    def load_local_data(self) -> bool:
        """Loads private dataset strictly from the hospital client local directory."""
        if not os.path.exists(self.dataset_path):
            return False
        
        df = pd.read_csv(self.dataset_path)
        self.X_train, self.X_val, self.y_train, self.y_val = self.preprocessor.prepare_data(df)
        self.is_data_loaded = True
        return True

    def train_local_epoch(
        self,
        global_weights: list,
        global_bias: float,
        epochs: int = 5,
        learning_rate: float = 0.05,
        batch_size: int = 32,
        apply_dp: bool = False,
        dp_epsilon: float = 1.5
    ) -> Dict[str, Any]:
        """
        Initializes local model with global parameters,
        trains locally on private patient dataset,
        and returns model update.
        """
        if not self.is_data_loaded:
            success = self.load_local_data()
            if not success:
                raise FileNotFoundError(f"Hospital {self.hospital_id} dataset not found at {self.dataset_path}")

        # Set local model parameters to current global model
        self.model.set_parameters(global_weights, global_bias)

        # Train local model
        metrics = self.model.fit_local(
            X_train=self.X_train,
            y_train=self.y_train,
            X_val=self.X_val,
            y_val=self.y_val,
            epochs=epochs,
            batch_size=batch_size,
            lr=learning_rate
        )

        raw_params = self.model.get_parameters()
        local_weights = raw_params["weights"]
        local_bias = raw_params["bias"]
        n_samples = len(self.X_train)

        dp_info = {"dp_applied": False}
        if apply_dp:
            dp_mech = DifferentialPrivacyMechanism(epsilon=dp_epsilon, clip_norm=1.0)
            local_weights, local_bias, dp_info = dp_mech.apply_differential_privacy(
                local_weights=local_weights,
                local_bias=local_bias,
                global_weights=global_weights,
                global_bias=global_bias,
                n_samples=n_samples
            )

        update_payload = {
            "hospital_id": self.hospital_id,
            "hospital_name": self.hospital_name,
            "sample_count": n_samples,
            "weights": local_weights,
            "bias": local_bias,
            "metrics": metrics,
            "dp_info": dp_info
        }

        checksum = compute_update_checksum(update_payload)
        update_payload["checksum"] = checksum
        return update_payload
