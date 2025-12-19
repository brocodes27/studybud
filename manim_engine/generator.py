import os
import sys
import json
import shutil
from openai import OpenAI
from pydub import AudioSegment

# Import locally if possible, otherwise rely on pydub
try:
    from audio_engine import generate_audio
except ImportError:
    # Quick fallback if running from different dir
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    from audio_engine import generate_audio

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY"))


MANIM_PROMPT = r"""
You are a senior Manim animation director. Your goal is to generate clean, labeled, and continuously evolving educational visuals.

**CRITICAL INSTRUCTION: DYNAMIC LABELS**
- The screen MUST NOT be text-less.
- **EVERY SEGMENT** must introduce a new "Key Concept" text label at the bottom or top.
- **TRANSITIONS**: You MUST `FadeOut` or `Transform` the text from the previous segment before showing the new one.
- **SYNC**: The text must match the narration beat.

**ABSOLUTE OUTPUT RULES**
- Output **ONLY valid JSON**.
- JSON schema:
{
  "scenes": [
    {
      "segments": [
        {
          "text": "Narration...",
          "archetype": "PHYSICS",
          "code": "# Python code for this segment..."
        }
      ]
    }
  ]
}

**VISUAL ARCHETYPES (You MUST choose the best fit)**:

1.  **BIOLOGY: CELLULAR** (Membranes, Organelles)
    -   Container with internal moving parts. Organic shapes (Ellipse/Blob).

2.  **BIOLOGY: MOLECULAR** (DNA, Chemical Bonds)
    -   Ball-and-stick or Ribbon diagrams. NO wobbly lines unless specified.

3.  **PHYSICS / MECHANICS** (Forces, Motion, Gravity)
    - Use only Manim Community primitives (e.g., VGroup, VMobject, Dot, Circle, Rectangle, RoundedRectangle, Arrow, Line, Ellipse, NumberPlane, Tex/MathTex, Text).
- Prefer VGroup for grouping (Manim docs show VGroup usage for arranging/transforming multiple mobjects). 
- For particle motion along a path, use MoveAlongPath with rate_func=linear. 

**STRICT CODE SAFETY (AVOID THESE CRASHES)**
- **Graphs**: DO NOT use `axes.get_graph`. ALWAYS use `axes.plot(lambda x: ..., color=...)`.
- **Lists**: DO NOT pass lists to `FadeIn`/`FadeOut`. BEFORE animating, wrap lists: `FadeOut(VGroup(*my_list))`.
- **Text**: Ensure no text overlaps. `FadeOut(old_text)` before `Write(new_text)`.

4.  **MATH / GRAPHS** (Calculus, Functions, Stats)
    -   `Axes` object is mandatory.
    -   Plot functions using `FunctionGraph`. Area under curve with `Polygon`.

5.  **HISTORY / GEOGRAPHY** (Timelines, Maps)
    -   **Map**: Use `Polygon` shapes to roughly draw territories or `ImageMobject` placeholders.
    -   **Timeline**: Horizontal `NumberLine` with `Dot` markers and dates/labels.

6.  **SYSTEMS / PROCESS** (General Flow)
    -   Flowcharts: Box -> Arrow -> Box.

**SCENE CONSTRUCTION RULES**:
- **Setup**: In Segment 1, create the `main_group` and the primary `caption_text`.
- **Motion**: `main_group` should gently move or specific parts should highlight.
- **Text Safety**: `Text(..., font_size=36).to_edge(DOWN)` is a safe bet.
- **Cleanup**: If changing topics significantly, `self.play(FadeOut(old_group), FadeOut(old_text))`.

**EXAMPLE (Physics Segment)**:
```python
# Segment 1
box = Square(color=BLUE)
arrow = Arrow(start=box.get_center(), end=box.get_center() + RIGHT*2, color=RED)
label = Text("Applied Force").next_to(arrow, UP)
group = VGroup(box, arrow, label).move_to(ORIGIN)
caption = Text("Newton's Second Law", font_size=40).to_edge(UP)

self.play(Create(box), GrowArrow(arrow), Write(label), Write(caption))
```
"""

def clean_code_block(code):
    # Remove markdown code fences if present
    code = code.replace("```python", "").replace("```", "").strip()
    return code

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
    import re
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
    full_code = "from manim import *\n\nclass GeneratedScene(Scene):\n    def construct(self):\n"
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
        import textwrap
        
        full_code += f"        # Segment {idx}\n"
        # Normalize indentation from AI then re-indent to class depth (8 spaces)
        clean_seg_code = textwrap.dedent(code).strip()
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
