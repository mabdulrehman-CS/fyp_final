from functools import lru_cache
from typing import List
import os


class Settings:
    PROJECT_NAME: str = "IntraView AI Backend"
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "CHANGE_ME_IN_PRODUCTION")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Groq API
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    # YouTube Data API v3
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")

    # MongoDB
    MONGO_URL: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    DB_NAME: str = os.getenv("MONGODB_DB_NAME", "intraview_ai")

    # Docker sandbox
    SANDBOX_IMAGES = {
        "python": "python:3.11-slim",
        "javascript": "node:18-slim",
        "java": "openjdk:11-slim",
        "cpp": "gcc:latest",
    }

    # Interview settings
    MAX_INTERVIEW_DURATION: int = 900  # 15 minutes
    CODING_PHASE_DURATION: int = 1800  # 30 minutes
    BEHAVIORAL_FRAME_INTERVAL: int = 5  # analyze every 5 seconds

    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
