"""Analyze Mixkit waveform JSON: overall energy + best start offset for a clip."""
import json
import sys
import urllib.request

VIDEO_SECONDS = 1006 / 30

TRACKS = [
    ("Trap Electro Vibes", 126, 116),
    ("Techno Fest Vibes", 124, 134),
    ("Games Music", 706, 118),
    ("K.O. Games", 1103, 93),
]

for name, track_id, duration in TRACKS:
    url = f"https://assets.mixkit.co/music/{track_id}/{track_id}-waveform.json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    raw = json.loads(urllib.request.urlopen(req).read())
    samples = raw["data"] if isinstance(raw, dict) else raw
    samples = [abs(x) for x in samples]
    n = len(samples)
    per_second = n / duration
    win = int(VIDEO_SECONDS * per_second)
    if win >= n:
        print(f"{name}: track shorter than video window")
        continue

    best_start, best_score = 0, -1.0
    prefix = [0.0]
    for x in samples:
        prefix.append(prefix[-1] + x)
    # Windows can't start beyond track_end - video_length.
    for start in range(0, n - win):
        score = prefix[start + win] - prefix[start]
        if score > best_score:
            best_score = score
            best_start = start

    overall = sum(samples) / n
    first10 = sum(samples[: int(10 * per_second)]) / int(10 * per_second)
    best_sec = best_start / per_second
    best_mean = best_score / win
    print(
        f"{name}: samples={n} overall_mean={overall:.3f} "
        f"first10s_mean={first10:.3f} best_window_start={best_sec:.1f}s "
        f"best_window_mean={best_mean:.3f}"
    )
