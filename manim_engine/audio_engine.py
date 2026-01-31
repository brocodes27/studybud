from pathlib import Path
from pydub import AudioSegment
import os
from openai import OpenAI
from gtts import gTTS
from dotenv import load_dotenv

load_dotenv()

# Try to initialize OpenAI, but don't fail if it's not setup
api_key = os.getenv("OPENAI_API_KEY") or os.getenv("VITE_OPENAI_API_KEY")
client = OpenAI(api_key=api_key) if api_key else None

VOICE_MODEL = "tts-1"

def generate_audio(text, out_path):
    """Generates audio from text using OpenAI TTS with gTTS fallback."""
    out_path = str(out_path) if isinstance(out_path, Path) else out_path
    
    # 1. Try OpenAI
    if client:
        try:
            response = client.audio.speech.create(
                model=VOICE_MODEL,
                voice="alloy",
                input=text
            )
            response.stream_to_file(out_path)
            print(f"✅ Generated audio (OpenAI): {out_path}")
            return
        except Exception as e:
            print(f"⚠️ OpenAI TTS failed: {e}. Falling back to gTTS...")
    
    # 2. Fallback to gTTS (Free)
    try:
        tts = gTTS(text=text, lang='en')
        tts.save(out_path)
        print(f"✅ Generated audio (gTTS): {out_path}")
    except Exception as e:
        print(f"❌ All audio generation failed: {e}")
        raise

def audio_duration(path):
    # Ensure path is a string
    path = str(path) if isinstance(path, Path) else path
    audio = AudioSegment.from_file(path)
    return len(audio) / 1000
