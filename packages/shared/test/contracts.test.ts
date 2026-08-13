import { describe, expect, test } from 'vitest'

import { ChatStashError, parseCaptureDraft, searchRequestSchema } from '../src'

const baseCapture = {
  platform: 'chatgpt',
  sourceUrl: 'https://chatgpt.com/c/abc?utm_source=x#frag',
  sourceConversationId: 'conv-1',
  sourceMessageId: 'msg-1',
  title: 'Title',
  messages: [
    { role: 'user', contentMarkdown: 'Prompt' },
    { role: 'assistant', contentMarkdown: 'Response' },
  ],
} as const

describe('capture contracts', () => {
  test('canonicalizes the source URL during parsing', () => {
    const draft = parseCaptureDraft(baseCapture)
    expect(draft.sourceUrl).toBe('https://chatgpt.com/c/abc')
  })

  test('rejects server-owned fields in a capture draft', () => {
    for (const key of ['user_id', 'dedupe_key', 'id', 'saved_at']) {
      expect(() => parseCaptureDraft({ ...baseCapture, [key]: 'value' })).toThrow()
    }
  })

  test('preserves Unicode content', () => {
    const draft = parseCaptureDraft({
      ...baseCapture,
      title: '中国历史',
      messages: [
        { role: 'user', contentMarkdown: '什么是明朝？' },
        { role: 'assistant', contentMarkdown: '明朝是中国的一个朝代。' },
      ],
    })
    expect(draft.title).toBe('中国历史')
    expect(draft.messages[1].contentMarkdown).toBe('明朝是中国的一个朝代。')
  })

  test('supports content-based fallback when source message id is absent', () => {
    const capture = {
      platform: baseCapture.platform,
      sourceUrl: baseCapture.sourceUrl,
      sourceConversationId: baseCapture.sourceConversationId,
      title: baseCapture.title,
      messages: baseCapture.messages,
    }
    expect(() => parseCaptureDraft(capture)).not.toThrow()
  })

  test('rejects oversized capture payloads', () => {
    expect(() =>
      parseCaptureDraft({
        ...baseCapture,
        messages: [
          { role: 'user', contentMarkdown: '汉'.repeat(400_000) },
          { role: 'assistant', contentMarkdown: '汉'.repeat(400_000) },
        ],
      }),
    ).toThrow(ChatStashError)
  })
})

describe('search contracts', () => {
  test('applies limits and defaults', () => {
    expect(searchRequestSchema.parse({ query: 'react' }).limit).toBe(30)
    expect(searchRequestSchema.safeParse({ query: 'a' }).success).toBe(false)
    expect(searchRequestSchema.safeParse({ query: 'react', limit: 101 }).success).toBe(false)
  })
})
