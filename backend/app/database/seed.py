import os
import sys
import hashlib
from datetime import datetime, timezone, timedelta

# Ensure repo root in sys.path
sys.path.insert(0, os.path.abspath("."))

from backend.app.database.session import SessionLocal
from backend.app.models.entities import (
    User,
    Hospital,
    Dataset,
    TrainingRun,
    FederatedRound,
    ModelRecord,
    Prediction,
    AuditLog,
)

def utcnow():
    return datetime.now(timezone.utc)

def hash_password(password: str) -> str:
    # Deterministic SHA-256 password hash for standard test accounts
    return hashlib.sha256(password.encode()).hexdigest()

def seed_database():
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Hospital).count() > 0:
            print("[Seed] Database already contains hospital records. Skipping initial seeding.")
            return

        print("[Seed] Populating initial development seed data...")

        # 1. Hospitals
        hospitals_data = [
            {
                "id": 1,
                "hospital_name": "Metropolitan General Hospital",
                "hospital_code": "METRO-01",
                "location": "New York, NY",
                "contact_email": "contact@metrohospital.org",
                "status": "ACTIVE",
                "created_at": utcnow() - timedelta(days=30),
            },
            {
                "id": 2,
                "hospital_name": "St. Jude Cardiac Institute",
                "hospital_code": "STJUDE-02",
                "location": "Chicago, IL",
                "contact_email": "research@stjude.org",
                "status": "ACTIVE",
                "created_at": utcnow() - timedelta(days=28),
            },
            {
                "id": 3,
                "hospital_name": "Rural Health Network Care",
                "hospital_code": "RURAL-03",
                "location": "Bozeman, MT",
                "contact_email": "coordinator@ruralhealth.org",
                "status": "ACTIVE",
                "created_at": utcnow() - timedelta(days=22),
            },
            {
                "id": 4,
                "hospital_name": "University Research Hospital",
                "hospital_code": "UNIV-04",
                "location": "Boston, MA",
                "contact_email": "trials@univhealth.edu",
                "status": "ACTIVE",
                "created_at": utcnow() - timedelta(days=20),
            },
            {
                "id": 5,
                "hospital_name": "Suburban Memorial Clinic",
                "hospital_code": "SUBURB-05",
                "location": "Austin, TX",
                "contact_email": "data@suburbanhealth.org",
                "status": "ACTIVE",
                "created_at": utcnow() - timedelta(days=15),
            },
        ]

        hospitals = []
        for h_info in hospitals_data:
            h = Hospital(**h_info)
            db.add(h)
            hospitals.append(h)
        db.commit()
        print(f"[Seed] Created {len(hospitals)} hospitals.")

        # 2. Users
        users_data = [
            {
                "name": "System Super Admin",
                "email": "admin@federatedhealth.ai",
                "password_hash": hash_password("Admin@12345"),
                "role": "SUPER_ADMIN",
                "status": "ACTIVE",
                "hospital_id": None,
                "created_at": utcnow() - timedelta(days=30),
            },
            {
                "name": "Dr. Sarah Chen (Chief of Cardiology)",
                "email": "admin@metrohospital.org",
                "password_hash": hash_password("Hospital@12345"),
                "role": "HOSPITAL_ADMIN",
                "status": "ACTIVE",
                "hospital_id": 1,
                "created_at": utcnow() - timedelta(days=29),
            },
            {
                "name": "Dr. Marcus Brody (Cardiologist)",
                "email": "doctor@metrohospital.org",
                "password_hash": hash_password("Doctor@12345"),
                "role": "DOCTOR",
                "status": "ACTIVE",
                "hospital_id": 1,
                "created_at": utcnow() - timedelta(days=25),
            },
            {
                "name": "Dr. Elena Rostova",
                "email": "admin@stjude.org",
                "password_hash": hash_password("Hospital@12345"),
                "role": "HOSPITAL_ADMIN",
                "status": "ACTIVE",
                "hospital_id": 2,
                "created_at": utcnow() - timedelta(days=27),
            },
            {
                "name": "Nurse Supervisor John Miller",
                "email": "admin@ruralhealth.org",
                "password_hash": hash_password("Hospital@12345"),
                "role": "HOSPITAL_ADMIN",
                "status": "ACTIVE",
                "hospital_id": 3,
                "created_at": utcnow() - timedelta(days=21),
            },
            {
                "name": "Prof. David Thorne",
                "email": "admin@univhealth.edu",
                "password_hash": hash_password("Hospital@12345"),
                "role": "HOSPITAL_ADMIN",
                "status": "ACTIVE",
                "hospital_id": 4,
                "created_at": utcnow() - timedelta(days=19),
            },
            {
                "name": "Dr. Rachel Vance",
                "email": "admin@suburbanhealth.org",
                "password_hash": hash_password("Hospital@12345"),
                "role": "HOSPITAL_ADMIN",
                "status": "ACTIVE",
                "hospital_id": 5,
                "created_at": utcnow() - timedelta(days=14),
            },
        ]

        users = []
        for u_info in users_data:
            u = User(**u_info)
            db.add(u)
            users.append(u)
        db.commit()
        print(f"[Seed] Created {len(users)} users.")

        # 3. Datasets (Privacy-Preserving: Metadata ONLY, raw records remain partitioned locally)
        datasets_data = [
            {
                "hospital_id": 1,
                "dataset_name": "Metropolitan Cardiac Inpatient Cohort (2024-2025)",
                "record_count": 320,
                "feature_count": 10,
                "status": "VALIDATED",
                "file_path": "data/hospital_1/dataset.csv",
                "schema_info": {
                    "format": "csv",
                    "target_column": "target",
                    "positive_class_ratio": 0.55,
                    "missing_values_count": 0,
                    "features": ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol", "fasting_blood_sugar", "resting_ecg", "max_heart_rate", "exercise_angina", "st_depression"],
                },
                "uploaded_at": utcnow() - timedelta(days=20),
            },
            {
                "hospital_id": 2,
                "dataset_name": "St. Jude Outpatient Heart Screening Cohort",
                "record_count": 280,
                "feature_count": 10,
                "status": "VALIDATED",
                "file_path": "data/hospital_2/dataset.csv",
                "schema_info": {
                    "format": "csv",
                    "target_column": "target",
                    "positive_class_ratio": 0.52,
                    "missing_values_count": 0,
                    "features": ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol", "fasting_blood_sugar", "resting_ecg", "max_heart_rate", "exercise_angina", "st_depression"],
                },
                "uploaded_at": utcnow() - timedelta(days=18),
            },
            {
                "hospital_id": 3,
                "dataset_name": "Rural Clinical Registry Cardiovascular Baseline",
                "record_count": 220,
                "feature_count": 10,
                "status": "VALIDATED",
                "file_path": "data/hospital_3/dataset.csv",
                "schema_info": {
                    "format": "csv",
                    "target_column": "target",
                    "positive_class_ratio": 0.48,
                    "missing_values_count": 0,
                    "features": ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol", "fasting_blood_sugar", "resting_ecg", "max_heart_rate", "exercise_angina", "st_depression"],
                },
                "uploaded_at": utcnow() - timedelta(days=16),
            },
            {
                "hospital_id": 4,
                "dataset_name": "University Cohort Multi-Center Trial Registry",
                "record_count": 350,
                "feature_count": 10,
                "status": "VALIDATED",
                "file_path": "data/hospital_4/dataset.csv",
                "schema_info": {
                    "format": "csv",
                    "target_column": "target",
                    "positive_class_ratio": 0.58,
                    "missing_values_count": 0,
                    "features": ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol", "fasting_blood_sugar", "resting_ecg", "max_heart_rate", "exercise_angina", "st_depression"],
                },
                "uploaded_at": utcnow() - timedelta(days=15),
            },
            {
                "hospital_id": 5,
                "dataset_name": "Suburban Health Community Heart Screening",
                "record_count": 250,
                "feature_count": 10,
                "status": "VALIDATED",
                "file_path": "data/hospital_5/dataset.csv",
                "schema_info": {
                    "format": "csv",
                    "target_column": "target",
                    "positive_class_ratio": 0.50,
                    "missing_values_count": 0,
                    "features": ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol", "fasting_blood_sugar", "resting_ecg", "max_heart_rate", "exercise_angina", "st_depression"],
                },
                "uploaded_at": utcnow() - timedelta(days=12),
            },
        ]

        for d_info in datasets_data:
            d = Dataset(**d_info)
            db.add(d)
        db.commit()
        print("[Seed] Created 5 dataset metadata records (No raw clinical patient data centrally stored).")

        # 4. Global Models
        sample_weights = [0.42, 0.61, 0.85, 0.38, 0.44, 0.15, 0.22, -0.74, 0.68, 0.72]
        model_record = ModelRecord(
            model_name="FedAvg Cardiovascular Risk Classifier",
            model_version="global_model_v1.0",
            model_type="LogisticRegression",
            accuracy=0.8350,
            precision=0.8420,
            recall=0.8290,
            f1_score=0.8354,
            storage_path="models_storage/global_model_v1.0.json",
            parameters_summary={
                "features": ["age", "sex", "chest_pain_type", "resting_bp", "cholesterol", "fasting_blood_sugar", "resting_ecg", "max_heart_rate", "exercise_angina", "st_depression"],
                "weights": sample_weights,
                "bias": -0.15,
                "differential_privacy": {
                    "enabled": True,
                    "epsilon": 1.5,
                    "clip_norm": 1.0,
                    "mechanism": "Gaussian LDP",
                },
            },
            is_active=True,
            status="READY",
            created_at=utcnow() - timedelta(days=5),
        )
        db.add(model_record)
        db.commit()
        print("[Seed] Created global federated model record.")

        # 5. Federated Round 1
        fed_round = FederatedRound(
            round_number=1,
            participating_hospitals=[1, 2, 3, 4, 5],
            completed_hospitals=[1, 2, 3, 4, 5],
            failed_hospitals=[],
            global_model_version="global_model_v1.0",
            aggregation_method="FedAvg",
            status="COMPLETED",
            global_metrics={
                "accuracy": 0.8350,
                "precision": 0.8420,
                "recall": 0.8290,
                "f1_score": 0.8354,
                "roc_auc": 0.8872,
                "total_samples": 1420,
            },
            started_at=utcnow() - timedelta(days=5, hours=2),
            completed_at=utcnow() - timedelta(days=5, hours=1, minutes=45),
        )
        db.add(fed_round)
        db.commit()
        print("[Seed] Created federated round 1.")

        # 6. Local Training Runs for Round 1
        local_runs_data = [
            {"hospital_id": 1, "samples": 320, "acc": 0.792, "prec": 0.785, "rec": 0.801, "f1": 0.793, "loss": 0.465},
            {"hospital_id": 2, "samples": 280, "acc": 0.815, "prec": 0.820, "rec": 0.810, "f1": 0.815, "loss": 0.442},
            {"hospital_id": 3, "samples": 220, "acc": 0.741, "prec": 0.735, "rec": 0.750, "f1": 0.742, "loss": 0.518},
            {"hospital_id": 4, "samples": 350, "acc": 0.834, "prec": 0.840, "rec": 0.828, "f1": 0.834, "loss": 0.412},
            {"hospital_id": 5, "samples": 250, "acc": 0.776, "prec": 0.780, "rec": 0.772, "f1": 0.776, "loss": 0.485},
        ]
        for lr in local_runs_data:
            tr = TrainingRun(
                hospital_id=lr["hospital_id"],
                round_number=1,
                model_version="global_model_v1.0",
                training_samples=lr["samples"],
                accuracy=lr["acc"],
                precision=lr["prec"],
                recall=lr["rec"],
                f1_score=lr["f1"],
                loss=lr["loss"],
                status="COMPLETED",
                metrics_json={"local_epochs": 5, "learning_rate": 0.05, "batch_size": 32},
                started_at=utcnow() - timedelta(days=5, hours=2),
                completed_at=utcnow() - timedelta(days=5, hours=1, minutes=50),
            )
            db.add(tr)
        db.commit()
        print("[Seed] Created 5 on-premise local training runs.")

        # 7. Clinical Risk Predictions
        predictions_data = [
            {
                "hospital_id": 1,
                "model_version": "global_model_v1.0",
                "input_features": {
                    "age": 62, "sex": 1, "chest_pain_type": 3, "resting_bp": 145, "cholesterol": 265,
                    "fasting_blood_sugar": 1, "resting_ecg": 1, "max_heart_rate": 132, "exercise_angina": 1, "st_depression": 2.2
                },
                "prediction_result": "Positive Risk (High Cardiac Event Probability)",
                "confidence": 0.894,
                "created_at": utcnow() - timedelta(days=2),
            },
            {
                "hospital_id": 2,
                "model_version": "global_model_v1.0",
                "input_features": {
                    "age": 44, "sex": 0, "chest_pain_type": 1, "resting_bp": 118, "cholesterol": 185,
                    "fasting_blood_sugar": 0, "resting_ecg": 0, "max_heart_rate": 172, "exercise_angina": 0, "st_depression": 0.2
                },
                "prediction_result": "Negative Risk (Normal / Low Cardiac Event Risk)",
                "confidence": 0.941,
                "created_at": utcnow() - timedelta(days=1),
            },
        ]
        for p in predictions_data:
            pred = Prediction(**p)
            db.add(pred)
        db.commit()
        print("[Seed] Created sample clinical predictions.")

        # 8. Audit Logs
        audit_events = [
            {"user_id": 1, "action": "FEDERATED_ROUND_INIT", "resource": "FederatedRound 1", "status": "SUCCESS", "timestamp": utcnow() - timedelta(days=5, hours=2), "metadata_json": {"coordinator": "admin@federatedhealth.ai"}},
            {"user_id": 1, "action": "FEDERATED_ROUND_AGGREGATE", "resource": "ModelRecord global_model_v1.0", "status": "SUCCESS", "timestamp": utcnow() - timedelta(days=5, hours=1, minutes=45), "metadata_json": {"method": "FedAvg", "accuracy": 0.835}},
            {"user_id": 2, "action": "CLINICAL_INFERENCE", "resource": "Prediction Patient #1042", "status": "SUCCESS", "timestamp": utcnow() - timedelta(days=2), "metadata_json": {"hospital_id": 1, "risk": "POSITIVE"}},
        ]
        for a in audit_events:
            audit = AuditLog(**a)
            db.add(audit)
        db.commit()
        print("[Seed] Created initial security audit log entries.")
        print("[Seed] Database seeding completed successfully!")

    except Exception as e:
        db.rollback()
        print(f"[Seed] Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
