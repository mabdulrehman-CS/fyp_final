import os
import tempfile
import subprocess
import shutil

sandbox_id = "test_123"
temp_dir = os.path.join(os.environ.get('TEMP', '/tmp'), f"sandbox_{sandbox_id}")
os.makedirs(temp_dir, exist_ok=True)
try:
    code_path = os.path.join(temp_dir, "solution.py")
    with open(code_path, "w", encoding="utf-8") as f:
        f.write("print('hello world')")
    
    docker_cmd = [
        "docker", "run", "--rm",
        "--memory=128m", "--cpus=0.5", "--network=none",
        "-v", f"{temp_dir}:/code:ro",
        "python:3.11-slim", "sh", "-c", "python /code/solution.py",
    ]
    
    print("Running docker command:", " ".join(docker_cmd))
    proc = subprocess.run(docker_cmd, capture_output=True, text=True, timeout=10)
    print("Return code:", proc.returncode)
    print("Stdout:", proc.stdout)
    print("Stderr:", proc.stderr)
finally:
    shutil.rmtree(temp_dir, ignore_errors=True)
    
