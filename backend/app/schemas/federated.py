from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel

class FederatedStartRequest(BaseModel):
    rounds: int = 3
    selected_hospital_ids: Optional[List[int]] = None
    local_epochs: int = 3
    learning_rate: float = 0.05
    apply_dp: bool = False
    dp_epsilon: float = 1.5

class ClientRoundStatus(BaseModel):
    hospital_id: int
    hospital_name: str
    status: str  # WAITING, TRAINING, COMPLETED, FAILED
    sample_count: int
    local_accuracy: Optional[float] = None
    local_f1: Optional[float] = None
    loss: Optional[float] = None
    update_checksum: Optional[str] = None

class FederatedRoundOut(BaseModel):
    id: int
    round_number: int
    participating_hospitals: List[int]
    completed_hospitals: List[int]
    failed_hospitals: List[int]
    global_model_version: str
    aggregation_method: str
    status: str
    global_metrics: Optional[Dict[str, Any]] = None
    client_statuses: Optional[List[ClientRoundStatus]] = None
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ModelRecordOut(BaseModel):
    id: int
    model_name: str
    model_version: str
    model_type: str
    accuracy: Optional[float] = None
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    parameters_summary: Optional[Dict[str, Any]] = None
    is_active: bool
    status: str
    created_at: datetime

    class Config:
        from_attributes = True
