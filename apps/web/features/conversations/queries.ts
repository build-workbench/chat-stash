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

  // Use versioned RPC to avoid client-side IN + max_rows truncation and to
  // keep folder/tag + keyset pagination atomic on the server.
  const { data, error } = await auth.supabase.rpc('list_conversations_v1', {
    p_folder_id: input.folderId ?? undefined,
    p_tag_id: input.tagId ?? undefined,
    p_after_saved_at: cursor?.savedAt ?? undefined,
    p_after_id: cursor?.id ?? undefined,
    p_limit: limit + 1,
  })

  if (error) return { ok: false, error: 'NETWORK_ERROR' }

  const page = (data ?? []) as unknown as {
    conversation_id: string
    title: string
    source_platform: 'chatgpt' | 'deepseek'
    source_url: string
    folder_id: string | null
    saved_at: string
  }[]
  const hasMore = page.length > limit
  const slice = hasMore ? page.slice(0, limit) : page
  const last = slice.at(-1)
  const nextCursor =
    hasMore && last ? encodeListCursor({ savedAt: last.saved_at, id: last.conversation_id }) : null

  const tagNames = await loadTagNames(
    auth.supabase,
    slice.map((row) => row.conversation_id),
  )

  return {
    ok: true,
    data: {
      items: slice.map((row) => ({
        id: row.conversation_id,
        title: row.title,
        sourcePlatform: row.source_platform,
        sourceUrl: row.source_url,
        folderId: row.folder_id,
        savedAt: row.saved_at,
        tagNames: tagNames.get(row.conversation_id) ?? [],
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

  const [messages, folderName, joins] = await Promise.all([
    auth.supabase
      .from('messages')
      .select('role, content_markdown, position')
      .eq('conversation_id', data.id)
      .order('position', { ascending: true }),
    data.folder_id
      ? auth.supabase.from('folders').select('name').eq('id', data.folder_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null, error: null }),
    auth.supabase.from('conversation_tags').select('tag_id').eq('conversation_id', data.id),
  ])

  if (messages.error) return { ok: false, error: 'NETWORK_ERROR' }
  if (joins.error) return { ok: false, error: 'NETWORK_ERROR' }

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
