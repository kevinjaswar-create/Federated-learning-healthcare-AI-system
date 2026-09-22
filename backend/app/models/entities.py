from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    ForeignKey,
    Text,
    JSON,
    Boolean,
    Index,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from backend.app.database.session import Base

def utcnow():
    return datetime.now(timezone.utc)

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="DOCTOR")  # SUPER_ADMIN, HOSPITAL_ADMIN, DOCTOR
    status = Column(String(50), nullable=False, default="ACTIVE")  # ACTIVE, INACTIVE, SUSPENDED
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    # Relationships
    hospital = relationship("Hospital", back_populates="users")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        CheckConstraint("role IN ('SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR')", name="check_user_role"),
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')", name="check_user_status"),
        Index("idx_users_role_status", "role", "status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "hospital_id": self.hospital_id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Hospital(Base):
    __tablename__ = "hospitals"
    
    id = Column(Integer, primary_key=True, index=True)
    hospital_name = Column(String(255), nullable=False)
    hospital_code = Column(String(50), unique=True, index=True, nullable=False)
    location = Column(String(255), nullable=False)
    contact_email = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="ACTIVE")  # ACTIVE, INACTIVE, TRAINING, OFFLINE
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="hospital")
    datasets = relationship("Dataset", back_populates="hospital", cascade="all, delete-orphan")
    training_runs = relationship("TrainingRun", back_populates="hospital", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="hospital")
    
    __table_args__ = (
        CheckConstraint("status IN ('ACTIVE', 'INACTIVE', 'TRAINING', 'OFFLINE')", name="check_hospital_status"),
        Index("idx_hospitals_code_status", "hospital_code", "status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "hospital_name": self.hospital_name,
            "hospital_code": self.hospital_code,
            "location": self.location,
            "contact_email": self.contact_email,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Dataset(Base):
    """
    Privacy-Preserving Dataset Metadata.
    CRITICAL: Raw clinical patient records are NEVER stored in this central table.
    Only cohort metadata, on-premise file pointers, feature counts, and validation
    schemas are registered centrally.
    """
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_name = Column(String(255), nullable=False)
    record_count = Column(Integer, nullable=False, default=0)
    feature_count = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="VALIDATED")  # PENDING, VALIDATED, FAILED, PREPROCESSED
    file_path = Column(String(500), nullable=True)  # Path to localized, partitioned CSV on-premise
    schema_info = Column(JSON, nullable=True)  # feature types, missing counts, normalized ranges
    uploaded_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    # Relationships
    hospital = relationship("Hospital", back_populates="datasets")
    
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'VALIDATED', 'FAILED', 'PREPROCESSED')", name="check_dataset_status"),
        CheckConstraint("record_count >= 0", name="check_record_count_non_negative"),
        Index("idx_datasets_hospital_status", "hospital_id", "status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "hospital_id": self.hospital_id,
            "dataset_name": self.dataset_name,
            "record_count": self.record_count,
            "feature_count": self.feature_count,
            "status": self.status,
            "file_path": self.file_path,
            "schema_info": self.schema_info,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
        }


class TrainingRun(Base):
    __tablename__ = "training_runs"
    
    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="CASCADE"), nullable=False, index=True)
    round_number = Column(Integer, nullable=True, index=True)
    model_version = Column(String(50), nullable=False, index=True)
    training_samples = Column(Integer, nullable=False, default=0)
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    loss = Column(Float, nullable=True)
    status = Column(String(50), nullable=False, default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED, FAILED
    metrics_json = Column(JSON, nullable=True)  # confusion matrix, roc_auc, epoch losses
    started_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    hospital = relationship("Hospital", back_populates="training_runs")
    
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')", name="check_training_run_status"),
        Index("idx_training_hospital_round", "hospital_id", "round_number"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "hospital_id": self.hospital_id,
            "round_number": self.round_number,
            "model_version": self.model_version,
            "training_samples": self.training_samples,
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "loss": self.loss,
            "status": self.status,
            "metrics_json": self.metrics_json,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class FederatedRound(Base):
    __tablename__ = "federated_rounds"
    
    id = Column(Integer, primary_key=True, index=True)
    round_number = Column(Integer, unique=True, index=True, nullable=False)
    participating_hospitals = Column(JSON, nullable=False, default=list)  # list of hospital IDs
    completed_hospitals = Column(JSON, nullable=False, default=list)
    failed_hospitals = Column(JSON, nullable=False, default=list)
    global_model_version = Column(String(50), nullable=False)
    aggregation_method = Column(String(50), nullable=False, default="FedAvg")
    status = Column(String(50), nullable=False, default="PENDING")  # PENDING, RUNNING, COMPLETED, FAILED
    global_metrics = Column(JSON, nullable=True)  # accuracy, precision, recall, f1, roc_auc
    started_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        CheckConstraint("status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')", name="check_federated_round_status"),
        Index("idx_federated_rounds_status", "status"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "round_number": self.round_number,
            "participating_hospitals": self.participating_hospitals,
            "completed_hospitals": self.completed_hospitals,
            "failed_hospitals": self.failed_hospitals,
            "global_model_version": self.global_model_version,
            "aggregation_method": self.aggregation_method,
            "status": self.status,
            "global_metrics": self.global_metrics,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


class ModelRecord(Base):
    __tablename__ = "models"
    
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String(255), nullable=False)
    model_version = Column(String(50), unique=True, index=True, nullable=False)
    model_type = Column(String(50), nullable=False, default="LogisticRegression")
    accuracy = Column(Float, nullable=True)
    precision = Column(Float, nullable=True)
    recall = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    storage_path = Column(String(500), nullable=True)
    parameters_summary = Column(JSON, nullable=True)  # weights, bias, feature names
    is_active = Column(Boolean, default=True, index=True)
    status = Column(String(50), nullable=False, default="READY")  # READY, TRAINING, DEPRECATED
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    __table_args__ = (
        CheckConstraint("status IN ('READY', 'TRAINING', 'DEPRECATED')", name="check_model_status"),
        Index("idx_models_active_version", "is_active", "model_version"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "model_type": self.model_type,
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "storage_path": self.storage_path,
            "parameters_summary": self.parameters_summary,
            "is_active": self.is_active,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Prediction(Base):
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id", ondelete="SET NULL"), nullable=True, index=True)
    model_version = Column(String(50), nullable=False, index=True)
    input_features = Column(JSON, nullable=False)
    prediction_result = Column(String(100), nullable=False)  # Positive Risk, Negative Risk
    confidence = Column(Float, nullable=False)  # 0.0 - 1.0
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    
    # Relationships
    hospital = relationship("Hospital", back_populates="predictions")
    
    __table_args__ = (
        CheckConstraint("confidence >= 0.0 AND confidence <= 1.0", name="check_prediction_confidence_range"),
        Index("idx_predictions_hospital_created", "hospital_id", "created_at"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "hospital_id": self.hospital_id,
            "model_version": self.model_version,
            "input_features": self.input_features,
            "prediction_result": self.prediction_result,
            "confidence": self.confidence,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class AuditLog(Base):
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)  # LOGIN, DATASET_UPLOAD, FL_ROUND_START, etc.
    resource = Column(String(100), nullable=False)
    status = Column(String(50), nullable=False)  # SUCCESS, FAILURE, UNAUTHORIZED
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    metadata_json = Column(JSON, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="audit_logs")
    
    __table_args__ = (
        CheckConstraint("status IN ('SUCCESS', 'FAILURE', 'UNAUTHORIZED')", name="check_audit_status"),
        Index("idx_audit_action_timestamp", "action", "timestamp"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "action": self.action,
            "resource": self.resource,
            "status": self.status,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "metadata_json": self.metadata_json,
        }
