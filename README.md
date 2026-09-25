# Claude Code 桌面宠物：机灵（Ghost）

参考 Codex 的桌面宠物，给 Claude Code 做一只《命运 2》机灵造型的桌面宠物：它悬浮在桌面上，根据 Claude Code 的状态（思考、执行工具、等待批准、完成、出错）做出不同反应。

当前方案：开源桌宠程序 [clawd-on-desk](https://github.com/rullerzhou-afk/clawd-on-desk) 加上本仓库渲染的机灵主题（经典白壳，个人自用）。

- [docs/clawd-ghost-setup.md](docs/clawd-ghost-setup.md)：Mac 上的安装步骤，以及如何确保不影响现有的 Claude Code 全局配置
- [tools/claude-config-check.mjs](tools/claude-config-check.mjs)：安装前检查、备份，安装后核对全局配置
- [prototype/ghost-render](prototype/ghost-render)：把机灵模型组装、渲染成各状态动画，并打包成 clawd 主题
- [docs/feasibility.md](docs/feasibility.md)：可行性评估、技术路线和授权说明
