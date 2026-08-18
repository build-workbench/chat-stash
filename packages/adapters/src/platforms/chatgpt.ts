import { ChatStashError } from '@chatstash/shared'
import type { CaptureDraft } from '@chatstash/shared'

import { isElementConnected } from '../dom/validate'
import { convertElementToMarkdown, extractReadableText } from '../markdown/convert'
import type { AdapterDiagnostic, AdapterTarget, SiteAdapter } from '../types'

/**
 * ChatGPT (chatgpt.com) adapter.
 *
 * Selector table (public DOM contract; live smoke still required):
 *
 * | Capability        | Primary                                      | Fallback                         | Validation                         |
 * |-------------------|----------------------------------------------|----------------------------------|------------------------------------|
 * | Conversation root | `main`                                       | `[role="main"]`                  | contains at least one turn         |
 * | Assistant target  | `[data-message-author-role="assistant"]`     | `article[data-turn="assistant"]` | connected; has extractable body    |
 * | User prompt       | `[data-message-author-role="user"]`          | `article[data-turn="user"]`      | nearest preceding in document order|
 * | Mount point       | the assistant element                        | wrapping article                 | 1:1 with target                    |
 * | Streaming         | `[data-testid="stop-button"]`                | `[aria-label*="Stop streaming"]` / `.result-streaming` | last assistant only |
 * | Message id        | `[data-message-id]`                          | article test id                  | non-empty                          |
 *
 * Regenerated / branched DOM: only the currently visible assistant node is a
 * target. Ambiguous pairing (assistant with no preceding user) fails closed.
 */

const PRIMARY_ASSISTANT = '[data-message-author-role="assistant"]'
const FALLBACK_ASSISTANT = 'article[data-turn="assistant"]'
const PRIMARY_USER = '[data-message-author-role="user"]'
const FALLBACK_USER = 'article[data-turn="user"]'
const STREAMING = '[data-testid="stop-button"], [aria-label*="Stop streaming"], .result-streaming'

function conversationRoot(node: ParentNode | HTMLElement): HTMLElement | null {
  if (node instanceof HTMLElement) {
    const closest = node.closest('main') ?? node.closest('[role="main"]')
    if (closest) return closest
  }
  return node.querySelector('main') ?? node.querySelector('[role="main"]')
}

function isAssistant(el: HTMLElement): boolean {
  return (
    el.matches(PRIMARY_ASSISTANT) ||
    el.matches(FALLBACK_ASSISTANT) ||
    el.getAttribute('data-message-author-role') === 'assistant' ||
    el.getAttribute('data-turn') === 'assistant'
  )
}

function isUser(el: HTMLElement): boolean {
  return (
    el.matches(PRIMARY_USER) ||
    el.matches(FALLBACK_USER) ||
    el.getAttribute('data-message-author-role') === 'user' ||
    el.getAttribute('data-turn') === 'user'
  )
}

function turnElements(root: ParentNode): HTMLElement[] {
  const primary = Array.from(root.querySelectorAll<HTMLElement>('[data-message-author-role]'))
  if (primary.length > 0) return primary
  return Array.from(root.querySelectorAll<HTMLElement>('article[data-turn]'))
}

function findPairedUser(assistant: HTMLElement, root: ParentNode): HTMLElement | null {
  const turns = turnElements(root)
  const index = turns.indexOf(assistant)
  if (index < 0) return null
  for (let i = index - 1; i >= 0; i -= 1) {
    if (isUser(turns[i])) return turns[i]
  }
  return null
}

function localKeyFor(el: HTMLElement): string {
  const id =
    el.getAttribute('data-message-id')?.trim() ||
    el.querySelector('[data-message-id]')?.getAttribute('data-message-id')?.trim() ||
    el.closest('[data-testid]')?.getAttribute('data-testid')?.trim() ||
    ''
  return id === '' ? '' : `chatgpt:${id}`
}

function bodyOf(el: HTMLElement): HTMLElement {
  return (
    el.querySelector<HTMLElement>('.markdown') ??
    el.querySelector<HTMLElement>('.whitespace-pre-wrap') ??
    el
  )
}

function conversationIdFromUrl(url: URL): string | null {
  const match = url.pathname.match(/\/c\/([^/]+)/)
  const id = match?.[1]?.trim()
  return id && id.length > 0 ? id : null
}

function titleFromUser(user: HTMLElement): string {
  const text = extractReadableText(bodyOf(user)).replace(/\s+/g, ' ').trim()
  if (text === '') return 'ChatGPT conversation'
  return text.length <= 240 ? text : text.slice(0, 240)
}

export const chatgptAdapter: SiteAdapter = {
  platform: 'chatgpt',

  matches(url: URL): boolean {
    return url.hostname === 'chatgpt.com'
  },

  findTargets(root: ParentNode): AdapterTarget[] {
    const conversation = conversationRoot(root) ?? (root instanceof Document ? root.body : null)
    if (!conversation) return []

    const targets: AdapterTarget[] = []
    for (const element of turnElements(conversation)) {
      if (!isElementConnected(element)) continue
      if (!isAssistant(element)) continue
      if (!findPairedUser(element, conversation)) continue
      const key = localKeyFor(element)
      if (key === '') continue
      targets.push({ responseElement: element, mountPoint: element, localKey: key })
    }
    return targets
  },

  isStreaming(target: AdapterTarget): boolean {
    const root = target.responseElement.ownerDocument ?? document
    if (root.querySelector(STREAMING) === null) return false
    const conversation = conversationRoot(target.responseElement) ?? root
    const assistants = turnElements(conversation).filter(isAssistant)
    return assistants.at(-1) === target.responseElement
  },

  extract(target: AdapterTarget, pageUrl: URL): CaptureDraft {
    const conversation = conversationRoot(target.responseElement)
    const user = conversation ? findPairedUser(target.responseElement, conversation) : null
    if (!conversation || !user) {
      throw new ChatStashError('PAIR_NOT_FOUND', 'ChatGPT response has no valid user prompt')
    }

    const userMarkdown = convertElementToMarkdown(bodyOf(user))
    const assistantMarkdown = convertElementToMarkdown(bodyOf(target.responseElement))
    if (!userMarkdown || !assistantMarkdown) {
      throw new ChatStashError('INVALID_CAPTURE', 'ChatGPT response produced empty content')
    }

    const sourceMessageId =
      target.responseElement.getAttribute('data-message-id') ??
      target.responseElement.querySelector('[data-message-id]')?.getAttribute('data-message-id') ??
      null

    return {
      platform: 'chatgpt',
      sourceUrl: pageUrl.toString(),
      sourceConversationId: conversationIdFromUrl(pageUrl),
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
    const root = document.querySelector('main') ?? document.querySelector('[role="main"]')
    if (!root) {
      diagnostics.push({
        capability: 'conversation-root',
        tier: 'invalid',
        message: 'ChatGPT conversation root missing',
      })
    } else {
      diagnostics.push({
        capability: 'conversation-root',
        tier: 'primary',
        message: 'found main',
      })
    }

    const primary = document.querySelectorAll(PRIMARY_ASSISTANT).length
    const fallback = document.querySelectorAll(FALLBACK_ASSISTANT).length
    if (primary === 0 && fallback === 0) {
      diagnostics.push({
        capability: 'assistant-targets',
        tier: 'invalid',
        message: 'no assistant turns found',
      })
    } else {
      diagnostics.push({
        capability: 'assistant-targets',
        tier: primary > 0 ? 'primary' : 'fallback',
        message: `found ${primary || fallback} assistant turn(s)`,
      })
    }

    return diagnostics
  },
}
