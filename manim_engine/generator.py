import json, uuid, re, sys, os, textwrap
from pathlib import Path
from openai import OpenAI

from audio_engine import generate_audio
from alignment import align_segments
from subtitle_generator import generate_subtitles

# Use absolute path to ensure correct directory in Docker
BASE_DIR = Path(__file__).parent / "jobs"
# Default model (can be changed by user)
MODEL = "gpt-5.1"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY"))

# ---------------- JSON HARD PARSE ----------------
def sanitize_visual_text(visual: str) -> str:
    """Removes all file-based image references."""
    lowered = visual.lower()
    banned = [".png", ".jpg", ".jpeg", ".gif", "image", "photo", "picture"]
    if any(b in lowered for b in banned):
        return "Abstract diagram illustrating the concept"
    return visual

def extract_json(raw):
    """Robust JSON extraction from AI response."""
    # Find the first { and the last }
    start = raw.find('{')
    end = raw.rfind('}')
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in response")
    
    json_str = raw[start:end+1]
    
    # Common AI mistake: unescaped backslashes in code
    # We try to fix basic ones, but json.loads is usually better at reporting where
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        # Try a more aggressive fix for unescaped backslashes if simple load fails
        fixed_str = json_str.replace('\\', '\\\\')
        # But wait, that might double-escape things that were already escaped.
        # Let's try to just load it and provide helpful error if it's dead.
        raise

# ---------------- AI SEGMENTS ----------------
def fallback_segments(topic, script):
    """Simple segmentation when AI fails."""
    sentences = re.split(r"(?<=[.!?])\s+", script)
    chunks = []
    current = ""
    for s in sentences:
        current += " " + s
        if len(current) > 300:
            chunks.append(current.strip())
            current = ""
    if current:
        chunks.append(current.strip())
    
    segments = []
    for i, chunk in enumerate(chunks[:10]):
        segments.append({
            "code": "", # Empty code triggers text-based fallback
            "voiceover": chunk
        })
    return segments

def get_segments_from_ai(topic, script_text):
    """Calls AI to generate segments. Tries multiple models if primary fails."""
    models_to_try = [MODEL, "gpt-4o", "gpt-4-turbo"]
    
    prompt = f"""You are a FRONTIER VISIONARY Manim creator. Design a museum-quality educational masterpiece.
Think beyond 2D—create the illusion of depth, light, and hyper-detailed procedural structure.

RETURN ONLY VALID JSON. NO MARKDOWN. NO BACKTICKS. NO DISCOUSE.
SCHEMA:
{{
  "segments": [
    {{
      "voiceover": "narration text",
      "code": "sophisticated manim animation code"
    }}
  ]
}}

=== 🪐 VISUAL DNA ===
1. DEPTH: Use NumberPlane(background_line_style={{"stroke_opacity": 0.05}}).
2. GLOW: Layer objects for 'bloom'. `obj.set_stroke(opacity=0.2, width=12)` + `obj.copy().set_stroke(opacity=1, width=2)`.
3. MOTION: Avoid linear paths. Use `rate_func=smooth` or `rate_func=rush_into`. Use `LaggedStart`.
4. CONTINUITY: Transform objects using `ReplacementTransform`. Do not clear screen between segments. Use `self.camera.frame.animate` to move focus.

=== 🛠️ BLUEPRINT SAMPLES ===
🚗 CAR: RoundedRectangle chassis + Arc roof + VGroup wheels.
🚲 BIKE: Circle tires + Line frame + line handles.
👤 PERSON: Circle head + RoundedRectangle body + CubicBezier limbs.

MANDATORY:
- CODE MUST BE MULTI-LINE.
- NO 'import', 'class', or 'def' inside segments.
- Visuals MUST be detailed (15+ primitives).

Topic: {topic}
Script: {script_text}
"""

    for model_name in models_to_try:
        if not model_name: continue
        print(f"📡 Requesting segments from {model_name}...")
        for attempt in range(2):
            try:
                response = client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "You are a professional Manim animator. Output JSON only."},
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.3,
                    max_completion_tokens=4000
                    
                )
                raw = response.choices[0].message.content.strip()
                data = extract_json(raw)
                
                # Check for segments
                raw_segs = None
                if isinstance(data, list): raw_segs = data
                elif isinstance(data, dict):
                    raw_segs = data.get("segments") or data.get("data")
                
                if raw_segs and isinstance(raw_segs, list):
                    return normalize_segments(raw_segs)
                
            except Exception as e:
                print(f"⚠️ {model_name} attempt {attempt+1} failed: {e}")
    
    print("❌ All AI models failed. Using deterministic fallback.")
    return fallback_segments(topic, script_text)

# ---------------- SCENE BUILDER ----------------
def validate_python_code(code):
    """Check if code is syntactically valid."""
    try:
        import ast
        ast.parse(code)
        return True
    except Exception as e:
        print(f"⚠️ Code Validation Error: {e}")
        return False

def build_scene_code(segments, durations):
    """Assembles segments into a complete Manim script."""
    lines = [
        "from manim import *",
        "import numpy as np",
        "import os",
        "",
        "# Polyfills",
        "def v_circle(self, radius=2):",
        "    n = len(self)",
        "    if n == 0: return self",
        "    for i, m in enumerate(self):",
        "        a = i * (2*TAU/n)",
        "        m.move_to(radius * (np.cos(a)*RIGHT + np.sin(a)*UP))",
        "    return self",
        "VGroup.arrange_in_circle = v_circle",
        "",
        "class GeneratedScene(MovingCameraScene):",
        "    def construct(self):",
        "        grid = NumberPlane(background_line_style={'stroke_opacity': 0.1})",
        "        self.add(grid)",
        ""
    ]
    
    for i, (seg, dur) in enumerate(zip(segments, durations)):
        raw_code = seg.get("code", "").strip()
        voiceover = seg.get("voiceover", "").replace("'", "\\'")
        
        # 1. Dedent and Clean
        code = textwrap.dedent(raw_code).strip()
        
        if code:
            # Strip imports/classes/defs
            code_lines = [l for l in code.split('\n') if not any(l.strip().startswith(x) for x in ['import ', 'from ', 'class ', 'def '])]
            code = '\n'.join(code_lines).strip()
        
        # 2. Fix Tex -> MathTex
        if code:
            import re as regex
            def to_math(m):
                content = m.group(1)
                # If it looks like math, make it MathTex
                if any(x in content for x in ['^', '_', '\\', '{', '}', '$']):
                    pref = "" if content.strip().startswith('r') else "r"
                    return f"MathTex({pref}{content})"
                return m.group(0)
            code = regex.sub(r'Tex\(([^)]+)\)', to_math, code)
        
        # 3. Final Validation
        if not code or not validate_python_code(f"from manim import *\n{code}"):
            # Better Fallback: Display voiceover text on screen
            code = f"txt = Text('{voiceover[:60]}...', font_size=24).to_edge(UP)\nself.play(Write(txt))"
        
        # 4. Indent for construct() method
        indented = textwrap.indent(code, "        ")
        
        lines += [
            f"        # --- Segment {i+1} ({dur:.2f}s) ---",
            indented,
            f"        self.wait({dur:.2f})",
            ""
        ]
        
    return "\n".join(lines)

def normalize_segments(raw):
    """Standardizes segment objects."""
    cleaned = []
    for seg in raw:
        if not isinstance(seg, dict): continue
        code = seg.get("code") or seg.get("visual") or ""
        voice = seg.get("voiceover") or seg.get("narration") or seg.get("text") or ""
        if voice:
            cleaned.append({"code": str(code), "voiceover": str(voice)})
    return cleaned

# ---------------- CORE PIPELINE ----------------
def generate(topic, script_path):
    from pydub import AudioSegment
    script = Path(script_path).read_text(encoding='utf-8')
    job = BASE_DIR / str(uuid.uuid4())
    job.mkdir(parents=True, exist_ok=True)

    segments = get_segments_from_ai(topic, script)
    audio_files = []
    full_transcript = []
    
    for i, seg in enumerate(segments):
        p = job / f"seg_{i+1}.mp3"
        generate_audio(seg["voiceover"], p)
        audio_files.append(p)
        full_transcript.append(seg["voiceover"])

    durations = align_segments(audio_files)
    
    # Audio assembly
    combined = AudioSegment.empty()
    for f in audio_files: combined += AudioSegment.from_file(str(f))
    combined.export(str(job / "narration.mp3"), format="mp3")
    
    # Files
    (job / "narration.txt").write_text(" ".join(full_transcript), encoding='utf-8')
    (job / "scene.py").write_text(build_scene_code(segments, durations), encoding='utf-8')
    generate_subtitles(segments, durations, str(job / "subtitles.vtt"))
    
    return str(job.resolve())

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generator.py <topic> <script_path> [job_dir]")
        sys.exit(1)
    
    topic = sys.argv[1]
    script_path = sys.argv[2]
    job_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    if job_dir:
        from pydub import AudioSegment
        job = Path(job_dir)
        job.mkdir(parents=True, exist_ok=True)
        script = Path(script_path).read_text(encoding='utf-8')
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
        (job / "narration.txt").write_text(" ".join(full_transcript), encoding='utf-8')
        (job / "scene.py").write_text(build_scene_code(segments, durations), encoding='utf-8')
        generate_subtitles(segments, durations, str(job / "subtitles.vtt"))
    else:
        print(generate(topic, script_path))
