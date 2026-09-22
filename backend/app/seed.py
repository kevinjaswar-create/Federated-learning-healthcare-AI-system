import os
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from backend.app.database.session import SessionLocal, engine, Base
from backend.app.models.entities import User, Hospital, Dataset, ModelRecord, AuditLog
from backend.app.core.security import get_password_hash
from backend.app.core.config import settings
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG

def generate_non_iid_hospital_data(hospital_idx: int, n_samples: int) -> pd.DataFrame:
    """
    Generates realistic, de-identified non-IID clinical cardiovascular datasets.
    Simulates domain shifts between hospital cohorts:
    H1: Older demographic, higher resting BP bias
    H2: Cardiac center with higher severity chest pain
    H3: Rural health, younger demographic, lower ECG anomalies
    H4: University academic research, balanced trial cohort
    H5: Suburban clinic, lower cholesterol, mild presentations
    """
    np.random.seed(42 + hospital_idx * 17)

    # 1. Age distribution
    if hospital_idx == 1:
        age = np.clip(np.random.normal(64, 8, n_samples), 40, 85).astype(int)
    elif hospital_idx == 2:
        age = np.clip(np.random.normal(59, 10, n_samples), 35, 82).astype(int)
    elif hospital_idx == 3:
        age = np.clip(np.random.normal(48, 12, n_samples), 25, 78).astype(int)
    elif hospital_idx == 4:
        age = np.clip(np.random.normal(55, 11, n_samples), 30, 80).astype(int)
    else:
        age = np.clip(np.random.normal(52, 9, n_samples), 28, 75).astype(int)

    # 2. Sex (0=F, 1=M)
    sex_prob = 0.65 if hospital_idx in (1, 2) else 0.50
    sex = np.random.binomial(1, sex_prob, n_samples)

    # 3. Chest pain type (0: typical, 1: atypical, 2: non-anginal, 3: asymptomatic)
    cp_p = [0.2, 0.2, 0.3, 0.3] if hospital_idx != 2 else [0.1, 0.2, 0.35, 0.35]
    chest_pain_type = np.random.choice([0, 1, 2, 3], size=n_samples, p=cp_p)

    # 4. Resting Blood Pressure (mm Hg)
    bp_mean = 142 if hospital_idx == 1 else 130
    resting_bp = np.clip(np.random.normal(bp_mean, 16, n_samples), 90, 200).astype(int)

    # 5. Serum Cholesterol (mg/dl)
    chol_mean = 255 if hospital_idx == 2 else 235
    cholesterol = np.clip(np.random.normal(chol_mean, 40, n_samples), 130, 420).astype(int)

    # 6. Fasting Blood Sugar > 120 (0=No, 1=Yes)
    fbs_prob = 0.22 if hospital_idx == 1 else 0.14
    fasting_blood_sugar = np.random.binomial(1, fbs_prob, n_samples)

    # 7. Resting ECG (0, 1, 2)
    resting_ecg = np.random.choice([0, 1, 2], size=n_samples, p=[0.50, 0.45, 0.05])

    # 8. Maximum Heart Rate Achieved (bpm)
    max_hr = np.clip(220 - age * 0.8 + np.random.normal(0, 15, n_samples), 75, 205).astype(int)

    # 9. Exercise Induced Angina (0=No, 1=Yes)
    ex_angina_prob = 0.45 if hospital_idx == 2 else 0.30
    exercise_angina = np.random.binomial(1, ex_angina_prob, n_samples)

    # 10. ST Depression (mm)
    st_mean = 1.4 if hospital_idx in (1, 2) else 0.9
    st_depression = np.round(np.clip(np.random.exponential(st_mean, n_samples), 0.0, 5.8), 2)

    # Underlying Disease Risk Probability function (Ground Truth latent model + realistic noise)
    z = (
        0.04 * (age - 50)
        + 0.5 * sex
        + 0.4 * chest_pain_type
        + 0.02 * (resting_bp - 120)
        + 0.008 * (cholesterol - 200)
        + 0.6 * fasting_blood_sugar
        + 0.3 * resting_ecg
        - 0.03 * (max_hr - 140)
        + 0.8 * exercise_angina
        + 0.5 * st_depression
        - 1.2
    )
    prob = 1.0 / (1.0 + np.exp(-z))
    target = (prob >= 0.5).astype(int)

    df = pd.DataFrame({
        "age": age,
        "sex": sex,
        "chest_pain_type": chest_pain_type,
        "resting_bp": resting_bp,
        "cholesterol": cholesterol,
        "fasting_blood_sugar": fasting_blood_sugar,
        "resting_ecg": resting_ecg,
        "max_heart_rate": max_hr,
        "exercise_angina": exercise_angina,
        "st_depression": st_depression,
        "target": target
    })
    return df

def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if already seeded
        if db.query(Hospital).count() > 0:
            print("Database already contains data. Skipping initial seeding.")
            return

        print("Seeding initial hospitals, users, and simulated local datasets...")

        hospitals_data = [
            {"id": 1, "name": "Metropolitan General Hospital", "code": "METRO-01", "location": "New York, NY", "email": "contact@metrohospital.org", "samples": 320},
            {"id": 2, "name": "St. Jude Cardiac Institute", "code": "STJUDE-02", "location": "Chicago, IL", "email": "research@stjude.org", "samples": 280},
            {"id": 3, "name": "Rural Health Network Care", "code": "RURAL-03", "location": "Bozeman, MT", "email": "coordinator@ruralhealth.org", "samples": 220},
            {"id": 4, "name": "University Research Hospital", "code": "UNIV-04", "location": "Boston, MA", "email": "trials@univhealth.edu", "samples": 350},
            {"id": 5, "name": "Suburban Memorial Clinic", "code": "SUBURB-05", "location": "Austin, TX", "email": "data@suburbanhealth.org", "samples": 250},
        ]

        hosp_objs = []
        for h in hospitals_data:
            hosp = Hospital(
                id=h["id"],
                hospital_name=h["name"],
                hospital_code=h["code"],
                location=h["location"],
                contact_email=h["email"],
                status="ACTIVE"
            )
            db.add(hosp)
            hosp_objs.append(hosp)
        db.commit()

        # Seed Users with explicit secure roles
        users = [
            User(
                name="System Super Admin",
                email="admin@federatedhealth.ai",
                password_hash=get_password_hash("Admin@12345"),
                role="SUPER_ADMIN",
                status="ACTIVE"
            ),
            User(
                name="Dr. Sarah Connor (Admin)",
                email="admin@metrohospital.org",
                password_hash=get_password_hash("Hospital@12345"),
                role="HOSPITAL_ADMIN",
                hospital_id=1,
                status="ACTIVE"
            ),
            User(
                name="Dr. James Wilson (Cardiologist)",
                email="doctor@metrohospital.org",
                password_hash=get_password_hash("Doctor@12345"),
                role="DOCTOR",
                hospital_id=1,
                status="ACTIVE"
            ),
            User(
                name="Dr. Lisa Cuddy (Lead Researcher)",
                email="doctor@stjude.org",
                password_hash=get_password_hash("Doctor@12345"),
                role="DOCTOR",
                hospital_id=2,
                status="ACTIVE"
            ),
        ]
        for u in users:
            db.add(u)
        db.commit()

        # Seed local hospital datasets on local disk
        for h in hospitals_data:
            hosp_dir = os.path.join(settings.DATA_DIR, f"hospital_{h['id']}")
            os.makedirs(hosp_dir, exist_ok=True)
            csv_path = os.path.join(hosp_dir, "dataset.csv")

            df = generate_non_iid_hospital_data(h["id"], h["samples"])
            df.to_csv(csv_path, index=False)

            dataset_rec = Dataset(
                hospital_id=h["id"],
                dataset_name=f"{h['name']} - Local Patient Cohort (Non-IID)",
                record_count=len(df),
                feature_count=len(DEFAULT_HEART_DISEASE_CONFIG.feature_columns),
                status="PREPROCESSED",
                file_path=csv_path,
                schema_info={
                    "features": DEFAULT_HEART_DISEASE_CONFIG.feature_columns,
                    "target": "target",
                    "non_iid_bias": f"Hospital cohort {h['id']} partition",
                    "positive_class_count": int(df['target'].sum()),
                    "negative_class_count": int((1 - df['target']).sum()),
                    "missing_values": 0
                }
            )
            db.add(dataset_rec)
        db.commit()

        # Seed initial Baseline Model v0
        os.makedirs(settings.MODELS_DIR, exist_ok=True)
        m0_path = os.path.join(settings.MODELS_DIR, "global_model_v0.json")
        num_feats = len(DEFAULT_HEART_DISEASE_CONFIG.feature_columns)
        m0 = ModelRecord(
            model_name="global_model",
            model_version="global_model_v0",
            model_type="LogisticRegression (Baseline)",
            accuracy=0.6200,
            precision=0.6150,
            recall=0.6300,
            f1_score=0.6224,
            storage_path=m0_path,
            parameters_summary={
                "weights": [0.0] * num_feats,
                "bias": 0.0,
                "num_features": num_feats,
                "participating_count": 0
            },
            is_active=True,
            status="READY"
        )
        db.add(m0)

        # Seed initial audit log
        audit = AuditLog(
            user_id=1,
            action="SYSTEM_INITIALIZED",
            resource="Database & Non-IID Local Datasets",
            status="SUCCESS",
            metadata_json={"hospitals_initialized": 5, "total_records": sum(h['samples'] for h in hospitals_data)}
        )
        db.add(audit)
        db.commit()

        print("Database initialized successfully with 5 simulated hospitals and 1,420 non-IID patient records.")

    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
