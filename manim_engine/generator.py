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
You are the Lead Visual Designer for a high-end AI Educational Platform. Your goal is to generate **state-of-the-art, high-density Manim illustrations** in the style of 3Blue1Brown.

**CRITICAL: NO "BASIC" PRIMITIVES**
- BANNED: `self.play(Create(Circle()))` or `self.play(Write(Text("...")))` as the sole focus.
- MANDATORY: Every object must be a **Complex Assembly**. If you need a circle, make it a "Cell" or a "Planet".
- **ANNOTATION IS KEY**: Every complex assembly MUST have at least **3-5 descriptive labels** using `Tex` or `MathTex`. Never show a diagram without explaining its parts.

**MAXIMAL SCIENTIFIC DENSITY**:
- **Triggers**: If a concept is mentioned even in passing, show its technical representation. 
  - *Chemistry*: Mention "Water"? Show `H_2O` and its bent molecular structure. Mention "Reaction"? Show the balanced equation with state symbols.
  - *Physics*: Mention "Force"? Show a vector arrow labeled `\vec{F}`. Mention "Energy"? Show the conservation equation.
  - *Math*: Mention "Rate of change"? Show `\frac{dy}{dx}`. Show **full intermediate steps** in derivations.
- **Visual Evidence**: The screen should look like a "Digital Laboratory". Use small side-formulas, constants (like `c=3\times10^8`), and structural skeletons in the corners for extra context.

**VISUAL COMPLEXITY BLUEPRINTS**:
1. **Scientific Objects**: Use nested shapes. (e.g., A Proton is a sphere + 3 smaller quarks).
2. **Connectivity**: Use `Arrow` or `DashedLine` between nodes. Never show a concept in isolation.
3. **Data/Math**: Use `Axes`, `NumberLine`, or `Matrix` with glowing highlights.
4. **Schematics**: Use `Square` with `Line` connectors for "Flowcharts".

**AESTHETIC GUIDELINES (ULTRA-PREMIUM DARK MODE)**:
- **Constants**: `NEON_GREEN` (#22c55e), `ELECTRIC_BLUE` (#3b82f6), `GOLD` (#f59e0b), `DEEP_PURPLE` (#a855f7), `CORAL` (#fb7185).
- **Styling**: Always use `.set_stroke(width=2)` and `.set_fill(opacity=0.3)`. Use `.set_glow(0.1)` on focus items.
- **Layers**: Use `Backing` mobjects (larger, lower opacity) to create depth.

**SYNC & FLOW RULES**:
- **Controlled Timing**: For key animations, use `run_time=3.0` (or similar).
- **Continuous Evolution**: The screen should NEVER be static. Parts should rotate, pulse, or move slightly.
- **Narrative Match**: If text mentions "growth," use `Transform` to grow the mobject.

**SCIENTIFIC ANNOTATION & LABELS**:
- **Contextual Text**: Use `Tex` for labels (e.g., "Mitochondria"). Use `Arrow` to point to parts.
- **Formulas**: Laws or equations MUST be center-stage using `MathTex`.
- **Layout**: Use `VGroup` to bundle mobjects with their labels.

**VISUAL CHOREOGRAPHY**:
- **ZERO TOLERANCE FOR OVERLAP**: Mobjects must NEVER overlap unless they are part of the same intentional assembly (e.g., nucleus inside a cell).
- **Screen Real Estate Management**: 
  - If adding a new major concept, FIRST clear space by either:
    1. `self.play(FadeOut(old_mobject))` - Remove what's no longer needed
    2. `self.play(old_mobject.animate.scale(0.3).to_corner(UL))` - Shrink and move to corner as reference
  - NEVER add more than 3 major visual elements on screen at once (labels don't count)
- **Transitions Between Ideas**:
  - Same concept evolving: Use `ReplacementTransform(old, new)`
  - New concept entirely: Use `FadeOut` on old elements first, then `Create` new ones
  - Related concepts: Move old to side/corner, then add new

**MANDATORY CLEANUP**:
- **Before Each Segment**: Start with `self.play(FadeOut(*[m for m in self.mobjects if not isinstance(m, (Tex, MathTex))]))` if the previous segment had complex visuals
- **Rule of 3**: If you have 3+ major mobjects on screen, you MUST fade out at least one before adding another
- **Clear Transitions**: When the narration shifts topics (e.g., from "arrays" to "stacks"), completely clear the screen with `self.play(FadeOut(*self.mobjects))`


**STRICT OUTPUT FORMAT**:
Output ONLY valid JSON matching this schema:
{
  "segments": [
    {
      "text": "Narration text...",
      "code": "Direct command block"
    }
  ]
}

**CODE SAFETY & CRASH PREVENTION**:
1. **LaTeX**: Use `MathTex(r'\frac{1}{2}')` with a raw string (r) and SINGLE BACKSLASHES for all commands.
2. **Groups**: Always wrap lists in `VGroup(*my_list)` before animating.
3. **Axes**: Use `Axes(axis_config={"include_tip": True})` for all graphs.
4. **Positioning**: Use `.to_edge(UP)` or `.next_to(obj, DOWN)` to avoid "messy" overlaps.
5. **Memory**: If a segment has more than 8 major components (excluding labels), fade out the oldest ones.

**CRITICAL: BANNED METHODS (THESE DO NOT EXIST)**:
- NEVER use `.arrange_in_circle()` - VGroup does NOT have this method
- NEVER use `.set_glow()` - This method does not exist in standard Manim
- NEVER use `.pulse()` - Use `.animate.scale()` with back-and-forth transforms instead

**CORRECT CIRCULAR ARRANGEMENTS**:
To arrange objects in a circle, use manual positioning with trigonometry:
```python
import numpy as np
radius = 2
n_objects = 5
objects = VGroup(*[Circle() for _ in range(n_objects)])
for i, obj in enumerate(objects):
    angle = i * 2 * PI / n_objects
    obj.move_to([radius * np.cos(angle), radius * np.sin(angle), 0])
```

**VALID VGROUP METHODS**:
- `.arrange(direction=RIGHT, buff=0.5)` - arranges in a line
- `.arrange_in_grid(rows=2, cols=3, buff=0.5)` - arranges in a grid
- `.shift(vector)` - moves the entire group
- `.scale(factor)` - scales the entire group
- `.rotate(angle)` - rotates the entire group
- `.next_to(mobject, direction)` - positions relative to another object

**VALID ANIMATION METHODS**:
- `Create()`, `Write()`, `FadeIn()`, `FadeOut()`, `Transform()`, `ReplacementTransform()`
- `GrowFromCenter()`, `ShrinkToCenter()`, `Indicate()`, `Flash()`, `Wiggle()`
- Use `.animate` for property changes: `obj.animate.shift(UP)`, `obj.animate.scale(2)`
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
    
    # Join and dedent to normalize indentation
    cleaned = "\n".join(filtered_lines)
    cleaned = textwrap.dedent(cleaned).strip()
    
    # Re-indent with 8 spaces (2 levels) for construct method body
    if cleaned:
        indented_lines = ["        " + line if line.strip() else "" for line in cleaned.split('\n')]
        return "\n".join(indented_lines)
    
    return ""

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

def generate_scene_and_audio(topic, script_text, job_dir=None):
    setup_ffmpeg()
    
    # If job_dir is provided, make sure it exists and use it as base
    if job_dir and not os.path.exists(job_dir):
        os.makedirs(job_dir, exist_ok=True)
        
    base_path = job_dir if job_dir else ""
    
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
    
    temp_dir = os.path.join(base_path, "temp_audio_segments")
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
    os.makedirs(temp_dir, exist_ok=True)
    
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
            
        # 3. Append Code with Precision Sync Timing
        full_code += f"        # --- Segment {idx} ( Narration: {duration_sec:.2f}s ) ---\n"
        full_code += f"        _start_t_{idx} = self.renderer.time\n"
        
        # Segment Code Processing
        clean_seg_code = textwrap.dedent(code).strip()
        
        indented_code = textwrap.indent(clean_seg_code, "        ")
        full_code += indented_code + "\n"
        
        # Calculate how much time the animations took and wait the remainder
        full_code += f"        _end_t_{idx} = self.renderer.time\n"
        full_code += f"        _wait_t_{idx} = {duration_sec:.2f} - (_end_t_{idx} - _start_t_{idx})\n"
        full_code += f"        if _wait_t_{idx} > 0:\n"
        full_code += f"            self.wait(_wait_t_{idx})\n\n"
        
        full_narrative_text += text + " "

    # Clean up
    if os.path.exists(temp_dir):
        shutil.rmtree(temp_dir)
        
    # Write Final Files
    scene_path = os.path.join(base_path, "scene.py")
    audio_path = os.path.join(base_path, "narration.mp3")
    text_path = os.path.join(base_path, "narration.txt")

    with open(scene_path, "w", encoding="utf-8") as f:
        f.write(full_code)
        
    full_audio.export(audio_path, format="mp3")
    
    with open(text_path, "w", encoding="utf-8") as f:
        f.write(full_narrative_text.strip())
        
    print(f"Success: Generated files in {base_path if base_path else 'current directory'}")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generator.py <topic> <script_json> [job_dir]")
        sys.exit(1)
        
    topic = sys.argv[1].strip('"').strip("'")
    script_arg = sys.argv[2]
    job_dir = sys.argv[3] if len(sys.argv) > 3 else None
    
    if os.path.isfile(script_arg):
        with open(script_arg, "r", encoding="utf-8") as f:
            script_data = f.read()
    else:
        script_data = script_arg
    
    generate_scene_and_audio(topic, script_data, job_dir)
