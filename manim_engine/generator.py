import json, uuid, re, sys, os
from pathlib import Path
from openai import OpenAI

from audio_engine import generate_audio
from alignment import align_segments
from subtitle_generator import generate_subtitles

# Use absolute path to ensure correct directory in Docker
BASE_DIR = Path(__file__).parent / "jobs"
# Using gpt-4o for peak visual stability (GPT-5 availability varies)
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
    prompt = f"""You are a FRONTIER VISIONARY Manim creator. Leveraging advanced AI, your task is to design museum-quality educational masterpieces.
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
1. DEPTH LAYERING: Use NumberPlane with multiple opacities (0.05 for grid, 0.1 for axes).
2. DYNAMIC BROADCAST: Every object must feel "powered". Use outer glow (width 15, opacity 0.1) + inner neon core (width 2, opacity 1).
3. PROCEDURAL DETAIL: Never show a "Sun"—show a core with rotating plasma arcs (Randomized Points + always_redraw).
4. CINEMATIC FLOW: Use LaggedStartMap and Succession. Morph everything with ReplacementTransform.

=== 🔬 FRONTIER BLUEPRINTS ===

🧬 NEURAL ARCHITECTURE:
```python
nodes = VGroup(*[Circle(radius=0.15, color=TEAL, fill_opacity=0.8) for _ in range(12)])
synapses = VGroup(*[always_redraw(lambda n1=nodes[i], n2=nodes[j]: Line(n1.get_center(), n2.get_center(), stroke_opacity=0.3, color=BLUE_A)) 
                 for i in range(12) for j in range(i+1, 12) if np.random.rand() > 0.7])
cloud = VGroup(nodes, synapses)
```

🪐 ORBITAL DYNAMICS:
```python
star = VGroup(Circle(radius=0.8, color=GOLD, fill_opacity=1), Circle(radius=1.2, color=GOLD_E, fill_opacity=0.1)).set_stroke(width=10, opacity=0.2)
orbit = Ellipse(width=8, height=4, color=GRAY_E, stroke_width=1)
planet = VGroup(Circle(radius=0.3, color=BLUE_D, fill_opacity=1))
```

MANDATORY DIRECTIVES:
- EVERY SEGMENT must create a "WOW" effect.
- USE CAMERA PANS: self.play(self.camera.frame.animate.set_width(5).move_to(target))
- USE UPDATERS: Visuals must never be static.
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
            match = re.search(r"\{.*\}", raw, re.S)
            if not match:
                raise ValueError("No JSON object found")
            data = json.loads(match.group())
            if isinstance(data, dict):
                if "segments" in data and isinstance(data["segments"], list):
                    return normalize_segments(data["segments"])
                for key, value in data.items():
                    if isinstance(value, dict) and "segments" in value:
                        return normalize_segments(value["segments"])
                    if isinstance(value, list):
                        return normalize_segments(value)
            if isinstance(data, list):
                return normalize_segments(data)
            raise ValueError("No usable segments found")
        except Exception as e:
            last_error = e
            print(f"⚠️ AI parse failed ({attempt+1}/3): {e}")
    return fallback_segments(topic, script_text)

# ---------------- SCENE BUILDER ----------------
def validate_python_code(code):
    try:
        import ast
        ast.parse(code)
        return True
    except Exception:
        return False

def build_scene_code(segments, durations):
    lines = [
        "from manim import *",
        "import numpy as np",
        "import os",
        "",
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
        "        grid = NumberPlane(background_line_style={'stroke_opacity': 0.1})",
        "        self.add(grid)",
        ""
    ]
    for i, (seg, dur) in enumerate(zip(segments, durations)):
        code = seg.get("code", "").strip()
        if code:
            code_lines = code.split('\n')
            cleaned_lines = []
            for line in code_lines:
                s = line.strip()
                if (s.startswith('from ') or s.startswith('import ') or
                    s.startswith('class ') or s.startswith('def ')):
                    continue
                cleaned_lines.append(line)
            code = '\n'.join(cleaned_lines).strip()
        
        if code:
            import re as regex_module
            def fix_tex(m):
                c = m.group(1)
                if any(s in c for s in ['^', '_', '\\', '{', '}', '$']):
                    return f"MathTex(r{c})" if not c.strip().startswith('r') else f"MathTex({c})"
                return m.group(0)
            code = regex_module.sub(r'Tex\(([^)]+)\)', fix_tex, code)
            if not validate_python_code(f"from manim import *\n{code}"):
                code = f"title = Text('Segment {i+1}')\nself.play(Write(title))"
            indented = '\n'.join('        ' + l if l.strip() else '' for l in code.split('\n'))
        else:
            indented = f"        title = Text('Segment {i+1}')\n        self.play(Write(title))"

        lines += [
            f"        # Segment {i+1}",
            indented,
            f"        self.wait({dur:.2f})",
            ""
        ]
    return "\n".join(lines)

def normalize_segments(raw):
    cleaned = []
    for seg in raw:
        if not isinstance(seg, dict): continue
        code = seg.get("code") or seg.get("visual") or ""
        voice = seg.get("voiceover") or seg.get("narration") or ""
        if voice: cleaned.append({"code": code, "voiceover": voice})
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
        p = job / f"seg_{i+1}.mp3"
        generate_audio(seg["voiceover"], p)
        audio_files.append(p)
        full_transcript.append(seg["voiceover"])
    durations = align_segments(audio_files)
    combined = AudioSegment.empty()
    for f in audio_files: combined += AudioSegment.from_file(str(f))
    combined.export(str(job / "narration.mp3"), format="mp3")
    (job / "narration.txt").write_text(" ".join(full_transcript))
    (job / "scene.py").write_text(build_scene_code(segments, durations))
    generate_subtitles(segments, durations, str(job / "subtitles.vtt"))
    return str(job.resolve())

if __name__ == "__main__":
    if len(sys.argv) < 3: sys.exit(1)
    topic, script_path = sys.argv[1], sys.argv[2]
    job_dir = sys.argv[3] if len(sys.argv) > 3 else None
    if job_dir:
        from pydub import AudioSegment
        job = Path(job_dir)
        job.mkdir(parents=True, exist_ok=True)
        script = Path(script_path).read_text()
        segments = get_segments_from_ai(topic, script)
        audio_files = []
        full_transcript = []
        for i, seg in enumerate(segments):
            p = job / f"seg_{i+1}.mp3"
            generate_audio(seg["voiceover"], str(p))
            audio_files.append(str(p))
            full_transcript.append(seg["voiceover"])
        durations = align_segments(audio_files)
        combined = AudioSegment.empty()
        for f in audio_files: combined += AudioSegment.from_file(f)
        combined.export(str(job / "narration.mp3"), format="mp3")
        (job / "narration.txt").write_text(" ".join(full_transcript))
        (job / "scene.py").write_text(build_scene_code(segments, durations))
        generate_subtitles(segments, durations, str(job / "subtitles.vtt"))
    else:
        print(generate(topic, script_path))
