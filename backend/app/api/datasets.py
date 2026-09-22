import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
import pandas as pd

from backend.app.database.session import get_db
from backend.app.models.entities import Dataset, Hospital, User, AuditLog
from backend.app.schemas.dataset import DatasetOut, DatasetValidationResult
from backend.app.ml.preprocessor import DataPreprocessor
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG
from backend.app.core.config import settings
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/datasets", tags=["Dataset Management"])

@router.get("", response_model=List[DatasetOut])
def get_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Dataset)
    if current_user.role in ("HOSPITAL_ADMIN", "DOCTOR") and current_user.hospital_id:
        query = query.filter(Dataset.hospital_id == current_user.hospital_id)
    
    datasets = query.order_by(Dataset.id.desc()).all()
    results = []
    for d in datasets:
        hosp_name = d.hospital.hospital_name if d.hospital else None
        results.append(DatasetOut(
            id=d.id,
            hospital_id=d.hospital_id,
            hospital_name=hosp_name,
            dataset_name=d.dataset_name,
            record_count=d.record_count,
            feature_count=d.feature_count,
            status=d.status,
            schema_info=d.schema_info,
            uploaded_at=d.uploaded_at
        ))
    return results

@router.post("/validate", response_model=DatasetValidationResult)
async def validate_dataset(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = await file.read()
    if len(content) > 25 * 1024 * 1024:  # 25 MB max
        raise HTTPException(status_code=400, detail="File size exceeds maximum permitted 25MB")

    preprocessor = DataPreprocessor(DEFAULT_HEART_DISEASE_CONFIG)
    validation = preprocessor.validate_csv(content)
    return DatasetValidationResult(**validation)

@router.post("/upload", response_model=DatasetOut)
async def upload_dataset(
    hospital_id: int = Form(...),
    dataset_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role in ("HOSPITAL_ADMIN", "DOCTOR") and current_user.hospital_id != hospital_id:
        raise HTTPException(status_code=403, detail="Cannot upload dataset to a different hospital")

    hosp = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hosp:
        raise HTTPException(status_code=404, detail="Hospital not found")

    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV formatted files are permitted")

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    preprocessor = DataPreprocessor(DEFAULT_HEART_DISEASE_CONFIG)
    val_result = preprocessor.validate_csv(content)
    if not val_result["is_valid"]:
        raise HTTPException(status_code=422, detail=val_result["message"])

    # Store locally in simulated client directory: data/hospital_{id}/
    hosp_dir = os.path.join(settings.DATA_DIR, f"hospital_{hospital_id}")
    os.makedirs(hosp_dir, exist_ok=True)
    file_path = os.path.join(hosp_dir, "dataset.csv")

    with open(file_path, "wb") as f:
        f.write(content)

    # Save metadata in database
    dataset_rec = Dataset(
        hospital_id=hospital_id,
        dataset_name=dataset_name,
        record_count=val_result["record_count"],
        feature_count=val_result["feature_count"],
        status="VALIDATED",
        file_path=file_path,
        schema_info=val_result
    )
    db.add(dataset_rec)
    db.commit()
    db.refresh(dataset_rec)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="DATASET_UPLOAD",
        resource=f"Dataset {dataset_rec.id} (Hospital {hospital_id})",
        status="SUCCESS",
        metadata_json={
            "dataset_id": dataset_rec.id,
            "record_count": val_result["record_count"],
            "feature_count": val_result["feature_count"]
        }
    )
    db.add(audit)
    db.commit()

    return DatasetOut(
        id=dataset_rec.id,
        hospital_id=dataset_rec.hospital_id,
        hospital_name=hosp.hospital_name,
        dataset_name=dataset_rec.dataset_name,
        record_count=dataset_rec.record_count,
        feature_count=dataset_rec.feature_count,
        status=dataset_rec.status,
        schema_info=dataset_rec.schema_info,
        uploaded_at=dataset_rec.uploaded_at
    )

@router.get("/{id}", response_model=DatasetOut)
def get_dataset(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    d = db.query(Dataset).filter(Dataset.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if current_user.role in ("HOSPITAL_ADMIN", "DOCTOR") and current_user.hospital_id != d.hospital_id:
        raise HTTPException(status_code=403, detail="Access to other hospital datasets is unauthorized")

    return DatasetOut(
        id=d.id,
        hospital_id=d.hospital_id,
        hospital_name=d.hospital.hospital_name if d.hospital else None,
        dataset_name=d.dataset_name,
        record_count=d.record_count,
        feature_count=d.feature_count,
        status=d.status,
        schema_info=d.schema_info,
        uploaded_at=d.uploaded_at
    )

@router.delete("/{id}")
def delete_dataset(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    d = db.query(Dataset).filter(Dataset.id == id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if current_user.role in ("HOSPITAL_ADMIN", "DOCTOR") and current_user.hospital_id != d.hospital_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    db.delete(d)
    db.commit()

    audit = AuditLog(
        user_id=current_user.id,
        action="DATASET_DELETED",
        resource=f"Dataset {id}",
        status="SUCCESS",
        metadata_json={"deleted_dataset_id": id}
    )
    db.add(audit)
    db.commit()

    return {"message": f"Dataset {id} removed successfully"}
