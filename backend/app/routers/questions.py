import os
import json
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

import google.generativeai as genai
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_admin
from app.models import ActivityLog, Question


router = APIRouter()


def _to_str_id(doc: Any) -> Any:
    if isinstance(doc, dict) and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


class QuestionCreate(BaseModel):
    title: str
    category: str
    difficulty: str = "Medium"
    description: str
    programming_subcategory: Optional[str] = None


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    difficulty: Optional[str] = None
    description: Optional[str] = None


class GenerateQuestionsRequest(BaseModel):
    prompt: str
    category: str
    difficulty: str = "Medium"
    programming_subcategory: Optional[str] = None
    count: int = 5


async def _log_activity(db: AsyncIOMotorDatabase, admin_email: str, action: str, metadata: Dict[str, Any]):
    log = ActivityLog(action=action, admin_email=admin_email, timestamp=datetime.utcnow(), metadata=metadata)
    # Clean up any legacy docs with null _id and ensure Mongo assigns a fresh ObjectId
    await db["activity_logs"].delete_many({"_id": None})
    await db["activity_logs"].insert_one(log.dict(by_alias=True, exclude_none=True))


@router.get("/questions")
async def list_questions(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    category: Optional[str] = None,
    programming_subcategory: Optional[str] = None,
    difficulty: Optional[str] = None,
):
    skip = (page - 1) * limit
    query: Dict[str, Any] = {}

    if search:
        # Use text search index for performance over 500k records
        query["$text"] = {"$search": search}
    if category:
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    if programming_subcategory:
        query["programming_subcategory"] = programming_subcategory
    if difficulty:
        query["difficulty"] = {"$regex": f"^{difficulty}$", "$options": "i"}

    total = await db["questions"].count_documents(query)
    cursor = db["questions"].find(query).sort("created_at", -1).skip(skip).limit(limit)

    items: List[Dict[str, Any]] = []
    async for doc in cursor:
        doc = _to_str_id(doc)
        # Normalize: ensure title exists (some docs have question_text instead)
        if not doc.get("title") and doc.get("question_text"):
            doc["title"] = doc["question_text"]
        if not doc.get("description") and doc.get("question_text"):
            doc["description"] = doc["question_text"]
        items.append(doc)

    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/questions/programming-subcategories")
async def get_programming_subcategories(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Get all unique programming subcategories."""
    pipeline = [
        {"$match": {"category": "Programming", "programming_subcategory": {"$exists": True, "$ne": None}}},
        {"$group": {"_id": "$programming_subcategory"}},
        {"$sort": {"_id": 1}},
    ]
    cursor = db["questions"].aggregate(pipeline)
    subcategories = []
    async for doc in cursor:
        subcategories.append(doc["_id"])
    return {"subcategories": subcategories}


@router.get("/questions/{question_id}")
async def get_question(
    question_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question id")
    
    doc = await db["questions"].find_one({"_id": ObjectId(question_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    
    doc = _to_str_id(doc)
    if not doc.get("title") and doc.get("question_text"):
        doc["title"] = doc["question_text"]
    if not doc.get("description") and doc.get("question_text"):
        doc["description"] = doc["question_text"]
    return doc


@router.post("/questions", status_code=status.HTTP_201_CREATED)
async def create_question(
    payload: QuestionCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    question = Question(
        title=payload.title,
        category=payload.category,
        difficulty=payload.difficulty,
        description=payload.description,
        created_at=datetime.utcnow(),
    )
    question_dict = question.dict(by_alias=True, exclude_none=True)
    if payload.programming_subcategory:
        question_dict["programming_subcategory"] = payload.programming_subcategory
    res = await db["questions"].insert_one(question_dict)
    created = await db["questions"].find_one({"_id": res.inserted_id})
    await _log_activity(
        db,
        admin_email=admin["email"],
        action="create_question",
        metadata={"question_id": str(res.inserted_id), "title": payload.title},
    )
    return _to_str_id(created)


@router.post("/questions/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_questions(
    payload: List[QuestionCreate],
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Bulk create questions from an array."""
    if not payload:
        raise HTTPException(status_code=400, detail="Empty list")
    
    docs = []
    for p in payload:
        question = Question(
            title=p.title,
            category=p.category,
            difficulty=p.difficulty,
            description=p.description,
            created_at=datetime.utcnow(),
        )
        q_dict = question.dict(by_alias=True, exclude_none=True)
        if p.programming_subcategory:
            q_dict["programming_subcategory"] = p.programming_subcategory
        docs.append(q_dict)
        
    res = await db["questions"].insert_many(docs)
    
    await _log_activity(
        db,
        admin_email=admin["email"],
        action="bulk_create_questions",
        metadata={"count": len(docs)},
    )
    return {"message": f"Successfully created {len(docs)} questions", "inserted_ids": [str(i) for i in res.inserted_ids]}


@router.put("/questions/{question_id}")
async def update_question(
    question_id: str,
    payload: QuestionUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question id")

    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    res = await db["questions"].update_one({"_id": ObjectId(question_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    doc = await db["questions"].find_one({"_id": ObjectId(question_id)})
    await _log_activity(
        db,
        admin_email=admin["email"],
        action="update_question",
        metadata={"question_id": question_id, "fields": list(update_data.keys())},
    )
    return _to_str_id(doc)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question id")

    await db["questions"].delete_one({"_id": ObjectId(question_id)})
    await _log_activity(
        db,
        admin_email=admin["email"],
        action="delete_question",
        metadata={"question_id": question_id},
    )
    return None


@router.post("/questions/generate")
async def generate_questions(
    payload: GenerateQuestionsRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Generate questions using Gemini API."""
    try:
        # Configure Gemini API
        api_key = os.getenv("GEMINI_API_KEY", "AIzaSyDtt3Gh57Dq3qgzdvm0BYHdtIi24uKRiug")
        genai.configure(api_key=api_key)
        
        # Use gemini-2.0-flash-exp or gemini-2.0-flash for faster responses, fallback to gemini-1.5-pro
        model = None
        model_names = ["gemini-2.0-flash-exp", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-pro"]
        for model_name in model_names:
            try:
                model = genai.GenerativeModel(model_name)
                print(f"[GEMINI] Using model: {model_name}")
                break
            except Exception as e:
                print(f"[GEMINI] Failed to initialize {model_name}: {e}")
                continue
        
        if model is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to initialize any Gemini model. Please check your API key and available models."
            )

        # Build the prompt
        category_context = ""
        if payload.category == "Programming" and payload.programming_subcategory:
            category_context = f" in the {payload.programming_subcategory} subcategory"
        
        system_prompt = f"""Generate exactly {payload.count} interview questions based on the following requirements:
- Category: {payload.category}{category_context}
- Difficulty Level: {payload.difficulty}
- User Request: {payload.prompt}

For each question, provide:
1. A clear, concise title (max 100 characters)
2. A detailed description that includes:
   - Problem statement or question
   - What the candidate should demonstrate
   - Any relevant context or background

Format your response as a JSON array where each question is an object with:
- "title": string (short title)
- "description": string (full question description)

Example format:
[
  {{
    "title": "Reverse a Linked List",
    "description": "Write a function to reverse a singly linked list. The function should take the head of the list as input and return the new head of the reversed list. Consider edge cases like empty lists and single-node lists."
  }},
  {{
    "title": "Two Sum Problem",
    "description": "Given an array of integers and a target sum, find two numbers that add up to the target. Return the indices of these two numbers. Assume there is exactly one solution and you cannot use the same element twice."
  }}
]

Return ONLY the JSON array, no additional text or markdown formatting."""

        # Generate questions
        print(f"[GEMINI] Generating {payload.count} questions with prompt: {payload.prompt[:50]}...")
        try:
            response = model.generate_content(system_prompt)
            
            # Extract text from response
            response_text = ""
            if hasattr(response, 'text'):
                response_text = response.text
            elif hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                    response_text = candidate.content.parts[0].text
                elif hasattr(candidate, 'text'):
                    response_text = candidate.text
            
            if not response_text:
                # Try to get any text representation
                response_text = str(response)
            
            response_text = response_text.strip()
            
            if not response_text:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Gemini API returned an empty response. Please try again."
                )
            print(f"[GEMINI] Received response (length: {len(response_text)})")
        except HTTPException:
            raise
        except Exception as e:
            print(f"[GEMINI] Error calling Gemini API: {type(e).__name__}: {e}")
            import traceback
            print(f"[GEMINI] Traceback: {traceback.format_exc()}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to call Gemini API: {str(e)}. Please check your API key and try again."
            )

        # Clean up the response (remove markdown code blocks if present)
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        response_text = response_text.strip()

        # Parse JSON
        try:
            questions_data = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from the response if it's wrapped in text
            json_match = re.search(r'\[.*\]', response_text, re.DOTALL)
            if json_match:
                questions_data = json.loads(json_match.group())
            else:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to parse generated questions. Please try again."
                )

        # Validate and format questions
        generated_questions = []
        for q in questions_data:
            if not isinstance(q, dict) or "title" not in q or "description" not in q:
                continue
            
            generated_questions.append({
                "title": q["title"][:100],  # Limit title length
                "description": q["description"],
                "category": payload.category,
                "difficulty": payload.difficulty,
                "programming_subcategory": payload.programming_subcategory if payload.category == "Programming" else None,
            })

        if not generated_questions:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No valid questions were generated. Please try again with a different prompt."
            )

        return {"questions": generated_questions}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[GEMINI] Error generating questions: {type(e).__name__}: {e}")
        print(f"[GEMINI] Traceback:\n{error_trace}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate questions: {str(e)}"
        )


