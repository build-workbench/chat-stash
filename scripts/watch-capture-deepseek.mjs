#!/usr/bin/env node
/**
 * 监听采集器：检测用户手动切换的会话 URL，自动采集脱敏保存。
 * 用户只需在浏览器窗口连续点开会话，本脚本后台逐个采集。
 * 用法：node scripts/watch-capture-deepseek.mjs
 */
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const FIXTURE_DIR = resolve('packages/adapters/fixtures/deepseek')
const LOG = resolve(FIXTURE_DIR, 'samples.log')
mkdirSync(FIXTURE_DIR, { recursive: true })

const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9340' })
const page = (await browser.pages())[0]

let lastUrl = page.url()
let captured = 0
console.log('监听开始。当前 URL:', lastUrl.slice(0, 80))
console.log('请开始手动切换会话（每切换一个，等待其加载后我会自动采集）。')

while (true) {
  const url = page.url()
  // 会话 URL 变化时采集（跳过首页和非会话页）
  if (url !== lastUrl && url.startsWith('https://chat.deepseek.com/a/chat/s/')) {
    // 等待消息加载（最多 20 秒）
    let messages = 0
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000))
      messages = await page.evaluate(() => document.querySelectorAll('[class*="ds-message"]').length)
      if (messages > 0) break
    }
    if (messages > 0) {
      const name = `capture-${Date.now()}`
      const html = await page.evaluate(() => {
        const root = document.querySelector('[class*="ds-virtual-list"]')
        if (!root) return null
        const clone = root.cloneNode(true)
        clone.querySelectorAll('script,style,noscript,svg,canvas,iframe,video,audio,button').forEach((n) => n.remove())
        const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
        while (walker.nextNode()) {
          const node = walker.currentNode
          const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
          if (text.length > 0) node.textContent = text.length <= 12 ? text : text.slice(0, 12) + '…'
        }
        clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
        return { html: clone.outerHTML, msgCount: document.querySelectorAll('[class*="ds-message"]').length, code: document.querySelectorAll('[class*="ds-markdown"] pre').length, table: document.querySelectorAll('[class*="ds-markdown"] table').length }
      })
      if (html?.html) {
        const file = `${FIXTURE_DIR}/${name}.html`
        writeFileSync(file, `<!doctype html>\n<html>\n  <body>\n    <!-- sampled: ${new Date().toISOString()}; url: ${url} -->\n${html.html}\n  </body>\n</html>\n`)
        const meta = `messages=${html.msgCount} code=${html.code} table=${html.table}`
        appendFileSync(LOG, `${new Date().toISOString()} | ${url} | ${meta}\n`)
        captured++
        console.log(`✅ 已采集 #${captured}: ${name} (${meta}) -> ${file}`)
      }
    } else {
      console.log(`⚠ 会话 ${url.slice(-12)} 未加载消息，跳过。`)
    }
    lastUrl = url
  } else if (url !== lastUrl) {
    lastUrl = url
  }
  await new Promise((r) => setTimeout(r, 1500))
}
