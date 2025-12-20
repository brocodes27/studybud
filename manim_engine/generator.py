import os
import sys
import json
import shutil
import re
import textwrap
import glob
from openai import OpenAI
from pydub import AudioSegment

# ------------------ AUDIO ENGINE ------------------

try:
    from audio_engine import generate_audio
except ImportError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from audio_engine import generate_audio

# ------------------ OPENAI CLIENT ------------------

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")
)

# ------------------ MANIM SYSTEM PROMPT ------------------

MANIM_PROMPT = r"""
You are a Lead Visual Designer creating dense 3Blue1Brown-style Manim scenes.

STRICT RULES:
- No nested functions
- No SVGMobject
- Initialize all variables
- Use MathTex for math
- Use self.ctx for persistence
- Dark theme, high-density visuals
- Every segment MUST have visuals

Return ONLY valid JSON:
{
  "segments": [
    {"text": "...", "code": "..."}
  ]
}
"""

# ------------------ CODE CLEANER ------------------

def clean_code_block(code: str) -> str:
    code = code.replace("```python", "").replace("```", "").strip()
    lines = code.split("\n")
    filtered = []

    for line in lines:
        l = line.strip()

        if l.startswith("from manim import"): continue
        if l.startswith("import "): continue
        if l.startswith("class "): continue
        if l.startswith("def construct"): continue
        if l.startswith("super()."): continue

        if "MathMathTex" in line:
            line = line.replace("MathMathTex", "MathTex")
        if "MathText" in line:
            line = line.replace("MathText", "MathTex")

        if "Tex(r" in line and ("_" in line or "^" in line):
            line = line.replace("Tex(r", "MathTex(r")

        if ".arrange_in_circle(" in line:
            line = line.replace(".arrange_in_circle(", ".arrange(")

        filtered.append(line)

    cleaned = textwrap.dedent("\n".join(filtered)).strip()

    if not cleaned:
        return ""

    return "\n".join(
        "        " + ln if ln.strip() else "" for ln in cleaned.split("\n")
    )

# ------------------ FFMPEG SETUP ------------------

def setup_ffmpeg():
    if os.name == "nt":
        base = os.path.join(
            os.environ.get("LOCALAPPDATA", ""),
            "Microsoft", "WinGet", "Packages"
        )
        matches = glob.glob(os.path.join(base, "**/bin/ffmpeg.exe"), recursive=True)
        if matches:
            bin_dir = os.path.dirname(matches[0])
            os.environ["PATH"] += os.pathsep + bin_dir
            AudioSegment.converter = os.path.join(bin_dir, "ffmpeg.exe")
            AudioSegment.ffprobe = os.path.join(bin_dir, "ffprobe.exe")

# ------------------ MAIN PIPELINE ------------------

def generate_scene_and_audio(topic, script_text, job_dir=None):
    setup_ffmpeg()

    if job_dir:
        os.makedirs(job_dir, exist_ok=True)
    base_path = job_dir or ""

    prompt = (
        f"Topic: {topic}\n"
        f"FIXED SCRIPT:\n{script_text}\n\n"
        "Split into 8–14 dense visual segments.\n"
        "Return JSON only."
    )

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": MANIM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.35,
        max_tokens=4500,
    )

    raw = response.choices[0].message.content.strip()
    start, end = raw.find("{"), raw.rfind("}")
    json_blob = raw[start:end + 1]

    def robust_load(s):
        try:
            return json.loads(s)
        except json.JSONDecodeError:
            s = re.sub(r'\\(?![\\"])', r'\\\\', s)
            return json.loads(s)

    data = robust_load(json_blob)
    segments = data.get("segments", [])

    # ------------------ MANIM SCENE TEMPLATE ------------------

    colors = [
        "NEON_GREEN = '#22c55e'",
        "ELECTRIC_BLUE = '#3b82f6'",
        "GOLD = '#f59e0b'",
        "DEEP_PURPLE = '#a855f7'",
        "CORAL = '#fb7185'",
    ]

    scene_code = (
        "from manim import *\n"
        "import numpy as np\n"
        "import math\n\n"
        "MathMathTex = MathTex\n"
        "MathText = MathTex\n\n"
        + "\n".join(colors) +
        "\n\nclass GeneratedScene(Scene):\n"
        "    def clear_except(self, *keep):\n"
        "        to_fade = [m for m in self.mobjects if m not in keep and isinstance(m, Mobject)]\n"
        "        if to_fade:\n"
        "            self.play(FadeOut(VGroup(*to_fade)))\n\n"
        "    def construct(self):\n"
        "        self.ctx = {}\n"
    )

    full_audio = AudioSegment.empty()
    narration_text = ""

    temp_audio = os.path.join(base_path, "temp_audio")
    shutil.rmtree(temp_audio, ignore_errors=True)
    os.makedirs(temp_audio, exist_ok=True)

    # ------------------ SEGMENT LOOP ------------------

    for i, seg in enumerate(segments, start=1):
        text = seg["text"]
        code = clean_code_block(seg["code"])

        audio_path = os.path.join(temp_audio, f"seg_{i}.mp3")
        if generate_audio(text, audio_path):
            audio = AudioSegment.from_file(audio_path)
            duration = len(audio) / 1000
            full_audio += audio
        else:
            duration = 2.0

        scene_code += f"\n        # ---- Segment {i} ({duration:.2f}s) ----\n"
        scene_code += f"        _t0 = self.renderer.time\n"
        scene_code += code + "\n"
        scene_code += f"        _t1 = self.renderer.time\n"
        scene_code += (
            f"        if {duration:.2f} - (_t1 - _t0) > 0:\n"
            f"            self.wait({duration:.2f} - (_t1 - _t0))\n"
        )

        narration_text += text + " "

    shutil.rmtree(temp_audio, ignore_errors=True)

    # ------------------ WRITE OUTPUT ------------------

    with open(os.path.join(base_path, "scene.py"), "w", encoding="utf-8") as f:
        f.write(scene_code)

    full_audio.export(os.path.join(base_path, "narration.mp3"), format="mp3")

    with open(os.path.join(base_path, "narration.txt"), "w", encoding="utf-8") as f:
        f.write(narration_text.strip())

    print("✅ 3–5 min educational video generated successfully")

# ------------------ CLI ENTRY ------------------

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generator.py <topic> <script_or_file> [job_dir]")
        sys.exit(1)

    topic = sys.argv[1]
    script_input = sys.argv[2]
    job_dir = sys.argv[3] if len(sys.argv) > 3 else None

    if os.path.isfile(script_input):
        with open(script_input, "r", encoding="utf-8") as f:
            script_text = f.read()
    else:
        script_text = script_input

    generate_scene_and_audio(topic, script_text, job_dir)
