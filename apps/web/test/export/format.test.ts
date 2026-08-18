import { describe, expect, test } from 'vitest'

import { formatConversationMarkdown, safeExportFilename } from '@/features/export/format'

const snapshot = {
  title: '闭包用途',
  sourcePlatform: 'deepseek' as const,
  sourceUrl: 'https://chat.deepseek.com/a/chat/s/abc',
  savedAt: '2026-01-01T00:00:00.000Z',
  sourceConversationId: null as string | null,
  sourceMessageId: '2',
  messages: [
    { role: 'user' as const, contentMarkdown: '闭包有什么实际用途' },
    {
      role: 'assistant' as const,
      contentMarkdown: '```js\nconst n = 1\n```\n\n| Use | Why |\n| --- | --- |\n| cache | keep |',
    },
  ],
}

describe('markdown export formatter', () => {
  test('emits deterministic metadata and verbatim bodies', () => {
    const markdown = formatConversationMarkdown(snapshot)
    expect(markdown).toBe(
      [
        '# 闭包用途',
        '',
        'Source: DeepSeek',
        'URL: https://chat.deepseek.com/a/chat/s/abc',
        'Saved: 2026-01-01T00:00:00.000Z',
        'Message: 2',
        '',
        '## User',
        '',
        '闭包有什么实际用途',
        '',
        '## Assistant',
        '',
        '```js\nconst n = 1\n```\n\n| Use | Why |\n| --- | --- |\n| cache | keep |',
        '',
      ].join('\n'),
    )
    expect(markdown.endsWith('\n')).toBe(true)
    expect(markdown).not.toContain('null')
  })

  test('omits optional identifiers when absent', () => {
    const markdown = formatConversationMarkdown({
      ...snapshot,
      sourceMessageId: null,
    })
    expect(markdown).not.toContain('Message:')
    expect(markdown).not.toContain('Conversation:')
  })
})

describe('safe export filename', () => {
  test('strips path characters and reserved names', () => {
    expect(safeExportFilename('a/b:c*d')).toBe('a-b-c-d.md')
    expect(safeExportFilename('CON')).toBe('chatstash-CON.md')
    expect(safeExportFilename('...')).toBe('chatstash-export.md')
    expect(safeExportFilename('')).toBe('chatstash-export.md')
  })
})
