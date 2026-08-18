import { LIMITS } from '@chatstash/shared'
import { decodeSearchCursor, encodeSearchCursor } from '@/lib/cursors'
import { createClient } from '@/lib/supabase/server'
import { searchQuerySchema } from '@/lib/validation/search'
import type { ConversationSummary, QueryResult } from '@/features/conversations/types'

export async function searchConversations(input: {
  query: string
  folderId?: string | null
  tagId?: string | null
  cursor?: string
  limit?: number
}): Promise<QueryResult<{ items: ConversationSummary[]; nextCursor: string | null }>> {
  const parsed = searchQuerySchema.safeParse(input.query)
  if (!parsed.success) return { ok: true, data: { items: [], nextCursor: null } }

  const supabase = await createClient()
  const { data: user, error: authError } = await supabase.auth.getUser()
  if (authError || !user.user) return { ok: false, error: 'AUTH_EXPIRED' }

  const cursor = decodeSearchCursor(input.cursor)
  const limit = input.limit ?? LIMITS.pageSize.default

  const { data, error } = await supabase.rpc('search_conversations_v1', {
    p_query: parsed.data,
    p_folder_id: input.folderId ?? undefined,
    p_tag_id: input.tagId ?? undefined,
    p_after_rank: cursor?.rank,
    p_after_saved_at: cursor?.savedAt,
    p_after_id: cursor?.id,
    p_limit: limit + 1,
  })

  if (error) return { ok: false, error: 'SEARCH_FAILED' }

  const page = data ?? []
  const hasMore = page.length > limit
  const slice = hasMore ? page.slice(0, limit) : page
  const last = slice.at(-1)
  const nextCursor =
    hasMore && last
      ? encodeSearchCursor({ rank: last.rank, savedAt: last.saved_at, id: last.conversation_id })
      : null

  return {
    ok: true,
    data: {
      items: slice.map((row) => ({
        id: row.conversation_id,
        title: row.title,
        sourcePlatform: row.source_platform,
        sourceUrl: row.source_url,
        folderId: row.folder_id || null,
        savedAt: row.saved_at,
        tagNames: [],
      })),
      nextCursor,
    },
  }
}
