import os

class Settings:
    PROJECT_NAME: str = "AI-Driven Collaborative Federated Learning Platform"
    PROJECT_VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"
    
    # Security
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super-secret-production-jwt-key-fl-healthcare-2026")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")) # 24 hours
    
    # Database (PostgreSQL if provided, fallback to SQLite for local development)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./federated_learning.db")
    
    # Federated Learning Config
    DATA_DIR: str = os.getenv("DATA_DIR", "./data")
    MODELS_DIR: str = os.getenv("MODELS_DIR", "./models_storage")
    DEFAULT_AGGREGATION_METHOD: str = "FedAvg"
    
    # Differential Privacy parameters
    DP_ENABLED: bool = os.getenv("DP_ENABLED", "false").lower() in ("true", "1", "yes")
    DP_EPSILON: float = float(os.getenv("DP_EPSILON", "1.5"))
    DP_CLIP_NORM: float = float(os.getenv("DP_CLIP_NORM", "1.0"))

settings = Settings()
