#!/usr/bin/env python3
"""Contact sheet: 8 evenly spaced frames per clip on a dark desktop.
Usage: python3 scripts/sheet.py <framesRoot> <out.png> <clipId> [clipId ...]"""
import glob, os, sys
from PIL import Image, ImageDraw
root, out, ids = sys.argv[1], sys.argv[2], sys.argv[3:]
DARK = (38, 42, 49, 255)
cols, cell, label = 8, 150, 110
sheet = Image.new('RGBA', (label + cols * cell, len(ids) * cell), DARK)
d = ImageDraw.Draw(sheet)
for r, cid in enumerate(ids):
    fs = sorted(glob.glob(os.path.join(root, cid, 'f*.png')))
    d.text((6, r * cell + cell // 2 - 6), cid, fill=(255, 255, 255, 255))
    for c in range(cols):
        i = round(c * (len(fs) - 1) / (cols - 1))
        fr = Image.open(fs[i]).convert('RGBA').resize((cell, cell), Image.LANCZOS)
        t = Image.new('RGBA', (cell, cell), DARK); t.alpha_composite(fr)
        sheet.alpha_composite(t, (label + c * cell, r * cell))
        d.text((label + c * cell + 3, r * cell + 3), f'{i / 30:.2f}s', fill=(255, 220, 0, 255))
sheet.convert('RGB').save(out)
