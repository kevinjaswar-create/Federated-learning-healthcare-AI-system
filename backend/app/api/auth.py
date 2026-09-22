from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta

from backend.app.database.session import get_db
from backend.app.models.entities import User, Hospital, AuditLog
from backend.app.schemas.auth import Token, LoginRequest, UserCreate, UserOut
from backend.app.core.security import verify_password, get_password_hash, create_access_token
from backend.app.core.config import settings
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email.lower()).first()
    if not user or not verify_password(request.password, user.password_hash):
        # Audit failed login attempt
        audit = AuditLog(
            user_id=user.id if user else None,
            action="LOGIN_FAILED",
            resource="AuthService",
            status="FAILURE",
            metadata_json={"attempted_email": request.email}
        )
        db.add(audit)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is deactivated")

    hosp_name = None
    if user.hospital_id:
        hosp = db.query(Hospital).filter(Hospital.id == user.hospital_id).first()
        if hosp:
            hosp_name = hosp.hospital_name

    access_token = create_access_token(
        subject=user.id,
        role=user.role,
        hospital_id=user.hospital_id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    audit = AuditLog(
        user_id=user.id,
        action="LOGIN_SUCCESS",
        resource="AuthService",
        status="SUCCESS",
        metadata_json={"role": user.role, "hospital_id": user.hospital_id}
    )
    db.add(audit)
    db.commit()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "hospital_id": user.hospital_id,
        "hospital_name": hosp_name
    }

@router.post("/register", response_model=UserOut)
def register(request: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == request.email.lower()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    if request.hospital_id:
        hosp = db.query(Hospital).filter(Hospital.id == request.hospital_id).first()
        if not hosp:
            raise HTTPException(status_code=404, detail="Assigned hospital not found")

    user = User(
        name=request.name,
        email=request.email.lower(),
        password_hash=get_password_hash(request.password),
        role=request.role,
        hospital_id=request.hospital_id,
        status="ACTIVE"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    audit = AuditLog(
        user_id=user.id,
        action="USER_REGISTERED",
        resource="AuthService",
        status="SUCCESS",
        metadata_json={"role": user.role, "email": user.email}
    )
    db.add(audit)
    db.commit()

    return UserOut(
        id=user.id,
        hospital_id=user.hospital_id,
        hospital_name=user.hospital.hospital_name if user.hospital else None,
        name=user.name,
        email=user.email,
        role=user.role,
        status=user.status,
        created_at=user.created_at.isoformat() if user.created_at else None
    )

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        hospital_id=current_user.hospital_id,
        hospital_name=current_user.hospital.hospital_name if current_user.hospital else None,
        name=current_user.name,
        email=current_user.email,
        role=current_user.role,
        status=current_user.status,
        created_at=current_user.created_at.isoformat() if current_user.created_at else None
    )
