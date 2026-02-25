import os
import re
import glob

src_dir = r"c:\Users\ACER\sop\studybud\src"
tsx_files = glob.glob(os.path.join(src_dir, "**", "*.tsx"), recursive=True)

# Replacements
replacements = [
    (r'\bborder-black\b', 'border-white/10'),
    (r'\bborder-2\b', 'border'),
    (r'\bborder-4\b', 'border'),
    (r'\bborder-8\b', 'border'),
    (r'shadow-\[[^\]]+\]', 'shadow-neo'), # replace explicit arbitrary brutal shadows
    (r'\brounded-none\b', 'rounded-2xl'),
    (r'\bbg-black\b', 'bg-slate-900'),
    # (r'\btext-black\b', 'text-slate-100'), # Be careful with text-black, might be needed on light bgs
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

print("Cleanup complete.")
