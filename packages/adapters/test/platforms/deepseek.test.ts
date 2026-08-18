// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, test } from 'vitest'

import { deepseekAdapter } from '../../src/platforms/deepseek'
import { clearAdapters, matchAdapter, registerAdapter } from '../../src/registry'

function loadFixture(name: string): Document {
  const html = readFileSync(
    join(__dirname, '..', '..', 'fixtures', 'deepseek', `${name}.html`),
    'utf8',
  )
  return new DOMParser().parseFromString(html, 'text/html')
}

function urlFor(id = '02f4e67d-2c37-45d7-804f-7f4ab13cf6cd'): URL {
  return new URL(`https://chat.deepseek.com/a/chat/s/${id}`)
}

describe('deepseek adapter URL matching', () => {
  test('matches DeepSeek conversation URLs', () => {
    expect(deepseekAdapter.matches(urlFor())).toBe(true)
    expect(deepseekAdapter.matches(new URL('https://chat.deepseek.com/'))).toBe(true)
  })

  test('rejects other hosts', () => {
    expect(deepseekAdapter.matches(new URL('https://chatgpt.com/c/1'))).toBe(false)
    expect(deepseekAdapter.matches(new URL('https://evil.com/'))).toBe(false)
  })
})

describe('deepseek registry selection', () => {
  beforeEach(() => {
    clearAdapters()
  })

  test('matchAdapter selects DeepSeek for its origin', () => {
    registerAdapter(deepseekAdapter)
    expect(matchAdapter(urlFor())).toBe(deepseekAdapter)
    expect(matchAdapter(new URL('https://chatgpt.com/c/1'))).toBeUndefined()
  })
})

describe('deepseek target discovery', () => {
  test('discovers the paired assistant on a basic completed chat', () => {
    const doc = loadFixture('basic-1')
    const targets = deepseekAdapter.findTargets(doc)
    expect(targets).toHaveLength(1)
    expect(targets[0].localKey).toBe('deepseek:2')
    expect(
      targets[0].responseElement.querySelector('.ds-assistant-message-main-content'),
    ).not.toBeNull()
  })

  test('fails closed for an assistant without a preceding user turn', () => {
    const doc = loadFixture('invalid')
    expect(deepseekAdapter.findTargets(doc)).toHaveLength(0)
  })

  test('skips the orphaned earlier assistant in a virtualized multi-turn list', () => {
    const doc = loadFixture('multi-turn')
    const targets = deepseekAdapter.findTargets(doc)
    expect(targets).toHaveLength(1)
    expect(targets[0].localKey).toBe('deepseek:6')
  })

  test('uses markdown fallback when the primary assistant class is missing', () => {
    const doc = loadFixture('fallback')
    const targets = deepseekAdapter.findTargets(doc)
    expect(targets).toHaveLength(1)
    expect(
      targets[0].responseElement.querySelector('.ds-assistant-message-main-content'),
    ).toBeNull()
    expect(targets[0].responseElement.querySelector('.ds-markdown')).not.toBeNull()
  })
})

describe('deepseek streaming', () => {
  test('reports the in-progress last assistant as streaming', () => {
    const doc = loadFixture('streaming')
    const [target] = deepseekAdapter.findTargets(doc)
    expect(target).toBeDefined()
    expect(deepseekAdapter.isStreaming(target)).toBe(true)
  })

  test('reports completed responses as not streaming', () => {
    const doc = loadFixture('basic-1')
    const [target] = deepseekAdapter.findTargets(doc)
    expect(deepseekAdapter.isStreaming(target)).toBe(false)
  })

  test('treats a response as complete after generation signals clear', () => {
    const doc = loadFixture('streaming')
    const [target] = deepseekAdapter.findTargets(doc)
    doc.querySelector('.ds-button--stop')?.remove()
    doc.querySelector('.ds-streaming-cursor')?.remove()
    expect(deepseekAdapter.isStreaming(target)).toBe(false)
  })
})

describe('deepseek extraction', () => {
  test('extracts a paired snapshot from a live sanitized fixture', () => {
    const doc = loadFixture('basic-1')
    const [target] = deepseekAdapter.findTargets(doc)
    const draft = deepseekAdapter.extract(target, urlFor())

    expect(draft.platform).toBe('deepseek')
    expect(draft.sourceUrl).toContain('chat.deepseek.com')
    expect(draft.sourceConversationId).toBe('02f4e67d-2c37-45d7-804f-7f4ab13cf6cd')
    expect(draft.sourceMessageId).toBe('2')
    expect(draft.messages).toHaveLength(2)
    expect(draft.messages[0].role).toBe('user')
    expect(draft.messages[0].contentMarkdown).toContain('雨霏')
    expect(draft.messages[1].role).toBe('assistant')
    expect(draft.messages[1].contentMarkdown).toContain('诗经')
    expect(draft.messages[1].contentMarkdown).not.toContain('复制')
  })

  test('pairs the visible later turn in a virtualized multi-turn chat', () => {
    const doc = loadFixture('multi-turn')
    const [target] = deepseekAdapter.findTargets(doc)
    const draft = deepseekAdapter.extract(target, urlFor('dcc38f20-7b87-4da8-a2a2-66f211e30e17'))
    expect(draft.messages[0].contentMarkdown).toContain('闭包')
    expect(draft.messages[1].contentMarkdown).toContain('实际用途')
  })

  test('extracts tables from fallback markdown', () => {
    const doc = loadFixture('fallback')
    const [target] = deepseekAdapter.findTargets(doc)
    const draft = deepseekAdapter.extract(target, urlFor('fallback-fixture'))
    expect(draft.messages[1].contentMarkdown).toContain('|')
    expect(draft.messages[1].contentMarkdown).toContain('let')
  })

  test('extracts code without copy-control chrome', () => {
    const doc = loadFixture('code-rich-1')
    const [target] = deepseekAdapter.findTargets(doc)
    const draft = deepseekAdapter.extract(target, urlFor())
    expect(draft.messages[1].contentMarkdown).toContain('```')
    expect(draft.messages[1].contentMarkdown).not.toContain('复制')
    expect(draft.messages[1].contentMarkdown).not.toContain('下载')
  })

  test('throws PAIR_NOT_FOUND for an orphaned response', () => {
    const doc = loadFixture('invalid')
    const orphan = doc.querySelector('.ds-message') as HTMLElement
    expect(() =>
      deepseekAdapter.extract(
        { responseElement: orphan, mountPoint: orphan, localKey: 'deepseek:4' },
        urlFor(),
      ),
    ).toThrowError(expect.objectContaining({ code: 'PAIR_NOT_FOUND' }))
  })
})

describe('deepseek health check', () => {
  test('reports primary structure on a live fixture', () => {
    const diagnostics = deepseekAdapter.healthCheck(loadFixture('basic-1'))
    expect(diagnostics.some((d) => d.tier === 'invalid')).toBe(false)
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'conversation-root', tier: 'primary' }),
    )
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'assistant-targets', tier: 'primary' }),
    )
  })

  test('reports fallback when the primary assistant class is absent', () => {
    const diagnostics = deepseekAdapter.healthCheck(loadFixture('fallback'))
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'assistant-targets', tier: 'fallback' }),
    )
  })

  test('reports a missing conversation root as invalid', () => {
    const doc = loadFixture('basic-1')
    doc.querySelector('.ds-virtual-list')?.remove()
    const diagnostics = deepseekAdapter.healthCheck(doc)
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'conversation-root', tier: 'invalid' }),
    )
  })
})
