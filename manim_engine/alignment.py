from pydub import AudioSegment
import os
import sys
import subprocess
import glob

# Try to find ffmpeg/ffprobe in winget locations if not in PATH
def setup_ffmpeg():
    if os.name == 'nt':
        winget_path = os.path.join(os.environ['LOCALAPPDATA'], 'Microsoft', 'WinGet', 'Packages')
        ffmpeg_bins = glob.glob(os.path.join(winget_path, "**/bin/ffmpeg.exe"), recursive=True)
        if ffmpeg_bins:
            bin_dir = os.path.dirname(ffmpeg_bins[0])
            print(f"Auto-locating FFmpeg at: {bin_dir}")
            os.environ["PATH"] += os.pathsep + bin_dir
            AudioSegment.converter = os.path.join(bin_dir, "ffmpeg.exe")
            AudioSegment.ffprobe = os.path.join(bin_dir, "ffprobe.exe")

setup_ffmpeg()

def get_audio_duration(audio_path):
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
        
    try:
        audio = AudioSegment.from_file(audio_path)
        return len(audio) / 1000.0
    except Exception as e:
        print(f"Warning: pydub failed to get duration ({e}). Trying direct ffprobe...")
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", audio_path]
        result = subprocess.run(cmd, capture_output=True, text=True, shell=os.name == 'nt')
        if result.returncode == 0:
            return float(result.stdout.strip())
        raise e

def generate_subtitles(text, audio_path, output_srt_path):
    try:
        duration = get_audio_duration(audio_path)
    except Exception as e:
        print(f"Error getting audio duration: {e}")
        duration = 30.0 # Extreme fallback
        
    sentences = [s.strip() for s in text.replace('!', '.').replace('?', '.').split('.') if s.strip()]
    
    if not sentences:
        return
        
    # Weight durations by word count for more realistic timing
    words_per_sentence = [len(s.split()) for s in sentences]
    total_words = sum(words_per_sentence)
    
    if total_words == 0:
        return

    srt_content = ""
    vtt_content = "WEBVTT\n\n"
    
    current_time = 0.0
    for i, (sentence, word_count) in enumerate(zip(sentences, words_per_sentence)):
        # Calculate proportional duration based on word count
        sentence_duration = (word_count / total_words) * duration
        
        # Ensure minimum visibility (at least 1.5 seconds) unless near the end
        if i < len(sentences) - 1:
            sentence_duration = max(1.5, sentence_duration)
            
        start = current_time
        end = min(start + sentence_duration, duration)
        
        # SRT Format
        srt_content += f"{i+1}\n{format_timestamp(start)} --> {format_timestamp(end)}\n{sentence}.\n\n"
        
        # VTT Format
        vtt_content += f"{format_vtt_timestamp(start)} --> {format_vtt_timestamp(end)}\n{sentence}.\n\n"
        
        current_time = end
        
    with open(output_srt_path, "w", encoding="utf-8") as f:
        f.write(srt_content)
    
    output_vtt_path = output_srt_path.replace(".srt", ".vtt")
    with open(output_vtt_path, "w", encoding="utf-8") as f:
        f.write(vtt_content)
        
    print(f"Success: Generated SRT and VTT at {output_srt_path}")

def format_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds * 1000) % 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"

def format_vtt_timestamp(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds * 1000) % 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}.{millis:03}"

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python alignment.py <narration_text> <audio_path> <output_srt_path>")
        sys.exit(1)
        
    input_arg = sys.argv[1]
    audio_path = sys.argv[2]
    output_path = sys.argv[3]
    
    if os.path.isfile(input_arg):
        with open(input_arg, "r", encoding="utf-8") as f:
            text = f.read()
    else:
        text = input_arg
    
    generate_subtitles(text, audio_path, output_path)
