import { describe, expect, test } from 'vitest'

import { conversationListHref } from '@/features/conversations/href'

describe('conversationListHref', () => {
  test('returns the unfiltered All Saves path', () => {
    expect(conversationListHref({})).toBe('/conversations')
  })

  test('combines folder, tag, search, and cursor', () => {
    expect(
      conversationListHref({
        folderId: 'folder-1',
        tagId: 'tag-1',
        query: '  closure  ',
        cursor: 'abc',
      }),
    ).toBe('/conversations?folder=folder-1&tag=tag-1&q=closure&cursor=abc')
  })

  test('drops one-character queries instead of searching', () => {
    expect(conversationListHref({ query: 'a' })).toBe('/conversations')
  })
})
