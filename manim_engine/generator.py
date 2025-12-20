import json, uuid, re, sys, os
from pathlib import Path
from openai import OpenAI

from audio_engine import generate_audio
from alignment import align_segments
from subtitle_generator import generate_subtitles

# Use absolute path to ensure correct directory in Docker
BASE_DIR = Path(__file__).parent / "jobs"
MODEL = "gpt-4o"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY"))

# ---------------- JSON HARD PARSE ----------------
def sanitize_visual_text(visual: str) -> str:
    """
    Removes all file-based image references.
    """
    lowered = visual.lower()

    banned = [".png", ".jpg", ".jpeg", ".gif", "image", "photo", "picture"]

    if any(b in lowered for b in banned):
        return "Abstract diagram illustrating the concept"

    return visual


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
    prompt = f"""You are an expert Manim animator creating educational videos.

Generate segments with ACTUAL Manim animation code, not text descriptions.

Return JSON only in this schema:
{{
  "segments": [
    {{
      "voiceover": "spoken narration text",
      "code": "Manim animation code (plain code, no class/def wrappers)"
    }}
  ]
}}

MANIM CODE RULES:
1. Use rich visuals: Circle(), Square(), Axes(), NumberPlane(), VMobject, etc.
2. Create diagrams, graphs, and animations - NOT just Text()
3. Use colors: BLUE, RED, GREEN, YELLOW, PURPLE, ORANGE
4. Animate with: Create(), FadeIn(), Transform(), Write(), MoveToTarget()
5. Position with: .to_edge(UP), .shift(LEFT*2), .next_to(obj, DOWN)
6. For math: Use MathTex(r"x^2 + y^2 = r^2")
7. For labels: Text("Label", font_size=24).next_to(obj, UP)
8. Code should be self-contained (no imports, no class definitions)
9. Use 'self.play()' and 'self.add()' to show objects
10. IMPORTANT: Create visual diagrams, NOT walls of text

EXAMPLES:
Good: "circle = Circle(radius=2, color=BLUE); self.play(Create(circle))"
Bad: "self.play(Write(Text('A circle')))"

Good: "axes = Axes(); graph = axes.plot(lambda x: x**2, color=RED); self.play(Create(axes), Create(graph))"
Bad: "self.text_block('This shows a parabola')"

Rules:
- 6 to 10 segments
- Each voiceover 20–45 seconds of speech
- Code creates actual animations/visuals matching the narration
- Escape quotes: use single quotes inside code strings

Topic: {topic}
Script:
{script_text}
"""

    last_error = None

    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model=MODEL,
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
        "from manim import *",
        "import numpy as np",
        "import os",
        "",
        "class GeneratedScene(Scene):",
        "    def construct(self):",
        ""
    ]

    for i, (seg, dur) in enumerate(zip(segments, durations)):
        code = seg.get("code", "")
        
        # Clean and indent the code
        code = code.strip()
        if code:
            # Indent each line appropriately for being inside construct()
            code_lines = code.split('\n')
            indented_code = '\n'.join('        ' + line if line.strip() else '' for line in code_lines)
        else:
            # Fallback to text if no code provided
            indented_code = f"        title = Text('Segment {i+1}', font_size=36)\n        self.play(Write(title))"

        lines += [
            f"        # Segment {i+1} - Duration: {dur:.2f}s",
            indented_code,
            f"        self.wait({dur:.2f})",
            "        # Clear for next segment",
            "        if self.mobjects:",
            "            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.3)",
            ""
        ]

    return "\n".join(lines)

# ---------------- MAIN ----------------
def normalize_segments(raw_segments):
    """
    Ensures every segment has code + voiceover
    """
    cleaned = []

    for i, seg in enumerate(raw_segments):
        if not isinstance(seg, dict):
            continue

        # Try to get code (new schema) or visual (old schema)
        code = seg.get("code") or seg.get("visual") or seg.get("scene") or ""
        voice = seg.get("voiceover") or seg.get("narration") or seg.get("text")

        if not voice:
            continue

        cleaned.append({
            "code": code,
            "voiceover": voice
        })

    if not cleaned:
        raise ValueError("Segments empty after normalization")

    return cleaned


def generate(topic, script_path):
    from pydub import AudioSegment
    
    script = Path(script_path).read_text()
    job = BASE_DIR / str(uuid.uuid4())
    job.mkdir(parents=True)

    segments = get_segments_from_ai(topic, script)

    audio_files = []
    full_transcript = []
    
    for i, seg in enumerate(segments):
        path = job / f"seg_{i+1}.mp3"
        generate_audio(seg["voiceover"], path)
        audio_files.append(path)
        full_transcript.append(seg["voiceover"])

    durations = align_segments(audio_files)

    # Combine all audio segments into narration.mp3
    combined_audio = AudioSegment.empty()
    for audio_file in audio_files:
        segment_audio = AudioSegment.from_file(str(audio_file))
        combined_audio += segment_audio
    
    combined_audio.export(str(job / "narration.mp3"), format="mp3")
    print(f"✅ Created combined narration.mp3")
    
    # Create narration.txt with full transcript
    (job / "narration.txt").write_text(" ".join(full_transcript))
    print(f"✅ Created narration.txt")

    scene_code = build_scene_code(segments, durations)
    (job / "scene.py").write_text(scene_code)
    print(f"✅ Created scene.py")
    
    # Generate subtitles
    generate_subtitles(segments, durations, str(job / "subtitles.vtt"))

    # Return absolute path
    job_abs = job.resolve()
    print(f"📁 Job directory (absolute): {job_abs}")
    return str(job_abs)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generator.py <topic> <script_path> [job_dir]")
        sys.exit(1)
    
    topic = sys.argv[1]
    script_path = sys.argv[2]
    job_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    if job_dir:
        from pydub import AudioSegment
        
        # Use provided job directory
        job = Path(job_dir)
        job.mkdir(parents=True, exist_ok=True)
        
        script = Path(script_path).read_text()
        segments = get_segments_from_ai(topic, script)
        
        audio_files = []
        full_transcript = []
        
        for i, seg in enumerate(segments):
            path = job / f"seg_{i+1}.mp3"
            generate_audio(seg["voiceover"], str(path))
            audio_files.append(str(path))
            full_transcript.append(seg["voiceover"])
        
        durations = align_segments(audio_files)
        
        # Combine all audio segments into narration.mp3
        combined_audio = AudioSegment.empty()
        for audio_file in audio_files:
            segment_audio = AudioSegment.from_file(audio_file)
            combined_audio += segment_audio
        
        combined_audio.export(str(job / "narration.mp3"), format="mp3")
        print(f"✅ Created combined narration.mp3")
        
        # Create narration.txt with full transcript
        (job / "narration.txt").write_text(" ".join(full_transcript))
        print(f"✅ Created narration.txt")
        
        scene_code = build_scene_code(segments, durations)
        (job / "scene.py").write_text(scene_code)
        print(f"✅ Created scene.py")
        
        # Generate subtitles
        generate_subtitles(segments, durations, str(job / "subtitles.vtt"))
        
        job_abs = job.resolve()
        print(f"📁 Job directory (absolute): {job_abs}")
        print(f"Success: Generated files in {job_abs}")
    else:
        job_path = generate(topic, script_path)
        print(f"Success: Generated files in {job_path}")
