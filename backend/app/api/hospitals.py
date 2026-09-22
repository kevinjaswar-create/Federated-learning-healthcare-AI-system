from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import Hospital, User, Dataset, TrainingRun, AuditLog
from backend.app.schemas.hospital import HospitalCreate, HospitalUpdate, HospitalOut
from backend.app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/hospitals", tags=["Hospital Management"])

@router.get("", response_model=List[HospitalOut])
def get_hospitals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    hospitals = db.query(Hospital).order_by(Hospital.id.asc()).all()
    results = []
    for h in hospitals:
        rec_count = sum(d.record_count for d in h.datasets) if h.datasets else 0
        runs_count = len(h.training_runs) if h.training_runs else 0
        latest_acc = None
        if h.training_runs:
            completed_runs = [r for r in h.training_runs if r.accuracy is not None]
            if completed_runs:
                latest_acc = completed_runs[-1].accuracy
        
        results.append(HospitalOut(
            id=h.id,
            hospital_name=h.hospital_name,
            hospital_code=h.hospital_code,
            location=h.location,
            contact_email=h.contact_email,
            status=h.status,
            created_at=h.created_at,
            record_count=rec_count,
            training_runs_count=runs_count,
            latest_accuracy=latest_acc
        ))
    return results

@router.post("", response_model=HospitalOut)
def create_hospital(
    hospital_in: HospitalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["SUPER_ADMIN"]))
):
    existing = db.query(Hospital).filter(Hospital.hospital_code == hospital_in.hospital_code.upper()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Hospital code already exists")

    new_hosp = Hospital(
        hospital_name=hospital_in.hospital_name,
        hospital_code=hospital_in.hospital_code.upper(),
        location=hospital_in.location,
        contact_email=hospital_in.contact_email,
        status="ACTIVE"
    )
    db.add(new_hosp)
    db.commit()
    db.refresh(new_hosp)

    audit = AuditLog(
        user_id=current_user.id,
        action="HOSPITAL_CREATED",
        resource=f"Hospital {new_hosp.hospital_code}",
        status="SUCCESS",
        metadata_json={"hospital_id": new_hosp.id, "name": new_hosp.hospital_name}
    )
    db.add(audit)
    db.commit()

    return HospitalOut(
        id=new_hosp.id,
        hospital_name=new_hosp.hospital_name,
        hospital_code=new_hosp.hospital_code,
        location=new_hosp.location,
        contact_email=new_hosp.contact_email,
        status=new_hosp.status,
        created_at=new_hosp.created_at,
        record_count=0,
        training_runs_count=0,
        latest_accuracy=None
    )

@router.get("/{id}", response_model=HospitalOut)
def get_hospital(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    h = db.query(Hospital).filter(Hospital.id == id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    rec_count = sum(d.record_count for d in h.datasets) if h.datasets else 0
    runs_count = len(h.training_runs) if h.training_runs else 0
    latest_acc = None
    if h.training_runs:
        completed = [r for r in h.training_runs if r.accuracy is not None]
        if completed:
            latest_acc = completed[-1].accuracy

    return HospitalOut(
        id=h.id,
        hospital_name=h.hospital_name,
        hospital_code=h.hospital_code,
        location=h.location,
        contact_email=h.contact_email,
        status=h.status,
        created_at=h.created_at,
        record_count=rec_count,
        training_runs_count=runs_count,
        latest_accuracy=latest_acc
    )

@router.put("/{id}", response_model=HospitalOut)
def update_hospital(
    id: int,
    update_data: HospitalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["SUPER_ADMIN", "HOSPITAL_ADMIN"]))
):
    h = db.query(Hospital).filter(Hospital.id == id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")

    if current_user.role == "HOSPITAL_ADMIN" and current_user.hospital_id != id:
        raise HTTPException(status_code=403, detail="Unauthorized to modify other hospitals")

    if update_data.hospital_name is not None:
        h.hospital_name = update_data.hospital_name
    if update_data.location is not None:
        h.location = update_data.location
    if update_data.contact_email is not None:
        h.contact_email = update_data.contact_email
    if update_data.status is not None and current_user.role == "SUPER_ADMIN":
        h.status = update_data.status

    db.commit()
    db.refresh(h)

    audit = AuditLog(
        user_id=current_user.id,
        action="HOSPITAL_UPDATED",
        resource=f"Hospital {h.hospital_code}",
        status="SUCCESS",
        metadata_json={"hospital_id": h.id, "new_status": h.status}
    )
    db.add(audit)
    db.commit()

    return HospitalOut(
        id=h.id,
        hospital_name=h.hospital_name,
        hospital_code=h.hospital_code,
        location=h.location,
        contact_email=h.contact_email,
        status=h.status,
        created_at=h.created_at,
        record_count=sum(d.record_count for d in h.datasets) if h.datasets else 0,
        training_runs_count=len(h.training_runs) if h.training_runs else 0,
        latest_accuracy=None
    )

@router.delete("/{id}")
def delete_hospital(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["SUPER_ADMIN"]))
):
    h = db.query(Hospital).filter(Hospital.id == id).first()
    if not h:
        raise HTTPException(status_code=404, detail="Hospital not found")

    db.delete(h)
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        action="HOSPITAL_DELETED",
        resource=f"Hospital ID {id}",
        status="SUCCESS",
        metadata_json={"deleted_id": id}
    )
    db.add(audit)
    db.commit()

    return {"message": f"Hospital {id} removed successfully"}
