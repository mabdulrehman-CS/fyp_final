"""
Behavioral Analyst Service
- Frame analysis (MediaPipe FaceMesh + DeepFace)
- Audio confidence analysis (librosa)
- Behavioral score calculation
"""
import base64
import io
import tempfile
import os
import numpy as np
from typing import Optional

# Lazy-load heavy models
_face_mesh = None
_mp_face_mesh = None


def _get_face_mesh():
    global _face_mesh, _mp_face_mesh
    if _face_mesh is None:
        try:
            import mediapipe as mp
            _mp_face_mesh = mp.solutions.face_mesh
            _face_mesh = _mp_face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5
            )
        except Exception as e:
            print(f"[BEHAVIORAL] MediaPipe init error: {e}")
    return _face_mesh


def store_frontend_behavioral_data(data: dict) -> dict:
    """
    Accept pre-computed behavioral data from the frontend (face-api.js).
    The frontend does all face detection, eye contact, and emotion analysis
    in the browser and sends the results directly — no server-side image
    processing needed.
    """
    return {
        "eye_contact_score": float(data.get("eye_contact_score", 0)),
        "dominant_emotion": data.get("dominant_emotion", "neutral"),
        "emotion_scores": data.get("emotion_scores", {}),
        "face_detected": bool(data.get("face_detected", False)),
    }


def analyze_frame(image_base64: str) -> dict:
    """Analyze a video frame for eye contact and emotions."""
    result = {
        "eye_contact_score": 0.0,
        "dominant_emotion": "unknown",
        "emotion_scores": {},
        "face_detected": False,
    }

    try:
        import cv2
        # Decode base64 to image
        if "," in image_base64:
            image_base64 = image_base64.split(",")[1]
        img_bytes = base64.b64decode(image_base64)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            return result

        # MediaPipe FaceMesh for eye contact
        face_mesh = _get_face_mesh()
        if face_mesh:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            mp_results = face_mesh.process(rgb)

            if mp_results.multi_face_landmarks:
                result["face_detected"] = True
                landmarks = mp_results.multi_face_landmarks[0].landmark

                # Eye contact score based on iris position
                # Left eye: landmarks 468-472, Right eye: 473-477 (refined landmarks)
                # Eye corners: Left (33, 133), Right (362, 263)
                try:
                    # Left iris center
                    left_iris = landmarks[468] if len(landmarks) > 468 else landmarks[159]
                    left_inner = landmarks[133]
                    left_outer = landmarks[33]

                    # Right iris center
                    right_iris = landmarks[473] if len(landmarks) > 473 else landmarks[386]
                    right_inner = landmarks[362]
                    right_outer = landmarks[263]

                    # Calculate how centered the iris is (0=edge, 1=centered)
                    def iris_center_ratio(iris, inner, outer):
                        eye_width = abs(outer.x - inner.x)
                        if eye_width < 0.001:
                            return 0.5
                        pos = (iris.x - min(inner.x, outer.x)) / eye_width
                        return 1.0 - abs(pos - 0.5) * 2  # 1.0 = centered

                    left_ratio = iris_center_ratio(left_iris, left_inner, left_outer)
                    right_ratio = iris_center_ratio(right_iris, right_inner, right_outer)
                    result["eye_contact_score"] = round(((left_ratio + right_ratio) / 2) * 100, 1)
                except (IndexError, AttributeError):
                    result["eye_contact_score"] = 50.0

        # DeepFace emotion analysis
        try:
            from deepface import DeepFace
            analysis = DeepFace.analyze(img, actions=['emotion'], enforce_detection=False, silent=True)
            if isinstance(analysis, list):
                analysis = analysis[0]
            result["dominant_emotion"] = analysis.get("dominant_emotion", "unknown")
            result["emotion_scores"] = analysis.get("emotion", {})
            result["face_detected"] = True
        except Exception as e:
            print(f"[BEHAVIORAL] DeepFace error: {e}")

    except Exception as e:
        print(f"[BEHAVIORAL] Frame analysis error: {e}")

    return result


def analyze_audio_confidence(audio_bytes: bytes) -> dict:
    """Analyze audio for confidence indicators."""
    result = {
        "confidence_score": 50.0,
        "volume_level": 0.0,
        "speech_rate_indicator": "normal",
    }

    try:
        import librosa
        import soundfile as sf

        # Write bytes to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(audio_bytes)
            temp_path = f.name

        try:
            y, sr = librosa.load(temp_path, sr=None)

            if len(y) == 0:
                return result

            # RMS energy (volume)
            rms = librosa.feature.rms(y=y)[0]
            avg_rms = float(np.mean(rms))
            result["volume_level"] = round(min(avg_rms * 1000, 100), 1)

            # Spectral centroid (pitch)
            spec_cent = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            pitch_var = float(np.std(spec_cent))

            # Zero crossing rate (speech rate indicator)
            zcr = librosa.feature.zero_crossing_rate(y=y)[0]
            avg_zcr = float(np.mean(zcr))

            if avg_zcr > 0.15:
                result["speech_rate_indicator"] = "fast"
            elif avg_zcr < 0.05:
                result["speech_rate_indicator"] = "slow"
            else:
                result["speech_rate_indicator"] = "normal"

            # Confidence score: high volume + moderate pitch variance = confident
            vol_score = min(avg_rms * 500, 50)  # Up to 50 points from volume
            pitch_score = min(pitch_var / 100, 50)  # Up to 50 points from pitch variation
            result["confidence_score"] = round(min(vol_score + pitch_score, 100), 1)

        finally:
            os.unlink(temp_path)

    except Exception as e:
        print(f"[BEHAVIORAL] Audio analysis error: {e}")

    return result


def calculate_behavioral_score(session_data: dict) -> dict:
    """Calculate overall behavioral score from session data."""
    behavioral = session_data.get("behavioral_data", {})
    frames = behavioral.get("frames", [])
    audio_events = behavioral.get("audio_events", [])

    # Defaults
    eye_contact_avg = 50.0
    positive_emotion_pct = 50.0
    confidence_avg = 50.0

    if frames:
        eye_scores = [f.get("eye_contact_score", 50) for f in frames]
        eye_contact_avg = sum(eye_scores) / len(eye_scores)

        positive_count = sum(
            1 for f in frames
            if f.get("dominant_emotion", "") in ["happy", "neutral", "surprise"]
        )
        positive_emotion_pct = (positive_count / len(frames)) * 100

    if audio_events:
        conf_scores = [a.get("confidence_score", 50) for a in audio_events]
        confidence_avg = sum(conf_scores) / len(conf_scores)

    # Weighted: eye_contact 40%, emotion 30%, audio_confidence 30%
    behavioral_score = (eye_contact_avg * 0.4) + (positive_emotion_pct * 0.3) + (confidence_avg * 0.3)

    summary_parts = []
    if eye_contact_avg >= 70:
        summary_parts.append("Good eye contact maintained")
    else:
        summary_parts.append("Eye contact needs improvement")
    if positive_emotion_pct >= 60:
        summary_parts.append("positive demeanor")
    else:
        summary_parts.append("appeared tense")
    if confidence_avg >= 60:
        summary_parts.append("confident delivery")
    else:
        summary_parts.append("could speak more confidently")

    return {
        "behavioral_score": round(behavioral_score, 1),
        "eye_contact_avg": round(eye_contact_avg, 1),
        "positive_emotion_pct": round(positive_emotion_pct, 1),
        "confidence_avg": round(confidence_avg, 1),
        "summary": "; ".join(summary_parts),
    }
