from typing import List, Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from backend.app.database.session import get_db
from backend.app.models.entities import AuditLog, User
from backend.app.schemas.prediction import AuditLogOut
from backend.app.api.deps import get_current_user, require_roles

router = APIRouter(prefix="/audit-logs", tags=["Audit & Security"])

@router.get("", response_model=List[AuditLogOut])
def get_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(["SUPER_ADMIN", "HOSPITAL_ADMIN"]))
):
    query = db.query(AuditLog)
    if current_user.role == "HOSPITAL_ADMIN":
        # Hospital admin can see events associated with their own user account
        query = query.filter(AuditLog.user_id == current_user.id)
    
    logs = query.order_by(AuditLog.timestamp.desc()).limit(limit).all()
    results = []
    for l in logs:
        user_name = l.user.name if l.user else "System / Anonymous"
        results.append(AuditLogOut(
            id=l.id,
            user_id=l.user_id,
            user_name=user_name,
            action=l.action,
            resource=l.resource,
            status=l.status,
            timestamp=l.timestamp,
            metadata_json=l.metadata_json
        ))
    return results
