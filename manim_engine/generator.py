import json
import uuid
import re
import sys
import os
import textwrap
import traceback
from pathlib import Path
from typing import Dict, List, Optional, Tuple

try:
    from openai import OpenAI
except ImportError:
    print("❌ OpenAI library not installed. Install with: pip install openai")
    sys.exit(1)

try:
    from audio_engine import generate_audio
    from alignment import align_segments
    from subtitle_generator import generate_subtitles
except ImportError as e:
    print(f"⚠️ Warning: Could not import dependency: {e}")

# Use absolute path to ensure correct directory in Docker
BASE_DIR = Path(__file__).parent / "jobs"
BASE_DIR.mkdir(parents=True, exist_ok=True)

# Default model (can be changed by user)
MODEL = "gpt-4o-mini"  # More reliable than gpt-5.1

# Initialize OpenAI client with error handling
try:
    api_key = os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")
    if not api_key:
        raise ValueError("No OpenAI API key found in environment")
    client = OpenAI(api_key=api_key)
except Exception as e:
    print(f"❌ OpenAI initialization failed: {e}")
    client = None

# ============================================================================
# LOGGING & ERROR HANDLING
# ============================================================================

class Logger:
    """Simple colored logging."""
    @staticmethod
    def info(msg):
        print(f"ℹ️  {msg}")
    
    @staticmethod
    def success(msg):
        print(f"✅ {msg}")
    
    @staticmethod
    def warn(msg):
        print(f"⚠️  {msg}")
    
    @staticmethod
    def error(msg):
        print(f"❌ {msg}")
    
    @staticmethod
    def debug(msg):
        if os.getenv("DEBUG"):
            print(f"🔍 {msg}")

log = Logger()

# ============================================================================
# JSON PARSING
# ============================================================================

def extract_json(raw: str) -> dict:
    """Robust JSON extraction from AI response."""
    if not raw:
        raise ValueError("Empty response")
    
    # Remove markdown code blocks
    clean_raw = re.sub(r'``````', r'\1', raw, flags=re.DOTALL | re.IGNORECASE)
    clean_raw = re.sub(r'``````', r'\1', clean_raw, flags=re.DOTALL)
    
    # Find JSON object or array
    start = clean_raw.find('{')
    end = clean_raw.rfind('}')
    
    if start == -1 or end == -1:
        start = clean_raw.find('[')
        end = clean_raw.rfind(']')
    
    if start == -1 or end == -1:
        raise ValueError("No JSON found in response")
    
    json_str = clean_raw[start:end+1]
    
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        log.debug(f"JSON parse error: {e}")
        raise ValueError(f"Invalid JSON: {e}")

# ============================================================================
# SEGMENTATION
# ============================================================================

def fallback_segments(topic: str, script: str) -> List[Dict]:
    """Simple deterministic segmentation when AI fails."""
    log.warn("Using fallback segmentation")
    
    # Split by sentences
    sentences = re.split(r"(?<=[.!?])\s+", script.strip())
    
    if not sentences:
        return [{"code": "", "voiceover": script}]
    
    # Group sentences into chunks (~300 chars each)
    chunks = []
    current = ""
    
    for sentence in sentences:
        test = current + " " + sentence if current else sentence
        if len(test) > 300 and current:
            chunks.append(current.strip())
            current = sentence
        else:
            current = test
    
    if current:
        chunks.append(current.strip())
    
    # Limit to 10 segments max
    chunks = chunks[:10]
    
    segments = []
    for chunk in chunks:
        if chunk.strip():
            segments.append({
                "code": "",
                "voiceover": chunk.strip()
            })
    
    return segments if segments else [{"code": "", "voiceover": script}]

def normalize_segments(raw: List) -> List[Dict]:
    """Normalize and validate segment structure."""
    cleaned = []
    
    for seg in raw:
        if not isinstance(seg, dict):
            continue
        
        code = str(seg.get("code") or seg.get("visual") or "").strip()
        voice = str(seg.get("voiceover") or seg.get("narration") or seg.get("text") or "").strip()
        
        if not voice:
            log.debug("Skipping segment with empty voiceover")
            continue
        
        cleaned.append({
            "code": code,
            "voiceover": voice
        })
    
    return cleaned

def get_segments_from_ai(topic: str, script_text: str) -> List[Dict]:
    """Call AI to generate segments with multiple fallbacks."""
    
    if not client:
        log.error("OpenAI client not initialized. Using fallback.")
        return fallback_segments(topic, script_text)
    
    # Try models in order of reliability
    models_to_try = ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"]
    
    prompt = f"""You are a Manim animation expert. Generate educational animation segments.

OUTPUT ONLY VALID JSON. No markdown, no explanation. Format:
{{
  "segments": [
    {{"voiceover": "text narration", "code": "manim code (no imports)"}}
  ]
}}

RULES:
- Each segment: 1-2 sentences max
- Code: basic shapes, transforms only
- No MathTex with $ signs
- No imports, classes, defs
- Proper string escaping

Topic: {topic}
Script (first 500 chars): {script_text[:500]}
"""
    
    for model_name in models_to_try:
        log.info(f"Trying {model_name}...")
        
        for attempt in range(2):
            try:
                api_args = {
                    "model": model_name,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_completion_tokens": 8000,
                    "temperature": 0.3,
                }
                
                response = client.chat.completions.create(**api_args)
                raw = response.choices[0].message.content.strip()
                
                if not raw:
                    log.warn(f"{model_name}: Empty response")
                    continue
                
                # Try to parse JSON
                try:
                    data = extract_json(raw)
                except ValueError as e:
                    log.debug(f"{model_name}: JSON parse failed - {e}")
                    continue
                
                # Extract segments
                raw_segs = None
                if isinstance(data, list):
                    raw_segs = data
                elif isinstance(data, dict):
                    raw_segs = data.get("segments") or data.get("data") or []
                    if not raw_segs and any(k in data for k in ["voiceover", "code"]):
                        raw_segs = [data]
                
                # Normalize and validate
                if raw_segs and isinstance(raw_segs, list):
                    segs = normalize_segments(raw_segs)
                    if segs:
                        log.success(f"Got {len(segs)} segments from {model_name}")
                        return segs
                
                log.debug(f"{model_name}: No valid segments extracted")
                
            except Exception as e:
                log.debug(f"{model_name} attempt {attempt+1}: {type(e).__name__}: {str(e)[:100]}")
                continue
    
    log.error("All AI models failed. Using fallback segmentation.")
    return fallback_segments(topic, script_text)

# ============================================================================
# CODE GENERATION
# ============================================================================

def validate_python_syntax(code: str) -> bool:
    """Check if code is syntactically valid Python."""
    try:
        import ast
        ast.parse(code)
        return True
    except SyntaxError as e:
        log.debug(f"Syntax error: {e}")
        return False

def escape_python_string(text: str, max_length: int = 80) -> str:
    """Safely escape text for Python string literals."""
    # Remove markdown and special characters
    text = re.sub(r'[*_`~\[\]{}]', '', text)
    
    # Truncate
    if len(text) > max_length:
        text = text[:max_length-3] + "..."
    
    # Escape backslashes first, then quotes
    text = text.replace("\\", "\\\\")
    text = text.replace('"', '\\"')
    
    return text

def clean_manim_code(code: str) -> str:
    """Clean and fix generated Manim code."""
    if not code:
        return ""
    
    # Dedent
    code = textwrap.dedent(code).strip()
    
    # Remove dangerous imports/defs
    code_lines = []
    for line in code.split('\n'):
        stripped = line.strip()
        if any(stripped.startswith(x) for x in ['import ', 'from ', 'class ', 'def ']):
            continue
        code_lines.append(line)
    
    code = '\n'.join(code_lines).strip()
    
    # Simple replacements (NO REGEX to avoid backreference errors)
    replacements = {
        "MathMathTex": "MathTex",
        "MathText": "MathTex",
        "scene.": "self.",
        "Scene.": "self.",
        "create_animation": "Write",
        "animate_": "Write",
    }
    
    for old, new in replacements.items():
        code = code.replace(old, new)
    
    # Remove $ from MathTex (simple approach)
    code = re.sub(
        r'MathTex\s*\(\s*r?["\']?\$([^\$]*)\$["\']?\s*\)',
        lambda m: f'MathTex(r"\\{m.group(1)}")',
        code
    )
    
    return code

def generate_fallback_code(voiceover: str) -> str:
    """Ultra-safe fallback: just display text."""
    safe_text = escape_python_string(voiceover)
    return f'title = Text("{safe_text}", font_size=28)\nself.play(Write(title), run_time=2)\nself.wait(1)'

def build_scene_code(segments: List[Dict], durations: List[float]) -> str:
    """Build complete Manim script from segments."""
    
    code_lines = [
        "from manim import *",
        "import numpy as np",
        "",
        "class GeneratedScene(MovingCameraScene):",
        "    def construct(self):",
        "        # Background grid",
        "        grid = NumberPlane(",
        "            background_line_style={'stroke_opacity': 0.1},",
        "        )",
        "        self.add(grid)",
        "        self.camera.background_color = '#1f2124'",
        "",
    ]
    
    for i, (seg, dur) in enumerate(zip(segments, durations)):
        voiceover = seg.get("voiceover", "").strip()
        raw_code = seg.get("code", "").strip()
        
        # Add comment
        code_lines.append(f"        # Segment {i+1} - Duration: {dur:.1f}s")
        
        # Clean code
        segment_code = clean_manim_code(raw_code) if raw_code else ""
        
        # Validate code
        is_valid = False
        if segment_code:
            test_code = f"from manim import *\nself = object()\n{segment_code}"
            is_valid = validate_python_syntax(test_code)
        
        # Use fallback if invalid
        if not is_valid:
            log.debug(f"Segment {i+1}: Invalid code, using fallback")
            segment_code = generate_fallback_code(voiceover)
        
        # Indent and add to output
        indented = textwrap.indent(segment_code, "        ")
        code_lines.append(indented)
        
        # Add wait
        wait_time = max(dur - 1.5, 0.5)  # Account for animation time
        code_lines.append(f"        self.wait({wait_time:.2f})")
        code_lines.append("")
    
    final_code = "\n".join(code_lines)
    
    # Final validation of entire script
    if not validate_python_syntax(final_code):
        log.warn("Generated script has syntax errors. Adding wrapper...")
        # Wrap in try-except
        final_code = final_code.replace(
            "    def construct(self):",
            "    def construct(self):\n        try:"
        )
        final_code = textwrap.indent(
            final_code.split("    def construct(self):\n        try:")[1],
            "    "
        )
    
    return final_code

# ============================================================================
# AUDIO & SUBTITLE PIPELINE
# ============================================================================

def generate_with_error_handling(
    topic: str,
    script_path: str,
    job_dir: Optional[str] = None
) -> str:
    """Main pipeline with comprehensive error handling."""
    
    try:
        # 1. Read script
        script_file = Path(script_path)
        if not script_file.exists():
            raise FileNotFoundError(f"Script file not found: {script_path}")
        
        log.info(f"Reading script from {script_path}")
        script = script_file.read_text(encoding='utf-8').strip()
        
        if not script:
            raise ValueError("Script is empty")
        
        # 2. Create job directory
        if job_dir:
            job = Path(job_dir)
        else:
            job = BASE_DIR / str(uuid.uuid4())
        
        job.mkdir(parents=True, exist_ok=True)
        log.info(f"Job directory: {job}")
        
        # 3. Get segments
        log.info("Generating segments...")
        segments = get_segments_from_ai(topic, script)
        
        if not segments:
            log.error("No segments generated")
            raise ValueError("Failed to generate segments")
        
        log.success(f"Generated {len(segments)} segments")
        
        # 4. Generate audio
        log.info("Generating audio...")
        audio_files = []
        full_transcript = []
        
        for i, seg in enumerate(segments):
            try:
                voiceover = seg.get("voiceover", "")
                p = job / f"seg_{i+1}.mp3"
                
                generate_audio(voiceover, str(p))
                
                if not p.exists():
                    raise FileNotFoundError(f"Audio file not created: {p}")
                
                audio_files.append(str(p))
                full_transcript.append(voiceover)
                log.success(f"Generated audio {i+1}/{len(segments)}")
                
            except Exception as e:
                log.error(f"Audio generation for segment {i+1} failed: {e}")
                raise
        
        # 5. Align segments
        log.info("Aligning segments...")
        try:
            durations = align_segments(audio_files)
        except Exception as e:
            log.warn(f"Alignment failed: {e}. Using fallback durations.")
            durations = [3.0] * len(audio_files)  # Default 3s per segment
        
        # 6. Combine audio
        log.info("Combining audio...")
        try:
            from pydub import AudioSegment
            combined = AudioSegment.empty()
            
            for f in audio_files:
                combined += AudioSegment.from_file(f)
            
            combined.export(str(job / "narration.mp3"), format="mp3")
            log.success("Audio combined")
        except Exception as e:
            log.error(f"Audio combination failed: {e}")
        
        # 7. Build Manim script
        log.info("Building Manim scene...")
        scene_code = build_scene_code(segments, durations)
        scene_file = job / "scene.py"
        scene_file.write_text(scene_code, encoding='utf-8')
        log.success("Scene code generated")
        
        # 8. Save metadata
        log.info("Saving metadata...")
        (job / "narration.txt").write_text(
            " ".join(full_transcript),
            encoding='utf-8'
        )
        
        # Save segments as JSON
        (job / "segments.json").write_text(
            json.dumps(segments, indent=2),
            encoding='utf-8'
        )
        
        # 9. Generate subtitles
        log.info("Generating subtitles...")
        try:
            generate_subtitles(segments, durations, str(job / "subtitles.vtt"))
            log.success("Subtitles generated")
        except Exception as e:
            log.warn(f"Subtitle generation failed: {e}")
        
        log.success(f"Pipeline complete! Job: {job}")
        return str(job.resolve())
        
    except Exception as e:
        log.error(f"Pipeline failed: {e}")
        log.debug(traceback.format_exc())
        raise

# ============================================================================
# CLI INTERFACE
# ============================================================================

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generator.py <topic> <script_path> [job_dir]")
        print("\nExample:")
        print("  python generator.py 'Photosynthesis' script.txt")
        sys.exit(1)
    
    topic = sys.argv[1]
    script_path = sys.argv[2]
    job_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    try:
        result = generate_with_error_handling(topic, script_path, job_dir)
        print(f"\n✅ SUCCESS: {result}")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ FAILED: {e}")
        sys.exit(1)
