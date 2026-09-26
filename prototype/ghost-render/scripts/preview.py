#!/usr/bin/env python3
"""Preview rendered clips on a dark and a light desktop: MP4 + contact sheet.

Usage: python3 scripts/preview.py <framesRoot> <outBase> <clipId> [clipId ...]
Writes <outBase>.mp4 (clips one after another, dark | light side by side, 30 fps) and <outBase>.png
(8 evenly spaced frames per clip on the dark background).
"""
import glob
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw

root, out_base, clip_ids = sys.argv[1], sys.argv[2], sys.argv[3:]
SCALE = float(os.environ.get('PREVIEW_SCALE', '1'))   # shrink frames for a lighter video
DARK, LIGHT = (38, 42, 49, 255), (233, 230, 225, 255)


def frames_of(cid):
    return sorted(glob.glob(os.path.join(root, cid, 'f*.png')))


def on(bg, frame):
    tile = Image.new('RGBA', frame.size, bg)
    tile.alpha_composite(frame)
    return tile


with tempfile.TemporaryDirectory() as tmp:
    n = 0
    for cid in clip_ids:
        for f in frames_of(cid):
            fr = Image.open(f).convert('RGBA')
            if SCALE != 1:
                fr = fr.resize((round(fr.size[0] * SCALE), round(fr.size[1] * SCALE)), Image.LANCZOS)
            w, h = fr.size
            canvas = Image.new('RGBA', (w * 2, h + 24), (20, 22, 26, 255))
            canvas.paste(on(DARK, fr), (0, 24))
            canvas.paste(on(LIGHT, fr), (w, 24))
            ImageDraw.Draw(canvas).text((8, 6), cid, fill=(255, 220, 0, 255))
            canvas.convert('RGB').save(os.path.join(tmp, f'{n:05d}.png'))
            n += 1
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', os.path.join(tmp, '%05d.png'),
                    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', out_base + '.mp4'], check=True)

cols, cell = 8, 200
sheet = Image.new('RGBA', (cols * cell + 120, len(clip_ids) * cell), DARK)
d = ImageDraw.Draw(sheet)
for r, cid in enumerate(clip_ids):
    fs = frames_of(cid)
    d.text((6, r * cell + cell // 2 - 6), cid, fill=(255, 255, 255, 255))
    for c in range(cols):
        i = round(c * (len(fs) - 1) / (cols - 1))
        fr = Image.open(fs[i]).convert('RGBA').resize((cell, cell), Image.LANCZOS)
        sheet.alpha_composite(on(DARK, fr), (120 + c * cell, r * cell))
        d.text((120 + c * cell + 4, r * cell + 4), f'{i / 30:.2f}s', fill=(255, 220, 0, 255))
sheet.convert('RGB').save(out_base + '.png')
print(f'preview: {out_base}.mp4, {out_base}.png')
