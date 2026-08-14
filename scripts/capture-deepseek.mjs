#!/usr/bin/env node
/**
 * DeepSeek fixture 采集器（阶段 7 前置证据）。
 *
 * 启动一个独立实例的 Windows Chrome（带 CDP 调试端口），在 Windows 桌面弹出
 * 浏览器窗口。您在窗口里登录 chat.deepseek.com 并切换到目标会话/状态，脚本
 * 负责定位对话容器、脱敏并保存为仓库 fixture 文件。
 *
 * 用法：node scripts/capture-deepseek.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import readline from 'node:readline'

import puppeteer from 'puppeteer-core'

const CHROME_WIN = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
const CDP_PORT = 9340
const PROFILE = 'C:\\tmp\\chatstash-deepseek-profile'
const FIXTURE_DIR = resolve('packages/adapters/fixtures/deepseek')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((r) => rl.question(q, r))
mkdirSync(FIXTURE_DIR, { recursive: true })

const CANDIDATE_SELECTORS = [
  'main',
  '[class*="conversation"]',
  '[class*="thread"]',
  '[class*="message-list"]',
  '[class*="chat"]',
  '[class*="scroll"]',
]

const SANITIZE_JS = `(root) => {
  const MAX_TEXT = 12
  const clone = root.cloneNode(true)
  clone.querySelectorAll('script,style,noscript,svg,canvas,iframe,video,audio,button').forEach((n) => n.remove())
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    const text = (node.textContent || '').replace(/\\s+/g, ' ').trim()
    if (text.length > 0) {
      node.textContent = text.length <= MAX_TEXT ? text : text.slice(0, MAX_TEXT) + '…'
    }
  }
  clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
  return clone.outerHTML
}`

// 1. 启动独立 Windows Chrome（若已在运行则复用 CDP）
const chrome = spawn(CHROME_WIN, [
  `--remote-debugging-port=${CDP_PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--no-first-run',
  '--no-default-browser-check',
  'https://chat.deepseek.com/',
], { stdio: 'ignore' })

let browser
for (let i = 0; i < 40; i++) {
  try {
    const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
    if (res.ok) {
      browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${CDP_PORT}` })
      break
    }
  } catch { /* retry */ }
  await new Promise((r) => setTimeout(r, 500))
}
if (!browser) {
  console.error('无法连接 Windows Chrome CDP（端口 ' + CDP_PORT + '）。请确认没有防火墙拦截。')
  process.exit(1)
}
console.log('✅ 已连接 Windows Chrome:', await browser.version())

// 2. 等待用户在浏览器窗口登录
console.log('\n浏览器窗口已打开 chat.deepseek.com。请在窗口中登录（若已登录则跳过）。')
console.log('登录完成后，先在窗口中打开一个目标会话，然后回到本终端操作。')
await ask('> 按回车开始采集…')

// 3. 交互采集循环
while (true) {
  console.log('\n--- 请在浏览器中操作到目标状态（切换会话 / 发起提问 / 等待生成中等），然后按回车 ---')
  await ask('> 操作完成按回车…')

  const pages = await browser.pages()
  const page = pages.find((p) => p.url().startsWith('https://chat.deepseek.com')) ?? pages[0]
  const url = page.url()
  console.log(`当前 URL: ${url}`)

  const result = await page.evaluate((selectors, sanitize) => {
    const candidates = Array.from(document.querySelectorAll(selectors.join(',')))
      .filter((el) => el.offsetHeight > 200)
    candidates.sort((a, b) => b.offsetHeight - a.offsetHeight)
    const container = candidates[0]
    if (!container) return null
    return {
      html: sanitize(container),
      tag: container.tagName.toLowerCase(),
      className: String(container.className || '').slice(0, 120),
      childCount: container.children.length,
    }
  }, CANDIDATE_SELECTORS, new Function(`return (${SANITIZE_JS})`)())

  if (!result) {
    console.log('⚠ 未定位到对话容器（页面未加载或需滚动）。可继续操作后再试。')
    continue
  }
  console.log(`定位容器: <${result.tag} class="${result.className}"> 子节点 ${result.childCount}`)

  const name = (await ask('> 场景名（如 multi-turn，留空自动命名）：')).trim()
  if (name.toLowerCase() === 'quit') break

  const file = `${FIXTURE_DIR}/${name || `capture-${Date.now()}`}.html`
  const html = `<!doctype html>\n<html>\n  <body>\n    <!-- sampled: ${new Date().toISOString()}; url: ${url} -->\n${result.html}\n  </body>\n</html>\n`
  writeFileSync(file, html)
  console.log(`✅ 已保存: ${file}`)
}

browser.disconnect()
chrome.kill()
rl.close()
console.log('\n采集完成。请复查 fixtures 无隐私内容后提交。')
