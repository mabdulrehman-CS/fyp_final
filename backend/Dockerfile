FROM python:3.11-slim

WORKDIR /app

# System dependencies for Whisper, OpenCV, etc.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir setuptools wheel
# Pre-install CPU-only PyTorch and TensorFlow-CPU to reduce image size by over 10GB!
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu
RUN pip install --no-cache-dir tensorflow-cpu
RUN pip install --no-cache-dir --no-build-isolation -r requirements.txt
RUN python -m spacy download en_core_web_lg

COPY . .

RUN mkdir -p /app/reports /app/uploads

EXPOSE 8000

CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
