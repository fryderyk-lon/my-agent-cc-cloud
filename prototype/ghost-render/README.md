# ghost-render：机灵宠物渲染原型

把 3D 打印用的机灵 STL 套件按实物装配关系组装成游戏里的造型，渲染出宠物的各个状态，并打包成 [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) 主题。

## 模型文件（不在仓库里）

用的是 Printables 上 polygoncollectibles 的 “Destiny Generalist Ghost Shell — Fully Detailed 1:1 Scale”，授权 CC BY-NC-ND 4.0。本仓库是公开的，所以 STL 和渲染结果都不提交（见 `.gitignore`）。

把压缩包里的 `.stl` 解压到本目录的 `stl/` 下：

```
stl/body_front.stl  stl/body_back.stl  stl/wing.stl  stl/wing_inside.stl  stl/cap.stl  ...
```

## 使用

```bash
npm install

# 在浏览器里实时预览，底部按钮切换状态；加 &theme=claude 换 Claude 配色
npm run preview        # 然后打开 http://localhost:5173/index.html?ui=1

# 无头渲染（Playwright；默认用本机 Chrome 走 GPU。没有显卡或 Chrome 时加 GHOST_GL=swiftshader，
# 改用 Playwright 自带的 Chromium 软件渲染，需先 npx playwright install chromium）
npm run stills         # 各状态静帧 -> out/
npm run assembly       # 合拢 / 整角离开球体的对比 -> out/
npm run anim           # 状态动画序列帧 -> frames/
python3 scripts/make-gif.py frames ghost_states.gif   # 合成带中文标签的 GIF（需要 Pillow 和中文字体）

# 从 STL 重新推导装配常数（需要 trimesh、manifold3d 等，见脚本开头）
python3 scripts/derive-assembly.py stl

# 生成 clawd-on-desk 主题：渲染 29 段动画 -> WebP -> theme.json -> destiny-ghost.zip（需要 Pillow）
npm run theme:frames   # 约 5 分钟，帧输出到 build/clawd-theme/frames
npm run theme:pack     # 输出 build/clawd-theme/destiny-ghost/ 和 destiny-ghost.zip
# 浏览器里预览这些动画片段：npm run preview，然后打开 index.html?ui=clips
```

动画片段定义在 `src/theme-clips.js`，里面也写明了每段对应 clawd 的哪个状态。循环片段首尾无缝：所有周期项都能整除片段时长，外壳圈的转角是 90° 的整数倍。

## 组装是怎么还原的

- STL 坐标系：眼睛朝 +X，上方是 +Z，单位 mm。
- 套件按展示用的爆炸图导出，每个零件沿所在角的轴线（与眼轴成 55.5°）向外错开。重复零件只给一份，放在后下角；其余 7 个角由 D2 对称（绕三个轴各转 180°）加绕 X 轴 −90° 得到，保证打印件全等。
- **每个角是一个刚体**，由三件组成：
  - 外壳 `wing`
  - 底板 `wing_inside`：沿轴线外移 19.5mm，正好嵌进外壳内侧下沉的面板，4 根定位柱插进外壳
  - 尖端小盖 `cap`：3 根柱子（1 大 2 小）与外壳截平尖端上的 3 个孔完全对应，坐在尖端上补全角尖
- 套件里左右 4 个角是"两块半壳 + 中间插片框"拼的，外形与 `wing` 一致（平均偏差 0.4mm）。这里统一用整片 `wing`，所以没有拼缝。
- 静止姿态：每个整角沿轴线内移 37.15mm。内移到 37.18mm 时相邻的角边缘相接，合成封闭外壳；37.60mm 才会碰到球体。
- 动画只移动整角：沿各自轴线离开 / 合回球体，前后两圈绕眼轴旋转。前后两圈在任何相对转角下都不接触，所以反向旋转不会穿模。
- 镜片 `lense` 在文件里是平放的，绕 Y 轴转 90° 盖到眼睛上。
- 以上位置都用布尔求交（manifold3d）验证过零穿插，推导过程见 `scripts/derive-assembly.py`。

代码见 `src/ghost-model.js`（组装与材质）和 `src/anim.js`（状态动画）。
