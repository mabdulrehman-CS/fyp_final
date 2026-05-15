from datetime import datetime
from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.database import get_db
from app.deps import get_current_admin


router = APIRouter()


def _to_str_id(doc: Any) -> Any:
    if isinstance(doc, dict):
        # Convert _id to id
        if "_id" in doc:
            doc["id"] = str(doc["_id"])
            del doc["_id"]
        # Convert all ObjectId fields to strings
        for key, value in list(doc.items()):
            if isinstance(value, ObjectId):
                doc[key] = str(value)
    return doc


@router.get("/admin/sessions/live")
async def get_live_sessions(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
):
    """Get active/live interview sessions."""
    try:
        skip = (page - 1) * limit
        query = {"status": "active"}
        
        total = await db["interview_sessions"].count_documents(query)
        print(f"[Sessions API] Live sessions query: {query}, total: {total}, page: {page}, limit: {limit}")
        cursor = db["interview_sessions"].find(query).sort("start_time", -1).skip(skip).limit(limit)
        
        items: List[Dict[str, Any]] = []
        async for doc in cursor:
            try:
                # Handle start_time
                created_at = doc.get("start_time")
                if not created_at:
                    created_at = datetime.utcnow()
                
                # Calculate duration
                try:
                    if isinstance(created_at, datetime):
                        duration_seconds = int((datetime.utcnow() - created_at).total_seconds())
                    else:
                        duration_seconds = 0
                    minutes = duration_seconds // 60
                    seconds = duration_seconds % 60
                    duration_str = f"{minutes}:{seconds:02d}"
                except (TypeError, AttributeError):
                    duration_str = "0:00"
                
                # Calculate progress
                qa_responses = doc.get("qa_responses", [])
                current_q = len(qa_responses)
                # We assume total 10 unless specified
                total_q = doc.get("total_questions", 10)
                progress = int((current_q / total_q) * 100) if total_q > 0 else 0
                
                # Format start time
                try:
                    if isinstance(created_at, datetime) and hasattr(created_at, "strftime"):
                        try:
                            start_time_str = created_at.strftime("%-I:%M %p")
                        except ValueError:
                            start_time_str = created_at.strftime("%I:%M %p").lstrip("0")
                    else:
                        start_time_str = "N/A"
                except Exception:
                    start_time_str = "N/A"
                
                doc = _to_str_id(doc)
                doc["duration"] = duration_str
                doc["progress"] = progress
                doc["current_question"] = current_q
                doc["total_questions"] = total_q
                doc["start_time"] = created_at.isoformat() if isinstance(created_at, datetime) else start_time_str
                doc["formatted_start_time"] = start_time_str
                doc["question"] = f"Question {current_q}/{total_q}" if doc.get("status") == "active" else "Pre-check"
                doc["interview_type"] = doc.get("interview_type", "General")
                
                items.append(doc)
            except Exception as e:
                print(f"[Sessions API] Error processing live session {doc.get('_id')}: {e}")
                continue
    
        print(f"[Sessions API] Returning {len(items)} live sessions")
        
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        print(f"[Sessions API] Error in get_live_sessions: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching live sessions: {str(e)}")


@router.get("/admin/sessions/history")
async def get_session_history(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
):
    """Get completed/cancelled interview sessions."""
    try:
        skip = (page - 1) * limit
        query = {"status": {"$in": ["completed", "cancelled"]}}
        
        total = await db["interview_sessions"].count_documents(query)
        print(f"[Sessions API] History query: {query}, total: {total}, page: {page}, limit: {limit}")
        cursor = db["interview_sessions"].find(query).sort("end_time", -1).skip(skip).limit(limit)
        
        items: List[Dict[str, Any]] = []
        async for doc in cursor:
            try:
                # Handle created_at/end_time
                created_at = doc.get("end_time") or doc.get("start_time")
                if not created_at:
                    created_at = datetime.utcnow()
                
                # Format date
                try:
                    if isinstance(created_at, datetime) and hasattr(created_at, "strftime"):
                        try:
                            date_str = created_at.strftime("%b %d, %-I%p")
                        except ValueError:
                            hour = created_at.strftime("%I").lstrip("0")
                            date_str = created_at.strftime(f"%b %d, {hour}%p")
                    else:
                        date_str = "N/A"
                except Exception:
                    date_str = "N/A"
                
                # Get duration
                final_report = doc.get("final_report", {})
                duration_min = final_report.get("duration_minutes", 0)
                
                if duration_min == 0 and doc.get("start_time") and doc.get("end_time"):
                    st = doc.get("start_time")
                    et = doc.get("end_time")
                    if isinstance(st, datetime) and isinstance(et, datetime):
                        duration_min = int((et - st).total_seconds() / 60)
                
                duration_str = f"{duration_min} min" if duration_min > 0 else "N/A"
                
                # Get score
                score = final_report.get("overall_score", 0)
                score_str = f"{int(score)}%" if score > 0 else "N/A"
                
                doc = _to_str_id(doc)
                doc["date"] = date_str
                doc["start_time"] = created_at.isoformat() if isinstance(created_at, datetime) else date_str
                doc["formatted_start_time"] = date_str
                doc["duration"] = duration_str
                doc["score"] = score_str if doc.get("status") == "completed" else "N/A"
                doc["interview_type"] = doc.get("interview_type", "General")
                
                # Progress calculation for history
                qa_responses = doc.get("qa_responses", [])
                current_q = len(qa_responses)
                total_q = doc.get("total_questions", 10)
                doc["current_question"] = current_q
                doc["total_questions"] = total_q
                doc["progress"] = int((current_q / total_q) * 100) if total_q > 0 else 0
                
                items.append(doc)
            except Exception as e:
                print(f"[Sessions API] Error processing history session {doc.get('_id')}: {e}")
                continue
    
        print(f"[Sessions API] Returning {len(items)} history sessions")
        
        return {"items": items, "total": total, "page": page, "limit": limit}
    except Exception as e:
        print(f"[Sessions API] Error in get_session_history: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error fetching session history: {str(e)}")

