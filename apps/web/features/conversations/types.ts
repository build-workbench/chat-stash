export type QueryError = 'AUTH_EXPIRED' | 'NOT_FOUND' | 'NETWORK_ERROR' | 'SEARCH_FAILED'

export type QueryResult<T> = { ok: true; data: T } | { ok: false; error: QueryError }

export type ConversationSummary = {
  id: string
  title: string
  sourcePlatform: 'chatgpt' | 'deepseek'
  sourceUrl: string
  folderId: string | null
  savedAt: string
  tagNames: string[]
}

export type ConversationDetail = ConversationSummary & {
  sourceConversationId: string | null
  sourceMessageId: string | null
  folderName: string | null
  tags: { id: string; name: string }[]
  messages: { role: 'user' | 'assistant'; contentMarkdown: string; position: number }[]
}

export type FolderRow = {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
}

export type TagRow = {
  id: string
  name: string
}
