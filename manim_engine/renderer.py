import subprocess
import sys
import os
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: python renderer.py <job_directory>")
    sys.exit(1)

job_dir = sys.argv[1]

# Validate the job directory exists
if not os.path.isdir(job_dir):
    print(f"❌ Error: Job directory does not exist: {job_dir}")
    sys.exit(1)

# Check if scene.py exists
scene_path = os.path.join(job_dir, "scene.py")
if not os.path.isfile(scene_path):
    print(f"❌ Error: scene.py not found in {job_dir}")
    sys.exit(1)

print(f"📁 Job directory: {job_dir}")
print(f"🎬 Scene file: {scene_path}")
print(f"🚀 Starting Manim render...")

try:
    result = subprocess.run(
        ["manim", "-qm", "scene.py", "GeneratedScene", "--media_dir", "media"],
        cwd=job_dir,
        check=True,
        capture_output=True,
        text=True
    )
    print(result.stdout)
    if result.stderr:
        print("Warnings:", result.stderr)
    print("✅ Render complete!")
except subprocess.CalledProcessError as e:
    print(f"❌ Manim failed with code {e.returncode}")
    print("STDOUT:", e.stdout)
    print("STDERR:", e.stderr)
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    sys.exit(1)
