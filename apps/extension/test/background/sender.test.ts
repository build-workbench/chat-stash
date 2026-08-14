import { beforeEach, describe, expect, test, vi } from 'vitest'

import { hostMatchesPlatform, isPopupSender, isSupportedContentSender } from '@/messaging/sender'

beforeEach(() => {
  vi.stubGlobal('chrome', { runtime: { id: 'test-ext-id' } })
})

function sender(overrides: Record<string, unknown> = {}) {
  return { id: 'test-ext-id', ...overrides } as chrome.runtime.MessageSender
}

describe('isPopupSender', () => {
  test('accepts this extension popup page', () => {
    expect(isPopupSender(sender({ url: 'chrome-extension://test-ext-id/popup.html' }))).toEqual({
      ok: true,
    })
  })

  test('rejects a sender attached to a tab', () => {
    expect(isPopupSender(sender({ tab: { id: 1 } }))).toEqual({
      ok: false,
      reason: 'expected-popup-sender',
    })
  })

  test('rejects another extension', () => {
    expect(isPopupSender(sender({ id: 'other-ext' }))).toEqual({
      ok: false,
      reason: 'unknown-extension-sender',
    })
  })
})

describe('isSupportedContentSender', () => {
  test('accepts a top-frame content script on a supported host', () => {
    expect(
      isSupportedContentSender(
        sender({ frameId: 0, url: 'https://chatgpt.com/c/123', tab: { id: 7 } }),
      ),
    ).toEqual({ ok: true })
  })

  test('rejects an iframe (frameId > 0)', () => {
    expect(
      isSupportedContentSender(
        sender({ frameId: 1, url: 'https://chatgpt.com/c/123', tab: { id: 7 } }),
      ),
    ).toEqual({ ok: false, reason: 'not-top-frame' })
  })

  test('rejects an unsupported host', () => {
    expect(
      isSupportedContentSender(sender({ frameId: 0, url: 'https://evil.com/', tab: { id: 7 } })),
    ).toEqual({ ok: false, reason: 'unsupported-host' })
  })

  test('rejects a popup pretending to be content', () => {
    expect(
      isSupportedContentSender(sender({ frameId: 0, url: 'https://chatgpt.com/c/123' })),
    ).toEqual({
      ok: false,
      reason: 'expected-content-sender',
    })
  })

  test('rejects another extension', () => {
    expect(
      isSupportedContentSender(
        sender({ id: 'other-ext', frameId: 0, url: 'https://chatgpt.com/c/123', tab: { id: 7 } }),
      ),
    ).toEqual({ ok: false, reason: 'unknown-extension-sender' })
  })

  test('rejects a malformed sender URL', () => {
    expect(
      isSupportedContentSender(sender({ frameId: 0, url: 'not-a-url', tab: { id: 7 } })),
    ).toEqual({ ok: false, reason: 'invalid-sender-url' })
  })

  test('narrows to a single platform host', () => {
    const s = sender({ frameId: 0, url: 'https://chat.deepseek.com/', tab: { id: 7 } })
    expect(isSupportedContentSender(s, 'chatgpt')).toEqual({
      ok: false,
      reason: 'unsupported-host',
    })
    expect(isSupportedContentSender(s, 'deepseek')).toEqual({ ok: true })
  })
})

describe('hostMatchesPlatform', () => {
  test('matches the platform allowlist', () => {
    expect(hostMatchesPlatform('https://chatgpt.com/c/1', 'chatgpt')).toBe(true)
    expect(hostMatchesPlatform('https://chat.deepseek.com/a/chat/s/1', 'deepseek')).toBe(true)
    expect(hostMatchesPlatform('https://evil.com/', 'chatgpt')).toBe(false)
  })

  test('rejects an invalid URL', () => {
    expect(hostMatchesPlatform('not-a-url', 'chatgpt')).toBe(false)
  })
})
