// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { clearAdapters, registerAdapter, syntheticAdapter } from '@chatstash/adapters'
import { beforeEach, describe, expect, test } from 'vitest'

import { ensureDevAdapters } from '@/content/dev-adapters'
import { isSupportedPage, resolveAdapter } from '@/content/runtime'

function loadFixture(name: string): Document {
  const html = readFileSync(
    resolve('../../packages/adapters/fixtures/synthetic', `${name}.html`),
    'utf8',
  )
  return new DOMParser().parseFromString(html, 'text/html')
}

function syntheticUrl(path = '/c/1'): URL {
  return new URL(`https://synthetic.chatstash.test${path}`)
}

function makeTurn(role: 'user' | 'assistant', id: string, state?: string): HTMLElement {
  const turn = document.createElement('article')
  turn.dataset.chatstashTurn = role
  turn.dataset.chatstashMessageId = id
  if (state) turn.dataset.chatstashState = state
  const body = document.createElement('div')
  body.dataset.chatstashBody = ''
  body.innerHTML = `<p>${role} content ${id}</p>`
  turn.append(body)
  return turn
}

beforeEach(() => {
  clearAdapters()
  document.body.innerHTML = ''
})

describe('content runtime adapter resolution', () => {
  test('resolves the synthetic adapter for its host', () => {
    registerAdapter(syntheticAdapter)
    expect(resolveAdapter(syntheticUrl())).toBe(syntheticAdapter)
    expect(isSupportedPage(syntheticUrl())).toBe(true)
  })

  test('unsupported pages resolve to no adapter', () => {
    registerAdapter(syntheticAdapter)
    expect(resolveAdapter(new URL('https://example.com/'))).toBeUndefined()
    expect(isSupportedPage(new URL('https://example.com/'))).toBe(false)
  })

  test('resolveAdapter tracks URL changes (SPA navigation)', () => {
    registerAdapter(syntheticAdapter)
    const before = resolveAdapter(syntheticUrl('/c/one'))
    const after = resolveAdapter(syntheticUrl('/c/two'))
    expect(before).toBe(syntheticAdapter)
    expect(after).toBe(syntheticAdapter)
  })
})

describe('content runtime discovery', () => {
  test('discovers every paired assistant target', () => {
    registerAdapter(syntheticAdapter)
    document.body.innerHTML = loadFixture('basic').body.innerHTML
    const targets = syntheticAdapter.findTargets(document)
    expect(targets).toHaveLength(2)
  })

  test('appended responses become discoverable targets', () => {
    registerAdapter(syntheticAdapter)
    const main = document.createElement('main')
    main.dataset.chatstashConversation = 'conv'
    main.dataset.chatstashSourceUrl = 'https://chatgpt.com/c/conv'
    document.body.append(main)
    main.append(makeTurn('user', 'u1'), makeTurn('assistant', 'a1', 'complete'))

    let targets = syntheticAdapter.findTargets(main)
    expect(targets).toHaveLength(1)

    // The SPA appends another turn.
    main.append(makeTurn('user', 'u2'), makeTurn('assistant', 'a2', 'complete'))
    targets = syntheticAdapter.findTargets(main)
    expect(targets).toHaveLength(2)
    expect(targets.map((t) => t.localKey)).toEqual(['a1', 'a2'])
  })

  test('a replaced response node yields one fresh target, no stale target', () => {
    registerAdapter(syntheticAdapter)
    const main = document.createElement('main')
    main.dataset.chatstashConversation = 'conv'
    main.dataset.chatstashSourceUrl = 'https://chatgpt.com/c/conv'
    document.body.append(main)
    const user = makeTurn('user', 'u1')
    const oldAssistant = makeTurn('assistant', 'a-old', 'complete')
    main.append(user, oldAssistant)

    const before = syntheticAdapter.findTargets(main)
    expect(before).toHaveLength(1)
    expect(before[0].responseElement).toBe(oldAssistant)

    // The host replaces the assistant node entirely.
    const newAssistant = makeTurn('assistant', 'a-new', 'complete')
    oldAssistant.replaceWith(newAssistant)

    const after = syntheticAdapter.findTargets(main)
    expect(after).toHaveLength(1)
    expect(after[0].responseElement).toBe(newAssistant)
    expect(after[0].localKey).toBe('a-new')
  })

  test('no duplicate targets for the same element', () => {
    registerAdapter(syntheticAdapter)
    document.body.innerHTML = loadFixture('multi-turn').body.innerHTML
    const targets = syntheticAdapter.findTargets(document)
    const keys = targets.map((t) => t.localKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  test('removed targets disappear from discovery', () => {
    registerAdapter(syntheticAdapter)
    document.body.innerHTML = loadFixture('basic').body.innerHTML
    const assistant = document.querySelector('[data-chatstash-message-id="a1"]')
    assistant?.remove()
    const targets = syntheticAdapter.findTargets(document)
    expect(targets.map((t) => t.localKey)).toEqual(['a2'])
  })
})

describe('dev adapters registration', () => {
  test('registers the synthetic adapter when the env flag is set', () => {
    process.env.PLASMO_PUBLIC_ENABLE_SYNTHETIC = 'true'
    ensureDevAdapters()
    expect(resolveAdapter(syntheticUrl())).toBe(syntheticAdapter)
  })

  test('does not register the synthetic adapter in production', () => {
    process.env.PLASMO_PUBLIC_ENABLE_SYNTHETIC = ''
    ensureDevAdapters()
    expect(resolveAdapter(syntheticUrl())).toBeUndefined()
  })
})
