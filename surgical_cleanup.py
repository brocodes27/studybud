import os
import re
import glob

src_dir = r"c:\Users\ACER\sop\studybud\src"
tsx_files = glob.glob(os.path.join(src_dir, "**", "*.tsx"), recursive=True)

# Smart replacements for brutalist patterns
replacements = [
    (r'shadow-\[[^\]]+\]', 'shadow-neo'), # Kill arbitrary shadows
    (r'\bborder-black\b', 'border-white/10'),
    (r'\bborder-4\b', 'border'),
    (r'\bborder-8\b', 'border'),
    (r'\bborder-2\b', 'border'),
    (r'\bbg-white\b', 'bg-slate-800'),
    (r'\btext-black\b', 'text-slate-100'),
    (r'\brounded-none\b', 'rounded-2xl'),
    (r'\bbg-gray-100\b', 'bg-slate-900/50'),
    (r'\bbg-slate-50\b', 'bg-slate-900/50'),
    (r'\bbg-black\b', 'bg-slate-900'),
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
        print(f"Surgically updated {filepath}")

print("Surgical Cleanup complete.")
