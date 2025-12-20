from audio_engine import audio_duration

def align_segments(audio_files):
    """
    Returns duration per segment (seconds)
    """
    return [audio_duration(p) for p in audio_files]
