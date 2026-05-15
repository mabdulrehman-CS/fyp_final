"""
NLP Interviewer Service
- CV parsing with pdfplumber + regex
- Dynamic question generation via Groq
- Answer evaluation via Groq
- Audio transcription via Whisper
"""
import io
import os
import re
import json
import tempfile
from datetime import datetime
from typing import List, Optional

from app.core.config import get_settings

settings = get_settings()

# Lazy-load heavy models
_whisper_model = None
_spacy_nlp = None


def _get_spacy():
    global _spacy_nlp
    if _spacy_nlp is None:
        try:
            import spacy
            try:
                _spacy_nlp = spacy.load("en_core_web_lg")
            except OSError:
                try:
                    _spacy_nlp = spacy.load("en_core_web_sm")
                except OSError:
                    _spacy_nlp = None
        except ImportError:
            _spacy_nlp = None
    return _spacy_nlp


def _get_whisper():
    global _whisper_model
    if _whisper_model is None:
        try:
            import whisper
            _whisper_model = whisper.load_model("base")
        except Exception:
            _whisper_model = None
    return _whisper_model


def _get_groq_client():
    try:
        from groq import Groq
        return Groq(api_key=settings.GROQ_API_KEY)
    except Exception as e:
        print(f"[NLP] Failed to create Groq client: {e}")
        return None


# ── CV Parsing ──

def parse_cv(pdf_bytes: bytes) -> dict:
    """Parse a PDF CV and extract structured information."""
    import pdfplumber

    result = {
        "name": "",
        "email": "",
        "phone": "",
        "skills": [],
        "experience_years": 0,
        "education": [],
        "raw_text": "",
    }

    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            text = ""
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            result["raw_text"] = text
    except Exception as e:
        print(f"[NLP] PDF parsing error: {e}")
        return result

    # Extract email
    email_match = re.findall(r'[\w.+-]+@[\w-]+\.[\w.-]+', text)
    if email_match:
        result["email"] = email_match[0]

    # Extract phone
    phone_match = re.findall(r'[\+]?[\d\s\-\(\)]{10,15}', text)
    if phone_match:
        result["phone"] = phone_match[0].strip()

    # Extract name using spaCy NER
    nlp = _get_spacy()
    if nlp:
        doc = nlp(text[:3000])  # first 3000 chars for speed
        persons = [ent.text for ent in doc.ents if ent.label_ == "PERSON"]
        if persons:
            result["name"] = persons[0]

    # If no name found, try first non-empty line
    if not result["name"]:
        for line in text.split('\n'):
            line = line.strip()
            if line and not re.match(r'^[\w.+-]+@', line) and len(line.split()) <= 4:
                result["name"] = line
                break

    # Extract skills using keyword matching
    common_skills = [
        "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
        "react", "angular", "vue", "node.js", "express", "django", "flask", "fastapi",
        "spring boot", "sql", "mysql", "postgresql", "mongodb", "redis", "docker",
        "kubernetes", "aws", "azure", "gcp", "git", "linux", "html", "css",
        "machine learning", "deep learning", "tensorflow", "pytorch", "data science",
        "rest api", "graphql", "microservices", "devops", "ci/cd", "agile", "scrum",
        "system design", "data structures", "algorithms", "oop",
        "next.js", "tailwind", "sass", "webpack", "vite", "firebase",
        "elasticsearch", "kafka", "rabbitmq", "nginx", "terraform",
        "pandas", "numpy", "scikit-learn", "nlp", "computer vision",
    ]
    text_lower = text.lower()
    found_skills = []
    for skill in common_skills:
        if skill in text_lower:
            found_skills.append(skill.title() if len(skill) > 3 else skill.upper())
    result["skills"] = list(set(found_skills))

    # Extract experience years
    exp_match = re.findall(r'(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience)?', text_lower)
    if exp_match:
        result["experience_years"] = max(int(x) for x in exp_match)

    # Extract education
    edu_keywords = ["bachelor", "master", "phd", "b.s.", "m.s.", "b.sc", "m.sc", "b.tech", "m.tech", "mba", "diploma"]
    for line in text.split('\n'):
        line_lower = line.lower().strip()
        if any(kw in line_lower for kw in edu_keywords):
            result["education"].append(line.strip())

    return result


# ── Question Generation ──

async def get_interview_questions(db, skills: list, position: str = "Software Engineer", projects: list = None) -> list:
    """Get interview questions from DB, generate via LLM if needed using position context."""
    import random
    questions = []
    
    total_q_count = random.randint(10, 15)
    
    # 2 HR/Behavioral questions
    hr_count = 2

    # Always start with 2 HR questions
    hr_questions = await db["questions"].find(
        {"category": {"$in": ["hr", "behavioral", "HR", "Behavioral"]}}
    ).to_list(length=hr_count)

    if len(hr_questions) < hr_count:
        for _ in range(hr_count - len(hr_questions)):
            q = await generate_question_via_llm("soft skills and communication", "easy", "hr", position)
            if q:
                q["auto_generated"] = True
                res = await db["questions"].insert_one(q)
                q["_id"] = res.inserted_id
                hr_questions.append(q)

    questions.extend(hr_questions)

    # Technical questions dynamically distributed
    tech_count = total_q_count - len(questions)
    easy_c = max(1, tech_count // 3)
    med_c = max(1, tech_count // 3)
    hard_c = tech_count - easy_c - med_c

    difficulty_plan = [
        ("easy", easy_c), ("medium", med_c), ("hard", hard_c)
    ]

    for difficulty, count in difficulty_plan:
        skill_filter = {"$or": [
            {"skill_tags": {"$in": [s.lower() for s in skills]}},
            {"skill_tags": {"$in": skills}},
            {"topics": {"$in": [s.lower() for s in skills]}},
            {"topics": {"$in": skills}},
        ]} if skills else {}

        query = {
            "category": {"$in": ["technical", "coding", "Technical", "Coding", "System Design"]},
            "difficulty": {"$regex": difficulty, "$options": "i"},
        }
        if skill_filter:
            query.update(skill_filter)

        found = await db["questions"].find(query).to_list(length=count)

        # If not enough questions, generate via LLM
        if len(found) < count:
            # Inject context: grab a random project if available
            ctx_items = (skills or [position])
            for i in range(count - len(found)):
                skill = ctx_items[i % len(ctx_items)]
                project_context = ""
                if projects and len(projects) > 0:
                    proj = projects[i % len(projects)]
                    project_context = f"Candidate worked on a project: {proj.get('title', 'Unknown')} using {proj.get('technologies', 'some tech')}."
                
                q = await generate_question_via_llm(skill, difficulty, "technical", position, project_context)
                if q:
                    q["auto_generated"] = True
                    res = await db["questions"].insert_one(q)
                    q["_id"] = res.inserted_id
                    found.append(q)

        questions.extend(found[:count])

    return questions


async def generate_question_via_llm(skill: str, difficulty: str, category: str = "technical", position: str = "Software Engineer", project_context: str = "") -> Optional[dict]:
    """Generate a question using Groq LLM."""
    client = _get_groq_client()
    if not client:
        return _fallback_question(skill, difficulty, category)

    try:
        proj_str = f"Context: {project_context}" if project_context else ""
        prompt = f"""Generate a {difficulty} {category} interview question for a candidate applying for the position of "{position}". Focus the question around: {skill}. {proj_str}
The question should not be generic. Make it professional and practical.
Return ONLY valid JSON (no markdown, no code blocks):
{{"question_text": "...", "expected_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"], "difficulty": "{difficulty}", "category": "{category}", "skill_tags": ["{skill.lower()}"]}}"""

        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=500,
        )
        content = response.choices[0].message.content.strip()
        # Try to extract JSON from response
        if "```" in content:
            content = re.search(r'```(?:json)?\s*(.*?)```', content, re.DOTALL)
            content = content.group(1).strip() if content else ""
        data = json.loads(content)
        data["created_at"] = datetime.utcnow()
        return data
    except Exception as e:
        print(f"[NLP] LLM question generation error: {e}")
        return _fallback_question(skill, difficulty, category)


def _fallback_question(skill: str, difficulty: str, category: str) -> dict:
    """Fallback question if LLM fails."""
    return {
        "question_text": f"Explain the key concepts of {skill} and how you have applied them in your projects.",
        "expected_keywords": [skill.lower(), "implementation", "design", "performance", "best practices"],
        "difficulty": difficulty,
        "category": category,
        "skill_tags": [skill.lower()],
        "created_at": datetime.utcnow(),
        "auto_generated": True,
    }


# ── Answer Evaluation ──

async def evaluate_answer(question: dict, answer_text: str) -> dict:
    """Evaluate a candidate's answer using Groq LLM."""
    client = _get_groq_client()
    if not client:
        return {"score": 50, "feedback": "Evaluation service unavailable.", "keywords_found": [], "strong_points": "", "weak_points": ""}

    q_text = question.get("question_text", question.get("title", question.get("description", "")))
    keywords = question.get("expected_keywords", [])

    try:
        prompt = f"""You are an advanced technical interviewer evaluating a candidate for an AI-powered interview.
Question: {q_text}
Expected Technical Concepts: {json.dumps(keywords)}
Candidate's Answer: {answer_text}

CRITICAL INSTRUCTION: Do NOT check for exact keyword strings. Evaluate if the candidate conceptually understands the topic correctly and fully answers the question. High scores (80-100) are for conceptually accurate, complete answers. Low scores (0-40) are for completely wrong, silent or "I don't know" answers.

Return ONLY valid JSON (no markdown):
{{"score": <0-100>, "feedback": "<2 sentences max focused on concept>", "keywords_found": [<list of concepts mentioned>], "strong_points": "<brief>", "weak_points": "<brief>"}}"""

        response = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=300,
        )
        content = response.choices[0].message.content.strip()
        if "```" in content:
            content = re.search(r'```(?:json)?\s*(.*?)```', content, re.DOTALL)
            content = content.group(1).strip() if content else ""
        return json.loads(content)
    except Exception as e:
        print(f"[NLP] Answer evaluation error: {e}")
        # Simple keyword-based fallback
        found = [kw for kw in keywords if kw.lower() in answer_text.lower()]
        score = int((len(found) / max(len(keywords), 1)) * 100)
        return {
            "score": score,
            "feedback": f"Found {len(found)}/{len(keywords)} expected keywords.",
            "keywords_found": found,
            "strong_points": "Answer provided" if answer_text else "",
            "weak_points": "Could elaborate more" if score < 70 else "",
        }

async def evaluate_and_generate_next_question(
    chat_history: list,
    candidate_profile: dict,
    position: str
) -> dict:
    """Evaluate last answer and generate next contextual question."""
    client = _get_groq_client()
    if not client:
        return {"score": 50, "feedback": "Evaluation unavailable.", "next_question": "Explain a challenge you faced and how you solved it."}

    # Build context
    history_str = "\n".join([f"{msg['role'].upper()}: {msg['content']}" for msg in chat_history])
    projects = json.dumps(candidate_profile.get("projects", []))
    skills = json.dumps(candidate_profile.get("skills", []))

    try:
        prompt = f"""You are an expert technical interviewer conducting a conversational interview for the role of {position}.

Candidate Profile Context:
- Skills: {skills}
- Projects: {projects}

Chat History:
{history_str}

Based on the LAST candidate answer above, first evaluate it. Then, craft a CONTINUOUS conversational follow-up question.
- If they struggled, ask something simpler or drill down carefully.
- If they succeeded, dig into specifics of their projects or technical depth.
- Do NOT repeat past questions. Act natural.

Return ONLY a valid JSON object matching this schema:
{{
  "score": <0-100 evaluation of their last answer>,
  "feedback": "<very brief feedback on what they said>",
  "next_question": "<the actual question to speak to them next>"
}}"""

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=500,
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content.strip()
        data = json.loads(content)
        return data
    except Exception as e:
        print(f"[NLP] Conversational error: {e}")
        return {
            "score": 50,
            "feedback": "Failed to parse conversation.",
            "next_question": "Could you tell me more about your technical background?"
        }


# ── Audio Transcription ──

def transcribe_audio(audio_bytes: bytes) -> str:
    """Transcribe audio using Whisper."""
    model = _get_whisper()
    if not model:
        return "[Transcription unavailable - Whisper not loaded]"

    try:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        result = model.transcribe(temp_path)
        os.unlink(temp_path)
        return result.get("text", "")
    except Exception as e:
        print(f"[NLP] Transcription error: {e}")
        if 'temp_path' in locals():
            try:
                os.unlink(temp_path)
            except:
                pass
        return "[Transcription failed]"
