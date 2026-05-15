"""
Interview Routes — Complete candidate interview flow
"""
import base64
import json
from datetime import datetime
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, WebSocket, WebSocketDisconnect, status
from fastapi.responses import FileResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.services.nlp_interviewer import parse_cv, evaluate_answer, transcribe_audio, get_interview_questions, generate_question_via_llm, evaluate_and_generate_next_question
from app.services.behavioral_analyst import analyze_frame, analyze_audio_confidence, calculate_behavioral_score, store_frontend_behavioral_data
from app.services.code_sandbox import execute_code, run_test_cases, check_plagiarism
from app.services.recommendation_engine import generate_recommendations, generate_pdf_report, save_report

router = APIRouter(prefix="/api/interview")


def _sid(s: str):
    """Convert string to ObjectId if valid."""
    return ObjectId(s) if ObjectId.is_valid(s) else s


def _serialize_doc(doc):
    """Serialize MongoDB document for JSON response."""
    if doc is None:
        return None
    doc = dict(doc)
    if "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    for k, v in doc.items():
        if isinstance(v, ObjectId):
            doc[k] = str(v)
        elif isinstance(v, datetime):
            doc[k] = v.isoformat()
        elif isinstance(v, list):
            doc[k] = [_serialize_doc(i) if isinstance(i, dict) else str(i) if isinstance(i, ObjectId) else i for i in v]
        elif isinstance(v, dict):
            doc[k] = _serialize_doc(v)
    return doc


# ── Request/Response Models ──

class SubmitAnswerRequest(BaseModel):
    question_id: str
    answer_text: str = ""
    answer_audio_base64: Optional[str] = None

class BehavioralFrameRequest(BaseModel):
    image_base64: Optional[str] = None
    timestamp: Optional[str] = None
    # Pre-computed fields from frontend face-api.js
    eye_contact_score: Optional[float] = None
    dominant_emotion: Optional[str] = None
    emotion_scores: Optional[dict] = None
    face_detected: Optional[bool] = None

class BehavioralAudioRequest(BaseModel):
    audio_base64: str
    timestamp: Optional[str] = None

class ProctoringEventRequest(BaseModel):
    event_type: str  # tab_switch, focus_lost, camera_off, mic_off
    timestamp: Optional[str] = None

class SubmitCodeRequest(BaseModel):
    code: str
    language: str


# ── CV Upload ──

@router.post("/upload-cv")
async def upload_cv(file: UploadFile = File(...), db: AsyncIOMotorDatabase = Depends(get_db)):
    """Upload CV, parse it, create interview session."""
    try:
        pdf_bytes = await file.read()
        extracted = parse_cv(pdf_bytes)

        # Save CV upload record
        cv_doc = {
            "filename": file.filename,
            "upload_time": datetime.utcnow(),
            "extracted_data": extracted,
        }
        cv_result = await db["cv_uploads"].insert_one(cv_doc)

        # Create interview session
        session_doc = {
            "candidate_name": extracted.get("name", "Candidate"),
            "cv_extracted_skills": extracted.get("skills", []),
            "cv_upload_id": cv_result.inserted_id,
            "status": "pre_check",
            "start_time": datetime.utcnow(),
            "qa_responses": [],
            "behavioral_data": {"frames": [], "audio_events": [], "frames_analyzed": 0, "avg_eye_contact": 0, "avg_emotion_scores": {}, "avg_confidence": 0},
            "coding_submission": {},
            "proctoring_events": [],
            "final_report": {},
        }
        session_result = await db["interview_sessions"].insert_one(session_doc)

        return {
            "session_id": str(session_result.inserted_id),
            "candidate_name": extracted.get("name", "Candidate"),
            "extracted_skills": extracted.get("skills", []),
            "experience_years": extracted.get("experience_years", 0),
            "email": extracted.get("email", ""),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Start from Profile (no CV upload needed — uses profile data) ──

class StartFromProfileRequest(BaseModel):
    position: str

@router.get("/sessions")
async def get_candidate_sessions(
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Get all interview sessions for the current candidate."""
    try:
        sessions = await db["interview_sessions"].find(
            {"candidate_id": str(user["_id"])}
        ).sort("start_time", -1).to_list(length=100)
        
        return [_serialize_doc(s) for s in sessions]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start-from-profile")
async def start_from_profile(
    body: StartFromProfileRequest, 
    db: AsyncIOMotorDatabase = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    """Create interview session from the user's profile data."""
    try:
        position = body.position.strip()
        position_lower = position.lower()

        # Check for active or pending sessions
        existing_session = await db["interview_sessions"].find_one({
            "candidate_id": str(user["_id"]),
            "status": {"$in": ["pre_check", "qa_phase", "coding_phase", "in_progress", "pending"]}
        })
        
        if existing_session:
            raise HTTPException(
                status_code=400, 
                detail="You have an active or pending interview. Please complete or cancel it from 'My Sessions' first."
            )

        # Use the authenticated user's profile data
        candidate_name = "Candidate"
        skills = []
        projects = []
        
        user_doc = await db["users"].find_one({"_id": user["_id"]})
        
        if user_doc and user_doc.get("profile_info"):
            profile = user_doc["profile_info"]
            candidate_name = profile.get("name") or user_doc.get("name", "Candidate")
            skills = profile.get("skills", [])
            projects = profile.get("projects", [])

        
        # If no skills from profile, use position-based mapping
        if not skills:
            skill_map = {
                "frontend": ["javascript", "react", "html", "css", "typescript"],
                "backend": ["python", "java", "node.js", "sql", "api"],
                "fullstack": ["javascript", "react", "python", "node.js", "sql"],
                "data": ["python", "sql", "machine learning", "pandas", "numpy"],
                "devops": ["docker", "kubernetes", "ci/cd", "aws", "linux"],
                "mobile": ["react native", "flutter", "swift", "kotlin", "mobile"],
                "ml": ["python", "machine learning", "tensorflow", "deep learning", "nlp"],
                "ai": ["python", "machine learning", "deep learning", "nlp", "computer vision"],
            }
            for key, vals in skill_map.items():
                if key in position_lower:
                    skills = vals
                    break
            if not skills:
                skills = ["programming", "problem solving", "algorithms"]

        # Create interview session
        session_doc = {
            "candidate_id": str(user["_id"]),
            "candidate_name": candidate_name,
            "position": position,
            "cv_extracted_skills": skills,
            "cv_projects": projects,
            "status": "pre_check",
            "start_time": datetime.utcnow(),
            "qa_responses": [],
            "behavioral_data": {"frames": [], "audio_events": [], "frames_analyzed": 0, "avg_eye_contact": 0, "avg_emotion_scores": {}, "avg_confidence": 0},
            "coding_submission": {},
            "proctoring_events": [],
            "final_report": {},
        }
        session_result = await db["interview_sessions"].insert_one(session_doc)

        return {
            "session_id": str(session_result.inserted_id),
            "candidate_name": candidate_name,
            "position": position,
            "extracted_skills": skills,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/history")
async def get_candidate_history(db: AsyncIOMotorDatabase = Depends(get_db), user: dict = Depends(get_current_user)):
    """Get history of candidate interviews."""
    try:
        user_id = str(user["_id"])
        cursor = db["interview_sessions"].find({"candidate_id": user_id}).sort("start_time", -1).limit(50)
        
        sessions = []
        async for session in cursor:
            # We map local Mongo _id to id
            session["id"] = str(session["_id"])
            sessions.append(_serialize_doc(session))
            
        return sessions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}")
async def get_session(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db), user: dict = Depends(get_current_user)):
    """Fetch single session info."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        # Optional: ensure user owns the session
        # if session.get("candidate_id") != str(user["_id"]):
        #    raise HTTPException(status_code=403, detail="Forbidden")
        session["id"] = str(session["_id"])
        return _serialize_doc(session)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.post("/{session_id}/start")
async def start_interview(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Start interview: fetch/generate questions based on extracted skills."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        skills = session.get("cv_extracted_skills", [])
        position = session.get("position", "Software Engineer")
        first_question = {
            "question_id": str(ObjectId()),
            "question_text": f"Hi {session.get('candidate_name', 'there')}, I see you're interviewing for the {position} role. I've reviewed your resume. Could you start by introducing yourself and highlighting a recent project you're particularly proud of?",
            "difficulty": "easy",
            "category": "behavioral"
        }

        # Initialize chat history with the system's first question
        chat_history = [
            {"role": "interviewer", "content": first_question["question_text"]}
        ]

        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$set": {
                "status": "qa_phase",
                "chat_history": chat_history,
                "current_question_index": 0,
                "questions": [first_question] # Keeping compatible structure for UI
            }}
        )

        return {
            "questions": [{
                "id": first_question["question_id"],
                "text": first_question["question_text"],
                "difficulty": first_question["difficulty"],
                "category": first_question["category"]
            }],
            "total_questions": 10, # Fake total to keep UI progress indicator happy if any
            "time_limit_seconds": 900,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Submit Answer ──

@router.post("/{session_id}/submit-answer")
async def submit_answer(session_id: str, body: SubmitAnswerRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Submit and evaluate an answer."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        answer_text = body.answer_text

        # If audio provided, transcribe first
        if body.answer_audio_base64:
            try:
                audio_bytes = base64.b64decode(body.answer_audio_base64)
                transcribed = transcribe_audio(audio_bytes)
                if transcribed and not transcribed.startswith("["):
                    answer_text = transcribed
            except Exception as e:
                print(f"[INTERVIEW] Transcription error: {e}")

        # Conversational tracking setup
        chat_history = session.get("chat_history", [])
        questions = session.get("questions", [])
        current_idx = session.get("current_question_index", 0)

        # Append candidate response to chat history
        chat_history.append({"role": "candidate", "content": answer_text})

        # Dynamically evaluate and generate the next prompt
        candidate_profile = {
            "skills": session.get("cv_extracted_skills", []),
            "projects": session.get("cv_projects", []),
            "position": session.get("position", "Software Engineer")
        }
        
        evaluation = await evaluate_and_generate_next_question(
            chat_history=chat_history,
            candidate_profile=candidate_profile,
            position=candidate_profile["position"]
        )

        # Save response in traditional array format to preserve frontend compatibility
        current_question = questions[current_idx] if current_idx < len(questions) else {"question_text": "General", "question_id": body.question_id}
        
        response_doc = {
            "question_id": body.question_id,
            "question_text": current_question.get("question_text", ""),
            "answer_text": answer_text,
            "score": evaluation.get("score", 0),
            "feedback": evaluation.get("feedback", ""),
            "keywords_found": [],
            "skill_tags": [],
        }

        # Build the dynamic next question
        next_q_id = str(ObjectId())
        next_question_doc = {
            "question_id": next_q_id,
            "question_text": evaluation.get("next_question", "Could you elaborate on that?"),
            "difficulty": "adaptive",
            "category": "technical"
        }
        
        # Append interviewer's new response to history
        chat_history.append({"role": "interviewer", "content": next_question_doc["question_text"]})

        # Stop condition: Maybe 10 questions cap to finish interview
        if current_idx >= 9:
            next_q_id = None
        elif next_q_id:
            # Sync to global AI question databank for admins
            global_q_doc = {
                "title": f"Dynamic Follow-up for {candidate_profile['position']}",
                "description": next_question_doc["question_text"],
                "category": "technical",
                "difficulty": "medium",
                "skill_tags": candidate_profile.get("skills", []),
                "auto_generated": True,
                "created_at": datetime.utcnow()
            }
            try:
                await db["questions"].insert_one(global_q_doc)
            except Exception as e:
                print(f"[INTERVIEW] Failed to save dynamic question to databank: {e}")
            
        update_payload = {
            "$push": {
                "qa_responses": response_doc,
                "questions": next_question_doc
            },
            "$set": {
                "chat_history": chat_history,
                "current_question_index": current_idx + 1
            }
        }
        
        if not next_q_id:
            # Drop pushing the next question if we hit the limit
            del update_payload["$push"]["questions"]

        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            update_payload
        )
        return {
            "score": evaluation.get("score", 0),
            "feedback": evaluation.get("feedback", ""),
            "next_question_id": next_q_id,
            "next_question_text": next_question_doc["question_text"] if next_q_id else ""
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Behavioral Frame ──

@router.post("/{session_id}/behavioral-frame")
async def behavioral_frame(session_id: str, body: BehavioralFrameRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Analyze a behavioral video frame.
    
    Supports two modes:
    1. Frontend-computed (face-api.js): body contains eye_contact_score, dominant_emotion, etc.
    2. Server-computed (legacy): body contains image_base64 for server-side MediaPipe/DeepFace.
    """
    try:
        # Use pre-computed data from frontend face-api.js if available
        if body.eye_contact_score is not None:
            analysis = store_frontend_behavioral_data({
                "eye_contact_score": body.eye_contact_score,
                "dominant_emotion": body.dominant_emotion or "neutral",
                "emotion_scores": body.emotion_scores or {},
                "face_detected": body.face_detected if body.face_detected is not None else True,
            })
        elif body.image_base64:
            # Legacy: server-side analysis
            analysis = analyze_frame(body.image_base64)
        else:
            # No data provided
            analysis = {
                "eye_contact_score": 0.0,
                "dominant_emotion": "unknown",
                "emotion_scores": {},
                "face_detected": False,
            }

        frame_doc = {
            "timestamp": body.timestamp or datetime.utcnow().isoformat(),
            **analysis,
        }

        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {
                "$push": {"behavioral_data.frames": frame_doc},
                "$inc": {"behavioral_data.frames_analyzed": 1},
            }
        )

        return {
            "eye_contact_score": analysis["eye_contact_score"],
            "dominant_emotion": analysis["dominant_emotion"],
            "face_detected": analysis["face_detected"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Behavioral Audio ──

@router.post("/{session_id}/behavioral-audio")
async def behavioral_audio(session_id: str, body: BehavioralAudioRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Analyze audio confidence."""
    try:
        audio_bytes = base64.b64decode(body.audio_base64)
        analysis = analyze_audio_confidence(audio_bytes)

        audio_doc = {
            "timestamp": body.timestamp or datetime.utcnow().isoformat(),
            **analysis,
        }

        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$push": {"behavioral_data.audio_events": audio_doc}}
        )

        return {
            "confidence_score": analysis["confidence_score"],
            "volume_level": analysis["volume_level"],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Proctoring Event ──

@router.post("/{session_id}/proctoring-event")
async def proctoring_event(session_id: str, body: ProctoringEventRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Log a proctoring event."""
    try:
        event_doc = {
            "type": body.event_type,
            "timestamp": body.timestamp or datetime.utcnow().isoformat(),
        }

        result = await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$push": {"proctoring_events": event_doc}}
        )

        # Count warnings
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)}, {"proctoring_events": 1})
        warning_count = len(session.get("proctoring_events", [])) if session else 0

        return {"acknowledged": True, "warning_count": warning_count}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Transition to Coding ──

@router.post("/{session_id}/transition-to-coding")
async def transition_to_coding(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Transition from QA to coding phase. Generate or fetch a coding problem."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        skills = session.get("cv_extracted_skills", [])

        # Find past problem IDs for this candidate to avoid duplicates
        past_sessions = await db["interview_sessions"].find(
            {"candidate_name": session.get("candidate_name")},
            {"coding_submission.problem_id": 1}
        ).to_list(length=100)
        
        past_problem_ids = []
        for p in past_sessions:
            pid = p.get("coding_submission", {}).get("problem_id")
            if pid:
                # Add both string and object ID versions defensively
                if ObjectId.is_valid(pid):
                    past_problem_ids.extend([pid, ObjectId(pid)])
                else:
                    past_problem_ids.append(pid)

        # Try to find existing coding problem
        query = {}
        if past_problem_ids:
            query["_id"] = {"$nin": past_problem_ids}
            
        if skills:
            query["skill_tags"] = {"$in": [s.lower() for s in skills]}
            
        problem = await db["coding_problems"].find_one(query)

        if not problem and skills: # Try without skills filter
            fallback_query = {}
            if past_problem_ids:
                fallback_query["_id"] = {"$nin": past_problem_ids}
            problem = await db["coding_problems"].find_one(fallback_query)

        if not problem:
            # Generate via LLM
            from app.services.nlp_interviewer import _get_groq_client
            import re
            client = _get_groq_client()
            if client:
                skill_str = ", ".join(skills[:3]) if skills else "general programming"
                prompt = f"""Create a medium difficulty coding problem about {skill_str}.
Return ONLY valid JSON: {{"title": "...", "description": "...", "difficulty": "medium", "skill_tags": [...], "template_code": {{"python": "# Write your solution here\\n", "javascript": "// Write your solution here\\n"}}}}"""
                try:
                    resp = client.chat.completions.create(
                        model="llama-3.3-70b-versatile",
                        messages=[{"role": "user", "content": prompt}],
                        temperature=0.7,
                        max_tokens=500,
                    )
                    content = resp.choices[0].message.content.strip()
                    if "```" in content:
                        content = re.search(r'```(?:json)?\s*(.*?)```', content, re.DOTALL)
                        content = content.group(1).strip() if content else ""
                    problem = json.loads(content)
                    problem["created_at"] = datetime.utcnow()
                    res = await db["coding_problems"].insert_one(problem)
                    problem["_id"] = res.inserted_id
                except Exception as e:
                    print(f"[INTERVIEW] Coding problem generation error: {e}")

            if not problem:
                problem = {
                    "_id": ObjectId(),
                    "title": "Two Sum",
                    "description": "Given an array of integers nums and an integer target, return indices of the two numbers that add up to target.\n\nExample:\nInput: nums = [2,7,11,15], target = 9\nOutput: [0,1]\n\nConstraints:\n- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9",
                    "difficulty": "medium",
                    "skill_tags": ["arrays", "hash table"],
                    "template_code": {
                        "python": "def two_sum(nums, target):\n    # Write your solution here\n    pass\n",
                        "javascript": "function twoSum(nums, target) {\n    // Write your solution here\n}\n",
                        "java": "class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        // Write your solution here\n        return new int[]{};\n    }\n}\n",
                        "cpp": "#include <vector>\nusing namespace std;\n\nclass Solution {\npublic:\n    vector<int> twoSum(vector<int>& nums, int target) {\n        // Write your solution here\n        return {};\n    }\n};\n",
                    },
                }

        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$set": {
                "status": "coding_phase",
                "coding_submission.problem_id": str(problem.get("_id", "")),
                "coding_submission.problem_title": problem.get("title", ""),
                "coding_submission.problem_description": problem.get("description", ""),
            }}
        )

        return {
            "problem": {
                "id": str(problem.get("_id", "")),
                "title": problem.get("title", ""),
                "description": problem.get("description", ""),
                "difficulty": problem.get("difficulty", "medium"),
                "template_code": problem.get("template_code", {"python": "# Write your code\n"}),
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Run Code (execute only, no save) ──

@router.post("/{session_id}/run-code")
async def run_code(session_id: str, body: SubmitCodeRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Execute code and return raw stdout/stderr without saving. Used by the Run button."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Execute code directly, no test cases
        result = execute_code(body.code, body.language, "", 15000)

        return {
            "status": result["status"],
            "stdout": result["stdout"],
            "stderr": result["stderr"],
            "execution_time_ms": result["execution_time_ms"],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




@router.post("/{session_id}/submit-code")
async def submit_code(session_id: str, body: SubmitCodeRequest, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Submit code — evaluate with Groq LLM, check plagiarism, save results."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        problem_id = session.get("coding_submission", {}).get("problem_id", "")

        # Evaluate code with Groq LLM
        test_results = await run_test_cases(db, body.code, body.language, problem_id, session_id)

        # Check plagiarism
        plag_result = await check_plagiarism(db, body.code, session_id, problem_id)

        # Use overall_coding_score from LLM as the primary coding score
        coding_score = float(test_results.get("overall_coding_score", test_results.get("score", 0)))
        if plag_result["is_flagged"]:
            coding_score *= 0.5  # 50% penalty for plagiarism

        # Save to session
        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$set": {
                "coding_submission.code": body.code,
                "coding_submission.language": body.language,
                "coding_submission.test_results": test_results,
                "coding_submission.plagiarism_score": plag_result["plagiarism_score"],
                "coding_submission.final_score": coding_score,
                "coding_submission.time_complexity": test_results.get("time_complexity", "Unknown"),
                "coding_submission.space_complexity": test_results.get("space_complexity", "Unknown"),
                "coding_submission.code_quality_score": test_results.get("code_quality_score", 0),
                "coding_submission.logic_score": test_results.get("logic_score", 0),
                "coding_submission.issues": test_results.get("issues", []),
                "coding_submission.suggestions": test_results.get("suggestions", []),
                "coding_submission.feedback": test_results.get("feedback", ""),
            }}
        )

        return {
            "test_results": test_results,
            "plagiarism_score": plag_result["plagiarism_score"],
            "is_flagged": plag_result["is_flagged"],
            "coding_score": coding_score,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Complete Interview ──

@router.post("/{session_id}/complete")
async def complete_interview(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Complete interview and generate report."""
    try:
        session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Calculate scores
        qa_responses = session.get("qa_responses", [])
        tech_scores = [r.get("score", 0) for r in qa_responses]
        technical_score = sum(tech_scores) / max(len(tech_scores), 1)

        behavioral_result = calculate_behavioral_score(session)
        behavioral_score = behavioral_result["behavioral_score"]

        coding_score = session.get("coding_submission", {}).get("final_score", 0)

        # Overall: technical 40%, behavioral 30%, coding 30%
        overall_score = (technical_score * 0.4) + (behavioral_score * 0.3) + (coding_score * 0.3)

        # Update behavioral averages and summary
        # Find dominant emotion from frames
        frames = session.get("behavioral_data", {}).get("frames", [])
        dominant_emotion = "neutral"
        if frames:
            emotions = [f.get("dominant_emotion", "neutral") for f in frames if f.get("dominant_emotion")]
            if emotions:
                from collections import Counter
                dominant_emotion = Counter(emotions).most_common(1)[0][0]

        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$set": {
                "behavioral_data.avg_eye_contact": behavioral_result["eye_contact_avg"],
                "behavioral_data.avg_confidence": behavioral_result["confidence_avg"],
                "behavioral_data.dominant_emotion": dominant_emotion,
                "behavioral_data.summary": behavioral_result.get("summary", ""),
            }}
        )

        # Generate recommendations
        recommendations = await generate_recommendations(session)

        # Generate PDF (non-blocking — don't let PDF errors block the report)
        session["final_report"] = {
            "overall_score": overall_score,
            "technical_score": technical_score,
            "behavioral_score": behavioral_score,
            "coding_score": coding_score or 0,
        }
        pdf_path = ""
        try:
            pdf_bytes = generate_pdf_report(session, recommendations)
            pdf_path = await save_report(db, session_id, pdf_bytes, session, recommendations)
        except Exception as pdf_err:
            print(f"[INTERVIEW] PDF generation failed (non-fatal): {pdf_err}")
            import traceback
            traceback.print_exc()

        # Update session as completed
        await db["interview_sessions"].update_one(
            {"_id": _sid(session_id)},
            {"$set": {
                "status": "completed",
                "end_time": datetime.utcnow(),
                "final_report.overall_score": round(overall_score, 1),
                "final_report.technical_score": round(technical_score, 1),
                "final_report.behavioral_score": round(behavioral_score, 1),
                "final_report.coding_score": round(coding_score, 1),
                "final_report.recommendations": recommendations,
                "final_report.report_pdf_path": pdf_path,
            }}
        )

        return {
            "overall_score": round(overall_score, 1),
            "technical_score": round(technical_score, 1),
            "behavioral_score": round(behavioral_score, 1),
            "coding_score": round(coding_score, 1),
            "report_url": f"/api/interview/{session_id}/report",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Get Report (JSON) ──

@router.get("/{session_id}/report")
async def get_report(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Get full interview report as JSON."""
    session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return _serialize_doc(session)


# ── Download PDF Report ──

@router.get("/{session_id}/report/pdf")
async def download_report_pdf(session_id: str, db: AsyncIOMotorDatabase = Depends(get_db)):
    """Download the generated PDF report."""
    session = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    pdf_path = session.get("final_report", {}).get("report_pdf_path", "")
    if not pdf_path or not os.path.exists(pdf_path):
        raise HTTPException(status_code=404, detail="PDF report not found. Complete the interview first.")

    return FileResponse(
        pdf_path,
        media_type="application/pdf",
        filename=f"IntraView_Report_{session_id}.pdf",
    )


# ── WebSocket Handler ──

import os
import asyncio

@router.websocket("/ws/{session_id}")
async def interview_websocket(websocket: WebSocket, session_id: str):
    """Real-time WebSocket for interview events."""
    await websocket.accept()
    db = get_db()

    try:
        start_time = datetime.utcnow()
        warnings_sent = set()

        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1.0)
            except asyncio.TimeoutError:
                # Check time warnings
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                remaining = 900 - elapsed

                if remaining <= 300 and "5min" not in warnings_sent:
                    await websocket.send_json({"type": "time_warning", "seconds_remaining": int(remaining)})
                    warnings_sent.add("5min")
                elif remaining <= 120 and "2min" not in warnings_sent:
                    await websocket.send_json({"type": "time_warning", "seconds_remaining": int(remaining)})
                    warnings_sent.add("2min")
                elif remaining <= 0 and "0" not in warnings_sent:
                    await websocket.send_json({"type": "phase_transition", "next_phase": "coding"})
                    warnings_sent.add("0")
                continue
            except WebSocketDisconnect:
                break

            msg_type = data.get("type", "")

            if msg_type == "answer_audio":
                try:
                    audio_b64 = data.get("data", "")
                    audio_bytes = base64.b64decode(audio_b64)
                    text = transcribe_audio(audio_bytes)
                    await websocket.send_json({"type": "transcription", "text": text})
                except Exception as e:
                    await websocket.send_json({"type": "transcription", "text": f"[Error: {e}]"})

            elif msg_type == "behavioral_frame":
                try:
                    result = analyze_frame(data.get("data", ""))
                    await websocket.send_json({
                        "type": "behavioral_update",
                        "eye_contact": result["eye_contact_score"],
                        "emotion": result["dominant_emotion"],
                        "face_detected": result["face_detected"],
                    })
                except Exception as e:
                    print(f"[WS] Frame error: {e}")

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {session_id}")
    except Exception as e:
        print(f"[WS] Error: {e}")
