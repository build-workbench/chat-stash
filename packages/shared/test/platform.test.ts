import { describe, expect, test } from 'vitest'

import { ChatStashError, canonicalizeSourceUrl } from '../src'

describe('canonicalizeSourceUrl', () => {
  test('removes query params, fragment, and credentials', () => {
    expect(
      canonicalizeSourceUrl('https://user:pass@chatgpt.com/c/abc?utm_source=x#frag', 'chatgpt'),
    ).toBe('https://chatgpt.com/c/abc')
  })

  test('rejects http, unsupported hosts, and non-default ports', () => {
    expect(() => canonicalizeSourceUrl('http://chatgpt.com/c/abc', 'chatgpt')).toThrow(
      ChatStashError,
    )
    expect(() => canonicalizeSourceUrl('https://example.com/c/abc', 'chatgpt')).toThrow(
      ChatStashError,
    )
    expect(() => canonicalizeSourceUrl('https://chatgpt.com:8443/c/abc', 'chatgpt')).toThrow(
      ChatStashError,
    )
  })

  test('accepts an already canonical URL and preserves the path', () => {
    expect(canonicalizeSourceUrl('https://chat.deepseek.com/a/chat', 'deepseek')).toBe(
      'https://chat.deepseek.com/a/chat',
    )
  })
})
