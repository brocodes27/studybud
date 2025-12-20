from pathlib import Path
from pydub import AudioSegment
from openai import OpenAI

client = OpenAI()
VOICE_MODEL = "gpt-4o-mini-tts"

def generate_audio(text, out_path):
    response = client.audio.speech.create(
        model=VOICE_MODEL,
        voice="alloy",
        input=text
    )
    response.stream_to_file(out_path)

def audio_duration(path):
    audio = AudioSegment.from_file(path)
    return len(audio) / 1000
