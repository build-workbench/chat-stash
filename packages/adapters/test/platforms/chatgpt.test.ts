// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, test } from 'vitest'

import { chatgptAdapter } from '../../src/platforms/chatgpt'
import { deepseekAdapter } from '../../src/platforms/deepseek'
import { clearAdapters, matchAdapter, registerAdapter } from '../../src/registry'

function loadFixture(name: string): Document {
  const html = readFileSync(
    join(__dirname, '..', '..', 'fixtures', 'chatgpt', `${name}.html`),
    'utf8',
  )
  return new DOMParser().parseFromString(html, 'text/html')
}

function urlFor(id = 'synthetic-conv-basic'): URL {
  return new URL(`https://chatgpt.com/c/${id}`)
}

describe('chatgpt adapter URL matching', () => {
  test('matches chatgpt.com conversation URLs', () => {
    expect(chatgptAdapter.matches(urlFor())).toBe(true)
  })

  test('rejects other hosts', () => {
    expect(chatgptAdapter.matches(new URL('https://chat.deepseek.com/a/chat/s/1'))).toBe(false)
  })
})

describe('chatgpt registry', () => {
  beforeEach(() => {
    clearAdapters()
  })

  test('does not steal DeepSeek URLs when both adapters are registered', () => {
    registerAdapter(chatgptAdapter)
    registerAdapter(deepseekAdapter)
    expect(matchAdapter(urlFor())).toBe(chatgptAdapter)
    expect(matchAdapter(new URL('https://chat.deepseek.com/a/chat/s/1'))).toBe(deepseekAdapter)
  })
})

describe('chatgpt target discovery', () => {
  test('discovers each paired assistant response', () => {
    const targets = chatgptAdapter.findTargets(loadFixture('basic'))
    expect(targets).toHaveLength(2)
    expect(targets[0].localKey).toBe('chatgpt:asst-1')
    expect(targets[1].localKey).toBe('chatgpt:asst-2')
  })

  test('fails closed for an orphaned regenerate output', () => {
    const targets = chatgptAdapter.findTargets(loadFixture('invalid'))
    expect(targets).toHaveLength(1)
    expect(targets[0].localKey).toBe('chatgpt:asst-ok')
  })

  test('uses data-turn fallback when role attributes are missing', () => {
    const targets = chatgptAdapter.findTargets(loadFixture('fallback'))
    expect(targets).toHaveLength(1)
  })

  test('saves only the currently visible branch pair', () => {
    const targets = chatgptAdapter.findTargets(loadFixture('branch'))
    expect(targets).toHaveLength(1)
    expect(targets[0].localKey).toBe('chatgpt:asst-current')
  })
})

describe('chatgpt streaming', () => {
  test('reports streaming responses', () => {
    const [target] = chatgptAdapter.findTargets(loadFixture('streaming'))
    expect(chatgptAdapter.isStreaming(target)).toBe(true)
  })

  test('reports completed responses as not streaming', () => {
    const [target] = chatgptAdapter.findTargets(loadFixture('basic'))
    expect(chatgptAdapter.isStreaming(target)).toBe(false)
  })
})

describe('chatgpt extraction', () => {
  test('extracts a paired snapshot', () => {
    const [target] = chatgptAdapter.findTargets(loadFixture('basic'))
    const draft = chatgptAdapter.extract(target, urlFor())
    expect(draft.platform).toBe('chatgpt')
    expect(draft.sourceConversationId).toBe('synthetic-conv-basic')
    expect(draft.sourceMessageId).toBe('asst-1')
    expect(draft.messages[0].contentMarkdown).toContain('test-driven development')
    expect(draft.messages[1].contentMarkdown).toContain('TDD')
    expect(draft.messages[1].contentMarkdown).toContain('add(a, b)')
  })

  test('pairs an earlier response with its own prompt', () => {
    const targets = chatgptAdapter.findTargets(loadFixture('multi-turn'))
    const first = chatgptAdapter.extract(targets[0], urlFor())
    expect(first.messages[0].contentMarkdown).toContain('What is a closure')
    const last = chatgptAdapter.extract(targets[2], urlFor())
    expect(last.messages[0].contentMarkdown).toContain('Give one more example')
  })

  test('throws PAIR_NOT_FOUND for an orphaned response', () => {
    const doc = loadFixture('invalid')
    const orphan = doc.querySelector('[data-message-id="asst-orphan"]') as HTMLElement
    expect(() =>
      chatgptAdapter.extract(
        { responseElement: orphan, mountPoint: orphan, localKey: 'chatgpt:asst-orphan' },
        urlFor(),
      ),
    ).toThrowError(expect.objectContaining({ code: 'PAIR_NOT_FOUND' }))
  })
})

describe('chatgpt health check', () => {
  test('reports primary structure', () => {
    const diagnostics = chatgptAdapter.healthCheck(loadFixture('basic'))
    expect(diagnostics.some((d) => d.tier === 'invalid')).toBe(false)
  })

  test('reports fallback when role attributes are missing', () => {
    const diagnostics = chatgptAdapter.healthCheck(loadFixture('fallback'))
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'assistant-targets', tier: 'fallback' }),
    )
  })
})
