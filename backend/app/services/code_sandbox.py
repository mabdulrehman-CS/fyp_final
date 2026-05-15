"""
Code Execution Sandbox Service
- Docker-based code execution
- Test case runner
- Plagiarism detection
"""
import os
import uuid
import subprocess
import tempfile
import shutil
import difflib
import time
from typing import Optional
import threading

from app.core.config import get_settings

settings = get_settings()

def ensure_images_loaded():
    """Asynchronously pulls all docker images. Called on startup."""
    def pull_images():
        if not _docker_available():
            return
        images = settings.SANDBOX_IMAGES
        for img in images.values():
            subprocess.run(["docker", "pull", img])
    
    thread = threading.Thread(target=pull_images, daemon=True)
    thread.start()

def execute_code(code: str, language: str, stdin: str = "", time_limit_ms: int = 10000) -> dict:
    """Execute code in a Docker container (or fallback to subprocess)."""
    result = {
        "status": "runtime_error",
        "stdout": "",
        "stderr": "",
        "execution_time_ms": 0,
    }

    sandbox_id = str(uuid.uuid4())[:8]
    temp_dir = os.path.join(tempfile.gettempdir(), f"sandbox_{sandbox_id}")
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # Write code to file
        file_map = {
            "python": ("solution.py", None),
            "javascript": ("solution.js", None),
            "java": ("Solution.java", None),
            "cpp": ("solution.cpp", None),
        }

        if language not in file_map:
            result["stderr"] = f"Unsupported language: {language}"
            return result

        filename, _ = file_map[language]
        code_path = os.path.join(temp_dir, filename)
        with open(code_path, "w", encoding="utf-8") as f:
            f.write(code)

        # Write stdin
        stdin_path = os.path.join(temp_dir, "input.txt")
        with open(stdin_path, "w", encoding="utf-8") as f:
            f.write(stdin)

        timeout_secs = time_limit_ms / 1000

        # Try Docker first, fallback to subprocess
        if _docker_available():
            result = _run_docker(temp_dir, language, filename, stdin, timeout_secs)
            # Seamless fallback if Docker Desktop throws a volume mount or daemon error
            stderr = result.get("stderr", "")
            if stderr.startswith("docker: Error") or "Cannot connect to the Docker daemon" in stderr or "invalid volume specification" in stderr or "system cannot find the file" in stderr:
                print(f"[SANDBOX] Docker infrastructure error detected, falling back to subprocess. Error: {stderr[:100]}...")
                result = _run_subprocess(temp_dir, language, filename, stdin, timeout_secs)
        else:
            result = _run_subprocess(temp_dir, language, filename, stdin, timeout_secs)

    except Exception as e:
        result["stderr"] = str(e)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    return result


def _docker_available() -> bool:
    """Check if Docker is available."""
    try:
        proc = subprocess.run(["docker", "info"], capture_output=True, timeout=5)
        return proc.returncode == 0
    except Exception:
        return False


def _run_docker(temp_dir: str, language: str, filename: str, stdin: str, timeout: float) -> dict:
    """Run code in Docker container."""
    images = settings.SANDBOX_IMAGES
    image = images.get(language, "python:3.11-slim")

    cmd_map = {
        "python": f"python /code/{filename}",
        "javascript": f"node /code/{filename}",
        "java": f"cd /code && javac {filename} && java Solution",
        "cpp": f"cd /code && g++ -o /code/solution {filename} && /code/solution",
    }

    run_cmd = cmd_map.get(language, f"python /code/{filename}")

    docker_cmd = [
        "docker", "run", "--rm",
        "--memory=128m", "--cpus=0.5", "--network=none",
        "-v", f"{temp_dir}:/code:ro",
        image, "sh", "-c", run_cmd,
    ]

    start = time.time()
    try:
        proc = subprocess.run(
            docker_cmd,
            input=stdin,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        elapsed = int((time.time() - start) * 1000)

        return {
            "status": "accepted" if proc.returncode == 0 else "runtime_error",
            "stdout": proc.stdout[:10000],
            "stderr": proc.stderr[:5000],
            "execution_time_ms": elapsed,
        }
    except subprocess.TimeoutExpired:
        return {
            "status": "TLE",
            "stdout": "",
            "stderr": "Time limit exceeded",
            "execution_time_ms": int(timeout * 1000),
        }


def _run_subprocess(temp_dir: str, language: str, filename: str, stdin: str, timeout: float) -> dict:
    """Fallback: run code as subprocess (less secure, for dev only)."""
    code_path = os.path.join(temp_dir, filename)

    import sys
    cmd_map = {
        "python": [sys.executable, code_path],
        "javascript": ["node", code_path],
        "java": None,  # Needs compile step
        "cpp": None,    # Needs compile step
    }

    cmd = cmd_map.get(language)

    # Handle compiled languages
    if language == "java":
        compile_proc = subprocess.run(
            ["javac", code_path], capture_output=True, text=True, timeout=30
        )
        if compile_proc.returncode != 0:
            return {"status": "compilation_error", "stdout": "", "stderr": compile_proc.stderr, "execution_time_ms": 0}
        class_name = "Solution"
        cmd = ["java", "-cp", temp_dir, class_name]
    elif language == "cpp":
        out_path = os.path.join(temp_dir, "solution.exe" if os.name == "nt" else "solution")
        compile_proc = subprocess.run(
            ["g++", "-o", out_path, code_path], capture_output=True, text=True, timeout=30
        )
        if compile_proc.returncode != 0:
            return {"status": "compilation_error", "stdout": "", "stderr": compile_proc.stderr, "execution_time_ms": 0}
        cmd = [out_path]

    if not cmd:
        return {"status": "runtime_error", "stdout": "", "stderr": "Unsupported language", "execution_time_ms": 0}

    start = time.time()
    try:
        proc = subprocess.run(
            cmd, input=stdin, capture_output=True, text=True, timeout=timeout
        )
        elapsed = int((time.time() - start) * 1000)
        return {
            "status": "accepted" if proc.returncode == 0 else "runtime_error",
            "stdout": proc.stdout[:10000],
            "stderr": proc.stderr[:5000],
            "execution_time_ms": elapsed,
        }
    except subprocess.TimeoutExpired:
        return {"status": "TLE", "stdout": "", "stderr": "Time limit exceeded", "execution_time_ms": int(timeout * 1000)}
    except Exception as e:
        return {"status": "runtime_error", "stdout": "", "stderr": str(e), "execution_time_ms": 0}


async def run_test_cases(db, code: str, language: str, problem_id: str, session_id: str) -> dict:
    """Evaluate candidate code using Groq LLM — traces test cases mentally, returns detailed scores."""
    from bson import ObjectId
    import json
    from app.services.nlp_interviewer import _get_groq_client

    # Get problem description from coding_problems collection
    problem = await db["coding_problems"].find_one(
        {"_id": problem_id if not ObjectId.is_valid(problem_id) else ObjectId(problem_id)}
    )
    if not problem:
        problem = await db["coding_problems"].find_one({"_id": str(problem_id)})

    # Fallback: get problem info from the session itself (covers dynamically generated problems)
    if not problem and session_id:
        from app.routers.interview import _sid
        session_doc = await db["interview_sessions"].find_one({"_id": _sid(session_id)})
        if session_doc:
            cs = session_doc.get("coding_submission", {})
            # The problem info may have been stored directly on the session
            if cs.get("problem_title") or cs.get("problem_description"):
                problem = {"title": cs.get("problem_title", ""), "description": cs.get("problem_description", "")}
            else:
                # Try to find the problem by the stored problem_id in the session
                stored_pid = cs.get("problem_id", "")
                if stored_pid and stored_pid != problem_id:
                    problem = await db["coding_problems"].find_one(
                        {"_id": ObjectId(stored_pid) if ObjectId.is_valid(stored_pid) else stored_pid}
                    )
        print(f"[CODE EVAL] Problem not found in DB for id={problem_id}, session fallback: {'found' if problem else 'not found'}")

    prob_title = problem.get("title", "Unknown problem") if problem else "Unknown problem"
    prob_desc = problem.get("description", "") if problem else ""
    print(f"[CODE EVAL] Evaluating code for problem: '{prob_title}' (desc length: {len(prob_desc)})")

    # Fetch test cases from DB if they exist
    test_cases_list = []
    try:
        if ObjectId.is_valid(problem_id):
            tc_cursor = db["test_cases"].find({"question_id": problem_id})
        else:
            tc_cursor = db["test_cases"].find({"question_id": str(problem_id)})
        async for tc in tc_cursor:
            test_cases_list.append({
                "input": tc.get("input", ""),
                "expected_output": tc.get("output", tc.get("expected_output", "")),
                "is_hidden": tc.get("is_hidden", False),
            })
    except Exception as e:
        print(f"[CODE EVAL] Error fetching test cases: {e}")

    # Build test cases string for the prompt
    if test_cases_list:
        tc_str = json.dumps(test_cases_list, indent=2)
    else:
        tc_str = "No explicit test cases provided. Infer reasonable test cases from the problem description."

    client = _get_groq_client()
    if not client:
        return {
            "score": 0.0,
            "passed": 0,
            "total": 1,
            "results": [{"test_case_id": "logic_eval", "status": "error", "expected": "Groq client missing", "actual": "Error", "hidden": False}],
            "logic_correct": False,
            "time_complexity": "Unknown",
            "space_complexity": "Unknown",
            "code_quality_score": 0,
            "logic_score": 0,
            "overall_coding_score": 0,
            "issues": ["Groq API client not configured"],
            "suggestions": [],
            "feedback": "Could not evaluate — Groq API key missing.",
        }

    prompt = f"""You are a strict technical interviewer evaluating a coding submission.

Problem: {prob_title}
Description: {prob_desc}
Test Cases: {tc_str}
Candidate Code: {code}
Language: {language}

Mentally trace through the code against each test case.
Return ONLY this JSON:
{{
  "test_results": [
    {{"input": "...", "expected": "...", "passes": true, "reason": "..."}}
  ],
  "passed_count": 0,
  "total_count": 0,
  "pass_rate": 0,
  "logic_correct": true,
  "time_complexity": "O(?)",
  "space_complexity": "O(?)",
  "code_quality_score": 0,
  "logic_score": 0,
  "overall_coding_score": 0,
  "issues": ["..."],
  "suggestions": ["..."],
  "feedback": "two sentence summary"
}}

Rules:
- code_quality_score, logic_score, and overall_coding_score are integers from 0 to 100.
- pass_rate is a float from 0 to 100.
- Be strict but fair. Check the actual logic, not syntax.
- If the code is empty or just a template, give 0 for everything.
"""

    try:
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        content = resp.choices[0].message.content.strip()
        data = json.loads(content)

        # Extract fields with safe defaults
        test_results_raw = data.get("test_results", [])
        passed_count = int(data.get("passed_count") or 0)
        total_count = int(data.get("total_count") or len(test_results_raw) or 1)
        pass_rate = float(data.get("pass_rate") or 0)
        logic_correct = bool(data.get("logic_correct") or False)
        time_complexity = data.get("time_complexity") or "Unknown"
        space_complexity = data.get("space_complexity") or "Unknown"
        code_quality_score = int(data.get("code_quality_score") or 0)
        logic_score = int(data.get("logic_score") or 0)
        overall_coding_score = int(data.get("overall_coding_score") or 0)
        issues = data.get("issues", [])
        suggestions = data.get("suggestions", [])
        feedback = data.get("feedback", "No feedback provided.")

        # Convert test_results to the format the frontend/session expects
        formatted_results = []
        for i, tr in enumerate(test_results_raw):
            formatted_results.append({
                "test_case_id": f"tc_{i+1}",
                "status": "accepted" if tr.get("passes", False) else "wrong_answer",
                "expected": tr.get("expected", ""),
                "actual": tr.get("reason", ""),
                "input": tr.get("input", ""),
                "hidden": False,
            })

        return {
            "score": float(overall_coding_score),
            "passed": passed_count,
            "total": total_count,
            "pass_rate": pass_rate,
            "results": formatted_results if formatted_results else [{
                "test_case_id": "logic_eval",
                "status": "accepted" if logic_correct else "wrong_answer",
                "expected": "Logically sound approach",
                "actual": feedback,
                "hidden": False,
            }],
            "logic_correct": logic_correct,
            "time_complexity": time_complexity,
            "space_complexity": space_complexity,
            "code_quality_score": code_quality_score,
            "logic_score": logic_score,
            "overall_coding_score": overall_coding_score,
            "issues": issues,
            "suggestions": suggestions,
            "feedback": feedback,
        }
    except Exception as e:
        print(f"[CODE EVAL] LLM Error: {e}")
        return {
            "score": 0.0,
            "passed": 0,
            "total": 1,
            "results": [{"test_case_id": "logic_eval", "status": "runtime_error", "expected": "Logic Validation", "actual": str(e), "hidden": False}],
            "logic_correct": False,
            "time_complexity": "Unknown",
            "space_complexity": "Unknown",
            "code_quality_score": 0,
            "logic_score": 0,
            "overall_coding_score": 0,
            "issues": [str(e)],
            "suggestions": [],
            "feedback": f"Evaluation failed: {e}",
        }


async def check_plagiarism(db, code: str, session_id: str, problem_id: str = None) -> dict:
    """Check code similarity against recent submissions."""
    result = {
        "plagiarism_score": 0.0,
        "is_flagged": False,
        "similar_to_session": None,
    }

    try:
        query = {"coding_submission.code": {"$exists": True}}
        if problem_id:
            query["coding_submission.problem_id"] = problem_id

        recent = await db["interview_sessions"].find(
            query, {"_id": 1, "coding_submission.code": 1}
        ).sort("start_time", -1).to_list(length=50)

        max_similarity = 0
        most_similar_session = None

        for session in recent:
            sid = str(session["_id"])
            if sid == session_id:
                continue
            other_code = session.get("coding_submission", {}).get("code", "")
            if not other_code:
                continue

            ratio = difflib.SequenceMatcher(None, code, other_code).ratio()
            if ratio > max_similarity:
                max_similarity = ratio
                most_similar_session = sid

        result["plagiarism_score"] = round(max_similarity * 100, 1)
        result["is_flagged"] = max_similarity > 0.85
        if result["is_flagged"]:
            result["similar_to_session"] = most_similar_session

    except Exception as e:
        print(f"[SANDBOX] Plagiarism check error: {e}")

    return result
