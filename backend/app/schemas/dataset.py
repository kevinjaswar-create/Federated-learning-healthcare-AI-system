from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel

class DatasetOut(BaseModel):
    id: int
    hospital_id: int
    hospital_name: Optional[str] = None
    dataset_name: str
    record_count: int
    feature_count: int
    status: str
    schema_info: Optional[Dict[str, Any]] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True

class DatasetValidationResult(BaseModel):
    is_valid: bool
    record_count: int
    feature_count: int
    features: List[str]
    missing_values_count: int
    class_distribution: Dict[str, int]
    data_types: Dict[str, str]
    message: str
