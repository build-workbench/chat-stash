'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { conversationIdSchema } from '@/lib/validation/conversations'
import { moveConversationSchema, tagAttachSchema, uuidSchema } from '@/lib/validation/organization'

function fail(code: string): never {
  redirect(`/conversations?error=${encodeURIComponent(code)}`)
}

async function requireClient() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) redirect('/sign-in')
  return { supabase, userId: data.user.id }
}

export async function deleteConversation(formData: FormData): Promise<void> {
  const parsed = conversationIdSchema.safeParse(formData.get('id'))
  if (!parsed.success) fail('NOT_FOUND')

  const { supabase } = await requireClient()
  const { data, error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', parsed.data)
    .select('id')
  if (error) fail('NETWORK_ERROR')
  if (!data || data.length === 0) fail('NOT_FOUND')

  revalidatePath('/conversations')
  redirect('/conversations')
}

export async function moveConversation(formData: FormData): Promise<void> {
  const parsed = moveConversationSchema.safeParse({
    conversationId: formData.get('conversationId'),
    folderId: formData.get('folderId') || null,
  })
  if (!parsed.success) fail('NOT_FOUND')

  const { supabase } = await requireClient()
  const { data, error } = await supabase
    .from('conversations')
    .update({ folder_id: parsed.data.folderId })
    .eq('id', parsed.data.conversationId)
    .select('id')
  if (error) fail('NETWORK_ERROR')
  if (!data || data.length === 0) fail('NOT_FOUND')

  revalidatePath('/conversations')
  revalidatePath(`/conversations/${parsed.data.conversationId}`)
}

export async function attachTag(formData: FormData): Promise<void> {
  const parsed = tagAttachSchema.safeParse({
    conversationId: formData.get('conversationId'),
    tagId: formData.get('tagId'),
  })
  if (!parsed.success) fail('NOT_FOUND')

  const { supabase, userId } = await requireClient()
  const { error } = await supabase.from('conversation_tags').upsert(
    {
      user_id: userId,
      conversation_id: parsed.data.conversationId,
      tag_id: parsed.data.tagId,
    },
    { onConflict: 'user_id,conversation_id,tag_id', ignoreDuplicates: true },
  )
  if (error) fail('NETWORK_ERROR')
  revalidatePath(`/conversations/${parsed.data.conversationId}`)
}

export async function detachTag(formData: FormData): Promise<void> {
  const conversationId = uuidSchema.safeParse(formData.get('conversationId'))
  const tagId = uuidSchema.safeParse(formData.get('tagId'))
  if (!conversationId.success || !tagId.success) fail('NOT_FOUND')

  const { supabase } = await requireClient()
  const { error } = await supabase
    .from('conversation_tags')
    .delete()
    .eq('conversation_id', conversationId.data)
    .eq('tag_id', tagId.data)
  if (error) fail('NETWORK_ERROR')
  revalidatePath(`/conversations/${conversationId.data}`)
}
