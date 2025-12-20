import subprocess
import sys
import os
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: python renderer.py <job_directory_or_scene_file>")
    sys.exit(1)

job_input = sys.argv[1]

# Smart path detection: if it's a file path ending in scene.py, get the parent directory
if job_input.endswith('scene.py') or job_input.endswith('/scene.py'):
    job_dir = os.path.dirname(job_input)
    print(f"🔍 Detected scene.py path, using parent directory: {job_dir}")
else:
    job_dir = job_input

# Validate the job directory exists
if not os.path.isdir(job_dir):
    print(f"❌ Error: Job directory does not exist: {job_dir}")
    
    # Debug: show what we have
    print(f"📋 Received argument: {job_input}")
    print(f"📋 Interpreted as directory: {job_dir}")
    
    # Try to find the actual directory
    if os.path.exists(job_input):
        print(f"⚠️ Note: The path exists but is not a directory")
        if os.path.isfile(job_input):
            print(f"⚠️ It's a file. Trying parent directory...")
            job_dir = os.path.dirname(job_input)
            if os.path.isdir(job_dir):
                print(f"✅ Using parent directory: {job_dir}")
            else:
                print(f"❌ Parent directory also doesn't exist")
                sys.exit(1)
    else:
        print(f"❌ The path doesn't exist at all")
        sys.exit(1)

# Check if scene.py exists
scene_path = os.path.join(job_dir, "scene.py")
if not os.path.isfile(scene_path):
    print(f"❌ Error: scene.py not found in {job_dir}")
    print(f"📁 Directory contents:")
    try:
        contents = os.listdir(job_dir)
        for item in contents:
            print(f"  - {item}")
    except Exception as e:
        print(f"  Could not list directory: {e}")
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
