import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.core.config import settings
from backend.app.database.session import engine, Base
from backend.app.seed import seed_database
from backend.app.ml.dataset_config import DEFAULT_HEART_DISEASE_CONFIG

from backend.app.api.auth import router as auth_router
from backend.app.api.hospitals import router as hospitals_router
from backend.app.api.datasets import router as datasets_router
from backend.app.api.training import router as training_router
from backend.app.api.federated import router as federated_router
from backend.app.api.models import router as models_router
from backend.app.api.predictions import router as predictions_router
from backend.app.api.audit_logs import router as audit_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure database schema is initialized
    Base.metadata.create_all(bind=engine)
    seed_database()
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    description="Privacy-Preserving Collaborative Federated Learning Platform for Multi-Hospital Disease Prediction",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health endpoint
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.PROJECT_VERSION,
        "aggregation_protocol": "FedAvg",
        "framework": "Privacy-Preserving Collaborative Federated Learning"
    }

# Dynamic Dataset Config Endpoint for UI form generation
@app.get("/api/config/dataset", tags=["Dataset Config"])
def get_dataset_configuration():
    return DEFAULT_HEART_DISEASE_CONFIG

# Mount API routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(hospitals_router, prefix=settings.API_V1_STR)
app.include_router(datasets_router, prefix=settings.API_V1_STR)
app.include_router(training_router, prefix=settings.API_V1_STR)
app.include_router(federated_router, prefix=settings.API_V1_STR)
app.include_router(models_router, prefix=settings.API_V1_STR)
app.include_router(predictions_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
