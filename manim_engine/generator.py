import json, uuid, re, sys, os
from pathlib import Path
from openai import OpenAI

from audio_engine import generate_audio
from alignment import align_segments
from subtitle_generator import generate_subtitles

# Use absolute path to ensure correct directory in Docker
BASE_DIR = Path(__file__).parent / "jobs"
# Using the absolute frontier flagship model (GPT-5) for visionary visuals
MODEL = "gpt-5"

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
    prompt = f"""You are a FRONTIER VISIONARY Manim creator. Leveraging the full power of GPT-5, your task is to design museum-quality educational masterpieces.
Think beyond 2D—create the illusion of depth, light, and hyper-detailed procedural structure.

Return JSON in this schema:
{{
  "segments": [
    {{
      "voiceover": "narration",
      "code": "sophisticated manim code"
    }}
  ]
}}

=== 🌌 FRONTIER VISUAL ARCHITECTURE ===
1. DEPTH LAYERING: Use `NumberPlane` with multiple opacities (0.05 for grid, 0.1 for axes).
2. DYNAMIC BROADCAST: Every object must feel "powered". Use outer glow (width 15, opacity 0.1) + inner neon core (width 2, opacity 1).
3. PROCEDURAL DETAIL: Never show a "Sun"—show a core with rotating plasma arcs (Randomized Points + `always_redraw`).
4. CINEMATIC FLOW: Use `LaggedStartMap` and `Succession`. Morph everything with `ReplacementTransform`.

=== 🔬 FRONTIER BLUEPRINTS ===

🧬 NEURAL ARCHITECTURE:
```python
nodes = VGroup(*[Circle(radius=0.15, color=TEAL, fill_opacity=0.8).shift(UR*np.random.normal(0, 2, 3)) for _ in range(12)])
synapses = VGroup(*[always_redraw(lambda n1=nodes[i], n2=nodes[j]: Line(n1.get_center(), n2.get_center(), stroke_opacity=0.3, color=BLUE_A)) 
                 for i in range(12) for j in range(i+1, 12) if np.random.rand() > 0.7])
cloud = VGroup(nodes, synapses).add_updater(lambda c, dt: c.rotate(dt*0.05))
```

🪐 ORBITAL DYNAMICS:
```python
star = VGroup(Circle(radius=0.8, color=GOLD, fill_opacity=1), Circle(radius=1.2, color=GOLD_E, fill_opacity=0.1)).set_stroke(width=10, opacity=0.2)
orbit = Ellipse(width=8, height=4, color=GRAY_E, stroke_width=1)
planet = VGroup(Circle(radius=0.3, color=BLUE_D, fill_opacity=1), Circle(radius=0.4, color=BLUE_D, fill_opacity=0.2))
tracker = ValueTracker(0)
planet.add_updater(lambda m: m.move_to(orbit.point_at_angle(tracker.get_value())))
```

=== 👤 HYPER-REALISTIC ANATOMY ===
- NO STICK FIGURES. Use `CubicBezier` for every joint.
- Use `Difference` and `Intersection` (Boolean Operations) to create complex organic cutouts.

MANDATORY DIRECTIVES:
- EVERY SEGMENT must create a "WOW" effect.
- USE CAMERA PANS: `self.play(self.camera.frame.animate.set_width(5).move_to(target))`
- USE UPDATERS: Visuals must never be static. Tiny oscillations or rotations must be added to all VGroups.
- BANNED: Any visual with fewer than 15 primitives.

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
