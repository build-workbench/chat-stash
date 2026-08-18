import { ChatStashError } from '@chatstash/shared'
import type { CaptureDraft } from '@chatstash/shared'

import { isElementConnected } from '../dom/validate'
import { convertElementToMarkdown, extractReadableText } from '../markdown/convert'
import type { AdapterDiagnostic, AdapterTarget, SiteAdapter } from '../types'

/**
 * DeepSeek (chat.deepseek.com) adapter.
 *
 * Selector table (sampled 2026-08-14 from sanitized fixtures):
 *
 * | Capability        | Primary                                         | Fallback                                      | Validation                                      |
 * |-------------------|--------------------------------------------------|-----------------------------------------------|-------------------------------------------------|
 * | Conversation root | `.ds-virtual-list`                               | `[class*="ds-virtual-list"]`                  | connected, contains `.ds-message`               |
 * | Assistant target  | `.ds-message:has(.ds-assistant-message-main-content)` | `.ds-message:has(.ds-markdown)`          | connected; not think-only; has non-empty body   |
 * | User prompt       | `.ds-message` without assistant main content     | nearest preceding `.ds-message`               | connected; precedes target in document order    |
 * | Mount point       | the `.ds-message` itself                         | virtual-list item                             | 1:1 with target                                 |
 * | Streaming         | `[aria-label*="停止生成"]` / `.ds-button--stop`  | `.ds-streaming-cursor` on last assistant      | only the last assistant is marked streaming     |
 * | Message id        | `[data-virtual-list-item-key]`                   | document-order index                          | non-empty                                       |
 *
 * Hashed classes such as `_4f9bf79` are never used as the sole selector.
 */

const PRIMARY_ROOT = '.ds-virtual-list'
const FALLBACK_ROOT = '[class*="ds-virtual-list"]'
const MESSAGE = '.ds-message'
const PRIMARY_ASSISTANT_BODY = '.ds-assistant-message-main-content'
const MARKDOWN_BODY = '.ds-markdown'
const THINK = '.ds-think-content'
const ITEM_KEY = 'data-virtual-list-item-key'

const STREAMING_SELECTORS = [
  '[aria-label*="停止生成"]',
  '[aria-label*="Stop generating"]',
  '.ds-button--stop',
  '.ds-streaming-cursor',
].join(', ')

const EXTRA_NOISE = [
  THINK,
  '.md-code-block-banner-wrap',
  '.ds-markdown-cite',
  '.site_logo_back',
  '[role="button"]',
  '.ds-button',
].join(', ')

function queryFirst(root: ParentNode, primary: string, fallback: string): HTMLElement | null {
  return root.querySelector<HTMLElement>(primary) ?? root.querySelector<HTMLElement>(fallback)
}

function findConversationRoot(node: ParentNode | HTMLElement): HTMLElement | null {
  if (node instanceof HTMLElement) {
    const closest =
      node.closest<HTMLElement>(PRIMARY_ROOT) ?? node.closest<HTMLElement>(FALLBACK_ROOT)
    if (closest) return closest
  }
  return queryFirst(node, PRIMARY_ROOT, FALLBACK_ROOT)
}

function isAssistantMessage(message: HTMLElement): boolean {
  if (!message.matches(MESSAGE) && !message.classList.contains('ds-message')) return false
  if (message.querySelector(PRIMARY_ASSISTANT_BODY)) return true
  const markdown = message.querySelector(MARKDOWN_BODY)
  if (!markdown) return false
  // Think-only blocks are not the assistant body.
  return markdown.closest(THINK) === null
}

function isUserMessage(message: HTMLElement): boolean {
  if (!message.classList.contains('ds-message')) return false
  return !isAssistantMessage(message)
}

function assistantBody(message: HTMLElement): HTMLElement {
  return (
    message.querySelector<HTMLElement>(PRIMARY_ASSISTANT_BODY) ??
    message.querySelector<HTMLElement>(`:scope > ${MARKDOWN_BODY}`) ??
    message.querySelector<HTMLElement>(MARKDOWN_BODY) ??
    message
  )
}

function userBody(message: HTMLElement): HTMLElement {
  const markdown = message.querySelector<HTMLElement>(MARKDOWN_BODY)
  if (markdown && markdown.closest(THINK) === null) return markdown
  const first = message.firstElementChild
  return first instanceof HTMLElement ? first : message
}

function usedPrimaryAssistant(message: HTMLElement): boolean {
  return message.querySelector(PRIMARY_ASSISTANT_BODY) !== null
}

function localKeyFor(message: HTMLElement, index: number): string {
  const item = message.closest(`[${ITEM_KEY}]`)
  const key = item?.getAttribute(ITEM_KEY)?.trim()
  if (key) return `deepseek:${key}`
  return `deepseek:idx:${index}`
}

function findPairedUser(assistant: HTMLElement, root: ParentNode): HTMLElement | null {
  const messages = Array.from(root.querySelectorAll<HTMLElement>(MESSAGE))
  const index = messages.indexOf(assistant)
  if (index < 0) return null
  for (let i = index - 1; i >= 0; i -= 1) {
    if (isUserMessage(messages[i])) return messages[i]
  }
  return null
}

function stripNoise(root: HTMLElement): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement
  clone.querySelectorAll(EXTRA_NOISE).forEach((node) => node.remove())
  return clone
}

function conversationIdFromUrl(url: URL): string | null {
  const match = url.pathname.match(/\/a\/chat\/s\/([^/]+)/)
  const id = match?.[1]?.trim()
  return id && id.length > 0 ? id : null
}

function titleFromUser(user: HTMLElement): string {
  const text = extractReadableText(stripNoise(userBody(user)))
  const collapsed = text.replace(/\s+/g, ' ').trim()
  if (collapsed === '') return 'DeepSeek conversation'
  return collapsed.length <= 240 ? collapsed : collapsed.slice(0, 240)
}

function generationIsActive(root: ParentNode): boolean {
  return root.querySelector(STREAMING_SELECTORS) !== null
}

export const deepseekAdapter: SiteAdapter = {
  platform: 'deepseek',

  matches(url: URL): boolean {
    return url.hostname === 'chat.deepseek.com'
  },

  findTargets(root: ParentNode): AdapterTarget[] {
    const conversation = findConversationRoot(root) ?? (root instanceof Document ? root.body : null)
    if (!conversation) return []

    const targets: AdapterTarget[] = []
    const messages = Array.from(conversation.querySelectorAll<HTMLElement>(MESSAGE))
    messages.forEach((message, index) => {
      if (!isElementConnected(message)) return
      if (!isAssistantMessage(message)) return
      if (!findPairedUser(message, conversation)) return

      const key = localKeyFor(message, index)
      targets.push({
        responseElement: message,
        mountPoint: message,
        localKey: key,
      })
    })
    return targets
  },

  isStreaming(target: AdapterTarget): boolean {
    const root = target.responseElement.ownerDocument ?? document
    if (!generationIsActive(root)) return false
    const conversation = findConversationRoot(target.responseElement) ?? root
    const assistants = Array.from(conversation.querySelectorAll<HTMLElement>(MESSAGE)).filter(
      isAssistantMessage,
    )
    const last = assistants.at(-1)
    return last === target.responseElement
  },

  extract(target: AdapterTarget, pageUrl: URL): CaptureDraft {
    const conversation = findConversationRoot(target.responseElement)
    const user = conversation ? findPairedUser(target.responseElement, conversation) : null
    if (!conversation || !user) {
      throw new ChatStashError('PAIR_NOT_FOUND', 'DeepSeek response has no valid user prompt')
    }

    const userMarkdown = convertElementToMarkdown(stripNoise(userBody(user)))
    const assistantMarkdown = convertElementToMarkdown(
      stripNoise(assistantBody(target.responseElement)),
    )
    if (!userMarkdown || !assistantMarkdown) {
      throw new ChatStashError('INVALID_CAPTURE', 'DeepSeek response produced empty content')
    }

    const sourceUrl = pageUrl.toString()
    const sourceConversationId = conversationIdFromUrl(pageUrl)
    const item = target.responseElement.closest(`[${ITEM_KEY}]`)
    const sourceMessageId = item?.getAttribute(ITEM_KEY) ?? target.localKey

    return {
      platform: 'deepseek',
      sourceUrl,
      sourceConversationId,
      sourceMessageId,
      title: titleFromUser(user),
      messages: [
        { role: 'user', contentMarkdown: userMarkdown },
        { role: 'assistant', contentMarkdown: assistantMarkdown },
      ],
    }
  },

  healthCheck(document: Document): AdapterDiagnostic[] {
    const diagnostics: AdapterDiagnostic[] = []
    const primaryRoot = document.querySelector(PRIMARY_ROOT)
    const fallbackRoot = document.querySelector(FALLBACK_ROOT)

    if (!primaryRoot && !fallbackRoot) {
      diagnostics.push({
        capability: 'conversation-root',
        tier: 'invalid',
        message: 'DeepSeek conversation root missing',
      })
    } else {
      diagnostics.push({
        capability: 'conversation-root',
        tier: primaryRoot ? 'primary' : 'fallback',
        message: primaryRoot ? 'found .ds-virtual-list' : 'found hashed virtual-list fallback',
      })
    }

    const messages = Array.from(document.querySelectorAll<HTMLElement>(MESSAGE))
    const assistants = messages.filter(isAssistantMessage)
    const primaryCount = assistants.filter(usedPrimaryAssistant).length
    if (assistants.length === 0) {
      diagnostics.push({
        capability: 'assistant-targets',
        tier: 'invalid',
        message: 'no assistant messages found',
      })
    } else {
      diagnostics.push({
        capability: 'assistant-targets',
        tier: primaryCount > 0 ? 'primary' : 'fallback',
        message: `found ${assistants.length} assistant message(s) (${primaryCount} primary)`,
      })
    }

    return diagnostics
  },
}
