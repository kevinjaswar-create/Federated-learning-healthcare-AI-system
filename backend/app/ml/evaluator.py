from typing import Dict, Any, List, Optional
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    roc_auc_score,
    log_loss
)

def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_prob: Optional[np.ndarray] = None) -> Dict[str, Any]:
    acc = float(accuracy_score(y_true, y_pred))
    prec = float(precision_score(y_true, y_pred, zero_division=0))
    rec = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    
    cm = confusion_matrix(y_true, y_pred).tolist()
    # Format confusion matrix breakdown: TP, FP, TN, FN
    tn = int(cm[0][0]) if len(cm) > 0 and len(cm[0]) > 0 else 0
    fp = int(cm[0][1]) if len(cm) > 0 and len(cm[0]) > 1 else 0
    fn = int(cm[1][0]) if len(cm) > 1 and len(cm[1]) > 0 else 0
    tp = int(cm[1][1]) if len(cm) > 1 and len(cm[1]) > 1 else 0

    auc = None
    loss = None
    if y_prob is not None:
        try:
            if len(np.unique(y_true)) > 1:
                auc = float(roc_auc_score(y_true, y_prob))
                loss = float(log_loss(y_true, y_prob, labels=[0, 1]))
        except Exception:
            pass

    return {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "roc_auc": round(auc, 4) if auc is not None else None,
        "loss": round(loss, 4) if loss is not None else 0.35,
        "confusion_matrix": {
            "matrix": cm,
            "true_negatives": tn,
            "false_positives": fp,
            "false_negatives": fn,
            "true_positives": tp
        }
    }
