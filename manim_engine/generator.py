import os
import sys
import json
import shutil
from openai import OpenAI
from pydub import AudioSegment
import re
import textwrap

# Import locally if possible, otherwise rely on pydub
try:
    from audio_engine import generate_audio
except ImportError:
    # Quick fallback if running from different dir
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from audio_engine import generate_audio

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY"))


MANIM_PROMPT = r"""
You are the Lead Visual Designer for a high-end AI Educational Platform. Your goal is to generate **state-of-the-art, high-density Manim illustrations**. 

**CRITICAL: NO "BASIC" PRIMITIVES**
- NEVER just show a single "Circle" or "Square."
- EVERY visual must be a **Complex Compound Diagram**. 
- If the topic is an "Atom," build a system of orbiting rings, glowing particles, and labeled shells.
- If the topic is "Force," show a high-tech vector field or a detailed mechanical assembly.

**AESTHETIC GUIDELINES (FUTURISTIC / DARK MODE)**:
- **Colors**: Use the following constants: `NEON_GREEN` (green), `ELECTRIC_BLUE` (blue), `GOLD` (yellow), `DEEP_PURPLE` (purple), `CORAL` (red/pink).
- **Glows**: Use `.set_glow(0.2)` or `Create(..., rate_func=slow_into)` for vital elements.
- **Complexity**: Aim for at least 15-20 distinct mobjects per scene. Use `VGroup` to keep them organized.

**SYNC & FLOW RULES**:
- **Continuous Evolution**: Visuals must NOT be static. Use `UpdateFromAlpha` or successive `self.play` calls to keep the screen moving during the entire segment.
- **Segment Transitions**: ALWAYS `FadeOut` or `Transform` the previous segment's elements into the new ones.
- **Labels**: Every key part of the diagram MUST have a professional label using `Text(..., font_size=24)`.

**STRICT OUTPUT FORMAT**:
Output ONLY valid JSON matching this schema:
{
  "scenes": [
    {
      "segments": [
        {
          "text": "Narration text for this specific segment...",
          "code": "ONLY direct commands here (no imports/classes)"
        }
      ]
    }
  ]
}

**STRICT CODE ASSEMBLY RULES**:
- Provide ONLY the direct commands that would go inside a `construct(self)` method.
- **DO NOT** include `from manim import *`, `class ...`, or `def construct(self):`.
- Start directly with mobject creation or animations.

**CODE SAFETY & CRASH PREVENTION**:
1. **LaTeX**: Use `MathTex(r'\\frac{1}{2}')` with DOUBLE BACKSLASHES.
2. **Groups**: Always wrap lists in `VGroup(*my_list)` before animating.
3. **Axes**: Use `Axes(axis_config={"include_tip": True})` for all graphs.
4. **Positioning**: Use `.to_edge(UP)` or `.next_to(obj, DOWN)` to avoid "messy" overlaps.
"""

def clean_code_block(code):
    # Remove markdown code fences
    code = code.replace("```python", "").replace("```", "").strip()
    
    # Aggressively remove common AI-generated boilerplate
    lines = code.split('\n')
    filtered_lines = []
    for line in lines:
        l = line.strip()
        if l.startswith("from manim import"): continue
        if l.startswith("import "): continue
        if l.startswith("class "): continue
        if l.startswith("def construct"): continue
        if l.startswith("super()."): continue
        filtered_lines.append(line)
        
    return "\n".join(filtered_lines).strip()

import glob

def setup_ffmpeg():
    if os.name == 'nt':
        winget_path = os.path.join(os.environ['LOCALAPPDATA'], 'Microsoft', 'WinGet', 'Packages')
        # Use recursive glob to find ffmpeg
        ffmpeg_bins = glob.glob(os.path.join(winget_path, "**/bin/ffmpeg.exe"), recursive=True)
        if ffmpeg_bins:
            bin_dir = os.path.dirname(ffmpeg_bins[0])
            print(f"Auto-locating FFmpeg at: {bin_dir}")
            os.environ["PATH"] += os.pathsep + bin_dir
            AudioSegment.converter = os.path.join(bin_dir, "ffmpeg.exe")
            AudioSegment.ffprobe = os.path.join(bin_dir, "ffprobe.exe")

def generate_scene_and_audio(topic, script_text):
    setup_ffmpeg()
    
    prompt = (
        f"Topic: {topic}\n"
        f"FIXED SCRIPT: {script_text}\n\n"
        f"TASKS:\n"
        f"1. Break the FIXED SCRIPT into 6-10 logical segments.\n"
        f"2. For each segment, provide the narration text and the Manim code.\n"
        f"3. Ensure the 'text' fields combined exactly match the FIXED SCRIPT.\n"
        f"4. RETURN ONLY THE JSON OBJECT."
    )
    
    print("Sending prompt to OpenAI...")
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": MANIM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.0
    )
    
    content = response.choices[0].message.content.strip()
    
    # Robust JSON extraction
    json_match = re.search(r"\{.*\}", content, re.DOTALL)
    if json_match:
        content = json_match.group(0)
        
    try:
        data = json.loads(content)
        # Handle both flat and nested schemas
        if "segments" in data:
            segments = data["segments"]
        elif "scenes" in data and len(data["scenes"]) > 0:
            segments = data["scenes"][0].get("segments", [])
        else:
            segments = []
    except Exception as e:
        print(f"JSON Parse Error: {e}\nContent: {content}")
        return

    # Prepare logic
    color_defs = [
        "NEON_GREEN = '#22c55e'",
        "ELECTRIC_BLUE = '#3b82f6'",
        "GOLD = '#f59e0b'",
        "DEEP_PURPLE = '#a855f7'",
        "CORAL = '#fb7185'"
    ]
    
    full_code = "from manim import *\n\n" + "\n".join(color_defs) + "\n\nclass GeneratedScene(Scene):\n    def construct(self):\n"
    full_audio = AudioSegment.empty()
    full_narrative_text = ""
    
    temp_dir = "temp_audio_segments"
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir)
    
    print(f"Processing {len(segments)} segments...")
    
    for i, seg in enumerate(segments):
        idx = i + 1
        text = seg['text']
        code = clean_code_block(seg['code'])
        
        print(f"  [Segment {idx}] Text: {text[:30]}...")
        
        # 1. Generate Audio
        seg_audio_path = os.path.join(temp_dir, f"seg_{idx}.mp3")
        success = generate_audio(text, seg_audio_path)
        
        if success:
            # 2. Measure Duration
            audio_seg = AudioSegment.from_file(seg_audio_path)
            duration_sec = len(audio_seg) / 1000.0
            full_audio += audio_seg
        else:
            print(f"    WARNING: Audio generation failed for seg {idx}. Using 2s fallback.")
            duration_sec = 2.0
            
        # 3. Append Code + Wait
        full_code += f"        # Segment {idx}\n"
        # Normalize indentation from AI then re-indent to class depth (8 spaces)
        clean_seg_code = textwrap.dedent(code).strip()
        # Safety Fix: Ensure LaTeX backslashes are escaped if AI forgot
        # This regex finds a backslash that is NOT followed by n, t, r, ', ", or another backslash
        # and doubles it. This protects LaTeX like \frac while allowing \n.
        clean_seg_code = re.sub(r'\\(?![ntr\'"\\])', r'\\\\', clean_seg_code)
        
        indented_code = textwrap.indent(clean_seg_code, "        ")
        full_code += indented_code + "\n"
        full_code += f"        self.wait({duration_sec:.2f})\n\n"
        
        full_narrative_text += text + " "

    # Clean up
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
        
    # Write Final Files
    with open("scene.py", "w", encoding="utf-8") as f:
        f.write(full_code)
        
    full_audio.export("narration.mp3", format="mp3")
    
    with open("narration.txt", "w", encoding="utf-8") as f:
        f.write(full_narrative_text.strip())
        
    print("Success: Generated scene.py and narration.mp3 with perfect sync.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generator.py <topic> <script_json>")
        sys.exit(1)
        
    topic = sys.argv[1].strip('"').strip("'")
    script_arg = sys.argv[2]
    
    if os.path.isfile(script_arg):
        with open(script_arg, "r", encoding="utf-8") as f:
            script_data = f.read()
    else:
        script_data = script_arg
    
    generate_scene_and_audio(topic, script_data)
