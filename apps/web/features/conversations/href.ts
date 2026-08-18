import { LIMITS } from '@chatstash/shared'

export function conversationListHref(input: {
  folderId?: string
  tagId?: string
  query?: string
  cursor?: string
}): string {
  const params = new URLSearchParams()
  if (input.folderId) params.set('folder', input.folderId)
  if (input.tagId) params.set('tag', input.tagId)
  const query = input.query?.trim() ?? ''
  if (query.length >= LIMITS.searchQuery.min) {
    params.set('q', query.slice(0, LIMITS.searchQuery.max))
  }
  if (input.cursor) params.set('cursor', input.cursor)
  const encoded = params.toString()
  return encoded ? `/conversations?${encoded}` : '/conversations'
}
