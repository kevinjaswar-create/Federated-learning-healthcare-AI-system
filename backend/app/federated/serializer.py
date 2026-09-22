import hashlib
import json
from typing import Dict, Any, Tuple

def compute_update_checksum(update_dict: Dict[str, Any]) -> str:
    """Computes a deterministic SHA-256 integrity hash of model update parameters."""
    core_payload = {
        "hospital_id": update_dict.get("hospital_id"),
        "round_number": update_dict.get("round_number"),
        "sample_count": update_dict.get("sample_count"),
        "weights": [round(float(w), 6) for w in update_dict.get("weights", [])],
        "bias": round(float(update_dict.get("bias", 0.0)), 6),
    }
    encoded = json.dumps(core_payload, sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()

def verify_update_integrity(update_dict: Dict[str, Any], expected_checksum: str) -> bool:
    """Verifies that the transmitted model update has not been corrupted or tampered with."""
    computed = compute_update_checksum(update_dict)
    return computed == expected_checksum
