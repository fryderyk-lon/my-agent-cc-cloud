# 在 Mac 上装机灵桌宠（clawd-on-desk + 机灵主题）

适用环境：MacBook Pro，在 Claude 桌面 App 里用 Claude Code（本地会话）。

整体做法：用开源桌宠程序 [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) 负责置顶透明窗口、状态同步和审批气泡，外观换成本仓库渲染的机灵主题。

## 它会怎么动你的 Claude Code 全局配置

clawd 第一次启动时会往 `~/.claude/settings.json` 写入 hooks。Claude 桌面 App 的本地会话和命令行共用这个文件，所以写一次两边都生效。它的写法（已按源码和实测核对）：

| 行为 | 说明 |
|---|---|
| 只追加 | 在各事件末尾追加自己的条目，你已有的 hooks、权限规则、`env`、`statusLine` 等设置都不会被改动或删除 |
| 先备份 | 写入前另存 `settings.json.clawd-*.bak`，并且原子写入，不会写出半截文件 |
| 不拖慢 Claude | 状态类 hook 都是 `async: true`、5 秒超时，也不会往对话里输出任何内容 |
| 审批气泡 | `PermissionRequest` 注册为 HTTP hook，地址是 `http://127.0.0.1:23333/permission`；clawd 没开、开了勿扰或关掉气泡时，都会交回 Claude App 自己审批 |
| 自动修复 | clawd 运行期间每 5 分钟检查一次，发现自己的 hooks 被删就会补回。想去掉，要用 clawd 自己的卸载（见文末） |
| statusLine | 默认不碰。只有你在 clawd 里打开"收集本地 Claude 用量"时才会接管；如果你已有 statusLine，它会先问你，把原配置存档后串联调用，关闭时还原 |

我在一份模拟配置上用 clawd 自己的安装器实测过：安装后你原有的条目全部保留；卸载后配置内容与安装前完全一致。

需要你这边确认的只有下面几项，`tools/claude-config-check.mjs` 会自动检查：

1. **Node.js**：clawd 的 hook 命令是 `"<node 路径>" ".../clawd-hook.js"`，Mac 上必须装有 Node.js，否则机灵收不到任何状态。
2. **`disableAllHooks`**：如果为 `true`，所有 hooks 都不会运行。
3. **`allowedHttpHookUrls`**：如果你设了这个 HTTP hook 白名单，clawd 不会自动把自己加进去，审批气泡会被拦下。加 `--allow-clawd-http` 参数可以追加 `http://127.0.0.1:2333*/permission*`。
4. **你自己的 `PermissionRequest` hook**（比如自动批准脚本）：它会和 clawd 的气泡并行运行，气泡等你点击期间，你的自动批准也要等。
5. **`CLAUDE_CONFIG_DIR`**：如果在 shell 里设置过，从访达启动的 clawd 读不到它，会写到 `~/.claude`。

## 安装步骤

### 0. 准备 Node.js

```bash
node -v || brew install node      # 没有 Homebrew 的话，去 nodejs.org 下载 .pkg 安装包
```

### 1. 安装前检查并备份

```bash
curl -fsSLO https://raw.githubusercontent.com/fryderyk-lon/my-agent-cc-cloud/claude/vigilant-wright-djyxsj/tools/claude-config-check.mjs
node claude-config-check.mjs --backup
```

- 这条命令只读，只多做一件事：把 `settings.json` 复制成 `settings.json.ghost-backup-<时间>`。
- 标 `[问题]` 的先处理。提示 `allowedHttpHookUrls` 时，运行 `node claude-config-check.mjs --allow-clawd-http`（修改前会自动再备份一次）。
- 如果输出里有你看不懂的项，把输出贴给我。

### 2. 安装并启动 clawd

```bash
brew install --cask clawd-on-desk
```

也可以从 [Releases](https://github.com/rullerzhou-afk/clawd-on-desk/releases) 下载 `.dmg`。正式版有 Developer ID 签名和 Apple 公证；万一 macOS 仍然拦截，到"系统设置 → 隐私与安全性"里点"仍要打开"。

启动 clawd 后，它会自动写入 Claude Code hooks。

### 3. 验证原有配置完好

```bash
node claude-config-check.mjs --verify ~/.claude/settings.json.ghost-backup-<时间>
```

期望看到：`你原有的全部配置都还在，没有被改动。`

### 4. 装上机灵主题

主题包 `destiny-ghost.zip` 我单独发给你。它不在仓库里，原因见文末"授权"。

最简单的办法：在 clawd 里打开 设置 → 主题 → "导入 Clawd 主题包（.zip）"，选 `destiny-ghost.zip`，然后选中"机灵 Ghost"。

也可以手动解压：

```bash
mkdir -p ~/Library/Application\ Support/clawd-on-desk/themes
unzip -o ~/Downloads/destiny-ghost.zip -d ~/Library/Application\ Support/clawd-on-desk/themes/
```

解压后在 设置 → 主题 里选"机灵 Ghost"。如果列表里没有，点"刷新主题"或重启 clawd。

以后换新版主题包时，先在"打开主题文件夹"里删掉旧的 `destiny-ghost` 文件夹再导入，因为 clawd 不会覆盖同名主题。

### 5. 在 Claude 桌面 App 里试一下

在 Code 标签页新开一个**本地**会话，然后看机灵的反应：

| 你做了什么 | 机灵的反应 |
|---|---|
| 发一条消息 | 眼睛变亮，外壳微开慢转（思考） |
| Claude 开始读写文件、跑命令 | 8 个角整体离开球体，前后两圈反向旋转（工作）；同时开多个会话时转得更快、开得更大 |
| 用到子代理 | 外壳一波一波地起落（杂耍） |
| 需要你批准 | 黄色眼睛闪烁、歪头，旁边弹出 Allow / Deny 气泡 |
| 这一轮做完 | 绿色眼睛，外壳弹开转一圈再合上 |
| 工具出错 | 红色眼睛，外壳收紧、抖动 |
| 压缩上下文 | 整个外壳边转边收放 |
| 鼠标 60 秒不动 | 眼睛变暗、低头休眠；动一下鼠标就醒来 |

另外：拖动它时外壳会张开摇晃，双击它会原地转一圈，连点 4 下会触发外壳爆开再合拢。

注意：会话必须是本地会话。云端会话跑在远程容器里，你 Mac 上的机灵收不到它的状态。

## 可选设置（都在 clawd 的"设置"里）

- **审批放在哪**：
  - 默认在机灵的气泡里点，Claude App 在后台时也能批。
  - 如果更习惯在 Claude App 里点，到"气泡显示与自动关闭"里关掉"权限 / 交互气泡"。这时需要批准，机灵仍会亮起黄色眼睛，但要等 Claude 发出提醒通知，大约 6 秒后。
- **休眠（免打扰）**：右键机灵选择这一项。机灵会睡着，审批也交回 Claude App。
- **收集本地 Claude 用量**（Agents → Claude Code）：如果你有自己的 statusLine，建议保持关闭（默认就是关的）。
- **开机自启**：打开后不用每次手动启动 clawd。

## 排查

- **机灵完全没反应**：
  - 运行 `node claude-config-check.mjs`，重点看 Node.js 和 `disableAllHooks` 两项；
  - 确认用的是本地会话；
  - 在 Claude App 里新开一个会话再试。
- **状态正常但没有审批气泡**：通常是 `allowedHttpHookUrls` 拦截了，也可能是开了"休眠（免打扰）"，或关掉了"权限 / 交互气泡"。
- clawd 设置侧栏里有 **Doctor**，会检查 hook 路径、端口等问题，并提供修复按钮。

## 卸载 / 回滚

1. 在 clawd 里：设置 → Agents → Claude Code → 卸载。它会先备份，再只删除自己的条目。
2. 退出 clawd，然后 `brew uninstall --cask clawd-on-desk`。
3. 如果需要，用第 1 步的备份还原：`cp ~/.claude/settings.json.ghost-backup-<时间> ~/.claude/settings.json`。
4. 如果用过 `--allow-clawd-http`，从 `allowedHttpHookUrls` 里删掉 `http://127.0.0.1:2333*/permission*`。

注意：clawd 还在运行时手动删它的 hooks，5 分钟内会被自动补回，所以请走第 1 步的卸载。

## 授权

机灵主题基于 polygoncollectibles 的 Ghost 3D 模型（CC BY-NC-ND 4.0）渲染，机灵造型属于 Bungie。主题包只供个人使用，请不要公开分享。需要重新生成时，把 STL 放进 `prototype/ghost-render/stl/`，然后运行：

```bash
npm run theme:frames && npm run theme:pack
```
