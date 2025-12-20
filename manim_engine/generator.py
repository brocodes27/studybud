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
    prompt = f"""You are an ELITE Manim animator creating SOPHISTICATED, DETAILED educational illustrations.

CRITICAL: Create DETAILED, REALISTIC-LOOKING illustrations, NOT basic shapes. Use curves, complex compositions, and artistic techniques to make visuals look PROFESSIONAL and ORGANIC.

Return JSON only:
{{
  "segments": [
    {{
      "voiceover": "spoken narration text",
      "code": "Manim animation code"
    }}
  ]
}}

SYNTAX RULES:
1. Balance ALL parentheses, brackets, braces
2. Multi-line code for clarity
3. Use \\n between statements
4. Validate syntax mentally
5. DO NOT include import, class, or def statements (already imported at top)
6. CRITICAL: Use MathTex(r"...") for ANY text with math symbols: ^, _, \\, {{, }}
   - Text() for plain text labels
   - MathTex(r"x^2") for formulas, chemical formulas, superscripts/subscripts
   - NEVER use Tex() - it will cause LaTeX errors

=== ADVANCED ILLUSTRATION TECHNIQUES ===

� CREATE DETAILED, ORGANIC VISUALS:
- Use CubicBezier() and Arc() for smooth, curved lines
- Layer multiple shapes for depth and detail
- Use fill_opacity to create shading and dimension
- Combine 10-20+ small shapes to create complex objects
- Use color gradients and varied opacity
- Add texture with patterns of small elements

🖼️ REALISTIC VISUAL EXAMPLES:

🌸 DETAILED FLOWER:
```
# Petals using curves
petals = VGroup(*[
    CubicBezier(
        [0, 0, 0],
        [np.cos(angle)*0.3, np.sin(angle)*0.3, 0],
        [np.cos(angle)*0.8, np.sin(angle)*0.8, 0],
        [np.cos(angle)*1.2, np.sin(angle)*1.2, 0]
    ).set_fill(PINK, opacity=0.7).set_stroke(PINK, width=2)
    for angle in np.linspace(0, 2*np.pi, 8, endpoint=False)
])
center = Circle(radius=0.3, color=YELLOW, fill_opacity=1)
stem = Line(DOWN*2, ORIGIN, stroke_width=8, color=GREEN)
leaves = VGroup(*[
    Ellipse(width=0.4, height=0.8, color=GREEN, fill_opacity=0.6).rotate(angle).shift(DOWN*0.5 + dir)
    for angle, dir in [(PI/4, LEFT*0.3), (-PI/4, RIGHT*0.3)]
])
self.play(Create(stem), Create(leaves))
self.play(Create(petals), FadeIn(center))
```

👤 DETAILED HUMAN FIGURE:
```
# Head with features
head = Circle(radius=0.4, color=YELLOW_C, fill_opacity=1)
eyes = VGroup(
    Dot(point=head.get_center() + UP*0.1 + LEFT*0.15, radius=0.05),
    Dot(point=head.get_center() + UP*0.1 + RIGHT*0.15, radius=0.05)
)
smile = Arc(radius=0.2, start_angle=-PI, angle=PI).shift(head.get_center() + DOWN*0.1).scale(0.6)
# Body with details
body = Rectangle(height=1.2, width=0.6, color=BLUE, fill_opacity=0.8)
arms = VGroup(
    CubicBezier(body.get_top() + LEFT*0.3, LEFT*1.2 + UP*0.3, LEFT*1.2, LEFT*1.2 + DOWN*0.3).set_stroke(BLUE, width=8),
    CubicBezier(body.get_top() + RIGHT*0.3, RIGHT*1.2 + UP*0.3, RIGHT*1.2, RIGHT*1.2 + DOWN*0.3).set_stroke(BLUE, width=8)
)
legs = VGroup(
    Line(body.get_bottom() + LEFT*0.2, DOWN*2.5 + LEFT*0.3, stroke_width=8, color=BLUE),
    Line(body.get_bottom() + RIGHT*0.2, DOWN*2.5 + RIGHT*0.3, stroke_width=8, color=BLUE)
)
person = VGroup(head, eyes, smile, body, arms, legs).shift(DOWN*0.5)
self.play(FadeIn(person, scale=0.5))
```

🏠 DETAILED HOUSE:
```
# Main structure with depth
walls = Rectangle(width=4, height=2.5, color=ORANGE, fill_opacity=0.7, stroke_width=3)
roof = Polygon(
    walls.get_corner(UL), walls.get_corner(UR), walls.get_top() + UP*1.2,
    color=MAROON_D, fill_opacity=0.8, stroke_width=3
)
# Windows with frames
window1 = VGroup(
    Rectangle(width=0.6, height=0.8, color=BLUE_C, fill_opacity=0.5),
    Line(UP*0.4, DOWN*0.4), Line(LEFT*0.3, RIGHT*0.3)
).shift(LEFT*1.2 + UP*0.3)
window2 = window1.copy().shift(RIGHT*2.4)
# Door with detail
door = VGroup(
    Rectangle(width=0.7, height=1.4, color=MAROON_C, fill_opacity=0.9),
    Circle(radius=0.05, fill_opacity=1, color=GOLD).shift(RIGHT*0.25)
).shift(RIGHT*0.8 + DOWN*0.55)
house = VGroup(walls, roof, window1, window2, door)
self.play(Create(walls), Create(roof))
self.play(Create(window1), Create(window2), Create(door))
```

� DETAILED CAR:
```
# Car body with curves
body = RoundedRectangle(width=3, height=1, corner_radius=0.2, color=RED, fill_opacity=0.9)
top = Arc(radius=1.5, start_angle=0, angle=PI, color=RED, fill_opacity=0.9, stroke_width=3).scale(0.5).move_to(body.get_top() + UP*0.3)
# Wheels with detail
wheel1 = VGroup(
    Circle(radius=0.4, color=GREY, fill_opacity=1),
    Circle(radius=0.25, color=DARK_GREY, fill_opacity=1),
    Circle(radius=0.1, color=WHITE, fill_opacity=1)
).shift(body.get_bottom() + LEFT*0.8 + DOWN*0.3)
wheel2 = wheel1.copy().shift(RIGHT*1.6)
# Windows
windows = VGroup(
    Arc(radius=0.8, start_angle=0, angle=PI, color=BLUE_C, fill_opacity=0.4).scale([0.6, 0.4, 1]).move_to(top.get_center() + LEFT*0.5),
    Arc(radius=0.8, start_angle=0, angle=PI, color=BLUE_C, fill_opacity=0.4).scale([0.6, 0.4, 1]).move_to(top.get_center() + RIGHT*0.5)
)
car = VGroup(body, top, wheel1, wheel2, windows)
self.play(FadeIn(car, shift=LEFT))
```

🍎 DETAILED APPLE:
```
# Apple body with shading
apple_body = Circle(radius=1.2, color=RED, fill_opacity=1)
highlight = Ellipse(width=0.5, height=0.8, color=RED_A, fill_opacity=0.6).shift(UP*0.3 + LEFT*0.3)
shadow = Ellipse(width=0.4, height=0.6, color=RED_E, fill_opacity=0.4).shift(DOWN*0.2 + RIGHT*0.3)
# Stem and leaf
stem = Line(UP*1.2, UP*1.6, stroke_width=6, color=BROWN)
leaf = Ellipse(width=0.8, height=0.4, color=GREEN, fill_opacity=0.8).rotate(PI/6).shift(UP*1.4 + RIGHT*0.3)
apple = VGroup(apple_body, shadow, highlight, stem, leaf)
self.play(FadeIn(apple, scale=0.3))
```

=== SUBJECT-SPECIFIC DETAILED VISUALS ===

📗 CHEMISTRY - Detailed Molecules:
Use multiple circles with gradients, overlapping for 3D effect
Add electron clouds with dashed circles and small dots
Show bonds with thick lines or cylinders

📘 PHYSICS - Realistic Scenarios:
Create full scenes with objects, backgrounds
Use arrows with gradient fills for forces
Add motion blur effects with transparent copies

📙 MATHEMATICS - Rich Diagrams:
Multiple coordinate systems overlaid
Color-coded regions with patterned fills
Animated transformations showing steps

📕 BIOLOGY - Detailed Organisms:
Layer multiple shapes for cell membranes
Use curves for organic shapes (cells, organs)
Add internal structures with smaller grouped shapes

COMPOSITION RULES:
1. Build complex objects from 10+ primitive shapes
2. Use CubicBezier for organic, curved lines
3. Layer shapes with varying opacity for depth
4. Add small details (dots, lines, patterns)
5. Use color gradients (different shades of same color)
6. Group related elements with VGroup
7. Animate in stages (build up complexity)

MANDATORY:
✓ Create DETAILED, LAYERED illustrations
✓ Use curves and arcs for organic shapes
✓ Add depth with opacity and layering
✓ Include small details for realism
✓ Compose complex scenes from many parts

Rules:
- 6-10 segments
- 20-45 seconds each
- DETAILED, REALISTIC visuals
- Multi-line, clear code
- VALIDATE syntax

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
        "class GeneratedScene(Scene):",
        "    def construct(self):",
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
            "        # Gentle transition to next segment",
            "        if self.mobjects:",
            "            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.2)",
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
