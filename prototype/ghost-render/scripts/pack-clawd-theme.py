"""Encode the rendered clip frames into a clawd-on-desk theme folder + zip.

Usage: python3 scripts/pack-clawd-theme.py [outDir=build/clawd-theme]
Needs Pillow with WebP support. Reads <outDir>/frames (from build-clawd-theme.mjs) and writes
<outDir>/destiny-ghost/{theme.json,assets/*.webp} and <outDir>/destiny-ghost.zip.

The theme is for personal use only: the Ghost model is CC BY-NC-ND 4.0, so the rendered
assets must not be published (this repo only keeps the code that makes them).
"""
import json
import os
import shutil
import sys
import zipfile
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

THEME_ID = 'destiny-ghost'
EDGE_MARGIN = 2          # px; a frame whose content comes closer to the canvas edge is clipped
WEBP = dict(lossless=False, quality=88, method=6, alpha_quality=100)


def load_frames(frames_dir, clip):
    d = os.path.join(frames_dir, clip['id'])
    return [Image.open(os.path.join(d, f'f{i:04d}.png')).convert('RGBA') for i in range(clip['frames'])]


def union_bbox(frames):
    boxes = [f.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox() for f in frames]
    boxes = [b for b in boxes if b]
    return (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))


def file_of(clip_id):
    return f'ghost-{clip_id}.webp'


def encode_clip(job):
    frames_dir, clip, path = job
    frames = load_frames(frames_dir, clip)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=round(1000 / clip['fps']),
                   loop=0 if clip['loop'] else 1, **WEBP)
    return union_bbox(frames), os.path.getsize(path)


def rect(box, pad=0):
    x0, y0, x1, y1 = box
    return {'x': x0 - pad, 'y': y0 - pad, 'w': x1 - x0 + 2 * pad, 'h': y1 - y0 + 2 * pad}


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else 'build/clawd-theme'
    frames_dir = os.path.join(out_dir, 'frames')
    manifest = json.load(open(os.path.join(frames_dir, 'manifest.json')))
    size, b = manifest['size'], manifest['bindings']
    theme_dir = os.path.join(out_dir, THEME_ID)
    shutil.rmtree(theme_dir, ignore_errors=True)
    os.makedirs(os.path.join(theme_dir, 'assets'))

    jobs = [(frames_dir, clip, os.path.join(theme_dir, 'assets', file_of(clip['id']))) for clip in manifest['clips']]
    with ProcessPoolExecutor() as pool:
        results = list(pool.map(encode_clip, jobs))
    bboxes, total, clipped = {}, 0, []
    for clip, (bbox, nbytes) in zip(manifest['clips'], results):
        bboxes[clip['id']] = bbox
        total += nbytes
        edge = bbox[0] < EDGE_MARGIN or bbox[1] < EDGE_MARGIN or bbox[2] > size - EDGE_MARGIN or bbox[3] > size - EDGE_MARGIN
        if edge:
            clipped.append(clip['id'])
        print(f"{clip['id']:18s} {clip['frames']:3d} frames  {nbytes / 1024:7.1f} KB  bbox={bbox}{'  CLIPPED!' if edge else ''}")
    if clipped:
        raise SystemExit(f"clips touch the canvas edge: {', '.join(clipped)}; tone them down or increase VIEW.distance")

    # Layout: align every asset on the idle envelope (the Ghost floats, so the "baseline" is its
    # lowest point while idling).
    ix0, iy0, ix1, iy1 = bboxes['idle']
    content = {'x': ix0, 'y': iy0, 'width': ix1 - ix0, 'height': iy1 - iy0}
    wide_ids = [c for c in ('working-3', 'juggling-2', 'react-double') if c in bboxes]
    wide = (min(bboxes[c][0] for c in wide_ids), min(bboxes[c][1] for c in wide_ids),
            max(bboxes[c][2] for c in wide_ids), max(bboxes[c][3] for c in wide_ids))
    ms = lambda clip_id, loops=1: round(next(c for c in manifest['clips'] if c['id'] == clip_id)['duration'] * 1000 * loops)

    theme = {
        'schemaVersion': 1,
        'name': '机灵 Ghost',
        'author': 'Claude (render and animation)',
        'version': '1.0.0',
        'description': '命运 2 机灵（Generalist Shell）· 经典白壳 · 由 3D 模型渲染',
        'license': 'Personal use only. Ghost model: polygoncollectibles, CC BY-NC-ND 4.0. Destiny and the Ghost are Bungie IP.',
        'customization': {'petTint': False},
        'viewBox': {'x': 0, 'y': 0, 'width': size, 'height': size},
        'layout': {
            'contentBox': content,
            'centerX': round(ix0 + content['width'] / 2),
            'baselineY': iy1,
            'visibleHeightRatio': 0.58,
            'baselineBottomRatio': 0.1,
        },
        'eyeTracking': {'enabled': False, 'states': []},
        'states': {state: [file_of(clip)] for state, clip in b['states'].items()},
        'sleepSequence': {'mode': 'direct'},
        'workingTiers': [{'minSessions': n, 'file': file_of(c)} for n, c in b['workingTiers']],
        'jugglingTiers': [{'minSessions': n, 'file': file_of(c)} for n, c in b['jugglingTiers']],
        'idleAnimations': [{'file': file_of(c), 'duration': ms(c)} for c in b['idleAnimations']],
        'displayHintMap': {hint: file_of(c) for hint, c in b['displayHints'].items()},
        'timings': {
            'minDisplay': {'attention': ms('attention', 2), 'error': ms('error', 3), 'notification': ms('notification', 2),
                           'sweeping': ms('sweeping', 2), 'carrying': ms('carrying', 1), 'working': 1000, 'thinking': 1000},
            'autoReturn': {'attention': ms('attention', 2), 'error': ms('error', 3), 'notification': ms('notification', 4),
                           'sweeping': 300000, 'carrying': ms('carrying', 2)},
            'mouseIdleTimeout': 20000,
            'mouseSleepTimeout': 60000,
            'wakeDuration': ms('waking'),
        },
        'hitBoxes': {
            'default': rect(bboxes['idle'], 4),
            'sleeping': rect(bboxes['sleeping'], 4),
            'wide': rect(wide, 2),
        },
        'sleepingHitboxFiles': [file_of('sleeping')],
        'wideHitboxFiles': [file_of(c) for c in wide_ids],
        'reactions': {
            'drag': {'file': file_of(b['reactions']['drag'])},
            'clickLeft': {'file': file_of(b['reactions']['clickLeft']), 'duration': ms(b['reactions']['clickLeft'])},
            'clickRight': {'file': file_of(b['reactions']['clickRight']), 'duration': ms(b['reactions']['clickRight'])},
            'double': {'files': [file_of(b['reactions']['double'])], 'duration': ms(b['reactions']['double'])},
        },
        'miniMode': {'supported': False},
    }
    with open(os.path.join(theme_dir, 'theme.json'), 'w', encoding='utf-8') as f:
        json.dump(theme, f, ensure_ascii=False, indent=2)
        f.write('\n')

    zip_path = os.path.join(out_dir, f'{THEME_ID}.zip')
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as z:
        for root, _, files in os.walk(theme_dir):
            for name in sorted(files):
                full = os.path.join(root, name)
                z.write(full, os.path.relpath(full, out_dir))
    print(f'\nassets {total / 1024 / 1024:.1f} MB -> {theme_dir}\nzip    {os.path.getsize(zip_path) / 1024 / 1024:.1f} MB -> {zip_path}')


if __name__ == '__main__':
    main()
