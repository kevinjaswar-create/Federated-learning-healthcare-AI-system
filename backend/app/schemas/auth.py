from typing import Optional
from pydantic import BaseModel, EmailStr

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str
    email: str
    hospital_id: Optional[int] = None
    hospital_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "DOCTOR"  # SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR
    hospital_id: Optional[int] = None

class UserOut(BaseModel):
    id: int
    hospital_id: Optional[int]
    hospital_name: Optional[str] = None
    name: str
    email: str
    role: str
    status: str
    created_at: Optional[str] = None

    class Config:
        from_attributes = True
