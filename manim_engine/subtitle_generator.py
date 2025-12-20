"""
Generates WebVTT subtitle files from segments with timing information.
"""

def format_vtt_timestamp(seconds):
    """Convert seconds to WebVTT timestamp format (HH:MM:SS.mmm)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds * 1000) % 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}.{millis:03}"

def generate_subtitles(segments, durations, output_path):
    """
    Generate WebVTT subtitles from segments and their durations.
    
    Args:
        segments: List of segment dicts with 'voiceover' field
        durations: List of durations in seconds for each segment
        output_path: Path to output .vtt file
    """
    vtt_content = "WEBVTT\n\n"
    
    current_time = 0.0
    
    for i, (seg, duration) in enumerate(zip(segments, durations)):
        voiceover = seg.get("voiceover", "")
        
        if not voiceover:
            continue
        
        # Split voiceover into sentences for better readability
        sentences = []
        for sentence in voiceover.replace('!', '.').replace('?', '.').split('.'):
            sentence = sentence.strip()
            if sentence:
                sentences.append(sentence + '.')
        
        if not sentences:
            continue
        
        # Distribute duration across sentences
        sentence_duration = duration / len(sentences)
        
        for sentence in sentences:
            start = current_time
            end = current_time + sentence_duration
            
            # Add subtitle entry
            vtt_content += f"{format_vtt_timestamp(start)} --> {format_vtt_timestamp(end)}\n"
            vtt_content += f"{sentence}\n\n"
            
            current_time = end
    
    # Write to file
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(vtt_content)
    
    print(f"✅ Created subtitles: {output_path}")

if __name__ == "__main__":
    # Test
    test_segments = [
        {"voiceover": "Hello world. This is a test. How are you?"},
        {"voiceover": "This is the second segment. It has more content."}
    ]
    test_durations = [5.0, 3.5]
    
    generate_subtitles(test_segments, test_durations, "test_subtitles.vtt")
    print("Test completed!")
