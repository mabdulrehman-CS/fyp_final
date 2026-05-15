from datetime import datetime, timedelta
from typing import Any, Dict, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_admin
from app.core.security import get_password_hash, verify_password
from app.models import ActivityLog


router = APIRouter()


@router.get("/admin/rubrics")
async def get_rubrics(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
) -> List[Dict[str, Any]]:
    cursor = db["rubrics"].find({})
    items: List[Dict[str, Any]] = []
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
        items.append(doc)
    return items


@router.post("/admin/rubrics")
async def upsert_rubrics(
    rubrics: List[Dict[str, Any]],
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    await db["rubrics"].delete_many({})
    if rubrics:
        await db["rubrics"].insert_many(rubrics)
    return {"status": "ok"}


@router.get("/admin/settings")
async def get_settings(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    doc = await db["settings"].find_one({"_id": "global"})
    if not doc:
        return {"id": "global", "passingThresholdCoding": 60, "passingThresholdBehavioral": 65, "passingThresholdTechnical": 62}
    doc["id"] = doc["_id"]
    del doc["_id"]
    return doc


@router.post("/admin/settings")
async def update_settings(
    payload: Dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    await db["settings"].update_one({"_id": "global"}, {"$set": payload}, upsert=True)
    
    # Log activity
    log = ActivityLog(
        action="update_settings",
        admin_email=admin.get("email"),
        timestamp=datetime.utcnow(),
        metadata={"settings_updated": list(payload.keys())},
    )
    await db["activity_logs"].insert_one(log.dict(by_alias=True))
    
    return {"status": "ok"}


class AdminPasswordChange(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


@router.get("/admin/profile")
async def get_admin_profile(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Get current admin profile information."""
    return {
        "email": admin.get("email"),
        "role": admin.get("role"),
        "name": admin.get("profile_info", {}).get("name", "Admin"),
    }


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


@router.post("/admin/change-password")
async def change_admin_password(
    payload: AdminPasswordChange,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Change admin password. Requires current password verification."""
    admin_id = admin.get("_id")
    if not admin_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Admin ID not found")
    
    # Validate new password requirements
    password_errors = validate_password_requirements(payload.new_password)
    if password_errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=password_errors[0]  # Return first error message
        )
    
    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match"
        )
    
    # Get current admin from database
    admin_doc = await db["users"].find_one({"_id": ObjectId(admin_id)})
    if not admin_doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin not found")
    
    # Verify current password
    stored_hash = admin_doc.get("password_hash") or admin_doc.get("password")
    if not stored_hash or not verify_password(payload.current_password, stored_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Update password
    new_password_hash = get_password_hash(payload.new_password)
    await db["users"].update_one(
        {"_id": ObjectId(admin_id)},
        {"$set": {"password_hash": new_password_hash}}
    )
    
    return {"status": "ok", "message": "Password changed successfully"}


@router.get("/admin/stats")
async def get_admin_stats(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    total_candidates = await db["users"].count_documents({"role": "candidate"})
    # Count only active sessions created in the last 1 hour (truly active)
    one_hour_ago = datetime.utcnow() - timedelta(hours=1)
    active_sessions = await db["interview_sessions"].count_documents({
        "status": "active",
        "created_at": {"$gte": one_hour_ago}
    })
    total_questions = await db["questions"].count_documents({})

    # New users trends (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=6)
    pipeline = [
        {"$match": {"role": "candidate", "created_at": {"$gte": seven_days_ago}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$created_at"},
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    trend_cursor = db["users"].aggregate(pipeline)
    trend_map: Dict[str, int] = {}
    async for doc in trend_cursor:
        trend_map[doc["_id"]] = doc["count"]

    new_users_trend: List[Dict[str, Any]] = []
    for i in range(7):
        day = seven_days_ago + timedelta(days=i)
        key = day.strftime("%Y-%m-%d")
        new_users_trend.append({"day": day.strftime("%a"), "date": key, "new_users": trend_map.get(key, 0)})

    # Question category distribution from question bank
    question_category_pipeline = [
        {"$match": {"category": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$category", "value": {"$sum": 1}}},
        {"$project": {"name": "$_id", "value": 1, "_id": 0}},
    ]
    question_category_cursor = db["questions"].aggregate(question_category_pipeline)
    category_distribution: List[Dict[str, Any]] = []
    async for doc in question_category_cursor:
        if doc.get("name"):  # Only add if name exists
            category_distribution.append(doc)
    
    # Map backend category names to frontend display names
    category_mapping = {
        "Coding": "Programming",
        "Programming": "Technical",
        "Behavioral": "Behavioral",
        "System Design": "System Design",
    }
    
    # Transform category names to frontend display names
    mapped_distribution: List[Dict[str, Any]] = []
    for item in category_distribution:
        backend_name = item["name"]
        frontend_name = category_mapping.get(backend_name, backend_name)
        # Check if we already have this frontend name
        existing = next((x for x in mapped_distribution if x["name"] == frontend_name), None)
        if existing:
            existing["value"] += item["value"]
        else:
            mapped_distribution.append({"name": frontend_name, "value": item["value"]})
    
    # Ensure all expected categories are represented (even if 0)
    expected_categories = ["Behavioral", "Programming", "System Design", "Technical"]
    existing_categories = {item["name"]: item["value"] for item in mapped_distribution}
    category_distribution = [
        {"name": cat, "value": existing_categories.get(cat, 0)}
        for cat in expected_categories
    ]

    # Get recent activity logs (admin actions only)
    cursor = db["activity_logs"].find({}).sort("timestamp", -1).limit(10)
    recent_activity: List[Dict[str, Any]] = []
    async for doc in cursor:
        recent_activity.append(
            {
                "id": str(doc["_id"]),
                "action": doc.get("action"),
                "admin_email": doc.get("admin_email"),
                "timestamp": doc.get("timestamp"),
                "metadata": doc.get("metadata", {}),
            }
        )

    # Count completed interviews
    completed_sessions = await db["interview_sessions"].count_documents({"status": "completed"})

    return {
        "total_candidates": total_candidates,
        "active_sessions": active_sessions,
        "total_questions": total_questions,
        "completed_sessions": completed_sessions,
        "recent_activity": recent_activity,
        "new_users_trend": new_users_trend,
        "category_distribution": category_distribution,
    }


@router.get("/admin/analytics/score-distribution")
async def get_score_distribution(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Get score distribution from completed interview sessions."""
    # Get all completed sessions with scores
    pipeline = [
        {"$match": {"status": "completed", "scores.overall": {"$exists": True, "$ne": None}}},
        {
            "$project": {
                "score": "$scores.overall",
            }
        },
    ]
    
    cursor = db["interview_sessions"].aggregate(pipeline)
    scores: List[float] = []
    async for doc in cursor:
        score = doc.get("score", 0)
        if isinstance(score, (int, float)) and 0 <= score <= 100:
            scores.append(float(score))
    
    # Initialize ranges
    ranges = {
        "0-10": 0,
        "10-20": 0,
        "20-30": 0,
        "30-40": 0,
        "40-50": 0,
        "50-60": 0,
        "60-70": 0,
        "70-80": 0,
        "80-90": 0,
        "90-100": 0,
    }
    
    # Group scores into ranges
    for score in scores:
        if 0 <= score < 10:
            ranges["0-10"] += 1
        elif 10 <= score < 20:
            ranges["10-20"] += 1
        elif 20 <= score < 30:
            ranges["20-30"] += 1
        elif 30 <= score < 40:
            ranges["30-40"] += 1
        elif 40 <= score < 50:
            ranges["40-50"] += 1
        elif 50 <= score < 60:
            ranges["50-60"] += 1
        elif 60 <= score < 70:
            ranges["60-70"] += 1
        elif 70 <= score < 80:
            ranges["70-80"] += 1
        elif 80 <= score < 90:
            ranges["80-90"] += 1
        elif 90 <= score <= 100:
            ranges["90-100"] += 1
    
    # Convert to list format for frontend, maintaining order
    range_order = ["0-10", "10-20", "20-30", "30-40", "40-50", "50-60", "60-70", "70-80", "80-90", "90-100"]
    distribution = [{"range": k, "count": ranges[k]} for k in range_order]
    
    return distribution


@router.get("/admin/analytics/skill-performance")
async def get_skill_performance(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Get skill performance data for the 4 interview categories."""
    # Get all completed sessions with scores
    cursor = db["interview_sessions"].find({"status": "completed", "scores.overall": {"$exists": True, "$ne": None}})
    
    # Initialize category scores
    category_scores = {
        "Technical": [],
        "Behavioral": [],
        "Programming": [],
        "Architecture": [],  # Better name for System Design
    }
    
    # Collect scores by category
    async for doc in cursor:
        scores = doc.get("scores", {})
        overall = scores.get("overall", 0)
        
        # Since each interview consists of all 4 categories, use category-specific scores if available
        # Otherwise, use overall score for all categories (as each interview includes all 4)
        technical_score = scores.get("technical") or scores.get("Technical") or overall
        behavioral_score = scores.get("behavioral") or scores.get("Behavioral") or overall
        programming_score = scores.get("programming") or scores.get("Programming") or overall
        architecture_score = scores.get("architecture") or scores.get("Architecture") or scores.get("system_design") or scores.get("System Design") or overall
        
        # Add scores to respective categories (each interview contributes to all 4)
        if isinstance(technical_score, (int, float)) and 0 <= technical_score <= 100:
            category_scores["Technical"].append(float(technical_score))
        if isinstance(behavioral_score, (int, float)) and 0 <= behavioral_score <= 100:
            category_scores["Behavioral"].append(float(behavioral_score))
        if isinstance(programming_score, (int, float)) and 0 <= programming_score <= 100:
            category_scores["Programming"].append(float(programming_score))
        if isinstance(architecture_score, (int, float)) and 0 <= architecture_score <= 100:
            category_scores["Architecture"].append(float(architecture_score))
    
    # Calculate averages and counts
    skill_performance = []
    category_order = ["Technical", "Behavioral", "Programming", "Architecture"]
    
    # Get passing threshold from settings (default 60%)
    settings_doc = await db["settings"].find_one({"_id": "global"})
    passing_threshold = 60
    # Use category-specific thresholds if available
    threshold_map = {
        "Technical": settings_doc.get("passingThresholdTechnical", 62) if settings_doc else 62,
        "Behavioral": settings_doc.get("passingThresholdBehavioral", 65) if settings_doc else 65,
        "Programming": settings_doc.get("passingThresholdCoding", 60) if settings_doc else 60,
        "Architecture": settings_doc.get("passingThresholdTechnical", 62) if settings_doc else 62,  # Use Technical threshold for Architecture
    }
    
    for category in category_order:
        scores_list = category_scores[category]
        if scores_list:
            avg_score = sum(scores_list) / len(scores_list)
            attempts = len(scores_list)
            # Calculate real pass rate based on threshold
            threshold = threshold_map.get(category, passing_threshold)
            passed = sum(1 for s in scores_list if s >= threshold)
            pass_rate = (passed / attempts * 100) if attempts > 0 else 0
        else:
            avg_score = 0
            attempts = 0
            pass_rate = 0
        
        skill_performance.append({
            "skill": category,
            "avgScore": round(avg_score, 1),
            "attempts": attempts,
            "passRate": round(pass_rate, 1),
        })
    
    return skill_performance


