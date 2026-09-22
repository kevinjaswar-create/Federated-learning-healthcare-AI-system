from typing import Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class LocalTrainingRequest(BaseModel):
    hospital_id: int
    epochs: int = 5
    learning_rate: float = 0.01
    batch_size: int = 32
    model_type: str = "LogisticRegression"

class TrainingRunOut(BaseModel):
    id: int
    hospital_id: int
    hospital_name: Optional[str] = None
    round_number: Optional[int] = None
    model_version: str
    training_samples: int
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    loss: Optional[float] = None
    status: str
    metrics_json: Optional[Dict[str, Any]] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
