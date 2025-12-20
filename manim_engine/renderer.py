import subprocess, sys

job = sys.argv[1]

subprocess.run(
    ["manim", "-qm", "scene.py", "GeneratedScene", "--media_dir", "media"],
    cwd=job,
    check=True
)
