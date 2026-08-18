'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  createFolderSchema,
  folderNameSchema,
  reparentFolderSchema,
  tagNameSchema,
  uuidSchema,
} from '@/lib/validation/organization'

function fail(code: string): never {
  redirect(`/conversations?error=${encodeURIComponent(code)}`)
}

async function requireClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/sign-in')
  return { supabase, userId: data.user.id }
}

function mapPostgrestError(message: string | undefined): string {
  const text = message ?? ''
  if (text.includes('FOLDER_CYCLE')) return 'FOLDER_CYCLE'
  if (text.includes('FOLDER_NAME_CONFLICT') || text.includes('folders_unique'))
    return 'FOLDER_NAME_CONFLICT'
  if (text.includes('tags_unique') || text.includes('TAG_NAME_CONFLICT')) return 'TAG_NAME_CONFLICT'
  return 'NETWORK_ERROR'
}

export async function createFolder(formData: FormData): Promise<void> {
  const parsed = createFolderSchema.safeParse({
    name: formData.get('name'),
    parentId: formData.get('parentId') || null,
  })
  if (!parsed.success) fail('INVALID_CAPTURE')

  const { supabase, userId } = await requireClient()
  const { error } = await supabase.from('folders').insert({
    user_id: userId,
    name: parsed.data.name,
    parent_id: parsed.data.parentId ?? null,
  })
  if (error) fail(mapPostgrestError(error.message))
  revalidatePath('/conversations')
}

export async function renameFolder(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(formData.get('id'))
  const name = folderNameSchema.safeParse(formData.get('name'))
  if (!parsed.success || !name.success) fail('INVALID_CAPTURE')

  const { supabase } = await requireClient()
  const { data, error } = await supabase
    .from('folders')
    .update({ name: name.data })
    .eq('id', parsed.data)
    .select('id')
  if (error) fail(mapPostgrestError(error.message))
  if (!data || data.length === 0) fail('NOT_FOUND')
  revalidatePath('/conversations')
}

export async function reparentFolder(formData: FormData): Promise<void> {
  const parsed = reparentFolderSchema.safeParse({
    id: formData.get('id'),
    parentId: formData.get('parentId') || null,
  })
  if (!parsed.success) fail('INVALID_CAPTURE')

  const { supabase } = await requireClient()
  const { data, error } = await supabase
    .from('folders')
    .update({ parent_id: parsed.data.parentId })
    .eq('id', parsed.data.id)
    .select('id')
  if (error) fail(mapPostgrestError(error.message))
  if (!data || data.length === 0) fail('NOT_FOUND')
  revalidatePath('/conversations')
}

export async function deleteFolder(formData: FormData): Promise<void> {
  const parsed = uuidSchema.safeParse(formData.get('id'))
  if (!parsed.success) fail('NOT_FOUND')

  const { supabase } = await requireClient()
  const { error } = await supabase.rpc('delete_folder_v1', { p_folder_id: parsed.data })
  if (error) fail(mapPostgrestError(error.message))
  revalidatePath('/conversations')
  redirect('/conversations')
}

export async function createTag(formData: FormData): Promise<void> {
  const name = tagNameSchema.safeParse(formData.get('name'))
  if (!name.success) fail('INVALID_CAPTURE')

  const { supabase, userId } = await requireClient()
  const { error } = await supabase.from('tags').insert({ user_id: userId, name: name.data })
  if (error) fail(mapPostgrestError(error.message))
  revalidatePath('/conversations')
}

export async function renameTag(formData: FormData): Promise<void> {
  const id = uuidSchema.safeParse(formData.get('id'))
  const name = tagNameSchema.safeParse(formData.get('name'))
  if (!id.success || !name.success) fail('INVALID_CAPTURE')

  const { supabase } = await requireClient()
  const { data, error } = await supabase
    .from('tags')
    .update({ name: name.data })
    .eq('id', id.data)
    .select('id')
  if (error) fail(mapPostgrestError(error.message))
  if (!data || data.length === 0) fail('NOT_FOUND')
  revalidatePath('/conversations')
}

export async function deleteTag(formData: FormData): Promise<void> {
  const id = uuidSchema.safeParse(formData.get('id'))
  if (!id.success) fail('NOT_FOUND')

  const { supabase } = await requireClient()
  const { data, error } = await supabase.from('tags').delete().eq('id', id.data).select('id')
  if (error) fail('NETWORK_ERROR')
  if (!data || data.length === 0) fail('NOT_FOUND')
  revalidatePath('/conversations')
}
