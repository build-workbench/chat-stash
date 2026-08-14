// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { beforeEach, describe, expect, test } from 'vitest'

import { SYNTHETIC_HOST, syntheticAdapter } from '../../src/platforms/synthetic'
import { clearAdapters, matchAdapter, registerAdapter } from '../../src/registry'

function loadFixture(name: string): Document {
  const html = readFileSync(
    join(__dirname, '..', '..', 'fixtures', 'synthetic', `${name}.html`),
    'utf8',
  )
  return new DOMParser().parseFromString(html, 'text/html')
}

function urlFor(path = '/c/synthetic-1'): URL {
  return new URL(`https://${SYNTHETIC_HOST}${path}`)
}

describe('synthetic adapter URL matching', () => {
  test('matches the synthetic host', () => {
    expect(syntheticAdapter.matches(urlFor())).toBe(true)
  })

  test('rejects other hosts', () => {
    expect(syntheticAdapter.matches(new URL('https://chatgpt.com/c/1'))).toBe(false)
    expect(syntheticAdapter.matches(new URL('https://evil.com/'))).toBe(false)
  })
})

describe('registry', () => {
  beforeEach(() => {
    clearAdapters()
  })

  test('matchAdapter selects the registered adapter for its URL', () => {
    registerAdapter(syntheticAdapter)
    expect(matchAdapter(urlFor())).toBe(syntheticAdapter)
    expect(matchAdapter(new URL('https://chatgpt.com/c/1'))).toBeUndefined()
  })

  test('unsupported pages match no adapter', () => {
    registerAdapter(syntheticAdapter)
    expect(matchAdapter(new URL('https://example.com/'))).toBeUndefined()
  })
})

describe('synthetic adapter target discovery', () => {
  test('discovers each paired assistant response as a target', () => {
    const doc = loadFixture('basic')
    const targets = syntheticAdapter.findTargets(doc)
    expect(targets).toHaveLength(2)
    expect(targets[0].localKey).toBe('a1')
    expect(targets[1].localKey).toBe('a2')
  })

  test('fails closed for an assistant without a preceding user turn', () => {
    const doc = loadFixture('invalid')
    const targets = syntheticAdapter.findTargets(doc)
    // a1 is orphaned; only a2 (paired with u1) is a valid target.
    expect(targets).toHaveLength(1)
    expect(targets[0].localKey).toBe('a2')
  })

  test('ignores disconnected targets', () => {
    const doc = loadFixture('basic')
    const target = doc.querySelector('[data-chatstash-turn="assistant"]') as HTMLElement
    target.remove()
    const targets = syntheticAdapter.findTargets(doc)
    expect(targets).toHaveLength(1)
  })
})

describe('synthetic adapter streaming', () => {
  test('reports streaming responses', () => {
    const doc = loadFixture('streaming')
    const [target] = syntheticAdapter.findTargets(doc)
    expect(syntheticAdapter.isStreaming(target)).toBe(true)
  })

  test('reports completed responses as not streaming', () => {
    const doc = loadFixture('basic')
    const targets = syntheticAdapter.findTargets(doc)
    expect(syntheticAdapter.isStreaming(targets[0])).toBe(false)
  })

  test('treats a completed response as streamable again after the indicator clears', () => {
    const doc = loadFixture('streaming')
    const [target] = syntheticAdapter.findTargets(doc)
    target.responseElement.dataset.chatstashState = 'complete'
    target.responseElement.querySelector('[data-chatstash-streaming-indicator]')?.remove()
    expect(syntheticAdapter.isStreaming(target)).toBe(false)
  })
})

describe('synthetic adapter extraction', () => {
  test('extracts a paired user/assistant snapshot', () => {
    const doc = loadFixture('basic')
    const [target] = syntheticAdapter.findTargets(doc)
    const draft = syntheticAdapter.extract(target, urlFor())

    expect(draft.platform).toBe('chatgpt')
    expect(draft.sourceUrl).toBe('https://chatgpt.com/c/synthetic-conv-basic')
    expect(draft.sourceConversationId).toBe('synthetic-conv-basic')
    expect(draft.sourceMessageId).toBe('a1')
    expect(draft.title).toBe('Synthetic basic chat')
    expect(draft.messages).toHaveLength(2)
    expect(draft.messages[0].role).toBe('user')
    expect(draft.messages[0].contentMarkdown).toContain('test-driven development')
    expect(draft.messages[1].role).toBe('assistant')
    expect(draft.messages[1].contentMarkdown).toContain('TDD')
    expect(draft.messages[1].contentMarkdown).toContain('add(1, 2)')
  })

  test('pairs an earlier response with its own user prompt', () => {
    const doc = loadFixture('multi-turn')
    const targets = syntheticAdapter.findTargets(doc)
    const first = syntheticAdapter.extract(targets[0], urlFor())
    expect(first.messages[0].contentMarkdown).toContain('What is a closure')
    expect(first.messages[1].contentMarkdown).toContain('lexical scope')

    const third = syntheticAdapter.extract(targets[2], urlFor())
    expect(third.messages[0].contentMarkdown).toContain('Why does it preserve n')
    expect(third.messages[1].contentMarkdown).toContain('closes over n')
  })

  test('falls back to the page URL when source-url is missing', () => {
    const doc = loadFixture('multi-turn')
    const main = doc.querySelector('main') as HTMLElement
    main.removeAttribute('data-chatstash-source-url')
    const [target] = syntheticAdapter.findTargets(doc)
    const draft = syntheticAdapter.extract(target, urlFor('/c/page-url-1'))
    expect(draft.sourceUrl).toBe(`https://${SYNTHETIC_HOST}/c/page-url-1`)
  })

  test('derives the title from the user prompt when absent', () => {
    const doc = loadFixture('multi-turn')
    const main = doc.querySelector('main') as HTMLElement
    main.removeAttribute('data-chatstash-title')
    const [target] = syntheticAdapter.findTargets(doc)
    const draft = syntheticAdapter.extract(target, urlFor())
    expect(draft.title).toContain('What is a closure')
  })

  test('throws PAIR_NOT_FOUND for an orphaned response', () => {
    const doc = loadFixture('invalid')
    const orphan = doc.querySelector('[data-chatstash-message-id="a1"]') as HTMLElement
    const target = {
      responseElement: orphan,
      mountPoint: orphan,
      localKey: 'a1',
    }
    expect(() => syntheticAdapter.extract(target, urlFor())).toThrowError(
      expect.objectContaining({ code: 'PAIR_NOT_FOUND' }),
    )
  })
})

describe('synthetic adapter health check', () => {
  test('reports valid structure', () => {
    const doc = loadFixture('basic')
    const diagnostics = syntheticAdapter.healthCheck(doc)
    expect(diagnostics.some((d) => d.tier === 'invalid')).toBe(false)
    expect(diagnostics.length).toBeGreaterThan(0)
    expect(diagnostics.some((d) => d.capability === 'turns')).toBe(true)
  })

  test('reports a missing conversation root as invalid', () => {
    const doc = loadFixture('basic')
    doc.querySelector('main')?.remove()
    const diagnostics = syntheticAdapter.healthCheck(doc)
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ capability: 'conversation-root', tier: 'invalid' }),
    )
  })
})
