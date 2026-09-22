from typing import List, Dict, Any
from pydantic import BaseModel

class FeatureSpec(BaseModel):
    name: str
    display_name: str
    dtype: str  # numeric, categorical
    min_val: float
    max_val: float
    default_val: float
    unit: str
    description: str

class DatasetConfig(BaseModel):
    dataset_name: str
    disease_target: str
    target_column: str
    target_positive_label: str = "Cardiovascular Disease Risk Detected"
    target_negative_label: str = "Low Risk / Healthy Profile"
    feature_columns: List[str]
    features: List[FeatureSpec]

# Benchmark dataset: Cardiovascular Risk / Heart Disease Prediction
# Features based on standard clinical parameters (Cleveland / Framingham)
DEFAULT_HEART_DISEASE_CONFIG = DatasetConfig(
    dataset_name="Multi-Hospital Cardiovascular Cohort Benchmark",
    disease_target="Cardiovascular Disease",
    target_column="target",
    target_positive_label="Positive Risk (High Cardiac Event Probability)",
    target_negative_label="Negative Risk (Normal / Low Cardiac Event Risk)",
    feature_columns=[
        "age",
        "sex",
        "chest_pain_type",
        "resting_bp",
        "cholesterol",
        "fasting_blood_sugar",
        "resting_ecg",
        "max_heart_rate",
        "exercise_angina",
        "st_depression"
    ],
    features=[
        FeatureSpec(name="age", display_name="Age", dtype="numeric", min_val=20.0, max_val=90.0, default_val=55.0, unit="years", description="Patient age in years"),
        FeatureSpec(name="sex", display_name="Sex", dtype="categorical", min_val=0.0, max_val=1.0, default_val=1.0, unit="0=Female, 1=Male", description="Biological sex"),
        FeatureSpec(name="chest_pain_type", display_name="Chest Pain Type", dtype="categorical", min_val=0.0, max_val=3.0, default_val=1.0, unit="0-3 severity", description="0: Typical, 1: Atypical, 2: Non-anginal, 3: Asymptomatic"),
        FeatureSpec(name="resting_bp", display_name="Resting Blood Pressure", dtype="numeric", min_val=80.0, max_val=210.0, default_val=130.0, unit="mm Hg", description="Resting systolic blood pressure"),
        FeatureSpec(name="cholesterol", display_name="Serum Cholesterol", dtype="numeric", min_val=100.0, max_val=450.0, default_val=230.0, unit="mg/dl", description="Serum cholesterol level"),
        FeatureSpec(name="fasting_blood_sugar", display_name="Fasting Blood Sugar > 120", dtype="categorical", min_val=0.0, max_val=1.0, default_val=0.0, unit="0=No, 1=Yes", description="Fasting blood sugar exceeding 120 mg/dl"),
        FeatureSpec(name="resting_ecg", display_name="Resting ECG Results", dtype="categorical", min_val=0.0, max_val=2.0, default_val=1.0, unit="0-2 class", description="0: Normal, 1: ST-T wave abnormality, 2: Left ventricular hypertrophy"),
        FeatureSpec(name="max_heart_rate", display_name="Maximum Heart Rate Achieved", dtype="numeric", min_val=60.0, max_val=220.0, default_val=150.0, unit="bpm", description="Maximum heart rate achieved during stress test"),
        FeatureSpec(name="exercise_angina", display_name="Exercise Induced Angina", dtype="categorical", min_val=0.0, max_val=1.0, default_val=0.0, unit="0=No, 1=Yes", description="Exercise-induced chest tightness or pain"),
        FeatureSpec(name="st_depression", display_name="ST Depression (ECG)", dtype="numeric", min_val=0.0, max_val=6.2, default_val=1.0, unit="mm", description="ST depression induced by exercise relative to rest")
    ]
)
