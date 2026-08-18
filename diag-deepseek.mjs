import puppeteer from 'puppeteer-core'
import { writeFileSync } from 'node:fs'
const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9340' })
const page = (await browser.pages())[0]
const meta = await page.evaluate(() => ({
  url: location.href,
  messages: document.querySelectorAll('[class*="ds-message"]').length,
  code: document.querySelectorAll('[class*="ds-markdown"] pre').length,
  table: document.querySelectorAll('[class*="ds-markdown"] table').length,
}))
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
  writeFileSync('packages/adapters/fixtures/deepseek/ts-generics-rich.html',
    `<!doctype html>\n<html>\n  <body>\n    <!-- sampled: ${new Date().toISOString()}; url: ${meta.url} -->\n${html}\n  </body>\n</html>\n`)
}
console.log('已采集泛型详解会话:', JSON.stringify(meta))
browser.disconnect()
