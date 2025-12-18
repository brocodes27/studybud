import os
import sys
from openai import OpenAI
from pathlib import Path

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY"))

def generate_audio(text, output_path):
    """
    Generates speech from text using OpenAI's TTS API.
    """
    try:
        response = client.audio.speech.create(
            model="tts-1",
            voice="alloy",
            input=text
        )
        # Use a more robust way to save the file
        with open(output_path, "wb") as f:
            f.write(response.read())
            
        print(f"Success: Audio generated at {output_path}")
        return True
    except Exception as e:
        print(f"Error generating audio: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python audio_engine.py <text> <output_path>")
        sys.exit(1)
        
    input_arg = sys.argv[1]
    output_path = sys.argv[2]
    
    # If input_arg is a path to a file, read it
    if os.path.isfile(input_arg):
        with open(input_arg, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = input_arg
    
    success = generate_audio(text, output_path)
    if not success:
        sys.exit(1)
