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
    prompt = f"""You are an EXPERT Manim animator creating CINEMATIC educational videos with CONTEXTUAL, NARRATIVE-DRIVEN visuals.

CRITICAL: Create visuals that MATCH the narration content EXACTLY. If talking about a bicycle, DRAW a bicycle. If discussing a tree, DRAW a tree. Don't show generic shapes - create ILLUSTRATIVE, CONTEXTUAL scenes.

Return JSON only:
{{
  "segments": [
    {{
      "voiceover": "spoken narration text",
      "code": "Manim animation code"
    }}
  ]
}}

SYNTAX RULES (MUST FOLLOW):
1. Balance ALL parentheses, brackets, braces
2. Write MULTI-LINE code (avoid one-liners)
3. Use \\n to separate statements
4. Test Python syntax mentally before responding

=== CONTEXTUAL VISUAL CREATION ===

🎯 CORE PRINCIPLE: Visual should ILLUSTRATE what narration describes

If narration says...  →  Create this visual:
- "Person riding bicycle" → Draw stick figure on bicycle (circles for wheels, lines for frame)
- "Water evaporating" → Show water molecules (dots) rising with arrow
- "Tree absorbing sunlight" → Draw tree outline with sun rays as arrows
- "Heart pumping blood" → Show heart shape with arrows indicating flow
- "Ball rolling down ramp" → Draw ramp (line) with circle rolling
- "DNA replicating" → Show double helix splitting and copying
- "Light reflecting off mirror" → Draw mirror line with arrow bouncing
- "Supply and demand curves" → Draw actual crossing curves on axes

VISUAL CONSTRUCTION EXAMPLES:

🚴 BICYCLE:
```
wheel1 = Circle(radius=0.5, color=WHITE)
wheel2 = Circle(radius=0.5, color=WHITE).shift(RIGHT*2)
frame = VGroup(
    Line(wheel1.get_top(), wheel2.get_top()),
    Line(wheel1.get_center(), wheel1.get_top() + UP*0.5),
    Line(wheel2.get_center(), wheel1.get_top() + UP*0.5)
)
person = VGroup(
    Circle(radius=0.2, color=YELLOW, fill_opacity=1).shift(UP*1.5),
    Line(UP*1.3, UP*0.7),
    Line(UP*0.7, UP*0.7 + LEFT*0.3 + DOWN*0.3),
    Line(UP*0.7, UP*0.7 + RIGHT*0.3 + DOWN*0.3)
).shift(RIGHT)
self.play(Create(wheel1), Create(wheel2))
self.play(Create(frame))
self.play(Create(person))
```

🌳 TREE WITH PHOTOSYNTHESIS:
```
trunk = Line(DOWN*2, UP, color=BROWN_E)
leaves = VGroup(*[Circle(radius=0.3, color=GREEN, fill_opacity=0.8).shift(UP + dir) for dir in [LEFT*0.5, RIGHT*0.5, UP*0.3]])
sun = Circle(radius=0.4, color=YELLOW, fill_opacity=1).to_edge(UP+RIGHT)
rays = VGroup(*[Arrow(sun.get_center(), trunk.get_top() + dir, color=YELLOW) for dir in [LEFT*0.2, ORIGIN, RIGHT*0.2]])
co2_label = MathTex(r"CO_2", color=BLUE).next_to(trunk, LEFT)
o2_label = MathTex(r"O_2", color=GREEN).next_to(leaves, UP)
self.play(Create(trunk), Create(leaves))
self.play(FadeIn(sun), Create(rays))
self.play(Write(co2_label), Write(o2_label))
```

=== SUBJECT-SPECIFIC BLUEPRINTS ===

� CHEMISTRY:
- Molecules: Circle atoms + Line bonds + Text labels
- Reactions: Show transformation with Transform() or arrows
- pH scale: NumberLine with color gradient
Example:
```
h2o = VGroup(
    Circle(radius=0.2, color=RED, fill_opacity=1),
    Circle(radius=0.15, color=WHITE, fill_opacity=1).shift(LEFT*0.4+UP*0.2),
    Circle(radius=0.15, color=WHITE, fill_opacity=1).shift(RIGHT*0.4+UP*0.2)
)
label = MathTex(r"H_2O").next_to(h2o, DOWN)
self.play(Create(h2o), Write(label))
```

📘 PHYSICS:
- Motion: Show object with velocity vector (Arrow)
- Forces: Multiple arrows on object with labels
- Energy: Bar charts or potential wells
Example:
```
box = Square(side_length=1, color=BLUE, fill_opacity=0.5)
force = Arrow(start=box.get_right(), end=box.get_right()+RIGHT*2, color=RED)
f_label = MathTex(r"F").next_to(force, UP)
velocity = Arrow(start=box.get_center(), end=box.get_center()+RIGHT, color=GREEN)
v_label = MathTex(r"v").next_to(velocity, DOWN)
self.play(Create(box))
self.play(Create(force), Write(f_label))
self.play(Create(velocity), Write(v_label))
```

📙 MATHEMATICS:
- Graphs: ALWAYS use Axes with proper labels
- Geometry: Actual geometric constructions
- Transformations: Show before and after with arrows
Example:
```
axes = Axes(x_range=[-5, 5, 1], y_range=[-2, 10, 2], x_length=7, y_length=5)
curve = axes.plot(lambda x: x**2, color=YELLOW)
point = Dot(axes.c2p(2, 4), color=RED)
tangent = axes.plot(lambda x: 4*x - 4, color=GREEN, x_range=[1, 3])
title = Text("Derivative at x=2", font_size=28).to_edge(UP)
self.play(Create(axes))
self.play(Create(curve), Write(title))
self.play(FadeIn(point), Create(tangent))
```

📕 BIOLOGY:
- Organisms: Simple drawings using shapes
- Processes: Show steps with arrows
- Systems: Labeled component diagrams
Example:
```
cell_membrane = Circle(radius=2, color=BLUE)
cytoplasm = Circle(radius=1.9, color=BLUE, fill_opacity=0.2)
nucleus = Circle(radius=0.7, color=PURPLE, fill_opacity=0.7)
mitochondria = Ellipse(width=0.5, height=0.25, color=RED, fill_opacity=0.6).shift(RIGHT+UP*0.5)
labels = VGroup(Text("Nucleus", font_size=18).next_to(nucleus, DOWN, buff=0.1))
self.play(Create(cell_membrane), Create(cytoplasm))
self.play(Create(nucleus), Create(mitochondria))
self.play(Write(labels))
```

ANIMATION FLOW RULES:
1. Create contextual visuals that MATCH narration
2. Use Transform() to morph between related concepts  
3. Use .animate to show smooth changes
4. Keep some elements on screen for continuity
5. Add descriptive Text labels for clarity
6. Use VGroup to organize related parts
7. Color-code related concepts consistently

MANDATORY EVERY SEGMENT:
✓ Create scene that illustrates the narration topic
✓ Use shapes to represent real objects/concepts
✓ Add clear labels with Text() or MathTex()
✓ Animate creation smoothly
✓ Use appropriate colors and positioning

Rules:
- 6-10 segments total
- Each voiceover 20-45 seconds
- CONTEXTUAL visuals matching narration
- SIMPLE, CLEAR, MULTI-LINE code
- DOUBLE-CHECK syntax

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
