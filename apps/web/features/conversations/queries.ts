import { LIMITS } from '@chatstash/shared'
import { decodeListCursor, encodeListCursor } from '@/lib/cursors'
import { createClient } from '@/lib/supabase/server'
import { conversationIdSchema } from '@/lib/validation/conversations'
import type { ConversationDetail, ConversationSummary, QueryResult } from './types'

async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { ok: false as const, error: 'AUTH_EXPIRED' as const, supabase }
  return { ok: true as const, user: data.user, supabase }
}

export async function listConversations(input: {
  folderId?: string | null
  tagId?: string | null
  cursor?: string
  limit?: number
}): Promise<QueryResult<{ items: ConversationSummary[]; nextCursor: string | null }>> {
  const auth = await requireUser()
  if (!auth.ok) return auth

  const limit = input.limit ?? LIMITS.pageSize.default
  const cursor = decodeListCursor(input.cursor)

  let query = auth.supabase
    .from('conversations')
    .select('id, title, source_platform, source_url, folder_id, saved_at')
    .order('saved_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1)

  if (input.folderId) query = query.eq('folder_id', input.folderId)
  if (cursor) {
    query = query.or(
      `saved_at.lt.${cursor.savedAt},and(saved_at.eq.${cursor.savedAt},id.lt.${cursor.id})`,
    )
  }

  if (input.tagId) {
    const tagged = await auth.supabase
      .from('conversation_tags')
      .select('conversation_id')
      .eq('tag_id', input.tagId)
    if (tagged.error) return { ok: false, error: 'NETWORK_ERROR' }
    const ids = (tagged.data ?? []).map((row) => row.conversation_id)
    if (ids.length === 0) return { ok: true, data: { items: [], nextCursor: null } }
    query = query.in('id', ids)
  }

  const { data, error } = await query
  if (error) return { ok: false, error: 'NETWORK_ERROR' }

  const page = data ?? []
  const hasMore = page.length > limit
  const slice = hasMore ? page.slice(0, limit) : page
  const last = slice.at(-1)
  const nextCursor =
    hasMore && last ? encodeListCursor({ savedAt: last.saved_at, id: last.id }) : null

  const tagNames = await loadTagNames(
    auth.supabase,
    slice.map((row) => row.id),
  )

  return {
    ok: true,
    data: {
      items: slice.map((row) => ({
        id: row.id,
        title: row.title,
        sourcePlatform: row.source_platform,
        sourceUrl: row.source_url,
        folderId: row.folder_id,
        savedAt: row.saved_at,
        tagNames: tagNames.get(row.id) ?? [],
      })),
      nextCursor,
    },
  }
}

export async function getConversation(id: string): Promise<QueryResult<ConversationDetail>> {
  const parsed = conversationIdSchema.safeParse(id)
  if (!parsed.success) return { ok: false, error: 'NOT_FOUND' }

  const auth = await requireUser()
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('conversations')
    .select(
      'id, title, source_platform, source_url, source_conversation_id, source_message_id, folder_id, saved_at',
    )
    .eq('id', parsed.data)
    .maybeSingle()

  if (error) return { ok: false, error: 'NETWORK_ERROR' }
  if (!data) return { ok: false, error: 'NOT_FOUND' }

  const messages = await auth.supabase
    .from('messages')
    .select('role, content_markdown, position')
    .eq('conversation_id', data.id)
    .order('position', { ascending: true })

  if (messages.error) return { ok: false, error: 'NETWORK_ERROR' }

  const folderName = data.folder_id
    ? await auth.supabase.from('folders').select('name').eq('id', data.folder_id).maybeSingle()
    : { data: null, error: null }

  const joins = await auth.supabase
    .from('conversation_tags')
    .select('tag_id')
    .eq('conversation_id', data.id)

  const tagIds = (joins.data ?? []).map((row) => row.tag_id)
  const tagRows =
    tagIds.length === 0
      ? { data: [] as { id: string; name: string }[], error: null }
      : await auth.supabase.from('tags').select('id, name').in('id', tagIds)

  if (tagRows.error) return { ok: false, error: 'NETWORK_ERROR' }
  const tags = tagRows.data ?? []

  return {
    ok: true,
    data: {
      id: data.id,
      title: data.title,
      sourcePlatform: data.source_platform,
      sourceUrl: data.source_url,
      sourceConversationId: data.source_conversation_id,
      sourceMessageId: data.source_message_id,
      folderId: data.folder_id,
      folderName: folderName.data?.name ?? null,
      savedAt: data.saved_at,
      tagNames: tags.map((tag) => tag.name),
      tags,
      messages: (messages.data ?? []).map((message) => ({
        role: message.role,
        contentMarkdown: message.content_markdown,
        position: message.position,
      })),
    },
  }
}

async function loadTagNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationIds: string[],
): Promise<Map<string, string[]>> {
  const names = new Map<string, string[]>()
  if (conversationIds.length === 0) return names

  const { data } = await supabase
    .from('conversation_tags')
    .select('conversation_id, tag_id')
    .in('conversation_id', conversationIds)

  const tagIds = [...new Set((data ?? []).map((row) => row.tag_id))]
  if (tagIds.length === 0) return names

  const tags = await supabase.from('tags').select('id, name').in('id', tagIds)
  const byId = new Map((tags.data ?? []).map((tag) => [tag.id, tag.name]))

  for (const row of data ?? []) {
    const name = byId.get(row.tag_id)
    if (!name) continue
    const list = names.get(row.conversation_id) ?? []
    list.push(name)
    names.set(row.conversation_id, list)
  }
  return names
}
