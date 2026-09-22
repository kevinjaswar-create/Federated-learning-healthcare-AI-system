import os
import sys
import unittest
from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError

# Ensure repo root in path
sys.path.insert(0, os.path.abspath("."))

from backend.app.database.session import SessionLocal, engine
from backend.app.models.entities import (
    User,
    Hospital,
    Dataset,
    TrainingRun,
    FederatedRound,
    ModelRecord,
    Prediction,
    AuditLog,
    utcnow,
)

class TestDatabaseArchitecture(unittest.TestCase):
    def setUp(self):
        self.db = SessionLocal()

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def test_01_read_seeded_data(self):
        """Verify seeded hospitals and users exist with proper relationships."""
        hospitals = self.db.query(Hospital).all()
        self.assertGreaterEqual(len(hospitals), 5)
        
        users = self.db.query(User).all()
        self.assertGreaterEqual(len(users), 7)
        
        admin_user = self.db.query(User).filter(User.email == "admin@federatedhealth.ai").first()
        self.assertIsNotNone(admin_user)
        self.assertEqual(admin_user.role, "SUPER_ADMIN")

    def test_02_hospital_crud(self):
        """Test Create, Read, Update, Delete for Hospital entity."""
        test_code = "TEST-HOSP-99"
        # 1. Create
        new_hosp = Hospital(
            hospital_name="Community Test Hospital",
            hospital_code=test_code,
            location="Seattle, WA",
            contact_email="test@communityhosp.org",
            status="ACTIVE",
        )
        self.db.add(new_hosp)
        self.db.commit()

        # 2. Read
        fetched = self.db.query(Hospital).filter(Hospital.hospital_code == test_code).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.hospital_name, "Community Test Hospital")
        hosp_id = fetched.id

        # 3. Update
        fetched.status = "TRAINING"
        self.db.commit()
        updated = self.db.query(Hospital).filter(Hospital.id == hosp_id).first()
        self.assertEqual(updated.status, "TRAINING")

        # 4. Delete
        self.db.delete(updated)
        self.db.commit()
        deleted = self.db.query(Hospital).filter(Hospital.id == hosp_id).first()
        self.assertIsNone(deleted)

    def test_03_hospital_code_uniqueness_constraint(self):
        """Test unique constraint on hospital_code."""
        duplicate = Hospital(
            hospital_name="Duplicate Hospital",
            hospital_code="METRO-01",  # Existing in seed
            location="Somewhere",
            contact_email="dup@hospital.org",
            status="ACTIVE",
        )
        self.db.add(duplicate)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_04_user_email_uniqueness_constraint(self):
        """Test unique constraint on user email."""
        duplicate_user = User(
            name="Impostor Admin",
            email="admin@federatedhealth.ai",  # Existing in seed
            password_hash="fakehash",
            role="DOCTOR",
            status="ACTIVE",
        )
        self.db.add(duplicate_user)
        with self.assertRaises(IntegrityError):
            self.db.commit()
        self.db.rollback()

    def test_05_dataset_privacy_preservation(self):
        """Verify dataset table stores only metadata, no raw patient records centrally."""
        h1 = self.db.query(Hospital).filter(Hospital.hospital_code == "METRO-01").first()
        self.assertIsNotNone(h1)

        dataset = Dataset(
            hospital_id=h1.id,
            dataset_name="On-Premise Partition Metadata Only",
            record_count=150,
            feature_count=10,
            status="VALIDATED",
            file_path=f"data/hospital_{h1.id}/dataset.csv",
            schema_info={"feature_names": ["age", "sex"], "raw_data_stored_centrally": False},
        )
        self.db.add(dataset)
        self.db.commit()

        fetched = self.db.query(Dataset).filter(Dataset.id == dataset.id).first()
        self.assertEqual(fetched.record_count, 150)
        self.assertEqual(fetched.schema_info["raw_data_stored_centrally"], False)
        self.assertEqual(fetched.hospital.hospital_name, h1.hospital_name)

        # Clean up
        self.db.delete(fetched)
        self.db.commit()

    def test_06_model_record_and_active_version(self):
        """Test model creation with weights summary and active status."""
        version_tag = f"test_model_v{int(datetime.now().timestamp())}"
        model = ModelRecord(
            model_name="Experimental Model",
            model_version=version_tag,
            model_type="LogisticRegression",
            accuracy=0.852,
            parameters_summary={"weights": [0.1, 0.2], "bias": 0.05},
            is_active=False,
            status="READY",
        )
        self.db.add(model)
        self.db.commit()

        fetched = self.db.query(ModelRecord).filter(ModelRecord.model_version == version_tag).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.accuracy, 0.852)
        self.assertFalse(fetched.is_active)

        self.db.delete(fetched)
        self.db.commit()

    def test_07_prediction_crud_and_confidence(self):
        """Test prediction record insertion and confidence bounds."""
        pred = Prediction(
            hospital_id=1,
            model_version="global_model_v1.0",
            input_features={"age": 55, "sex": 1},
            prediction_result="Positive Risk (High Cardiac Event Probability)",
            confidence=0.887,
        )
        self.db.add(pred)
        self.db.commit()

        fetched = self.db.query(Prediction).filter(Prediction.id == pred.id).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.confidence, 0.887)

        self.db.delete(fetched)
        self.db.commit()

    def test_08_audit_log_generation(self):
        """Test audit trail recording and querying."""
        log = AuditLog(
            user_id=1,
            action="SECURITY_VALIDATION_TEST",
            resource="DatabaseArchitecture",
            status="SUCCESS",
            metadata_json={"phase": "PHASE_3", "verified": True},
        )
        self.db.add(log)
        self.db.commit()

        fetched = self.db.query(AuditLog).filter(AuditLog.id == log.id).first()
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.action, "SECURITY_VALIDATION_TEST")
        self.assertEqual(fetched.metadata_json["phase"], "PHASE_3")

        self.db.delete(fetched)
        self.db.commit()

    def test_09_relationships_back_populates(self):
        """Verify ORM relationships between Hospital, User, Dataset, and TrainingRuns."""
        metro = self.db.query(Hospital).filter(Hospital.hospital_code == "METRO-01").first()
        self.assertIsNotNone(metro)
        self.assertGreaterEqual(len(metro.users), 2)
        self.assertGreaterEqual(len(metro.datasets), 1)
        self.assertGreaterEqual(len(metro.training_runs), 1)

if __name__ == "__main__":
    unittest.main(verbosity=2)
