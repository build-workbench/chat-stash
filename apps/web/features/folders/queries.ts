import { createClient } from '@/lib/supabase/server'
import type { FolderRow, QueryResult, TagRow } from '@/features/conversations/types'

async function requireUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { ok: false as const, error: 'AUTH_EXPIRED' as const }
  return { ok: true as const, supabase }
}

export async function listFolders(): Promise<QueryResult<FolderRow[]>> {
  const auth = await requireUser()
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('folders')
    .select('id, name, parent_id, sort_order')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { ok: false, error: 'NETWORK_ERROR' }
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      sortOrder: row.sort_order,
    })),
  }
}

export async function listTags(): Promise<QueryResult<TagRow[]>> {
  const auth = await requireUser()
  if (!auth.ok) return auth

  const { data, error } = await auth.supabase
    .from('tags')
    .select('id, name')
    .order('name_normalized', { ascending: true })

  if (error) return { ok: false, error: 'NETWORK_ERROR' }
  return { ok: true, data: (data ?? []).map((row) => ({ id: row.id, name: row.name })) }
}
