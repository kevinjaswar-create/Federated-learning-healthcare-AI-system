import io
from typing import Tuple, Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG, DatasetConfig

class DataPreprocessor:
    def __init__(self, config: DatasetConfig = DEFAULT_HEART_DISEASE_CONFIG):
        self.config = config
        self.scaler = StandardScaler()
        self.is_fitted = False
        self.feature_means = {}
        self.feature_stds = {}

    def validate_csv(self, file_content: bytes) -> Dict[str, Any]:
        """Validates CSV format, columns, missing values, and data types."""
        try:
            df = pd.read_csv(io.BytesIO(file_content))
        except Exception as e:
            return {
                "is_valid": False,
                "record_count": 0,
                "feature_count": 0,
                "features": [],
                "missing_values_count": 0,
                "class_distribution": {},
                "data_types": {},
                "message": f"Malformed CSV file: {str(e)}"
            }

        missing_required = [col for col in self.config.feature_columns if col not in df.columns]
        target_col = self.config.target_column
        has_target = target_col in df.columns

        total_missing = int(df.isnull().sum().sum())
        dtypes = {col: str(dtype) for col, dtype in df.dtypes.items()}

        class_dist = {}
        if has_target:
            class_counts = df[target_col].value_counts().to_dict()
            class_dist = {str(k): int(v) for k, v in class_counts.items()}

        if missing_required:
            return {
                "is_valid": False,
                "record_count": len(df),
                "feature_count": len(df.columns),
                "features": list(df.columns),
                "missing_values_count": total_missing,
                "class_distribution": class_dist,
                "data_types": dtypes,
                "message": f"Missing required feature columns: {', '.join(missing_required)}"
            }

        return {
            "is_valid": True,
            "record_count": len(df),
            "feature_count": len(self.config.feature_columns),
            "features": self.config.feature_columns,
            "missing_values_count": total_missing,
            "class_distribution": class_dist,
            "data_types": dtypes,
            "message": "Dataset structure and schema verified successfully."
        }

    def prepare_data(self, df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """Cleans, imputes missing values, scales features, and performs train-test split."""
        X_df = df[self.config.feature_columns].copy()
        
        # Impute missing values with column median
        for col in self.config.feature_columns:
            if X_df[col].isnull().any():
                median_val = X_df[col].median()
                X_df[col].fillna(median_val, inplace=True)

        y = df[self.config.target_column].values.astype(int)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X_df.values, y, test_size=test_size, random_state=random_state, stratify=y if len(np.unique(y)) > 1 else None
        )

        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        self.is_fitted = True

        for idx, col in enumerate(self.config.feature_columns):
            self.feature_means[col] = float(self.scaler.mean_[idx])
            self.feature_stds[col] = float(self.scaler.scale_[idx])

        return X_train_scaled, X_test_scaled, y_train, y_test

    def transform_single_record(self, record: Dict[str, float]) -> np.ndarray:
        """Transforms a single feature dictionary for prediction."""
        raw_vector = []
        for col in self.config.feature_columns:
            val = float(record.get(col, 0.0))
            raw_vector.append(val)
        
        arr = np.array([raw_vector], dtype=float)
        if self.is_fitted:
            return self.scaler.transform(arr)
        else:
            # Fallback to standard baseline normalization if scaler not fitted
            normalized = []
            for idx, col in enumerate(self.config.feature_columns):
                mean = self.feature_means.get(col, 0.0)
                std = self.feature_stds.get(col, 1.0) or 1.0
                normalized.append((raw_vector[idx] - mean) / std)
            return np.array([normalized], dtype=float)
