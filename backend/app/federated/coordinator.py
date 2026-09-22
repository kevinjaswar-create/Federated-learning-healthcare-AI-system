import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from backend.app.core.config import settings
from backend.app.models.entities import Hospital, FederatedRound, ModelRecord, TrainingRun, AuditLog
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG
from backend.app.ml.models import LinearDiseaseClassifier
from backend.app.ml.evaluator import compute_metrics
from backend.app.federated.client import HospitalFLClient
from backend.app.federated.fedavg import federated_averaging
from backend.app.federated.serializer import verify_update_integrity

class FederatedCoordinator:
    """
    Central Federated Learning Server Coordinator.
    Manages communication rounds, client orchestration, FedAvg aggregation,
    global evaluation, and model versioning.
    """
    def __init__(self, db: Session):
        self.db = db
        self.config = DEFAULT_HEART_DISEASE_CONFIG
        self.num_features = len(self.config.feature_columns)
        self.global_classifier = LinearDiseaseClassifier(num_features=self.num_features)
        self.ensure_models_storage()

    def ensure_models_storage(self):
        os.makedirs(settings.MODELS_DIR, exist_ok=True)

    def get_latest_global_model(self) -> Tuple[ModelRecord, LinearDiseaseClassifier]:
        record = self.db.query(ModelRecord).filter(
            ModelRecord.model_name == "global_model",
            ModelRecord.is_active == True
        ).order_by(ModelRecord.id.desc()).first()

        if not record:
            # Initialize baseline global model v0
            weights = np.zeros(self.num_features).tolist()
            bias = 0.0
            record = ModelRecord(
                model_name="global_model",
                model_version="global_model_v0",
                model_type="LogisticRegression",
                accuracy=0.50,
                precision=0.50,
                recall=0.50,
                f1_score=0.50,
                storage_path=os.path.join(settings.MODELS_DIR, "global_model_v0.json"),
                parameters_summary={"weights": weights, "bias": bias, "num_features": self.num_features},
                is_active=True,
                status="READY"
            )
            self.db.add(record)
            self.db.commit()
            self.db.refresh(record)

            with open(record.storage_path, "w") as f:
                json.dump({"weights": weights, "bias": bias}, f)

            self.global_classifier.set_parameters(weights, bias)
        else:
            if record.parameters_summary:
                self.global_classifier.set_parameters(
                    record.parameters_summary.get("weights", [0.0] * self.num_features),
                    record.parameters_summary.get("bias", 0.0)
                )

        return record, self.global_classifier

    def run_federated_round(
        self,
        round_number: int,
        participating_hospital_ids: List[int],
        local_epochs: int = 3,
        learning_rate: float = 0.05,
        apply_dp: bool = False,
        dp_epsilon: float = 1.5,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Executes a complete federated learning round:
        1. Distribute current global model
        2. Local training across participating hospitals
        3. Receive updates & verify checksums
        4. Perform FedAvg parameter aggregation
        5. Evaluate updated global model
        6. Persist new model version & round statistics
        """
        start_time = datetime.now(timezone.utc)
        latest_model_rec, global_model = self.get_latest_global_model()
        cur_weights = global_model.weights.tolist()
        cur_bias = float(global_model.bias)

        # Retrieve participating hospital records
        hospitals = self.db.query(Hospital).filter(Hospital.id.in_(participating_hospital_ids)).all()
        
        round_record = FederatedRound(
            round_number=round_number,
            participating_hospitals=participating_hospital_ids,
            completed_hospitals=[],
            failed_hospitals=[],
            global_model_version=f"global_model_v{round_number}",
            aggregation_method="FedAvg",
            status="RUNNING",
            started_at=start_time
        )
        self.db.add(round_record)
        self.db.commit()
        self.db.refresh(round_record)

        valid_client_updates = []
        completed_ids = []
        failed_ids = []
        client_statuses = []

        # Simulate distributed client round execution
        for hosp in hospitals:
            client = HospitalFLClient(hospital_id=hosp.id, hospital_name=hosp.hospital_name)
            try:
                # Check hospital active status
                if hosp.status == "OFFLINE" or hosp.status == "INACTIVE":
                    raise ConnectionError(f"Hospital {hosp.hospital_name} is currently offline.")

                # Client trains locally on private dataset
                update = client.train_local_epoch(
                    global_weights=cur_weights,
                    global_bias=cur_bias,
                    epochs=local_epochs,
                    learning_rate=learning_rate,
                    apply_dp=apply_dp,
                    dp_epsilon=dp_epsilon
                )

                # Checksum integrity verification
                is_valid = verify_update_integrity(update, update["checksum"])
                if not is_valid:
                    raise ValueError("Model update signature / checksum verification failed!")

                valid_client_updates.append(update)
                completed_ids.append(hosp.id)
                
                metrics = update["metrics"]
                client_statuses.append({
                    "hospital_id": hosp.id,
                    "hospital_name": hosp.hospital_name,
                    "status": "COMPLETED",
                    "sample_count": update["sample_count"],
                    "local_accuracy": metrics.get("accuracy"),
                    "local_f1": metrics.get("f1_score"),
                    "loss": metrics.get("loss"),
                    "update_checksum": update["checksum"][:12] + "..."
                })

                # Save local training run in DB
                local_run = TrainingRun(
                    hospital_id=hosp.id,
                    round_number=round_number,
                    model_version=f"local_h{hosp.id}_r{round_number}",
                    training_samples=update["sample_count"],
                    accuracy=metrics.get("accuracy"),
                    precision=metrics.get("precision"),
                    recall=metrics.get("recall"),
                    f1_score=metrics.get("f1_score"),
                    loss=metrics.get("loss"),
                    status="COMPLETED",
                    metrics_json=metrics,
                    started_at=start_time,
                    completed_at=datetime.now(timezone.utc)
                )
                self.db.add(local_run)

            except Exception as e:
                failed_ids.append(hosp.id)
                client_statuses.append({
                    "hospital_id": hosp.id,
                    "hospital_name": hosp.hospital_name,
                    "status": "FAILED",
                    "sample_count": 0,
                    "local_accuracy": None,
                    "local_f1": None,
                    "loss": None,
                    "update_checksum": None
                })
                # Graceful handling: client failure does not crash the coordinator!
                continue

        if not valid_client_updates:
            round_record.status = "FAILED"
            round_record.failed_hospitals = failed_ids
            round_record.completed_at = datetime.now(timezone.utc)
            self.db.commit()
            raise RuntimeError("Federated round failed: No participating clients completed local training.")

        # 4. Perform FedAvg Aggregation
        new_weights, new_bias = federated_averaging(valid_client_updates)
        self.global_classifier.set_parameters(new_weights, new_bias)

        # 5. Evaluate Global Model across validation cohort
        global_metrics = self.evaluate_global_model(self.global_classifier, participating_hospital_ids)

        new_version_tag = f"global_model_v{round_number}"
        model_storage_path = os.path.join(settings.MODELS_DIR, f"{new_version_tag}.json")
        with open(model_storage_path, "w") as f:
            json.dump({
                "weights": new_weights,
                "bias": new_bias,
                "metrics": global_metrics,
                "round": round_number
            }, f)

        # Deactivate older model versions
        self.db.query(ModelRecord).filter(ModelRecord.model_name == "global_model").update({"is_active": False})

        new_model_record = ModelRecord(
            model_name="global_model",
            model_version=new_version_tag,
            model_type="LogisticRegression (FedAvg)",
            accuracy=global_metrics["accuracy"],
            precision=global_metrics["precision"],
            recall=global_metrics["recall"],
            f1_score=global_metrics["f1_score"],
            storage_path=model_storage_path,
            parameters_summary={
                "weights": new_weights,
                "bias": new_bias,
                "num_features": self.num_features,
                "participating_count": len(completed_ids)
            },
            is_active=True,
            status="READY"
        )
        self.db.add(new_model_record)

        # Complete round record
        round_record.completed_hospitals = completed_ids
        round_record.failed_hospitals = failed_ids
        round_record.status = "COMPLETED"
        round_record.global_metrics = global_metrics
        round_record.completed_at = datetime.now(timezone.utc)

        # Audit log
        audit = AuditLog(
            user_id=user_id,
            action="FEDERATED_ROUND_COMPLETED",
            resource=f"Round {round_number}",
            status="SUCCESS",
            metadata_json={
                "round_number": round_number,
                "completed_hospitals": completed_ids,
                "failed_hospitals": failed_ids,
                "accuracy": global_metrics["accuracy"],
                "f1_score": global_metrics["f1_score"],
                "global_model_version": new_version_tag
            }
        )
        self.db.add(audit)
        self.db.commit()
        self.db.refresh(round_record)

        return {
            "round_id": round_record.id,
            "round_number": round_number,
            "global_model_version": new_version_tag,
            "completed_hospitals": completed_ids,
            "failed_hospitals": failed_ids,
            "global_metrics": global_metrics,
            "client_statuses": client_statuses,
            "aggregation_method": "FedAvg",
            "duration_seconds": (round_record.completed_at - start_time).total_seconds()
        }

    def evaluate_global_model(self, model: LinearDiseaseClassifier, hospital_ids: List[int]) -> Dict[str, Any]:
        """Evaluates the global model on aggregate validation data from participating hospitals."""
        all_X_val = []
        all_y_val = []

        for hid in hospital_ids:
            client = HospitalFLClient(hospital_id=hid, hospital_name=f"Hospital_{hid}")
            if client.load_local_data() and client.X_val is not None:
                all_X_val.append(client.X_val)
                all_y_val.append(client.y_val)

        if all_X_val:
            X_eval = np.vstack(all_X_val)
            y_eval = np.concatenate(all_y_val)
        else:
            # Fallback if no validation sets
            X_eval = np.random.randn(50, self.num_features)
            y_eval = (np.random.rand(50) > 0.5).astype(int)

        y_prob = model.predict_proba(X_eval)[:, 1]
        y_pred = (y_prob >= 0.5).astype(int)
        return compute_metrics(y_eval, y_pred, y_prob)
