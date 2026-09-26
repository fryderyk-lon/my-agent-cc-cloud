#!/usr/bin/env python3
"""Turn black/white render pairs into RGBA frames (difference matting).

Usage: python3 scripts/matte.py <framesRoot> [onlyClipIds]
For every clip folder, b_fNNNN.png (rendered on black) and w_fNNNN.png (on white) become fNNNN.png:
  alpha = 1 - mean(white - black),  colour = black / alpha
Opaque pixels come out unchanged, the canvas becomes transparent, and additive light (eye glow,
energy sphere, burst) keeps its hue with an alpha that follows its brightness. The pair is removed.
"""
import glob
import os
import sys

import numpy as np
from PIL import Image

root = sys.argv[1]
only = set(filter(None, (sys.argv[2] if len(sys.argv) > 2 else '').split(',')))
done = 0
for clip_dir in sorted(p for p in glob.glob(os.path.join(root, '*')) if os.path.isdir(p)):
    if only and os.path.basename(clip_dir) not in only:
        continue
    for b_path in sorted(glob.glob(os.path.join(clip_dir, 'b_f*.png'))):
        w_path = b_path.replace(os.sep + 'b_f', os.sep + 'w_f')
        black = np.asarray(Image.open(b_path).convert('RGB'), dtype=np.float32) / 255.0
        white = np.asarray(Image.open(w_path).convert('RGB'), dtype=np.float32) / 255.0
        alpha = np.clip(1.0 - (white - black).mean(axis=2), 0.0, 1.0)
        colour = np.where(alpha[..., None] > 1.0 / 255.0, black / np.maximum(alpha[..., None], 1e-6), 0.0)
        rgba = np.dstack([np.clip(colour, 0.0, 1.0), alpha])
        Image.fromarray(np.round(rgba * 255.0).astype(np.uint8), 'RGBA').save(b_path.replace(os.sep + 'b_f', os.sep + 'f'))
        os.remove(b_path)
        os.remove(w_path)
        done += 1
print(f'matte: {done} frames')
