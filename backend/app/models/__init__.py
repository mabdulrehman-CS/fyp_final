from datetime import datetime
from typing import Any, Dict, List, Optional, Annotated

from pydantic import BaseModel, Field, EmailStr


# Pydantic v2-compatible ObjectId type
class PyObjectId(str):
    @classmethod
    def __get_pydantic_core_schema__(cls, _source, _handler):
        from pydantic_core import core_schema
        return core_schema.str_schema()

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema, handler):
        return handler({"type": "string"})

    @classmethod
    def validate(cls, v: Any) -> "PyObjectId":
        if isinstance(v, cls):
            return v
        return cls(str(v))


class User(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: str = ""
    password_hash: str = ""
    role: str = "candidate"
    created_at: datetime = Field(default_factory=datetime.utcnow)
    profile_info: Dict[str, Any] = Field(default_factory=dict)
    status: str = "active"

    model_config = {"populate_by_name": True, "json_encoders": {datetime: lambda v: v.isoformat()}}


class Question(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    title: str = ""
    category: str = ""
    difficulty: str = "Medium"
    description: str = ""
    topics: Optional[List[str]] = None
    examples: Optional[List[Dict[str, Any]]] = None
    constraints: Optional[List[str]] = None
    hints: Optional[List[str]] = None
    code_snippets: Optional[Dict[str, str]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "json_encoders": {datetime: lambda v: v.isoformat()}}


class TestCase(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    question_id: str = ""
    input: str = ""
    output: str = ""
    is_hidden: bool = False

    model_config = {"populate_by_name": True}


class Rubric(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    category: str = ""
    criteria: List[str] = Field(default_factory=list)
    weights: List[float] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class Session(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    candidate_id: str = ""
    status: str = ""
    scores: Dict[str, float] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = {"populate_by_name": True, "json_encoders": {datetime: lambda v: v.isoformat()}}


class ActivityLog(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    action: str = ""
    admin_email: str = ""
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"populate_by_name": True, "json_encoders": {datetime: lambda v: v.isoformat()}}


class InvitedCandidate(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")
    email: str = ""
    name: str = ""
    invited_by: str = ""
    invited_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = "pending"
    invitation_token: Optional[str] = None

    model_config = {"populate_by_name": True, "json_encoders": {datetime: lambda v: v.isoformat()}}
