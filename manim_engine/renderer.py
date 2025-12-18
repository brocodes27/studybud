import subprocess
import os
import sys
import re

def setup_latex():
    if os.name == 'nt':
        local_app_data = os.environ.get('LOCALAPPDATA', '')
        potential_paths = [
            os.path.join(local_app_data, 'Programs', 'MiKTeX', 'miktex', 'bin', 'x64'),
            r"C:\Program Files\MiKTeX\miktex\bin\x64",
            r"C:\texlive\2024\bin\windows",
            r"C:\texlive\2023\bin\windows",
        ]
        for p in potential_paths:
            if os.path.exists(p):
                print(f"Adding LaTeX to PATH: {p}")
                os.environ["PATH"] = p + os.pathsep + os.environ["PATH"]
                break

setup_latex()

def get_scene_class(file_path):
    with open(file_path, "r") as f:
        content = f.read()
        # Look for class Name(Scene) or class Name(ThreeDScene)
        match = re.search(r"class\s+(\w+)\s*\((?:Scene|ThreeDScene|MovingCameraScene)\)", content)
        if match:
            return match.group(1)
    return "GeneratedScene"

def render_scene(file_path, quality="l"):
    """
    Quality levels: l (480p), m (720p), h (1080p), k (4k)
    """
    try:
        scene_class = get_scene_class(file_path)
        print(f"Detected scene class: {scene_class}")
        print(f"Rendering {file_path} at quality {quality}...")
        
        if os.name == 'nt':
            # On Windows, use the launcher to specify Python 3.12 where manim is installed
            cmd = ["py", "-3.12", "-m", "manim", "-q" + quality, file_path, scene_class]
        else:
            cmd = ["manim", "-q" + quality, file_path, scene_class]
        
        result = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
        
        if result.returncode != 0:
            print("Error during rendering:")
            print(result.stderr)
            sys.exit(1)
            
        print("Rendering complete.")
        return True
    except FileNotFoundError:
        print("Error: 'manim' command not found. Please ensure Manim Community is installed and on your PATH.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python renderer.py <file_path> [quality]")
        sys.exit(1)
        
    file_path = sys.argv[1]
    quality = sys.argv[2] if len(sys.argv) > 2 else "l"
    
    render_scene(file_path, quality)
