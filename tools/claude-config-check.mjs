#!/usr/bin/env node
// Checks whether your global Claude Code configuration will work with clawd-on-desk
// (the desktop-pet app the Ghost theme runs in), before and after clawd installs its hooks.
//
//   node tools/claude-config-check.mjs                  read-only report (changes nothing)
//   node tools/claude-config-check.mjs --backup         + copy settings.json to a timestamped backup
//   node tools/claude-config-check.mjs --allow-clawd-http
//                                                      + if you use allowedHttpHookUrls, append the
//                                                        pattern clawd's approval bubble needs (backs up first)
//   node tools/claude-config-check.mjs --verify <backup>
//                                                      compare with a backup: is everything you had still there?
//
// Only Node's standard library is used. Written for macOS; paths also resolve on Linux.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const CLAWD_PORTS = [23333, 23334, 23335, 23336, 23337];
const CLAWD_HTTP_PATTERN = 'http://127.0.0.1:2333*/permission*';
const CLAWD_MARKERS = ['clawd-hook.js', 'auto-start.js', 'auto-start.sh'];
const MANAGED_DIR = '/Library/Application Support/ClaudeCode';
const MDM_PLIST = '/Library/Managed Preferences/com.anthropic.claudecode.plist';

const args = process.argv.slice(2);
const flag = name => args.includes(name);
const out = { ok: 0, warn: 0, err: 0 };
const say = (level, msg) => {
  const tag = { ok: '[正常]', info: '[信息]', warn: '[注意]', err: '[问题]' }[level];
  if (level in out) out[level]++;
  console.log(`${tag} ${msg}`);
};

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('根节点不是 JSON 对象');
  return value;
}

function writeJsonAtomic(file, value) {
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: fs.statSync(file).mode });
  fs.renameSync(tmp, file);
}

function backup(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = `${file}.ghost-backup-${stamp}`;
  fs.copyFileSync(file, dest);
  return dest;
}

// allowedHttpHookUrls: '*' is a wildcard, the rest matches literally; host is case-insensitive
const patternMatches = (pattern, url) => new RegExp(
  `^${pattern.split('*').map(s => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i',
).test(url);

const hookList = value => (Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []);
const flatHooks = (hooks = {}) => Object.entries(hooks).flatMap(([event, groups]) =>
  hookList(groups).flatMap(group => (Array.isArray(group.hooks) ? group.hooks : [group])
    .map(hook => ({ event, matcher: group.matcher ?? '', hook }))));
const isClawdHook = h => (h.type === 'http' && typeof h.url === 'string' && /^http:\/\/127\.0\.0\.1:2333\d\/permission/.test(h.url))
  || (typeof h.command === 'string' && CLAWD_MARKERS.some(m => h.command.includes(m)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function findNode() {
  // same search order clawd uses for its hook command (hooks run with a minimal PATH)
  const home = os.homedir();
  const candidates = ['/opt/homebrew/bin/node', '/usr/local/bin/node', path.join(home, '.volta/bin/node'),
    path.join(home, '.nvm/current/bin/node')];
  const nvmRoot = path.join(home, '.nvm/versions/node');
  if (fs.existsSync(nvmRoot)) {
    for (const v of fs.readdirSync(nvmRoot).sort().reverse()) candidates.push(path.join(nvmRoot, v, 'bin/node'));
  }
  candidates.push(path.join(home, '.local/share/fnm/aliases/default/bin/node'), path.join(home, '.asdf/shims/node'),
    path.join(home, '.local/share/mise/shims/node'), '/usr/bin/node');
  const hit = candidates.find(p => { try { fs.accessSync(p, fs.constants.X_OK); return true; } catch { return false; } });
  if (hit) return hit;
  try {
    const shell = process.env.SHELL || '/bin/zsh';
    const lines = execFileSync(shell, ['-lic', 'command -v node 2>/dev/null; true'], { encoding: 'utf8', timeout: 5000 })
      .split('\n').map(s => s.trim()).filter(s => s.startsWith('/'));
    return lines.at(-1) || null;
  } catch { return null; }
}

function report() {
  const envDir = process.env.CLAUDE_CONFIG_DIR;
  const claudeDir = envDir && envDir.trim() ? envDir.trim() : path.join(os.homedir(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.json');
  console.log(`Claude Code 全局配置：${settingsPath}\n`);

  // 1. where clawd will write vs where the desktop app reads
  if (envDir) {
    say('warn', `你设置了 CLAUDE_CONFIG_DIR=${envDir}。从访达/程序坞启动的 clawd 读不到这个变量，会把 hooks 写进 ~/.claude/settings.json；`
      + '如果 Claude 桌面 App 用的是你的自定义目录，两边会对不上。');
  } else {
    say('ok', '没有设置 CLAUDE_CONFIG_DIR，clawd 和 Claude 桌面 App 用的是同一个 ~/.claude/settings.json。');
  }

  // 2. the settings file itself
  let settings = {};
  if (!fs.existsSync(settingsPath)) {
    say('info', 'settings.json 还不存在，clawd 会新建它（没有旧配置需要保护）。');
  } else {
    try {
      settings = readJson(settingsPath);
      say('ok', 'settings.json 是合法 JSON。');
    } catch (e) {
      say('err', `settings.json 解析失败（${e.message}）。clawd 会拒绝修改它，宠物将收不到任何状态。请先修好这个文件。`);
      return { settingsPath, settings: null };
    }
  }

  // 3. switches that silence hooks
  const managed = [];
  const managedFiles = [path.join(MANAGED_DIR, 'managed-settings.json')];
  const dropIn = path.join(MANAGED_DIR, 'managed-settings.d');
  if (fs.existsSync(dropIn)) managedFiles.push(...fs.readdirSync(dropIn).filter(f => f.endsWith('.json')).map(f => path.join(dropIn, f)));
  for (const f of managedFiles.filter(f => fs.existsSync(f))) {
    try { managed.push({ source: f, value: readJson(f) }); } catch (e) { say('warn', `托管配置 ${f} 无法解析：${e.message}`); }
  }
  if (fs.existsSync(MDM_PLIST)) {
    try {
      const json = execFileSync('plutil', ['-convert', 'json', '-o', '-', MDM_PLIST], { encoding: 'utf8' });
      managed.push({ source: MDM_PLIST, value: JSON.parse(json) });
    } catch { say('info', `检测到 MDM 配置 ${MDM_PLIST}，但无法读取，请手动确认其中没有禁用 hooks。`); }
  }
  if (settings.disableAllHooks === true) {
    say('err', 'settings.json 里 disableAllHooks = true：所有 hooks（包括 clawd 的）都不会运行，宠物不会有任何反应。');
  } else {
    say('ok', '没有全局禁用 hooks（disableAllHooks）。');
  }
  for (const { source, value } of managed) {
    if (value.allowManagedHooksOnly === true) say('err', `${source} 设置了 allowManagedHooksOnly：只运行企业下发的 hooks，clawd 的 hooks 会被忽略。`);
    if (value.disableAllHooks === true) say('err', `${source} 设置了 disableAllHooks：所有 hooks 被禁用。`);
  }
  if (!managed.length) say('ok', '没有企业托管配置限制 hooks。');

  // 4. HTTP hook allowlist (clawd's approval bubble is an HTTP hook to 127.0.0.1)
  const allowLists = [{ source: settingsPath, list: settings.allowedHttpHookUrls },
    ...managed.map(m => ({ source: m.source, list: m.value.allowedHttpHookUrls }))].filter(x => Array.isArray(x.list));
  if (!allowLists.length) {
    say('ok', '没有设置 allowedHttpHookUrls，clawd 的审批气泡（HTTP hook）不受限制。');
  } else {
    const merged = allowLists.flatMap(x => x.list);
    const covered = CLAWD_PORTS.every(p => merged.some(pat => patternMatches(pat, `http://127.0.0.1:${p}/permission`)));
    if (covered) say('ok', `allowedHttpHookUrls 已放行 clawd 的审批地址。`);
    else say('warn', `你设置了 allowedHttpHookUrls（${allowLists.map(x => x.source).join('、')}），但没有放行 http://127.0.0.1:23333/permission。`
      + `状态动画不受影响，但审批气泡会被 Claude Code 拦下。运行本脚本加 --allow-clawd-http 可以追加 "${CLAWD_HTTP_PATTERN}"。`);
  }

  // 5. hooks you already have
  const all = flatHooks(settings.hooks);
  const yours = all.filter(h => !isClawdHook(h.hook));
  const clawd = all.filter(h => isClawdHook(h.hook));
  if (!yours.length) {
    say('ok', '你没有自己的 hooks，clawd 追加的条目不会和任何东西冲突。');
  } else {
    const byEvent = {};
    for (const h of yours) byEvent[h.event] = (byEvent[h.event] || 0) + 1;
    say('info', `你已有 ${yours.length} 个 hook：${Object.entries(byEvent).map(([e, n]) => `${e}×${n}`).join('，')}。`
      + 'clawd 只会在这些事件后面追加自己的条目，不会改动或删除它们。');
  }
  const permissionHooks = yours.filter(h => h.event === 'PermissionRequest');
  if (permissionHooks.length) {
    say('warn', `你有 ${permissionHooks.length} 个自己的 PermissionRequest hook。Claude Code 会并行运行它和 clawd 的审批气泡，`
      + '气泡等你点击期间，你的 hook（例如自动批准）也要等气泡结束才生效。如果不想这样，在 clawd 设置里关掉"权限气泡"，审批留在 Claude App 里。');
  }
  if (settings.statusLine) {
    say('info', '你有自定义 statusLine。clawd 默认不碰它；只有你在 clawd 里打开"收集本地 Claude 用量"时才会询问并串联它，关掉会还原。');
  }

  // 6. Node.js: clawd's hook command runs `"<node>" ".../clawd-hook.js"`
  const node = findNode();
  if (!node) {
    say('err', '找不到 Node.js。clawd 的 hook 命令需要系统里的 node，没有它宠物收不到任何状态。请先安装：brew install node（或到 nodejs.org 下载安装包）。');
  } else {
    let version = '';
    try { version = execFileSync(node, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim(); } catch {}
    const major = Number((version.match(/^v(\d+)/) || [])[1]);
    if (major && major < 18) say('warn', `Node.js 版本较旧：${node} ${version}，建议升级到 18 以上。`);
    else say('ok', `找到 Node.js：${node} ${version}（clawd 会把这个绝对路径写进 hook 命令）。`);
  }

  // 7. clawd hooks already present?
  if (!clawd.length) {
    say('info', '还没有 clawd 的 hooks（第一次启动 clawd 时会自动写入，并自动备份原文件）。');
  } else {
    const broken = clawd.filter(h => typeof h.hook.command === 'string').filter(h => {
      const [bin, script] = [...h.hook.command.matchAll(/"([^"]+)"/g)].map(m => m[1]);
      return (bin && bin.startsWith('/') && !fs.existsSync(bin)) || (script && !fs.existsSync(script));
    });
    say(broken.length ? 'warn' : 'ok', `已安装 clawd 的 hooks ${clawd.length} 个${broken.length ? `，其中 ${broken.length} 个指向不存在的路径（重启 clawd 会自动修复）` : '，路径都有效'}。`);
  }
  return { settingsPath, settings };
}

function verify(backupPath, settingsPath) {
  const before = readJson(backupPath);
  const after = readJson(settingsPath);
  console.log(`\n对比备份：${backupPath}\n`);
  let problems = 0;
  for (const key of Object.keys(before)) {
    if (key === 'hooks') continue;
    if (!(key in after)) { problems++; say('err', `顶层设置 "${key}" 不见了。`); }
    else if (!same(before[key], after[key])) {
      if (key === 'allowedHttpHookUrls' && before[key].every(p => after[key].includes(p))) say('info', 'allowedHttpHookUrls 只是追加了新条目，原有条目都在。');
      else { problems++; say('warn', `顶层设置 "${key}" 的值变了。`); }
    }
  }
  const afterHooks = flatHooks(after.hooks);
  for (const h of flatHooks(before.hooks)) {
    if (!afterHooks.some(a => a.event === h.event && a.matcher === h.matcher && same(a.hook, h.hook))) {
      problems++;
      say('err', `原有的 ${h.event} hook 不见了或被改动：${JSON.stringify(h.hook)}`);
    }
  }
  const added = afterHooks.filter(a => !flatHooks(before.hooks).some(h => h.event === a.event && same(a.hook, h.hook)));
  const foreign = added.filter(a => !isClawdHook(a.hook));
  say('info', `新增 hook ${added.length} 个，其中 clawd 的 ${added.length - foreign.length} 个。`);
  for (const f of foreign) say('warn', `新增了一个不属于 clawd 的 ${f.event} hook：${JSON.stringify(f.hook)}`);
  for (const key of Object.keys(after)) if (!(key in before) && key !== 'hooks') say('info', `新增顶层设置 "${key}"。`);
  if (!problems && !foreign.length) say('ok', '你原有的全部配置都还在，没有被改动。');
  return problems;
}

const { settingsPath, settings } = report();
if (flag('--backup') && settings && fs.existsSync(settingsPath)) {
  say('ok', `已备份到 ${backup(settingsPath)}`);
}
if (flag('--allow-clawd-http') && settings) {
  const list = settings.allowedHttpHookUrls;
  if (!Array.isArray(list)) say('info', '你没有设置 allowedHttpHookUrls，不需要追加。');
  else if (list.includes(CLAWD_HTTP_PATTERN)) say('info', '放行规则已经存在。');
  else {
    const dest = backup(settingsPath);
    writeJsonAtomic(settingsPath, { ...settings, allowedHttpHookUrls: [...list, CLAWD_HTTP_PATTERN] });
    say('ok', `已在 allowedHttpHookUrls 末尾追加 "${CLAWD_HTTP_PATTERN}"（修改前的备份：${dest}）。`);
  }
}
const verifyIdx = args.indexOf('--verify');
if (verifyIdx >= 0) {
  const backupPath = args[verifyIdx + 1];
  if (!backupPath || !fs.existsSync(backupPath)) { say('err', '--verify 后面要跟一个存在的备份文件路径。'); process.exitCode = 2; }
  else if (verify(backupPath, settingsPath)) process.exitCode = 1;
}
console.log(`\n结果：${out.ok} 项正常，${out.warn} 项需要注意，${out.err} 项有问题。`);
if (out.err && !process.exitCode) process.exitCode = 1;
