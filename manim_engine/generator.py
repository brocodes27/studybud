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
    prompt = f"""You are an ELITE Manim animator, specializing in 3Blue1Brown-style mathematical and scientific explainer videos.
Your job is to produce a high-quality animation script with visually rich, smooth, and conceptually clear animations.

Return JSON only in this schema:
{{
  "segments": [
    {{
      "voiceover": "spoken narration text",
      "code": "Manim animation code"
    }}
  ]
}}

=== 🪐 3B1B VISUAL DNA ===
1. PALETTE: Use high-end HEX colors. Primary: BLUE_D (#1C758A), TEAL (#5CD0B3), GREEN_D (#699C52), GOLD (#E8C11C), RED_D (#C55F4E), PURPLE_D (#9A72AC).
2. GLOW EFFECT: To make objects "pop", layer them. Example: `obj.set_stroke(color=COL, width=10, opacity=0.2)` then `obj.copy().set_stroke(width=2, opacity=1)`.
3. BACKGROUND: Use a subtle grid (`NumberPlane(background_line_style={"stroke_opacity": 0.1})`) if the scene feels empty.
4. CINEMATIC MOTION: Use `LaggedStart` for groups. Avoid linear motion; use `rate_func=smooth` or `rate_func=there_and_back`.

=== 🏙️ ENVIRONMENT BLUEPRINTS ===

🌳 REALISTIC TREE:
```python
trunk = RoundedRectangle(width=0.4, height=2, corner_radius=0.1, color=BROWN_E, fill_opacity=1)
foliage = VGroup(*[Circle(radius=0.6, color=GREEN_E, fill_opacity=0.8).shift(UP*1.2+dir) for dir in [LEFT*0.4, RIGHT*0.4, UP*0.5]])
tree = VGroup(trunk, foliage).shift(DOWN*2)
```

🌃 CITY SKYLINE:
```python
buildings = VGroup(*[Rectangle(width=0.5, height=h, color=GRAY_E, fill_opacity=1).shift(RIGHT*i*0.6) 
                   for i, h in enumerate([1.5, 2.2, 1.8, 2.5, 2.0])]).center().to_edge(DOWN, buff=0)
windows = VGroup(*[Dot(radius=0.05, color=YELLOW).move_to(b.get_center()+UP*y+LEFT*x) 
                 for b in buildings for y in [0.2, 0.5] for x in [-0.1, 0.1]])
```

=== 🛠️ MECHANICAL BLUEPRINTS ===
(Use these 10+ shape patterns for ANY object mentioned)

🚗 LUXURY CAR:
```python
chassis = RoundedRectangle(width=3.5, height=0.8, color=BLUE_D, fill_opacity=0.9).set_stroke(BLUE_A, 2)
cabin = ArcBetweenPoints(LEFT*0.9+UP*0.4, RIGHT*1.1+UP*0.4, angle=-TAU/4, color=BLUE_D, fill_opacity=0.9)
lights = VGroup(Dot(color=WHITE).move_to(chassis.get_left()+UP*0.2), Dot(color=RED).move_to(chassis.get_right()+UP*0.2))
wheels = VGroup(*[VGroup(Circle(radius=0.4, color=WHITE), Circle(radius=0.3, color=GRAY, fill_opacity=1), 
                 Line(UP*0.3, DOWN*0.3)).shift(DOWN*0.4+pos) for pos in [LEFT*1, RIGHT*1]])
car = VGroup(chassis, cabin, lights, wheels)
```

🚲 PRECISION BICYCLE:
```python
tires = VGroup(Circle(radius=0.8).set_stroke(WHITE, 2), Circle(radius=0.8).shift(RIGHT*2.8).set_stroke(WHITE, 2))
gears = VGroup(Circle(radius=0.2, color=GRAY, fill_opacity=1).move_to(tires[1]), 
               Circle(radius=0.15, color=GRAY).move_to(tires[0]))
chain = Line(gears[0], gears[1], stroke_width=2, color=GRAY)
frame = VGroup(Polygon(tires[0].get_center(), tires[1].get_center(), UP+RIGHT*1.2, color=TEAL, stroke_width=5))
```

MANDATORY FOR EVERY SEGMENT:
- Build intuition step-by-step. Use `ReplacementTransform` to evolve ideas.
- NO PLAIN SHAPES. If you need a circle, make it a "Sun" or a "Cell" with internal details.
- Add "Glow" layers to important objects.
- Use the camera to "walk" through the scene.

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

def validate_python_code(code):
    """Check if Python code is syntactically valid"""
    try:
        import ast
        ast.parse(code)
        return True
    except SyntaxError as e:
        print(f"⚠️ Syntax error in generated code: {e}")
        return False

def build_scene_code(segments, durations):
    lines = [
        "from manim import *",
        "import numpy as np",
        "import os",
        "",
        "# Polyfill for common AI hallucination",
        "def vgroup_arrange_in_circle(self, radius=2, **kwargs):",
        "    n = len(self)",
        "    if n == 0: return self",
        "    for i, m in enumerate(self):",
        "        angle = i * (2 * TAU / n)",
        "        m.move_to(radius * (np.cos(angle) * RIGHT + np.sin(angle) * UP))",
        "    return self",
        "VGroup.arrange_in_circle = vgroup_arrange_in_circle",
        "",
        "class GeneratedScene(MovingCameraScene):",
        "    def construct(self):",
        "        # Add subtle background grid for depth",
        "        grid = NumberPlane(background_line_style={'stroke_opacity': 0.1})",
        "        self.add(grid)",
        ""
    ]

    for i, (seg, dur) in enumerate(zip(segments, durations)):
        code = seg.get("code", "")
        
        # Clean the code
        code = code.strip()
        
        # Remove problematic statements that shouldn't be in construct()
        if code:
            # Remove import statements, class definitions, function definitions
            code_lines = code.split('\n')
            cleaned_lines = []
            for line in code_lines:
                stripped = line.strip()
                # Skip import statements, class/function definitions
                if (stripped.startswith('from ') or 
                    stripped.startswith('import ') or
                    stripped.startswith('class ') or
                    stripped.startswith('def ')):
                    continue
                cleaned_lines.append(line)
            code = '\n'.join(cleaned_lines).strip()
        
        # Validate and sanitize code
        if code:
            # Auto-fix: Convert Tex() to MathTex() when math symbols are present
            # Look for Tex( with math symbols like ^, _, \, etc.
            import re as regex_module
            def fix_tex_mathsymbols(match):
                # Check if the string contains math symbols
                tex_content = match.group(1)
                # Symbols that strongly suggest math mode
                math_symbols = ['^', '_', '\\', '{', '}', '$']
                if any(sym in tex_content for sym in math_symbols):
                    # Convert Tex to MathTex and ensure it remains valid
                    if tex_content.strip().startswith('r'):
                        return f"MathTex({tex_content})"
                    else:
                        # Add r prefix if it's just a string literal or similar
                        return f"MathTex(r{tex_content})"
                return match.group(0)
            
            # Apply the fix
            code = regex_module.sub(r'Tex\(([^)]+)\)', fix_tex_mathsymbols, code)
            
            # Check for syntax errors
            test_code = f"from manim import *\nimport numpy as np\n{code}"
            if not validate_python_code(test_code):
                print(f"⚠️ Segment {i+1} has invalid code, using fallback")
                code = f"title = Text('Segment {i+1}', font_size=36)\nself.play(Write(title))"
            
            # Split into statements and clean
            code_lines = code.split('\n')
            indented_code = '\n'.join('        ' + line if line.strip() else '' for line in code_lines)
        else:
            # Fallback to text if no code provided
            indented_code = f"        title = Text('Segment {i+1}', font_size=36)\n        self.play(Write(title))"

        lines += [
            f"        # Segment {i+1} - Duration: {dur:.2f}s",
            indented_code,
            f"        self.wait({dur:.2f})",
            "        # Continuity maintained: AI handles specific object removals",
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
