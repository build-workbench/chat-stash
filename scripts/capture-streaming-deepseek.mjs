#!/usr/bin/env node
/**
 * streaming 采集（v3，MutationObserver）：页面内观察新 assistant 消息，
 * 一出现立即通过 CDP 回调采集半成品 DOM。用法：node scripts/capture-streaming-deepseek.mjs
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const FIXTURE_DIR = resolve('packages/adapters/fixtures/deepseek')
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9340' })
const page = (await browser.pages())[0]

const startUrl = page.url()
let pendingUrl = startUrl

// 注入回调：页面检测到新 assistant 消息时调用
await page.exposeFunction('chatstashOnStream', (url) => {
  pendingUrl = url
})

// 页面内注入 MutationObserver（观察 ds-virtual-list 新增 ds-markdown）
await page.evaluate(() => {
  if (window.__chatstashObserverInstalled) return
  window.__chatstashObserverInstalled = true
  const target = document.querySelector('[class*="ds-virtual-list"]') || document.body
  const seen = new Set()
  const obs = new MutationObserver(() => {
    const messages = document.querySelectorAll('[class*="ds-message"]')
    for (const m of messages) {
      const md = m.querySelector('[class*="ds-markdown"]')
      if (md && (m.textContent || '').trim().length > 2) {
        const key = m.dataset._csKey || (m.textContent || '').slice(0, 20)
        if (!seen.has(key)) {
          seen.add(key)
          const isLast = messages[messages.length - 1] === m
          if (isLast && window.chatstashOnStream) {
            window.chatstashOnStream(location.href)
          }
        }
      }
    }
  })
  obs.observe(target, { childList: true, subtree: true, characterData: true })
})

console.log('observer 已注入。请发起新对话并发送问题（回复开始出现时我会立即采集）。起始 URL:', startUrl.slice(0, 50))

// 等待回调触发
let captured = false
for (let i = 0; i < 600 && !captured; i++) {
  await new Promise((r) => setTimeout(r, 200))
  if (pendingUrl !== startUrl) {
    // 给 React 一点渲染时间（~800ms），然后采集
    await new Promise((r) => setTimeout(r, 800))
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
      return clone.outerHTML
    })
    if (html) {
      const markers = await page.evaluate(() => ({
        stop: !!document.querySelector('[class*="stop"]'),
        cursor: !!document.querySelector('[class*="cursor"]'),
        loading: !!document.querySelector('[class*="loading"]'),
        textLen: document.body.innerText.length,
      }))
      const mk = Object.entries(markers).filter(([, v]) => v && typeof v === 'boolean').map(([k]) => k).join(',') || 'none'
      const file = `${FIXTURE_DIR}/streaming.html`
      writeFileSync(file, `<!doctype html>\n<html>\n  <body>\n    <!-- sampled: ${new Date().toISOString()}; url: ${pendingUrl}; markers: ${mk}; bodyText: ${markers.textLen} -->\n${html}\n  </body>\n</html>\n`)
      console.log(`✅ 已采集 streaming 快照 (markers=${mk}) -> ${file}`)
      captured = true
    }
  }
}
if (!captured) console.log('未捕获到 streaming（超时）。')
browser.disconnect()
