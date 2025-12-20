import os
import sys
import json
import shutil
import re
import textwrap
import glob
import time
from openai import OpenAI
from pydub import AudioSegment

# ================= AUDIO ENGINE =================

try:
    from audio_engine import generate_audio
except ImportError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from audio_engine import generate_audio

# ================= OPENAI =================

client = OpenAI(
    api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")
)

# ================= SYSTEM PROMPT =================

MANIM_PROMPT = r"""
You are generating Manim code for 3Blue1Brown-style educational videos.

STRICT RULES:
- Return ONLY valid JSON
- NO explanations, NO markdown, NO text outside JSON
- One visual idea per segment
- Always position visuals (LEFT / RIGHT / UP / DOWN)
- No SVGMobject
- No nested functions
- Use MathTex for math
- Calm animations

JSON FORMAT:
{
  "segments": [
    { "text": "...", "code": "..." }
  ]
}
"""

# ================= JSON EXTRACTION (BULLETPROOF) =================

def extract_json_object(text: str):
    """
    Extracts the FIRST valid JSON object from a string.
    Ignores extra text before/after.
    """
    text = text.replace("```json", "").replace("```", "")
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON start found")

    brace_count = 0
    for i in range(start, len(text)):
        if text[i] == "{":
            brace_count += 1
        elif text[i] == "}":
            brace_count -= 1

        if brace_count == 0:
            candidate = text[start:i + 1]
            try:
                return json.loads(candidate)
            except json.JSONDecodeError:
                break

    raise ValueError("Failed to extract valid JSON")

# ================= CODE CLEANER =================

def clean_code_block(code: str) -> str:
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

        if ".arrange_in_circle(" in line:
            line = line.replace(".arrange_in_circle(", ".arrange(")

        out.append(line)

    cleaned = textwrap.dedent("\n".join(out)).strip()
    if not cleaned:
        return ""

    return "\n".join("        " + ln if ln.strip() else "" for ln in cleaned.split("\n"))

# ================= FFMPEG =================

def setup_ffmpeg():
    if os.name == "nt":
        base = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Microsoft", "WinGet", "Packages")
        hits = glob.glob(os.path.join(base, "**/bin/ffmpeg.exe"), recursive=True)
        if hits:
            bin_dir = os.path.dirname(hits[0])
            os.environ["PATH"] += os.pathsep + bin_dir
            AudioSegment.converter = os.path.join(bin_dir, "ffmpeg.exe")
            AudioSegment.ffprobe = os.path.join(bin_dir, "ffprobe.exe")

# ================= OPENAI CALL WITH RETRY =================

def get_segments_from_ai(topic, script_text, retries=3):
    for attempt in range(1, retries + 1):
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": MANIM_PROMPT},
                    {
                        "role": "user",
                        "content": f"""
Topic: {topic}

SCRIPT:
{script_text}

Split into 8–14 segments.
Return JSON ONLY.
"""
                    },
                ],
                temperature=0.3,
                max_tokens=4500,
            )

            raw = response.choices[0].message.content
            data = extract_json_object(raw)

            if "segments" not in data or not isinstance(data["segments"], list):
                raise ValueError("JSON missing 'segments'")

            return data["segments"]

        except Exception as e:
            print(f"⚠️ AI parse failed (attempt {attempt}/{retries}): {e}")
            time.sleep(1)

    raise RuntimeError("❌ Failed to get valid JSON from AI after retries")

# ================= MAIN PIPELINE =================

def generate_scene_and_audio(topic, script_text, job_dir=None):
    setup_ffmpeg()
    base_path = job_dir or "."
    os.makedirs(base_path, exist_ok=True)

    segments = get_segments_from_ai(topic, script_text)

    # ---------- MANIM TEMPLATE ----------

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
    narration_text = ""

    temp_audio = os.path.join(base_path, "temp_audio")
    shutil.rmtree(temp_audio, ignore_errors=True)
    os.makedirs(temp_audio, exist_ok=True)

    # ---------- SEGMENTS ----------

    for i, seg in enumerate(segments, start=1):
        text = seg["text"]
        code = clean_code_block(seg["code"])

        audio_path = os.path.join(temp_audio, f"seg_{i}.mp3")
        if not generate_audio(text, audio_path):
            raise RuntimeError(f"Audio generation failed for segment {i}")

        audio = AudioSegment.from_file(audio_path)
        duration = len(audio) / 1000.0

        scene_code += f"""
        # ===== Segment {i} =====
        self.clear_except()
{code}
        self.wait({duration})
"""

        full_audio += audio
        narration_text += text + " "

    shutil.rmtree(temp_audio, ignore_errors=True)

    # ---------- WRITE OUTPUT ----------

    with open(os.path.join(base_path, "scene.py"), "w", encoding="utf-8") as f:
        f.write(scene_code)

    full_audio.export(os.path.join(base_path, "narration.mp3"), format="mp3")

    with open(os.path.join(base_path, "narration.txt"), "w", encoding="utf-8") as f:
        f.write(narration_text.strip())

    print("✅ Generation successful (no overlap, perfect sync, JSON-safe)")

# ================= CLI =================

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
