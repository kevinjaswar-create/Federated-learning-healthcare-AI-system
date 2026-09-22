from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import TrainingRun, Hospital, User, AuditLog
from backend.app.schemas.training import LocalTrainingRequest, TrainingRunOut
from backend.app.federated.client import HospitalFLClient
from backend.app.federated.coordinator import FederatedCoordinator
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/training", tags=["Local Training"])

@router.post("/start", response_model=TrainingRunOut)
def start_local_training(
    req: LocalTrainingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role in ("HOSPITAL_ADMIN", "DOCTOR") and current_user.hospital_id != req.hospital_id:
        raise HTTPException(status_code=403, detail="Unauthorized to trigger training for other hospitals")

    hosp = db.query(Hospital).filter(Hospital.id == req.hospital_id).first()
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    coordinator = FederatedCoordinator(db)
    latest_global_rec, global_model = coordinator.get_latest_global_model()
    cur_weights = global_model.weights.tolist()
    cur_bias = float(global_model.bias)

    client = HospitalFLClient(hospital_id=hosp.id, hospital_name=hosp.hospital_name)
    start_time = datetime.now(timezone.utc)

    try:
        update = client.train_local_epoch(
            global_weights=cur_weights,
            global_bias=cur_bias,
            epochs=req.epochs,
            learning_rate=req.learning_rate,
            batch_size=req.batch_size
        )
    except Exception as e:
        failed_run = TrainingRun(
            hospital_id=hosp.id,
            round_number=None,
            model_version=f"local_h{hosp.id}_failed",
            training_samples=0,
            status="FAILED",
            metrics_json={"error": str(e)},
            started_at=start_time,
            completed_at=datetime.now(timezone.utc)
        )
        db.add(failed_run)
        db.commit()
        raise HTTPException(status_code=500, detail=f"Local training failed: {str(e)}")

    metrics = update["metrics"]
    completed_time = datetime.now(timezone.utc)

    run_record = TrainingRun(
        hospital_id=hosp.id,
        round_number=None,
        model_version=f"local_h{hosp.id}_standlone",
        training_samples=update["sample_count"],
        accuracy=metrics.get("accuracy"),
        precision=metrics.get("precision"),
        recall=metrics.get("recall"),
        f1_score=metrics.get("f1_score"),
        loss=metrics.get("loss"),
        status="COMPLETED",
        metrics_json=metrics,
        started_at=start_time,
        completed_at=completed_time
    )
    db.add(run_record)

    audit = AuditLog(
        user_id=current_user.id,
        action="LOCAL_TRAINING_COMPLETED",
        resource=f"Hospital {hosp.hospital_code}",
        status="SUCCESS",
        metadata_json={
            "hospital_id": hosp.id,
            "accuracy": metrics.get("accuracy"),
            "f1_score": metrics.get("f1_score"),
            "samples": update["sample_count"]
        }
    )
    db.add(audit)
    db.commit()
    db.refresh(run_record)

    return TrainingRunOut(
        id=run_record.id,
        hospital_id=run_record.hospital_id,
        hospital_name=hosp.hospital_name,
        round_number=run_record.round_number,
        model_version=run_record.model_version,
        training_samples=run_record.training_samples,
        accuracy=run_record.accuracy,
        precision=run_record.precision,
        recall=run_record.recall,
        f1_score=run_record.f1_score,
        loss=run_record.loss,
        status=run_record.status,
        metrics_json=run_record.metrics_json,
        started_at=run_record.started_at,
        completed_at=run_record.completed_at
    )

@router.get("/history", response_model=List[TrainingRunOut])
def get_training_history(
    hospital_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TrainingRun)
    if current_user.role in ("HOSPITAL_ADMIN", "DOCTOR") and current_user.hospital_id:
        query = query.filter(TrainingRun.hospital_id == current_user.hospital_id)
    elif hospital_id:
        query = query.filter(TrainingRun.hospital_id == hospital_id)

    runs = query.order_by(TrainingRun.id.desc()).limit(100).all()
    results = []
    for r in runs:
        results.append(TrainingRunOut(
            id=r.id,
            hospital_id=r.hospital_id,
            hospital_name=r.hospital.hospital_name if r.hospital else None,
            round_number=r.round_number,
            model_version=r.model_version,
            training_samples=r.training_samples,
            accuracy=r.accuracy,
            precision=r.precision,
            recall=r.recall,
            f1_score=r.f1_score,
            loss=r.loss,
            status=r.status,
            metrics_json=r.metrics_json,
            started_at=r.started_at,
            completed_at=r.completed_at
        ))
    return results

@router.get("/status/{id}", response_model=TrainingRunOut)
def get_training_status(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(TrainingRun).filter(TrainingRun.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Training run not found")
    return TrainingRunOut(
        id=r.id,
        hospital_id=r.hospital_id,
        hospital_name=r.hospital.hospital_name if r.hospital else None,
        round_number=r.round_number,
        model_version=r.model_version,
        training_samples=r.training_samples,
        accuracy=r.accuracy,
        precision=r.precision,
        recall=r.recall,
        f1_score=r.f1_score,
        loss=r.loss,
        status=r.status,
        metrics_json=r.metrics_json,
        started_at=r.started_at,
        completed_at=r.completed_at
    )
