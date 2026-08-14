import { ChatStashError } from '@chatstash/shared'
import type { CaptureDraft } from '@chatstash/shared'

import { isElementConnected } from '../dom/validate'
import { convertElementToMarkdown, extractReadableText } from '../markdown/convert'
import type { AdapterDiagnostic, AdapterTarget, SiteAdapter } from '../types'

/**
 * Development/test-only adapter over the repository-owned synthetic fixture
 * DOM. It simulates a ChatGPT conversation so the full content runtime,
 * save-control state machine and background save path can be exercised
 * end-to-end without touching real AI pages. Never registered in production.
 */
export const SYNTHETIC_HOST = 'synthetic.chatstash.test'

const CONVERSATION_SELECTOR = '[data-chatstash-conversation]'
const TURN_SELECTOR = '[data-chatstash-turn]'
const ASSISTANT_SELECTOR = '[data-chatstash-turn="assistant"]'
const USER_SELECTOR = '[data-chatstash-turn="user"]'
const BODY_SELECTOR = '[data-chatstash-body]'

function findConversationRoot(node: HTMLElement): HTMLElement | null {
  return node.closest<HTMLElement>(CONVERSATION_SELECTOR)
}

function findPairedUserTurn(assistant: HTMLElement): HTMLElement | null {
  const conversation = findConversationRoot(assistant)
  if (!conversation) return null

  let candidate: HTMLElement | null = null
  for (const turn of Array.from(conversation.querySelectorAll<HTMLElement>(USER_SELECTOR))) {
    if (turn.compareDocumentPosition(assistant) & Node.DOCUMENT_POSITION_FOLLOWING) {
      candidate = turn
    }
  }
  return candidate
}

function contentRoot(turn: HTMLElement): HTMLElement {
  return turn.querySelector<HTMLElement>(BODY_SELECTOR) ?? turn
}

function localKeyFor(turn: HTMLElement): string {
  return turn.dataset.chatstashMessageId ?? turn.getAttribute('id') ?? ''
}

export const syntheticAdapter: SiteAdapter = {
  platform: 'chatgpt',

  matches(url: URL): boolean {
    return url.hostname === SYNTHETIC_HOST
  },

  findTargets(root: ParentNode): AdapterTarget[] {
    const targets: AdapterTarget[] = []
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(ASSISTANT_SELECTOR))) {
      if (!isElementConnected(element)) continue
      // Fail closed: an assistant response without a preceding user prompt is not saveable.
      if (!findPairedUserTurn(element)) continue

      const key = localKeyFor(element)
      if (key === '') continue

      targets.push({ responseElement: element, mountPoint: element, localKey: key })
    }
    return targets
  },

  isStreaming(target: AdapterTarget): boolean {
    return (
      target.responseElement.dataset.chatstashState === 'streaming' ||
      target.responseElement.querySelector('[data-chatstash-streaming-indicator]') !== null
    )
  },

  extract(target: AdapterTarget, pageUrl: URL): CaptureDraft {
    const conversation = findConversationRoot(target.responseElement)
    const user = findPairedUserTurn(target.responseElement)
    if (!conversation || !user) {
      throw new ChatStashError('PAIR_NOT_FOUND', 'Synthetic response has no valid user prompt')
    }

    const sourceUrl = conversation.dataset.chatstashSourceUrl ?? pageUrl.toString()
    const fallbackTitle = extractReadableText(contentRoot(user)).slice(0, 100)
    const title =
      conversation.dataset.chatstashTitle?.trim() || fallbackTitle || 'Saved conversation'

    const userMarkdown = convertElementToMarkdown(contentRoot(user))
    const assistantMarkdown = convertElementToMarkdown(contentRoot(target.responseElement))

    if (!userMarkdown || !assistantMarkdown) {
      throw new ChatStashError('INVALID_CAPTURE', 'Synthetic response produced empty content')
    }

    return {
      platform: 'chatgpt',
      sourceUrl,
      sourceConversationId: conversation.dataset.chatstashConversation ?? null,
      sourceMessageId: target.responseElement.dataset.chatstashMessageId ?? null,
      title,
      messages: [
        { role: 'user', contentMarkdown: userMarkdown },
        { role: 'assistant', contentMarkdown: assistantMarkdown },
      ],
    }
  },

  healthCheck(document: Document): AdapterDiagnostic[] {
    const diagnostics: AdapterDiagnostic[] = []

    if (!document.querySelector(CONVERSATION_SELECTOR)) {
      diagnostics.push({
        capability: 'conversation-root',
        tier: 'invalid',
        message: 'synthetic conversation root missing',
      })
    }

    const turnCount = document.querySelectorAll(TURN_SELECTOR).length
    if (turnCount === 0) {
      diagnostics.push({ capability: 'turns', tier: 'invalid', message: 'no turns found' })
    } else {
      const assistantCount = document.querySelectorAll(ASSISTANT_SELECTOR).length
      diagnostics.push({
        capability: 'turns',
        tier: assistantCount > 0 ? 'primary' : 'fallback',
        message: `found ${turnCount} turns (${assistantCount} assistant)`,
      })
    }

    return diagnostics
  },
}
