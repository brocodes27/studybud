import re

f = open('dist/assets/index-Bl5J3s_p.js', 'r', encoding='utf-8')
c = f.read()
f.close()

out = open('module_matches.txt', 'w', encoding='utf-8')

# Find module.exports occurrences
for m in re.finditer(r'module\.exports', c):
    s = max(0, m.start() - 300)
    e = min(len(c), m.end() + 300)
    out.write(f"OFFSET {m.start()}:\n{c[s:e]}\n{'='*80}\n")

# Find require( occurrences
for m in re.finditer(r'(?<!\w)require\s*\(', c):
    s = max(0, m.start() - 300)
    e = min(len(c), m.end() + 300)
    out.write(f"REQUIRE OFFSET {m.start()}:\n{c[s:e]}\n{'='*80}\n")

out.close()
print("Done - check module_matches.txt")
