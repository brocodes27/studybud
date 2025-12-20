import json, uuid, re
from pathlib import Path
from openai import OpenAI

from audio_engine import generate_audio
from alignment import align_segments

BASE_DIR = Path("manim_engine/jobs")
MODEL = "gpt-4.1"

client = OpenAI()

# ---------------- JSON HARD PARSE ----------------

def extract_json(raw):
    m = re.search(r"\{.*\}", raw, re.S)
    if not m:
        raise ValueError("No JSON")
    return json.loads(m.group())

# ---------------- AI SEGMENTS ----------------

def get_segments(topic, script):
    prompt = f"""
Return ONLY valid JSON.

Schema:
{{
 "segments":[
   {{
     "visual":"what should appear visually",
     "voiceover":"spoken narration"
   }}
 ]
}}

Rules:
- 6–10 segments
- No markdown
- Escape quotes
- 20–45s narration each

Topic: {topic}
Script:
{script}
"""
    for i in range(3):
        try:
            r = client.chat.completions.create(
                model=MODEL,
                messages=[{"role":"user","content":prompt}],
                temperature=0.2
            )
            return extract_json(r.choices[0].message.content)["segments"]
        except Exception as e:
            print(f"⚠️ AI parse failed ({i+1}/3):", e)

    raise RuntimeError("AI failed")

# ---------------- SCENE BUILDER ----------------

def build_scene_code(segments, durations):
    lines = [
        "from scene import GeneratedScene",
        "",
        "class GeneratedScene(GeneratedScene):",
        "    def construct(self):",
        "        self.ctx = {}",
        ""
    ]

    for i, (seg, dur) in enumerate(zip(segments, durations)):
        visual = seg["visual"].replace("'''", "")
        lines += [
            f"        # Segment {i+1}",
            "        self.run_segment(",
            f"            duration={dur:.2f},",
            "            fn=lambda:",
            f"                self.text_block('''{visual}''')",
            "        )",
            "        self.clear()",
            ""
        ]

    return "\n".join(lines)

# ---------------- MAIN ----------------

def generate(topic, script_path):
    script = Path(script_path).read_text()
    job = BASE_DIR / str(uuid.uuid4())
    job.mkdir(parents=True)

    segments = get_segments(topic, script)

    audio_files = []
    for i, seg in enumerate(segments):
        path = job / f"seg_{i+1}.mp3"
        generate_audio(seg["voiceover"], path)
        audio_files.append(path)

    durations = align_segments(audio_files)

    scene_code = build_scene_code(segments, durations)
    (job / "scene.py").write_text(scene_code)

    return job
