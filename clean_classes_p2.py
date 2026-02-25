import os
import re
import glob

src_dir = r"c:\Users\ACER\sop\studybud\src"
tsx_files = glob.glob(os.path.join(src_dir, "**", "*.tsx"), recursive=True)

replacements = [
    (r'\bbg-white\b', 'bg-slate-800'),
    (r'\btext-black\b', 'text-slate-100'),
    (r'\bbg-gray-100\b', 'bg-slate-800/50'),
]

for filepath in tsx_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    for pattern, repl in replacements:
        new_content = re.sub(pattern, repl, new_content)
        
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

print("Phase 2 Cleanup complete.")
