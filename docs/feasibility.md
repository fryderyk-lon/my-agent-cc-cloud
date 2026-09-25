# Claude Code 桌面宠物：机灵（Destiny Ghost）可行性评估

> 状态：可行性与造型评估阶段（2026-09-25）。结论：**技术上完全可行**，已有同类开源项目验证过整条链路；造型建议基于你提供的 3D 模型程序化渲染。

## 1. Codex 的桌面宠物是怎么做的

| 项 | Codex 的做法 |
|---|---|
| 形态 | Codex 桌面版（Electron，macOS / Windows）约 2026-05 上线；CLI 版 2026-05-12 加入终端宠物 |
| 窗口 | 悬浮、可拖动、置顶的透明窗口，除宠物本体外点击穿透；带活动托盘（点铃铛列出会话并跳转） |
| 状态 | 运行中 / 需要输入（审批）/ 完成待查看 / 失败，用气泡提示（红钟 = 需审批，绿勾 = 完成） |
| 渲染 | 2D 精灵图集，CSS background 逐帧播放 |
| 自定义宠物 | `~/.codex/pets/<id>/pet.json` + `spritesheet.webp`；图集固定 1536×1872，8 列 × 9 行，每格 192×208，透明底 |
| 图集行 | idle(6) · running-right(8) · running-left(8) · waving(4) · jumping(5) · failed(8) · waiting(6) · running(6) · review(6) |
| 生成方式 | 官方 `hatch-pet` skill 用图像生成模型逐行生成，再做一致性 QA |
| 状态来源 | App 内部事件（闭源）；未发现可在宠物上直接审批的功能 |

来源：[openai/skills hatch-pet](https://github.com/openai/skills/tree/main/skills/.curated/hatch-pet)、[openai/codex `codex-rs/tui/src/pets`](https://github.com/openai/codex/tree/main/codex-rs/tui/src/pets)、[openai/codex#21206](https://github.com/openai/codex/pull/21206)。

## 2. Claude Code 这边能拿到什么

Claude Code 没有内置桌面宠物（v2.1.89 的愚人节彩蛋 `/buddy` 是终端里的 ASCII 小动物，之后已移除），但 **hooks** 足够驱动一只宠物：

| 宠物状态 | 触发的 hook 事件 |
|---|---|
| 工作中（思考） | `UserPromptSubmit` |
| 工作中（执行工具，可显示 `Bash: npm test`） | `PreToolUse` / `PostToolUse` |
| 等待批准 | `PermissionRequest`（或 `Notification` 的 `permission_prompt`，约 6 秒后才触发） |
| 完成 | `Stop` |
| 出错 | `PostToolUseFailure`、`StopFailure` |
| 等你输入 | `Notification` 的 `idle_prompt` |
| 子代理 / 压缩上下文 | `SubagentStart` / `SubagentStop`、`PreCompact` / `PostCompact` |
| 上线 / 下线 | `SessionStart` / `SessionEnd` |

- 状态类事件用 `"async": true` 的 command hook（后台运行、不阻塞 Claude，脚本不输出任何内容以免混进对话），把事件转发给宠物的本地端口。
- 审批用 `type: "http"` hook，把事件 JSON 直接 POST 给宠物并等待答复。
- 整套 hooks 可以通过插件的 `hooks/hooks.json` 打包成一键安装。
- `PermissionRequest` hook 能返回 allow / deny，所以**宠物上直接点“批准 / 拒绝”是可行的**（Codex 做不到）。超时或宠物没开时返回空结果，自动退回终端里的正常确认。
- statusLine 命令能拿到上下文占用、费用、限额等信息，可做宠物的“能量条”。
- 文档：[hooks](https://code.claude.com/docs/en/hooks)、[statusline](https://code.claude.com/docs/en/statusline)、[plugins](https://code.claude.com/docs/en/plugins)。

限制：

- 只对**本机**会话生效（终端 CLI、VS Code / JetBrains 扩展、桌面 App 的本地会话）。claude.ai/code 的云端会话跑在远程容器里，hook 触发在云端，本机宠物收不到。
- hooks 本身不能把终端切到前台；需要宠物 App 自己调用系统 API 去激活终端窗口。

## 3. 已有的开源先例

| 项目 | 技术 | 要点 |
|---|---|---|
| [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) | Electron，Win11 / macOS / Linux | 启动即自动注册 Claude Code hooks；宠物上 Allow / Deny；点击穿透；自定义主题支持 SVG / GIF / APNG / WebP；可导入 Codex 宠物 zip |
| [agentpet](https://github.com/ntd4996/agentpet) | Swift（macOS）/ Tauri | hooks；兼容 Codex 宠物包 |
| [IMMINJU/claude-pet](https://github.com/IMMINJU/claude-pet) | Tauri 2，约 8 MB | hooks 经 TCP 发到本地端口 |
| [Hopet](https://github.com/BinaryFroggy/Hopet) | Swift / AppKit | Unix socket；可在宠物上回答权限 |

## 4. 技术路线

| 路线 | 做法 | 优点 | 代价 |
|---|---|---|---|
| A. 现成壳 + 机灵主题 | 用本仓库的渲染管线导出 APNG / WebP 动画，做成 clawd-on-desk 主题 | 最快；审批气泡、多会话、托盘等现成 | 受限于对方的状态划分和交互 |
| B. Codex 兼容宠物包 | 渲染成 1536×1872 图集 + `pet.json` | 一份资产同时可用于 Codex、clawd、agentpet 等 | 每个状态只有 4–8 帧，192×208 |
| C. 自研实时 3D | Electron + Three.js 实时渲染机灵，hooks → 本地 HTTP 服务驱动状态机 | 最像游戏：外壳展开旋转、眼睛跟随鼠标、状态平滑过渡 | 工作量最大；需减面（原始约 39 万三角面）并在空闲时降帧 |

窗口技术：Electron 的透明、置顶、点击穿透（`setIgnoreMouseEvents(true, { forward: true })`）在 macOS / Windows 上都有成熟做法。Tauri v2 体积小，但点击穿透没有 forward 选项，macOS 透明需要私有 API，Windows 透明窗口也有已知 bug。实时 3D 路线推荐 Electron。

## 5. 造型：谁来生成

**建议由我基于你的 3D 模型程序化生成，不需要额外用 AI 出图。**

- 模型本身就是 8 个角 + 球体本体的结构，和游戏里一致：每个角是一个整体，可以整块离开、合回球体，正好做“外壳展开 / 旋转”的动画。AI 出图或 AI 生成的 3D 网格是一整块，很难拆开做这种动画。
- 渲染是确定性的：每一帧都一致，任意分辨率、任意帧数，换配色只改一个参数。Codex 的 hatch-pet 要专门做 QA，正是因为图像生成模型会让帧与帧之间走样。
- 本仓库 `prototype/ghost-render` 已完成：按实物装配关系还原（外壳 + 底板 + 尖端小盖组成整角，8 个角边缘相接合成封闭外壳）、6 种状态动画、经典配色与 Claude 配色，128px 下辨识度良好。

以下情况适合你用其他工具来生成：

- 想要完全不同的画风（像素风、Q 版、手绘）。
- 打算公开发布：需要一个不依赖该模型的原创造型（见下文授权）。

## 6. 授权与 IP

- 模型来自 Printables 上 polygoncollectibles 的 “Destiny Generalist Ghost Shell — Fully Detailed 1:1 Scale”，授权 **CC BY-NC-ND 4.0**。允许为非商业目的制作改编物，但**不允许分享**改编后的内容。自用没问题；渲染出的宠物素材不能公开发布（包括本公开仓库）。
- 机灵造型本身是 Bungie 的 IP，建议只做个人、非商业用途。
- 所以本仓库只提交原创代码，STL 和渲染结果都在 `.gitignore` 里。如果将来要开源发布，需要换成原创造型，或取得模型作者的授权。

## 7. 已确定的方案（2026-09-25）

- 环境：MacBook Pro，在 Claude 桌面 App 里用 Claude Code（本地会话）
- 路线：A，即 clawd-on-desk 加机灵主题，并且要兼容现有的 Claude Code 全局配置
- 配色：经典白壳青眼
- 用途：自用，不公开

安装步骤和配置兼容性检查见 [clawd-ghost-setup.md](clawd-ghost-setup.md)。
