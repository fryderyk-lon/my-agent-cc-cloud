"""Compose render-anim frames into a labelled GIF preview (needs Pillow).
Usage: python3 scripts/make-gif.py frames ghost_states.gif [font.ttf]"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

LABELS = {
    'idle': ('空闲 · 等你下指令', '#3fd4ff'),
    'working': ('工作中 · Bash: npm test', '#3fd4ff'),
    'permission': ('需要批准 · Edit src/app.ts', '#ffc233'),
    'done': ('完成 · 本轮结束', '#4cf08c'),
    'error': ('出错 · 工具调用失败', '#ff4a4a'),
    'sleep': ('休眠 · 没有活动会话', '#5f8fa3'),
}
frames_dir, out = sys.argv[1], sys.argv[2]
font_path = sys.argv[3] if len(sys.argv) > 3 else '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc'
meta = json.load(open(os.path.join(frames_dir, 'frames.json')))
font = ImageFont.truetype(font_path, 17)
first = Image.open(os.path.join(frames_dir, meta['frames'][0]['frame']))
size = first.width
W, H = size + 84, size + 74
bg = Image.new('RGBA', (W, H))
draw = ImageDraw.Draw(bg)
for y in range(H):
    c = int(38 + 18 * y / H)
    draw.line([(0, y), (W, y)], fill=(c - 6, c, c + 10, 255))
out_frames = []
for f in meta['frames']:
    fr = bg.copy()
    fr.alpha_composite(Image.open(os.path.join(frames_dir, f['frame'])).convert('RGBA'), ((W - size) // 2, 6))
    text, color = LABELS[f['state']]
    d = ImageDraw.Draw(fr)
    tw = d.textlength(text, font=font)
    x0, y0 = (W - tw) / 2 - 14, size + 16
    d.rounded_rectangle([x0, y0, x0 + tw + 28, y0 + 36], radius=12, fill=(18, 20, 24, 235), outline=color, width=2)
    d.text((x0 + 14, y0 + 8), text, font=font, fill='#f2f4f7')
    out_frames.append(fr.convert('RGB').convert('P', palette=Image.ADAPTIVE, colors=128))
out_frames[0].save(out, save_all=True, append_images=out_frames[1:], duration=int(1000 / meta['fps']), loop=0, optimize=True)
print(f'wrote {out} ({len(out_frames)} frames)')
