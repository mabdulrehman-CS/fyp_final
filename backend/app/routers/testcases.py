from typing import Any, Dict, List, Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_admin


router = APIRouter()


def _to_str_id(doc: Any) -> Any:
    if isinstance(doc, dict) and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc


class TestCaseCreate(BaseModel):
    question_id: str  # This is actually the coding problem_id
    input: str
    output: str
    is_hidden: bool = False


class TestCaseUpdate(BaseModel):
    input: Optional[str] = None
    output: Optional[str] = None
    is_hidden: Optional[bool] = None


# ── List coding problems (for dropdown in test cases page) ──

@router.get("/coding-problems")
async def list_coding_problems(
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
) -> List[Dict[str, Any]]:
    """Return all coding problems for test case management."""
    cursor = db["coding_problems"].find().sort("created_at", -1)
    items: List[Dict[str, Any]] = []
    async for doc in cursor:
        items.append(_to_str_id(doc))
    return items


# ── List test cases for a problem ──

@router.get("/testcases/{question_id}")
async def list_testcases_for_question(
    question_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
) -> List[Dict[str, Any]]:
    if not ObjectId.is_valid(question_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question id")

    # Search both problem_id and question_id fields for compatibility
    # problem_id in DB can be ObjectId or string
    oid = ObjectId(question_id)
    cursor = db["test_cases"].find({
        "$or": [
            {"problem_id": oid},
            {"problem_id": str(question_id)},
            {"question_id": str(question_id)},
            {"question_id": oid},
        ]
    })
    items: List[Dict[str, Any]] = []
    async for doc in cursor:
        doc = _to_str_id(doc)
        # Normalize field names
        if "expected_output" in doc and "output" not in doc:
            doc["output"] = doc["expected_output"]
        if "problem_id" in doc and "question_id" not in doc:
            doc["question_id"] = doc["problem_id"]
        items.append(doc)
    return items


# ── Create test case ──

@router.post("/testcases", status_code=status.HTTP_201_CREATED)
async def create_testcase(
    payload: TestCaseCreate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(payload.question_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid question id")

    tc_doc = {
        "problem_id": payload.question_id,
        "question_id": payload.question_id,
        "input": payload.input,
        "expected_output": payload.output,
        "output": payload.output,
        "is_hidden": payload.is_hidden,
    }
    res = await db["test_cases"].insert_one(tc_doc)
    created = await db["test_cases"].find_one({"_id": res.inserted_id})
    doc = _to_str_id(created)
    if "expected_output" in doc:
        doc["output"] = doc["expected_output"]
    return doc


@router.post("/testcases/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_testcases(
    payload: List[TestCaseCreate],
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    """Bulk create test cases from an array."""
    if not payload:
        raise HTTPException(status_code=400, detail="Empty list")
        
    docs = []
    for p in payload:
        docs.append({
            "problem_id": p.question_id,
            "question_id": p.question_id,
            "input": p.input,
            "expected_output": p.output,
            "output": p.output,
            "is_hidden": p.is_hidden,
        })
        
    res = await db["test_cases"].insert_many(docs)
    return {"message": f"Successfully created {len(docs)} test cases", "inserted_ids": [str(i) for i in res.inserted_ids]}


# ── Update test case ──

@router.put("/testcases/{testcase_id}")
async def update_testcase(
    testcase_id: str,
    payload: TestCaseUpdate,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(testcase_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid test case id")

    update_data = {k: v for k, v in payload.dict(exclude_unset=True).items()}
    # Sync expected_output with output
    if "output" in update_data:
        update_data["expected_output"] = update_data["output"]
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")

    res = await db["test_cases"].update_one({"_id": ObjectId(testcase_id)}, {"$set": update_data})
    if res.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test case not found")

    doc = await db["test_cases"].find_one({"_id": ObjectId(testcase_id)})
    doc = _to_str_id(doc)
    if "expected_output" in doc:
        doc["output"] = doc["expected_output"]
    return doc


# ── Delete test case ──

@router.delete("/testcases/{testcase_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_testcase(
    testcase_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    admin: dict = Depends(get_current_admin),
):
    if not ObjectId.is_valid(testcase_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid test case id")

    await db["test_cases"].delete_one({"_id": ObjectId(testcase_id)})
    return None
