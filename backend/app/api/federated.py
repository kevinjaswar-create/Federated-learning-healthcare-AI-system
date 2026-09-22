from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import FederatedRound, Hospital, ModelRecord, User, AuditLog
from backend.app.schemas.federated import FederatedStartRequest, FederatedRoundOut, ModelRecordOut
from backend.app.federated.coordinator import FederatedCoordinator
from backend.app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/federated", tags=["Federated Learning"])

@router.get("/status")
def get_federated_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    coordinator = FederatedCoordinator(db)
    active_model_rec, _ = coordinator.get_latest_global_model()
    latest_round = db.query(FederatedRound).order_by(FederatedRound.round_number.desc()).first()
    total_rounds = db.query(FederatedRound).count()
    total_hospitals = db.query(Hospital).count()
    active_hospitals = db.query(Hospital).filter(Hospital.status == "ACTIVE").count()

    return {
        "status": "IDLE" if not latest_round or latest_round.status == "COMPLETED" else "RUNNING",
        "current_round": latest_round.round_number if latest_round else 0,
        "total_rounds": total_rounds,
        "total_hospitals": total_hospitals,
        "active_hospitals": active_hospitals,
        "global_model_version": active_model_rec.model_version,
        "global_accuracy": active_model_rec.accuracy,
        "global_f1": active_model_rec.f1_score,
        "aggregation_method": "FedAvg",
        "latest_round_status": latest_round.status if latest_round else None
    }

@router.post("/start")
def start_federated_training(
    req: FederatedStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["SUPER_ADMIN", "HOSPITAL_ADMIN"]))
):
    coordinator = FederatedCoordinator(db)

    # Determine participating hospitals
    if req.selected_hospital_ids and len(req.selected_hospital_ids) > 0:
        hosp_ids = req.selected_hospital_ids
    else:
        active_hosps = db.query(Hospital).filter(Hospital.status == "ACTIVE").all()
        hosp_ids = [h.id for h in active_hosps]

    if not hosp_ids:
        raise HTTPException(status_code=400, detail="No active hospitals available for federated training")

    # Determine current round number
    last_round = db.query(FederatedRound).order_by(FederatedRound.round_number.desc()).first()
    start_round = (last_round.round_number + 1) if last_round else 1

    executed_rounds = []
    current_round_num = start_round

    for r_idx in range(req.rounds):
        round_res = coordinator.run_federated_round(
            round_number=current_round_num,
            participating_hospital_ids=hosp_ids,
            local_epochs=req.local_epochs,
            learning_rate=req.learning_rate,
            apply_dp=req.apply_dp,
            dp_epsilon=req.dp_epsilon,
            user_id=current_user.id
        )
        executed_rounds.append(round_res)
        current_round_num += 1

    latest_model_rec, _ = coordinator.get_latest_global_model()

    return {
        "message": f"Successfully completed {len(executed_rounds)} federated learning round(s).",
        "latest_global_version": latest_model_rec.model_version,
        "latest_accuracy": latest_model_rec.accuracy,
        "latest_f1": latest_model_rec.f1_score,
        "rounds": executed_rounds
    }

@router.get("/rounds", response_model=List[FederatedRoundOut])
def get_federated_rounds(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rounds = db.query(FederatedRound).order_by(FederatedRound.round_number.desc()).all()
    return rounds

@router.get("/rounds/{id}", response_model=FederatedRoundOut)
def get_federated_round(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    r = db.query(FederatedRound).filter(FederatedRound.id == id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Federated round not found")
    return r

@router.get("/global-model", response_model=ModelRecordOut)
def get_global_model(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    coordinator = FederatedCoordinator(db)
    rec, _ = coordinator.get_latest_global_model()
    return rec
