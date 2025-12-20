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
    prompt = f"""You are an EXPERT Manim animator creating PREMIUM educational videos with RICH, DETAILED visuals.

Generate segments with ACTUAL Manim animation code that creates PROFESSIONAL-QUALITY diagrams, graphs, and structures.

Return JSON only in this schema:
{{
  "segments": [
    {{
      "voiceover": "spoken narration text",
      "code": "Manim animation code"
    }}
  ]
}}

CRITICAL SYNTAX RULES:
1. VALIDATE all parentheses, brackets, braces are balanced
2. Use MULTIPLE LINES - write clear, readable code
3. Split complex statements across lines
4. Double-check Python syntax before responding
5. Use newline characters (\\n) to separate statements

=== SUBJECT-SPECIFIC VISUAL BLUEPRINTS ===

📗 CHEMISTRY:
- Molecular structures: Use Circle() for atoms with Text labels (H, C, O, N)
- Bonds: Use Line() between atoms (single, double=parallel lines, triple=3 lines)
- Reactions: Arrow() pointing from reactants to products with "+" between compounds
- Formulas: MathTex(r"H_2O", r"CO_2", r"C_6H_{{12}}O_6") - escape braces!
- Energy diagrams: Axes with energy levels shown as horizontal lines
- Electron shells: Dashed Circle() around nucleus
Example:
```
carbon = Circle(radius=0.3, color=BLUE, fill_opacity=1)
c_label = Text("C", font_size=20).move_to(carbon)
hydrogen = Circle(radius=0.2, color=WHITE, fill_opacity=1).shift(RIGHT*0.8)
h_label = Text("H", font_size=16).move_to(hydrogen)
bond = Line(carbon.get_right(), hydrogen.get_left(), color=GREY)
self.play(Create(carbon), Write(c_label))
self.play(Create(hydrogen), Write(h_label), Create(bond))
```

📘 PHYSICS:
- Forces: Arrow() with labels showing F, mg, N, etc.
- Vectors: Arrow() with magnitude labels using MathTex
- Trajectories: Parametric curves using ParametricFunction()
- Fields: Many small arrows arranged in grid using VGroup
- Circuits: Rectangle() for batteries, zigzag Line() for resistors
- Waves: Axes with sine/cosine graphs
Example:
```
axes = Axes(x_range=[0, 4, 1], y_range=[-2, 2, 1], x_length=8, y_length=4)
wave = axes.plot(lambda x: np.sin(2*np.pi*x), color=BLUE)
wavelength = DoubleArrow(start=axes.c2p(0, -1.5), end=axes.c2p(1, -1.5), color=RED)
lambda_label = MathTex(r"\\lambda").next_to(wavelength, DOWN)
self.play(Create(axes))
self.play(Create(wave), Create(wavelength), Write(lambda_label))
```

📙 MATHEMATICS:
- Functions: Axes() with plot() for graphs - ALWAYS show axes
- Geometry: Polygon(), Circle(), Line() with angle marks
- Calculus: Show area under curves with rectangles
- Algebra: Equation transformations using MathTex with arrows between steps
- Number line: NumberLine() for real numbers, inequalities
- 3D graphs: Use ThreeDScene when relevant
Example:
```
axes = Axes(x_range=[-3, 3, 1], y_range=[-1, 5, 1], axis_config={{"include_tip": True}})
parabola = axes.plot(lambda x: x**2, color=YELLOW)
vertex = Dot(axes.c2p(0, 0), color=RED)
equation = MathTex(r"f(x) = x^2").to_edge(UP)
self.play(Create(axes))
self.play(Create(parabola), Write(equation))
self.play(FadeIn(vertex))
```

📕 BIOLOGY:
- Cells: Circle() with organelles inside (smaller circles, ovals)
- DNA: Double helix using two curved lines with connecting segments
- Processes: Flow diagrams with arrows showing sequences
- Body systems: Labeled diagrams using shapes and Text
- Graphs: Population curves, enzyme activity using Axes
Example:
```
cell = Circle(radius=2, color=GREEN)
nucleus = Circle(radius=0.6, color=PURPLE, fill_opacity=0.7).shift(LEFT*0.5)
mitochondria = Ellipse(width=0.4, height=0.2, color=RED, fill_opacity=0.6).shift(RIGHT*0.8)
labels = VGroup(
    Text("Cell", font_size=20).next_to(cell, UP),
    Text("Nucleus", font_size=16).next_to(nucleus, LEFT, buff=0.1),
    Text("Mitochondria", font_size=16).next_to(mitochondria, RIGHT, buff=0.1)
)
self.play(Create(cell))
self.play(Create(nucleus), Create(mitochondria))
self.play(Write(labels))
```

ANIMATION RULES:
1. ALWAYS create visual diagrams - NO text-only slides
2. Use proper colors: BLUE, RED, GREEN, YELLOW, PURPLE, ORANGE
3. Add labels with Text() or MathTex() positioned with .next_to()
4. Animate creation: Create() for shapes, Write() for text/math
5. Show relationships with Line(), Arrow(), DashedLine()
6. Use VGroup() to group related objects
7. Position with: .to_edge(UP/DOWN/LEFT/RIGHT), .shift(), .next_to()
8. Keep code SIMPLE and MULTI-LINE

MANDATORY FOR EVERY SEGMENT:
- Create at least ONE visual diagram/graph/structure
- Add descriptive labels
- Use appropriate colors
- Animate the creation (don't just add())

Rules:
- 6 to 10 segments total
- Each voiceover 20-45 seconds
- WRITE SIMPLE, CLEAR, MULTI-LINE CODE
- DOUBLE-CHECK syntax before returning

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
        
        # Validate and sanitize code
        if code:
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
