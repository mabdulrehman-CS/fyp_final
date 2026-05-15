from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError  # v2 reload trigger
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# Load environment variables from .env file
load_dotenv()

from .core.config import get_settings
from .database import get_database
from .routers import admin, auth, questions, sessions, testcases, users, interview


app = FastAPI(title="IntraView AI Backend", version="0.1.0")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Custom handler for validation errors to provide better error messages.
    """
    errors = exc.errors()
    error_messages = []
    for error in errors:
        field = ".".join(str(loc) for loc in error["loc"])
        msg = error["msg"]
        error_messages.append(f"{field}: {msg}")
    
    print(f"[VALIDATION ERROR] {request.url.path}: {', '.join(error_messages)}")
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={"detail": ", ".join(error_messages)},
    )


@app.on_event("startup")
async def startup_event() -> None:
    # Ensure database client is initialized on startup
    get_database()
    
    # Pre-pull docker images for the coding sandbox to prevent sandbox timeouts
    from .services.code_sandbox import ensure_images_loaded
    ensure_images_loaded()


settings = get_settings()

# Print CORS origins for debugging
print(f"[CORS] Allowed origins: {settings.BACKEND_CORS_ORIGINS}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok"}


# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, tags=["users"])
app.include_router(questions.router, tags=["questions"])
app.include_router(testcases.router, tags=["testcases"])
app.include_router(sessions.router, tags=["sessions"])
app.include_router(admin.router, tags=["admin"])
app.include_router(interview.router, tags=["interview"])



