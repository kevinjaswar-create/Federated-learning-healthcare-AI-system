from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, EmailStr

class HospitalBase(BaseModel):
    hospital_name: str
    hospital_code: str
    location: str
    contact_email: EmailStr

class HospitalCreate(HospitalBase):
    pass

class HospitalUpdate(BaseModel):
    hospital_name: Optional[str] = None
    location: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    status: Optional[str] = None

class HospitalOut(HospitalBase):
    id: int
    status: str
    created_at: datetime
    record_count: Optional[int] = 0
    training_runs_count: Optional[int] = 0
    latest_accuracy: Optional[float] = None

    class Config:
        from_attributes = True
