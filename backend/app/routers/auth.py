import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel, EmailStr

from app.core.email_service import send_password_reset_otp_email
from app.core.security import create_access_token, get_password_hash, verify_password
from app.database import get_db
from app.models import User


router = APIRouter()


from typing import Optional


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyResetOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


def validate_password_requirements(password: str) -> list[str]:
    """Validate password and return list of error messages."""
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    if not any(c.isupper() for c in password):
        errors.append("Password must contain at least one uppercase letter (A-Z)")
    
    if not any(c.islower() for c in password):
        errors.append("Password must contain at least one lowercase letter (a-z)")
    
    if not any(c.isdigit() for c in password):
        errors.append("Password must contain at least one number (0-9)")
    
    if not any(c in "!@#$%^&*" for c in password):
        errors.append("Password must contain at least one special character (!@#$%^&*)")
    
    return errors


@router.get("/check-email")
async def check_email_exists(
    email: str = Query(..., description="Email address to check"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Check if an email is already registered. Public endpoint for signup validation."""
    users = db["users"]
    # Check with case-insensitive email comparison
    email_lower = email.lower().strip()
    existing = await users.find_one({"email": email_lower})
    print(f"[CHECK-EMAIL] Checking email: {email_lower}, exists: {existing is not None}")
    return {"exists": existing is not None}


@router.post("/signup", response_model=User, status_code=status.HTTP_201_CREATED)
async def signup_candidate(payload: SignupRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    users = db["users"]
    email_lower = payload.email.lower().strip()
    existing = await users.find_one({"email": email_lower})
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    # Validate password requirements
    password_errors = validate_password_requirements(payload.password)
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_errors[0]
        )

    user = User(
        email=email_lower,
        password_hash=get_password_hash(payload.password),
        role="candidate",
        created_at=datetime.utcnow(),
        profile_info={"name": payload.name} if payload.name else {},
        status="active",
    )
    user_dict = user.dict(by_alias=True, exclude_none=True)
    print(f"Creating candidate user: email={payload.email}, role={user_dict.get('role')}")
    res = await users.insert_one(user_dict)
    user.id = str(res.inserted_id)  # type: ignore[attr-defined]
    print(f"Candidate created successfully: _id={res.inserted_id}, email={payload.email}")

    # Automatically send OTP for email verification
    try:
        otp_code = str(random.randint(100000, 999999))
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        await db["signup_otps"].delete_many({"email": email_lower})
        await db["signup_otps"].insert_one({
            "email": email_lower,
            "otp": otp_code,
            "expires_at": expires_at,
            "created_at": datetime.utcnow(),
        })
        # Try to send email — if email not configured, print OTP to logs
        from app.core.email_service import send_signup_otp_email
        sent = send_signup_otp_email(payload.email, otp_code, payload.name or "")
        if not sent:
            print(f"[SIGNUP OTP] Email not sent. OTP for {email_lower}: {otp_code}")
    except Exception as e:
        print(f"[SIGNUP OTP] Error sending OTP: {e}")

    return user


class SendSignupOTPRequest(BaseModel):
    email: EmailStr


class VerifySignupOTPRequest(BaseModel):
    email: EmailStr
    otp: str


@router.post("/send-signup-otp")
async def send_signup_otp(
    payload: SendSignupOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Resend signup OTP to email."""
    email_lower = payload.email.lower().strip()
    user = await db["users"].find_one({"email": email_lower})
    if not user:
        raise HTTPException(status_code=404, detail="Email not found. Please sign up first.")

    otp_code = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    await db["signup_otps"].delete_many({"email": email_lower})
    await db["signup_otps"].insert_one({
        "email": email_lower,
        "otp": otp_code,
        "expires_at": expires_at,
        "created_at": datetime.utcnow(),
    })
    from app.core.email_service import send_signup_otp_email
    name = (user.get("profile_info") or {}).get("name", "")
    sent = send_signup_otp_email(payload.email, otp_code, name)
    if not sent:
        print(f"[SIGNUP OTP] Email not configured. OTP for {email_lower}: {otp_code}")
        # Still return success so frontend can proceed; user sees code in backend logs
    return {"message": "OTP sent to your email", "email": email_lower}


@router.post("/verify-signup-otp")
async def verify_signup_otp(
    payload: VerifySignupOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify signup OTP and mark email as verified."""
    email_lower = payload.email.lower().strip()
    otp_record = await db["signup_otps"].find_one({"email": email_lower})

    if not otp_record:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")

    if otp_record["otp"] != payload.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP. Please check and try again.")

    if datetime.utcnow() > otp_record["expires_at"]:
        await db["signup_otps"].delete_one({"_id": otp_record["_id"]})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new one.")

    # Mark user as email verified
    await db["users"].update_one(
        {"email": email_lower},
        {"$set": {"email_verified": True, "status": "active"}}
    )
    await db["signup_otps"].delete_one({"_id": otp_record["_id"]})

    # Return access token so the user is logged in
    user = await db["users"].find_one({"email": email_lower})
    from app.core.security import create_access_token
    token = create_access_token(
        subject=str(user["_id"]),
        extra_data={"email": user["email"], "role": user.get("role", "candidate")},
    )
    return {"message": "Email verified successfully", "access_token": token, "token_type": "bearer"}




@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    OAuth2-compatible login endpoint.
    Frontend can send { username: email, password } in form-encoded body.
    """
    users = db["users"]
    # Check with case-insensitive email comparison
    email_lower = form_data.username.lower().strip()
    user = await users.find_one({"email": email_lower})
    # Support both new schema (password_hash) and any legacy documents (password)
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")
    
    # Check if user is banned
    if user.get("status") == "banned":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been banned. Please contact the administrator."
        )
    
    stored_hash = user.get("password_hash") or user.get("password")
    if not stored_hash or not verify_password(form_data.password, stored_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect email or password")

    token = create_access_token(
        subject=str(user["_id"]),
        extra_data={"email": user["email"], "role": user.get("role", "candidate")},
    )
    return TokenResponse(access_token=token)


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Send OTP to user's email for password reset. Only works if email exists."""
    users = db["users"]
    otps = db["password_reset_otps"]
    
    # Check if email exists (case-insensitive)
    email_lower = payload.email.lower().strip()
    user = await users.find_one({"email": email_lower})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account found with this email address. Please check your email or sign up first."
        )
    
    # Generate 6-digit OTP
    otp_code = str(random.randint(100000, 999999))
    expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Delete any existing OTP for this email
    await otps.delete_many({"email": email_lower})
    
    # Save OTP to database
    await otps.insert_one({
        "email": email_lower,
        "otp": otp_code,
        "expires_at": expires_at,
        "created_at": datetime.utcnow(),
    })
    
    # Send OTP via email
    email_sent = send_password_reset_otp_email(payload.email, otp_code)
    
    if not email_sent:
        print(f"[FORGOT PASSWORD] Email not sent. OTP for {email_lower}: {otp_code}")
        # Don't block the flow — OTP is in backend logs for debugging
    else:
        print(f"[FORGOT PASSWORD] OTP sent to {email_lower}")
    
    return {"message": "OTP sent successfully to your email", "email": email_lower}


@router.post("/verify-reset-otp")
async def verify_reset_otp(
    payload: VerifyResetOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Verify OTP for password reset."""
    otps = db["password_reset_otps"]
    email_lower = payload.email.lower().strip()
    
    # Find OTP record
    otp_record = await otps.find_one({"email": email_lower})
    
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    # Check if OTP matches
    if otp_record["otp"] != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP"
        )
    
    # Check if OTP is expired
    if datetime.utcnow() > otp_record["expires_at"]:
        await otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )
    
    return {"valid": True, "message": "OTP verified successfully"}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """Reset password after OTP verification."""
    users = db["users"]
    otps = db["password_reset_otps"]
    email_lower = payload.email.lower().strip()
    
    # Verify OTP first
    otp_record = await otps.find_one({"email": email_lower})
    
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP"
        )
    
    if otp_record["otp"] != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP"
        )
    
    if datetime.utcnow() > otp_record["expires_at"]:
        await otps.delete_one({"_id": otp_record["_id"]})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OTP has expired. Please request a new one."
        )
    
    # Validate new password
    password_errors = validate_password_requirements(payload.new_password)
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_errors[0]
        )
    
    # Update password
    new_password_hash = get_password_hash(payload.new_password)
    await users.update_one(
        {"email": email_lower},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    # Delete used OTP
    await otps.delete_one({"_id": otp_record["_id"]})
    
    return {"message": "Password reset successfully"}


