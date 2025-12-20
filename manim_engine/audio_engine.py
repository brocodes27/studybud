from pathlib import Path
from pydub import AudioSegment
import os
from openai import OpenAI

api_key = os.getenv("VITE_OPENAI_API_KEY")
if not api_key:
    raise RuntimeError("OPENAI_API_KEY is not set")

client = OpenAI(api_key=api_key)

VOICE_MODEL = "tts-1"

def generate_audio(text, out_path):
    try:
        response = client.audio.speech.create(
            model=VOICE_MODEL,
            voice="alloy",
            input=text
        )
        # Ensure path is a string
        out_path = str(out_path) if isinstance(out_path, Path) else out_path
        response.stream_to_file(out_path)
        print(f"✅ Generated audio: {out_path}")
    except Exception as e:
        print(f"❌ Audio generation failed: {e}")
        raise

def audio_duration(path):
    audio = AudioSegment.from_file(path)
    return len(audio) / 1000
