import pytest
import numpy as np
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG
from backend.app.ml.models import LinearDiseaseClassifier
from backend.app.ml.evaluator import compute_metrics
from backend.app.federated.fedavg import federated_averaging
from backend.app.federated.privacy import DifferentialPrivacyMechanism
from backend.app.federated.serializer import compute_update_checksum, verify_update_integrity
from backend.app.core.security import get_password_hash, verify_password, create_access_token, decode_access_token

client = TestClient(app)

def test_password_hashing():
    pwd = "SecureDoctorPassword123!"
    hashed = get_password_hash(pwd)
    assert hashed != pwd
    assert verify_password(pwd, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

def test_jwt_token_generation():
    token = create_access_token(subject=42, role="SUPER_ADMIN")
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["sub"] == "42"
    assert payload["role"] == "SUPER_ADMIN"

def test_health_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["aggregation_protocol"] == "FedAvg"

def test_linear_disease_classifier_local_fit():
    np.random.seed(42)
    n_samples = 150
    n_features = 10
    X = np.random.randn(n_samples, n_features)
    y = (X[:, 0] * 0.5 + X[:, 1] * 0.3 + np.random.randn(n_samples) * 0.1 > 0).astype(int)

    model = LinearDiseaseClassifier(num_features=n_features)
    metrics = model.fit_local(X, y, epochs=15, lr=0.1)
    
    assert "accuracy" in metrics
    assert "precision" in metrics
    assert "recall" in metrics
    assert "f1_score" in metrics
    assert metrics["accuracy"] > 0.60
    assert len(model.weights) == n_features

def test_fedavg_mathematical_aggregation():
    # Simulate 3 clients with different sample counts:
    # Client 1: n1 = 100, weights = [1.0, 1.0]
    # Client 2: n2 = 200, weights = [2.0, 2.0]
    # Client 3: n3 = 100, weights = [3.0, 3.0]
    # Total n = 400
    # Expected: (100/400)*1 + (200/400)*2 + (100/400)*3 = 0.25 + 1.0 + 0.75 = 2.0
    client_updates = [
        {"hospital_id": 1, "sample_count": 100, "weights": [1.0, 1.0], "bias": 0.5},
        {"hospital_id": 2, "sample_count": 200, "weights": [2.0, 2.0], "bias": 1.0},
        {"hospital_id": 3, "sample_count": 100, "weights": [3.0, 3.0], "bias": 1.5},
    ]

    agg_w, agg_b = federated_averaging(client_updates)
    assert np.allclose(agg_w, [2.0, 2.0])
    assert np.isclose(agg_b, 1.0)

def test_differential_privacy_noise():
    dp = DifferentialPrivacyMechanism(epsilon=1.0, clip_norm=1.0)
    local_w = [2.0, 2.0]
    global_w = [0.0, 0.0]
    
    priv_w, priv_b, meta = dp.apply_differential_privacy(
        local_weights=local_w,
        local_bias=0.5,
        global_weights=global_w,
        global_bias=0.0,
        n_samples=100
    )
    assert meta["dp_applied"] is True
    assert meta["clipped"] is True  # norm of [2, 2] = 2.82 > 1.0
    assert len(priv_w) == 2

def test_update_checksum_integrity():
    update = {
        "hospital_id": 1,
        "round_number": 2,
        "sample_count": 250,
        "weights": [0.123456, 0.654321],
        "bias": 0.05
    }
    checksum = compute_update_checksum(update)
    assert verify_update_integrity(update, checksum) is True
    # If tampered
    tampered = update.copy()
    tampered["bias"] = 0.99
    assert verify_update_integrity(tampered, checksum) is False

def test_auth_login_api():
    res = client.post("/api/auth/login", json={
        "email": "admin@federatedhealth.ai",
        "password": "Admin@12345"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "SUPER_ADMIN"

def test_federated_status_api():
    # Login as Admin first
    login_res = client.post("/api/auth/login", json={
        "email": "admin@federatedhealth.ai",
        "password": "Admin@12345"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/federated/status", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "global_model_version" in data
    assert "active_hospitals" in data

def test_prediction_api():
    login_res = client.post("/api/auth/login", json={
        "email": "doctor@metrohospital.org",
        "password": "Doctor@12345"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    sample_features = {
        "age": 62.0,
        "sex": 1.0,
        "chest_pain_type": 2.0,
        "resting_bp": 145.0,
        "cholesterol": 260.0,
        "fasting_blood_sugar": 1.0,
        "resting_ecg": 1.0,
        "max_heart_rate": 130.0,
        "exercise_angina": 1.0,
        "st_depression": 2.1
    }
    res = client.post("/api/predictions", json={
        "features": sample_features
    }, headers=headers)
    assert res.status_code == 200
    pred = res.json()
    assert "prediction_result" in pred
    assert "confidence" in pred
    assert "disclaimer" in pred
