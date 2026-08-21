import sys, re, json

s = sys.stdin.read()

def walk(node):
    if isinstance(node, dict):
        if node.get("@type") == "MusicRecording":
            yield node
        for v in node.values():
            yield from walk(v)
    elif isinstance(node, list):
        for v in node:
            yield from walk(v)

seen = set()
for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
    try:
        data = json.loads(m.group(1))
    except Exception:
        continue
    for rec in walk(data):
        url = rec.get("url", "")
        if url in seen:
            continue
        seen.add(url)
        print(f"{rec.get('name')} | {rec.get('genre')} | {rec.get('duration')} | {url}")
