from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field

class PredictionRequest(BaseModel):
    hospital_id: Optional[int] = None
    model_version: Optional[str] = "global_latest"
    features: Dict[str, float] = Field(
        ...,
        example={
            "age": 58.0,
            "sex": 1.0,
            "chest_pain_type": 2.0,
            "resting_bp": 140.0,
            "cholesterol": 245.0,
            "fasting_blood_sugar": 0.0,
            "resting_ecg": 1.0,
            "max_heart_rate": 150.0,
            "exercise_angina": 0.0,
            "st_depression": 1.2
        }
    )

class PredictionOut(BaseModel):
    id: int
    hospital_id: Optional[int]
    hospital_name: Optional[str] = None
    model_version: str
    prediction_result: str
    confidence: float
    probability_risk: float
    probability_healthy: float
    input_features: Dict[str, Any]
    disclaimer: str
    created_at: datetime

    class Config:
        from_attributes = True

class AuditLogOut(BaseModel):
    id: int
    user_id: Optional[int]
    user_name: Optional[str] = None
    action: str
    resource: str
    status: str
    timestamp: datetime
    metadata_json: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True
