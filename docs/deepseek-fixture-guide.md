# DeepSeek Adapter fixture 采集指南（阶段 7 前置证据）

## 目的

`packages/adapters/src/platforms/deepseek.ts` 的 primary/fallback selector、配对、streaming
与 extraction 全部**必须基于当前真实页面的无隐私 DOM 证据**，不允许猜测 selector。
请按本指南采集并提交 sanitized fixtures。

## 需要覆盖的场景（至少 5 种）

| 场景 | 如何获得 | 关键观察点 |
| --- | --- | --- |
| 普通多轮 | 打开一个已完成的、含多个 user/assistant 回合的会话 | user/assistant 消息的容器、role 标识、正文容器、消息 ID |
| rich Markdown | 同上，但回复含代码块、表格、列表、公式 | code/pre/table/annotation 的结构与 class |
| streaming | 发起一个新提问，在回复**生成过程中**立即采集 | 正在生成的标记：class、aria、data-*、停止按钮 |
| 新会话 vs 历史会话 | 分别打开一个新对话和一个从历史列表进入的会话 | 两种入口下 DOM 是否有差异（fallback 候选） |
| invalid / 无配对 | 正常会话即可；若出现无前驱 user 的孤立回复请单独标注 | 哪些结构会被误判为消息但实际不可配对 |

## 操作步骤

1. 登录 `https://chat.deepseek.com/`，打开目标会话。
2. 按 `F12` 打开 DevTools → 切到 **Console**。
3. 粘贴下方采集脚本，回车执行。脚本会自动定位最大的对话容器并输出脱敏 HTML。
4. 复制 `CHATSTASH_FIXTURE_START` / `END` 之间的内容。
5. 保存为：
   `packages/adapters/fixtures/deepseek/<场景>.html`
   （例如 `multi-turn.html`、`rich-markdown.html`、`streaming.html`、`fresh-vs-history.html`）
6. 在文件末尾的 HTML 注释中记录：
   ```html
   <!-- sampled: 2026-08-14; url: https://chat.deepseek.com/a/chat/s/<id>; state: complete -->
   ```

## 采集脚本（DevTools Console 粘贴执行）

```js
(() => {
  // ChatStash DeepSeek fixture 采集脚本：自动定位对话容器并脱敏输出。
  const MAX_TEXT = 12

  function sanitizeTree(root) {
    const clone = root.cloneNode(true)
    clone
      .querySelectorAll('script,style,noscript,svg,canvas,iframe,video,audio,button')
      .forEach((n) => n.remove())
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
      if (text.length > 0) {
        node.textContent = text.length <= MAX_TEXT ? text : text.slice(0, MAX_TEXT) + '…'
      }
    }
    // 移除会话标识 id（保留 class / aria-* / data-* 供 selector 分析）
    clone.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
    return clone
  }

  const candidates = Array.from(
    document.querySelectorAll('main, [class*="conversation"], [class*="chat"], [class*="message"], [class*="thread"], [class*="scroll"]'),
  ).filter((el) => el.offsetHeight > 200)

  const container = candidates.sort((a, b) => b.offsetHeight - a.offsetHeight)[0]

  if (container) {
    const clone = sanitizeTree(container)
    console.log('===== CHATSTASH_FIXTURE_START =====')
    console.log(clone.outerHTML)
    console.log('===== CHATSTASH_FIXTURE_END =====')
    console.log(`sampled: ${new Date().toISOString()}; url: ${location.href}`)
  } else {
    // 自动定位失败：请对目标消息元素手动执行并粘贴结果
    console.log('自动定位失败。请在 Elements 面板选中消息元素，右键 Copy > Copy element，然后自行脱敏文本。')
  }
})()
```

## 隐私与安全要求（必须遵守）

- 正文内容**会被脚本替换为占位符**（保留前 12 个字符便于识别结构），但请复查：
  - 不要包含账号邮箱、用户名、token、session、API key
  - 若消息 ID / 会话 ID 形似可关联账号，可手动改写成 `conv-1` / `msg-1`
- 只保留**结构**（标签层级、class、aria、data-* 属性、相对顺序），用于推断 selector 策略
- 不要上传整个页面 `outerHTML`（可能含侧栏列表、用户资料等无关敏感信息）；以对话主体为主
- 采集后本地打开文件确认无敏感内容，再放入仓库

## 提交方式

- fixture 放到 `packages/adapters/fixtures/deepseek/`（阶段 7 文件范围）
- 连同取样日期注释一起提交，阶段 7 实现时会逐条对照
