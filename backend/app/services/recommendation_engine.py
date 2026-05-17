"""
Recommendation Engine + PDF Report Generation
- Weak-area detection with Groq-powered recommendations
- YouTube API integration
- ReportLab PDF generation
"""
import json
import os
import re
from datetime import datetime
from typing import List

from app.core.config import get_settings

settings = get_settings()


def _get_groq_client():
    try:
        from groq import Groq
        return Groq(api_key=settings.GROQ_API_KEY)
    except Exception:
        return None


async def generate_recommendations(session_data: dict) -> list:
    """Generate learning recommendations based on interview performance."""
    recommendations = []

    # Collect weak areas (score < 60)
    weak_areas = []
    qa_responses = session_data.get("qa_responses", [])
    for resp in qa_responses:
        if resp.get("score", 100) < 60:
            skill_tags = resp.get("skill_tags", [])
            q_text = resp.get("question_text", "")
            weak_areas.append({
                "question": q_text[:100],
                "score": resp.get("score", 0),
                "skills": skill_tags,
            })

    # Check coding score
    coding = session_data.get("coding_submission", {})
    if coding.get("final_score", 100) < 60:
        weak_areas.append({
            "question": "Coding challenge",
            "score": coding.get("final_score", 0),
            "skills": session_data.get("cv_extracted_skills", [])[:3],
        })

    # Build context for LLM
    skills = session_data.get("cv_extracted_skills", [])
    position = session_data.get("position", "Software Engineer")
    interview_mode = session_data.get("interview_mode", "position")
    course = session_data.get("course", "")

    if interview_mode == "course" and course:
        subject = course
        if weak_areas:
            context = f"Student assessed on course '{course}' had weak areas: {json.dumps(weak_areas[:5])}"
            level = "beginner to intermediate"
        else:
            context = f"Student assessed on course '{course}' covering topics: {', '.join(skills[:6])} performed well overall."
            level = "intermediate to advanced"
    else:
        subject = position
        if weak_areas:
            context = f"Candidate applying for {position} had weak areas: {json.dumps(weak_areas[:5])}"
            level = "beginner to intermediate"
        else:
            context = f"Candidate applying for {position} with skills: {', '.join(skills[:6])} performed well overall."
            level = "intermediate to advanced"

    # Always get LLM recommendations
    client = _get_groq_client()
    if client:
        try:
            prompt = f"""{context}

Recommend exactly 5 high-quality online courses or tutorials to help them grow. 
Focus on {level} resources from platforms like Coursera, Udemy, edX, freeCodeCamp, or official documentation.
Each must have a real, working URL from those platforms.
Return ONLY a valid JSON array (no markdown, no extra text):
[{{"topic": "...", "resource_type": "course", "title": "Exact Course Title", "url": "https://www.coursera.org/...", "reason": "Why this helps", "platform": "Coursera", "estimated_hours": <number>}}]"""

            response = client.chat.completions.create(
                model=settings.GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.4,
                max_tokens=1000,
            )
            content = response.choices[0].message.content.strip()
            # Strip markdown code fences if present
            if "```" in content:
                match = re.search(r'```(?:json)?\s*(.*?)```', content, re.DOTALL)
                content = match.group(1).strip() if match else "[]"
            # Find JSON array in content
            arr_match = re.search(r'\[.*\]', content, re.DOTALL)
            if arr_match:
                content = arr_match.group(0)
            recommendations = json.loads(content)
        except Exception as e:
            print(f"[REC] LLM recommendation error: {e}")

    # Fallback if LLM failed or returned empty
    if not recommendations:
        skill_str = ", ".join(skills[:3]) if skills else position
        recommendations = [
            {"topic": skill_str, "resource_type": "course", "title": f"Complete {position} Course", "url": "https://www.coursera.org/search?query=" + position.replace(" ", "+"), "reason": "Comprehensive course for your role", "platform": "Coursera", "estimated_hours": 40},
            {"topic": "Data Structures", "resource_type": "course", "title": "Algorithms and Data Structures", "url": "https://www.coursera.org/learn/algorithms-part1", "reason": "Core CS fundamentals every engineer needs", "platform": "Coursera", "estimated_hours": 30},
            {"topic": "System Design", "resource_type": "course", "title": "System Design for Interviews", "url": "https://www.educative.io/courses/grokking-the-system-design-interview", "reason": "Essential for senior technical roles", "platform": "Educative", "estimated_hours": 20},
            {"topic": "Communication", "resource_type": "course", "title": "Technical Interview Skills", "url": "https://www.udemy.com/course/master-the-coding-interview-data-structures-algorithms/", "reason": "Improve interview confidence and problem-solving approach", "platform": "Udemy", "estimated_hours": 15},
            {"topic": "Problem Solving", "resource_type": "course", "title": "LeetCode Problem Solving", "url": "https://leetcode.com/study-plan/", "reason": "Practice real interview problems", "platform": "LeetCode", "estimated_hours": 50},
        ]

    return recommendations[:5]




async def _get_youtube_recommendations(weak_areas: list) -> list:
    """Get YouTube video recommendations for weak areas."""
    recs = []
    if not settings.YOUTUBE_API_KEY:
        return recs

    try:
        import httpx
        async with httpx.AsyncClient() as client:
            for area in weak_areas[:3]:
                skills = area.get("skills", [])
                query = f"{' '.join(skills[:2])} tutorial for beginners" if skills else "programming tutorial"
                
                resp = await client.get(
                    "https://www.googleapis.com/youtube/v3/search",
                    params={
                        "part": "snippet",
                        "q": query,
                        "type": "video",
                        "maxResults": 2,
                        "key": settings.YOUTUBE_API_KEY,
                    },
                    timeout=10,
                )
                if resp.status_code == 200:
                    data = resp.json()
                    for item in data.get("items", []):
                        video_id = item["id"]["videoId"]
                        title = item["snippet"]["title"]
                        recs.append({
                            "topic": " ".join(skills[:2]) if skills else "Programming",
                            "resource_type": "youtube",
                            "title": title,
                            "url": f"https://www.youtube.com/watch?v={video_id}",
                            "reason": f"Recommended to improve your {' '.join(skills[:2])} skills",
                            "estimated_hours": 1,
                        })
    except Exception as e:
        print(f"[REC] YouTube API error: {e}")

    return recs


def generate_pdf_report(session_data: dict, recommendations: list) -> bytes:
    """Generate a professional PDF report using ReportLab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch, mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable, KeepTogether
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from io import BytesIO

    buffer = BytesIO()
    PAGE_W, PAGE_H = A4
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=15*mm, bottomMargin=20*mm,
        leftMargin=18*mm, rightMargin=18*mm
    )

    # Color palette
    DARK = colors.HexColor('#0f172a')
    INDIGO = colors.HexColor('#4f46e5')
    INDIGO_LIGHT = colors.HexColor('#e0e7ff')
    GREEN = colors.HexColor('#16a34a')
    YELLOW = colors.HexColor('#d97706')
    RED = colors.HexColor('#dc2626')
    GRAY = colors.HexColor('#64748b')
    LIGHT_BG = colors.HexColor('#f8fafc')
    CARD_BG = colors.HexColor('#f1f5f9')
    WHITE = colors.white

    def score_color(s):
        if s >= 70: return GREEN
        if s >= 40: return YELLOW
        return RED

    styles = getSampleStyleSheet()
    story = []

    # ── HEADER BANNER ──
    header_data = [[
        Paragraph(
            '<font name="Helvetica-Bold" size="22" color="#ffffff">IntraView AI</font><br/>'
            '<font name="Helvetica" size="11" color="#c7d2fe">AI-Powered Interview Assessment Platform</font>',
            ParagraphStyle('H', parent=styles['Normal'], alignment=TA_LEFT)
        ),
        Paragraph(
            '<font name="Helvetica-Bold" size="13" color="#ffffff">Interview Report</font>',
            ParagraphStyle('HR', parent=styles['Normal'], alignment=TA_RIGHT)
        ),
    ]]
    header_table = Table(header_data, colWidths=[PAGE_W * 0.6 - 18*mm, PAGE_W * 0.4 - 18*mm])
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), INDIGO),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [INDIGO]),
        ('TOPPADDING', (0, 0), (-1, -1), 14),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 14),
        ('LEFTPADDING', (0, 0), (0, -1), 16),
        ('RIGHTPADDING', (-1, 0), (-1, -1), 16),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [6, 6, 0, 0]),
    ]))
    story.append(header_table)

    # ── CANDIDATE INFO BAR ──
    candidate_name = session_data.get("candidate_name", "Candidate")
    position = session_data.get("position", "Interview")
    start_time = session_data.get("start_time", datetime.utcnow())
    if isinstance(start_time, datetime):
        date_str = start_time.strftime("%B %d, %Y  %H:%M UTC")
    else:
        try:
            date_str = str(start_time)[:19].replace("T", "  ")
        except:
            date_str = "N/A"
    session_id_short = str(session_data.get("_id", ""))[:12] + "..."

    info_data = [[
        Paragraph(f'<font name="Helvetica-Bold" size="11">{candidate_name}</font><br/>'
                  f'<font name="Helvetica" size="9" color="#64748b">{position}</font>',
                  ParagraphStyle('CI', parent=styles['Normal'])),
        Paragraph(f'<font name="Helvetica" size="9" color="#64748b">Date: {date_str}</font><br/>'
                  f'<font name="Helvetica" size="9" color="#64748b">Session: {session_id_short}</font>',
                  ParagraphStyle('CI2', parent=styles['Normal'], alignment=TA_RIGHT)),
    ]]
    info_bar = Table(info_data, colWidths=[PAGE_W * 0.55 - 18*mm, PAGE_W * 0.45 - 18*mm])
    info_bar.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (0, -1), 14),
        ('RIGHTPADDING', (-1, 0), (-1, -1), 14),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROUNDEDCORNERS', [0, 0, 6, 6]),
    ]))
    story.append(info_bar)
    story.append(Spacer(1, 6*mm))

    # ── SECTION HELPER ──
    def section_heading(text, icon=""):
        return Paragraph(
            f'<font name="Helvetica-Bold" size="13" color="#1e293b">{icon}{text}</font>',
            ParagraphStyle('SH', parent=styles['Normal'], spaceBefore=6, spaceAfter=4)
        )

    def divider():
        return HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceAfter=6)

    # ── OVERALL SCORE ──
    report = session_data.get("final_report", {})
    overall = float(report.get("overall_score", 0))
    tech_score = float(report.get("technical_score", 0))
    behav_score = float(report.get("behavioral_score", 0))
    code_score = float(report.get("coding_score", 0))

    story.append(section_heading("Overall Performance"))
    story.append(divider())

    # Score cards row
    def score_cell(label, value, sub=""):
        sc = score_color(value)
        return Paragraph(
            f'<font name="Helvetica" size="9" color="#64748b">{label}</font><br/>'
            f'<font name="Helvetica-Bold" size="22" color="#{sc.hexval()[2:]}">{value:.0f}%</font>'
            + (f'<br/><font name="Helvetica" size="8" color="#94a3b8">{sub}</font>' if sub else ''),
            ParagraphStyle('SC', parent=styles['Normal'], alignment=TA_CENTER)
        )

    score_row = [[
        score_cell("Overall Score", overall),
        score_cell("Technical Q&A", tech_score, "40% weight"),
        score_cell("Behavioral", behav_score, "30% weight"),
        score_cell("Coding", code_score, "30% weight"),
    ]]
    score_table = Table(score_row, colWidths=[(PAGE_W - 36*mm) / 4] * 4)
    score_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('BACKGROUND', (0, 0), (0, -1), INDIGO_LIGHT),
        ('ROUNDEDCORNERS', [4, 4, 4, 4]),
    ]))
    story.append(score_table)
    story.append(Spacer(1, 6*mm))

    # ── BEHAVIORAL ANALYSIS ──
    behavioral = session_data.get("behavioral_data", {})
    eye = float(behavioral.get("avg_eye_contact", 0))
    conf = float(behavioral.get("avg_confidence", 0))
    emotion = behavioral.get("dominant_emotion", "neutral")
    behav_summary = behavioral.get("summary", "")

    story.append(section_heading("Behavioral Analysis"))
    story.append(divider())

    behav_row = [[
        Paragraph(f'<font name="Helvetica-Bold" size="11" color="#{score_color(eye).hexval()[2:]}">{eye:.0f}%</font><br/>'
                  f'<font name="Helvetica" size="9" color="#64748b">Eye Contact</font>',
                  ParagraphStyle('BC', parent=styles['Normal'], alignment=TA_CENTER)),
        Paragraph(f'<font name="Helvetica-Bold" size="11" color="#{score_color(conf).hexval()[2:]}">{conf:.0f}%</font><br/>'
                  f'<font name="Helvetica" size="9" color="#64748b">Confidence</font>',
                  ParagraphStyle('BC', parent=styles['Normal'], alignment=TA_CENTER)),
        Paragraph(f'<font name="Helvetica-Bold" size="11" color="#4f46e5">{emotion.title()}</font><br/>'
                  f'<font name="Helvetica" size="9" color="#64748b">Dominant Emotion</font>',
                  ParagraphStyle('BC', parent=styles['Normal'], alignment=TA_CENTER)),
        Paragraph(f'<font name="Helvetica" size="9" color="#475569">{behav_summary or "Analysis based on video frames."}</font>',
                  ParagraphStyle('BS', parent=styles['Normal'])),
    ]]
    behav_table = Table(behav_row, colWidths=[40*mm, 40*mm, 40*mm, None])
    behav_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(behav_table)
    story.append(Spacer(1, 6*mm))

    # ── Q&A BREAKDOWN ──
    qa = session_data.get("qa_responses", [])
    if qa:
        story.append(section_heading(f"Q&A Breakdown  ({len(qa)} questions)"))
        story.append(divider())
        body_style = ParagraphStyle('Body', parent=styles['Normal'], fontSize=9, leading=13)
        small_style = ParagraphStyle('Small', parent=styles['Normal'], fontSize=8, leading=12, textColor=GRAY)

        for i, resp in enumerate(qa):
            q_text = resp.get("question_text", f"Question {i+1}")
            a_text = resp.get("answer_text", "No answer given")
            score = float(resp.get("score", 0))
            feedback = resp.get("feedback", "")
            sc = score_color(score)

            qa_data = [[
                Paragraph(f'<font name="Helvetica-Bold" size="9">Q{i+1}. </font><font size="9">{q_text[:180]}</font>', body_style),
                Paragraph(f'<font name="Helvetica-Bold" size="11" color="#{sc.hexval()[2:]}">{score:.0f}%</font>', 
                         ParagraphStyle('QS', parent=styles['Normal'], alignment=TA_CENTER)),
            ]]
            qa_top = Table(qa_data, colWidths=[PAGE_W - 36*mm - 30*mm, 30*mm])
            qa_top.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
                ('TOPPADDING', (0, 0), (-1, -1), 6),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                ('LEFTPADDING', (0, 0), (0, -1), 8),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))

            answer_para = Paragraph(f'<font name="Helvetica-Oblique" size="8" color="#475569">Answer: {a_text[:250]}</font>', small_style)
            feedback_para = Paragraph(f'<font name="Helvetica" size="8" color="#64748b">Feedback: {feedback[:200]}</font>', small_style) if feedback else Spacer(1, 1)

            story.append(KeepTogether([qa_top, answer_para, feedback_para, Spacer(1, 2*mm)]))

        story.append(Spacer(1, 4*mm))

    # ── CODING CHALLENGE ──
    coding = session_data.get("coding_submission", {})
    if coding and coding.get("code"):
        story.append(section_heading("Coding Challenge"))
        story.append(divider())
        test_res = coding.get("test_results", {})
        lang = coding.get("language", "N/A")
        passed = test_res.get("passed", 0)
        total = test_res.get("total", 0)
        c_score = float(coding.get("final_score", 0))

        cod_info = [[
            Paragraph(f'<font name="Helvetica" size="9">Language: <b>{lang.upper()}</b></font><br/>'
                     f'<font name="Helvetica" size="9">Test Cases: <b>{passed}/{total} passed</b></font>',
                     ParagraphStyle('CI3', parent=styles['Normal'])),
            Paragraph(f'<font name="Helvetica-Bold" size="16" color="#{score_color(c_score).hexval()[2:]}">{c_score:.0f}%</font><br/>'
                     f'<font name="Helvetica" size="8" color="#64748b">Score</font>',
                     ParagraphStyle('CS', parent=styles['Normal'], alignment=TA_CENTER)),
        ]]
        cod_table = Table(cod_info, colWidths=[PAGE_W - 36*mm - 40*mm, 40*mm])
        cod_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), CARD_BG),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        story.append(cod_table)
        story.append(Spacer(1, 4*mm))

    # ── RECOMMENDATIONS ──
    if recommendations:
        valid_recs = [r for r in recommendations if r.get("url") and r.get("title") != "You performed well overall"]
        if valid_recs:
            story.append(section_heading(f"Learning Recommendations  ({len(valid_recs)} courses)"))
            story.append(divider())

            rec_style = ParagraphStyle('Rec', parent=styles['Normal'], fontSize=9, leading=14)
            small_style2 = ParagraphStyle('RecSmall', parent=styles['Normal'], fontSize=8, leading=12, textColor=GRAY)

            for i, rec in enumerate(valid_recs):
                title = rec.get("title", "Untitled")
                url = rec.get("url", "")
                reason = rec.get("reason", "")
                platform = rec.get("platform", rec.get("resource_type", "Online")).title()
                hours = rec.get("estimated_hours", "")
                hours_str = f"  •  ~{hours}h" if hours else ""

                rec_data = [[
                    Paragraph(f'<font name="Helvetica-Bold" size="10">{i+1}. {title}</font><br/>'
                             f'<font name="Helvetica" size="8" color="#4f46e5">📚 {platform}{hours_str}</font>',
                             rec_style),
                ]]
                rec_table = Table(rec_data, colWidths=[PAGE_W - 36*mm])
                rec_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
                    ('TOPPADDING', (0, 0), (-1, -1), 8),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('LINEBELOW', (0, 0), (-1, 0), 0, colors.HexColor('#e2e8f0')),
                ]))
                reason_p = Paragraph(f'<font name="Helvetica" size="8" color="#475569">{reason}</font>', small_style2)
                url_p = Paragraph(f'<link href="{url}"><font name="Helvetica" size="8" color="#4f46e5">{url}</font></link>', small_style2)
                story.append(KeepTogether([rec_table, reason_p, url_p, Spacer(1, 3*mm)]))

    # ── FOOTER ──
    story.append(Spacer(1, 6*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#e2e8f0'), spaceBefore=4, spaceAfter=4))
    story.append(Paragraph(
        f'<font name="Helvetica" size="8" color="#94a3b8">Generated by IntraView AI  •  {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}  •  Confidential</font>',
        ParagraphStyle('Footer', parent=styles['Normal'], alignment=TA_CENTER)
    ))

    doc.build(story)
    return buffer.getvalue()



async def save_report(db, session_id: str, pdf_bytes: bytes, session_data: dict, recommendations: list):
    """Save report PDF to disk and update MongoDB session."""
    reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "reports")
    os.makedirs(reports_dir, exist_ok=True)

    pdf_path = os.path.join(reports_dir, f"{session_id}.pdf")
    with open(pdf_path, "wb") as f:
        f.write(pdf_bytes)

    from bson import ObjectId
    filter_id = ObjectId(session_id) if ObjectId.is_valid(session_id) else session_id

    await db["interview_sessions"].update_one(
        {"_id": filter_id},
        {"$set": {
            "final_report.report_pdf_path": pdf_path,
            "final_report.recommendations": recommendations,
        }}
    )

    return pdf_path
