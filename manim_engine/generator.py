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
def fallback_segments(topic, script):
    sentences = re.split(r"(?<=[.!?])\s+", script)
    chunks = []

    current = ""
    for s in sentences:
        current += " " + s
        if len(current) > 400:
            chunks.append(current.strip())
            current = ""

    if current:
        chunks.append(current.strip())

    segments = []
    for i, chunk in enumerate(chunks[:8]):
        segments.append({
            "visual": f"{topic} – key idea {i+1}",
            "voiceover": chunk
        })

    return segments


def get_segments_from_ai(topic, script_text):
    prompt = f"""
You are an educational video planner.

Return JSON only.

Preferred schema:
{{
  "segments": [
    {{
      "visual": "what appears visually",
      "voiceover": "spoken narration"
    }}
  ]
}}

Rules:
- 6 to 10 segments
- Each voiceover 20–45 seconds
- No markdown
- No explanations outside JSON
- Escape quotes properly

Topic: {topic}
Script:
{script_text}
"""

    last_error = None

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
            )

            raw = response.choices[0].message.content.strip()

            # 1️⃣ Extract first JSON object
            match = re.search(r"\{.*\}", raw, re.S)
            if not match:
                raise ValueError("No JSON object found")

            data = json.loads(match.group())

            # 2️⃣ FLEXIBLE SEGMENT DISCOVERY
            if isinstance(data, dict):
                # Case 1: perfect schema
                if "segments" in data and isinstance(data["segments"], list):
                    return normalize_segments(data["segments"])

                # Case 2: nested
                for key, value in data.items():
                    if isinstance(value, dict) and "segments" in value:
                        return normalize_segments(value["segments"])
                    if isinstance(value, list):
                        return normalize_segments(value)

            # Case 3: raw list
            if isinstance(data, list):
                return normalize_segments(data)

            raise ValueError("No usable segments found")

        except Exception as e:
            last_error = e
            print(f"⚠️ AI parse failed ({attempt+1}/3): {e}")

    # 4️⃣ GUARANTEED FALLBACK (NEVER FAILS)
    print("⚠️ Falling back to deterministic segmentation")

    return fallback_segments(topic, script_text)


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
def normalize_segments(raw_segments):
    """
    Ensures every segment has visual + voiceover
    """
    cleaned = []

    for i, seg in enumerate(raw_segments):
        if not isinstance(seg, dict):
            continue

        visual = seg.get("visual") or seg.get("scene") or seg.get("description")
        voice = seg.get("voiceover") or seg.get("narration") or seg.get("text")

        if not voice:
            continue

        cleaned.append({
            "visual": visual or f"Concept explanation segment {i+1}",
            "voiceover": voice
        })

    if not cleaned:
        raise ValueError("Segments empty after normalization")

    return cleaned


def generate(topic, script_path):
    script = Path(script_path).read_text()
    job = BASE_DIR / str(uuid.uuid4())
    job.mkdir(parents=True)

    segments = get_segments_from_ai(topic, script)

    audio_files = []
    for i, seg in enumerate(segments):
        path = job / f"seg_{i+1}.mp3"
        generate_audio(seg["voiceover"], path)
        audio_files.append(path)

    durations = align_segments(audio_files)

    scene_code = build_scene_code(segments, durations)
    (job / "scene.py").write_text(scene_code)

    return job
