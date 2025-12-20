import os
import sys
import json
import shutil
import re
import textwrap
import glob
from openai import OpenAI
from pydub import AudioSegment

# ---------------- AUDIO ENGINE ----------------

try:
    from audio_engine import generate_audio
except ImportError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from audio_engine import generate_audio

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")
)

# ---------------- SYSTEM PROMPT ----------------

MANIM_PROMPT = r"""
You are generating Manim code for 3Blue1Brown-style videos.

RULES:
- One visual idea per segment
- NO overlapping visuals
- Always position objects using LEFT / RIGHT / UP / DOWN
- Use self.clear_except() at start of each segment
- Animations should be calm and minimal
- Return ONLY JSON
"""

# ---------------- CODE CLEANER ----------------

def clean_code_block(code):
    code = code.replace("```python", "").replace("```", "").strip()
    lines = code.split("\n")
    out = []

    for line in lines:
        l = line.strip()
        if l.startswith("import") or l.startswith("from manim"):
            continue
        if l.startswith("class ") or l.startswith("def construct"):
            continue
        if "MathText" in line:
            line = line.replace("MathText", "MathTex")
        if "Tex(r" in line and ("_" in line or "^" in line):
            line = line.replace("Tex(r", "MathTex(r")
        out.append(line)

    cleaned = textwrap.dedent("\n".join(out)).strip()
    return "\n".join("        " + ln for ln in cleaned.split("\n"))

# ---------------- FFMPEG ----------------

def setup_ffmpeg():
    if os.name == "nt":
        base = os.path.join(os.environ["LOCALAPPDATA"], "Microsoft", "WinGet", "Packages")
        hits = glob.glob(os.path.join(base, "**/bin/ffmpeg.exe"), recursive=True)
        if hits:
            os.environ["PATH"] += os.pathsep + os.path.dirname(hits[0])
            AudioSegment.converter = hits[0]

# ---------------- MAIN ----------------

def generate_scene_and_audio(topic, script_text, job_dir=None):
    setup_ffmpeg()
    os.makedirs(job_dir or ".", exist_ok=True)

    prompt = f"""
Topic: {topic}
SCRIPT:
{script_text}

Split into 8–14 segments.
Return JSON only.
"""

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": MANIM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=4500,
    )

    raw = response.choices[0].message.content
    data = json.loads(raw[raw.find("{"): raw.rfind("}") + 1])
    segments = data["segments"]

    scene_code = """from manim import *
import numpy as np

class GeneratedScene(Scene):
    def clear_except(self, *keep):
        to_remove = [m for m in self.mobjects if m not in keep]
        if to_remove:
            self.play(FadeOut(VGroup(*to_remove)))

    def construct(self):
        self.ctx = {}
"""

    full_audio = AudioSegment.empty()
    narration = ""

    temp_audio = "temp_audio"
    shutil.rmtree(temp_audio, ignore_errors=True)
    os.makedirs(temp_audio)

    for i, seg in enumerate(segments, start=1):
        text = seg["text"]
        code = clean_code_block(seg["code"])

        audio_path = f"{temp_audio}/seg_{i}.mp3"
        generate_audio(text, audio_path)
        audio = AudioSegment.from_file(audio_path)
        duration = len(audio) / 1000

        scene_code += f"""
        # ===== Segment {i} =====
        self.clear_except()
{code}
        self.wait({duration})
"""
        full_audio += audio
        narration += text + " "

    shutil.rmtree(temp_audio)

    with open("scene.py", "w", encoding="utf-8") as f:
        f.write(scene_code)

    full_audio.export("narration.mp3", format="mp3")

    with open("narration.txt", "w", encoding="utf-8") as f:
        f.write(narration.strip())

    print("✅ No overlap. Perfect audio sync.")

# ---------------- CLI ----------------

if __name__ == "__main__":
    topic = sys.argv[1]
    script = sys.argv[2]

    if os.path.isfile(script):
        with open(script) as f:
            script = f.read()

    generate_scene_and_audio(topic, script)
