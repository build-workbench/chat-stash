import {
  isChatStashError,
  parseCaptureDraft,
  saveCaptureResponseSchema,
  type ErrorCode,
  type SaveCaptureRequest,
  type SaveCaptureResponse,
} from '@chatstash/shared'

import { getSupabaseClient } from '@/auth/supabase-client'
import { hostMatchesPlatform, isSupportedContentSender } from '@/messaging/sender'

export type SaveResult =
  { ok: true; data: SaveCaptureResponse } | { ok: false; error: ErrorCode; message?: string }

/**
 * `save-capture` handler. Validates the sender, the shared schema, the
 * platform/source-URL consistency and the Extension session, then calls the
 * `save_capture_v1` RPC and maps its outcome to stable codes.
 */
export async function saveCapture(
  request: SaveCaptureRequest,
  sender: chrome.runtime.MessageSender,
): Promise<SaveResult> {
  // 1. Sender must be this extension's top-level content script on a supported host.
  const senderCheck = isSupportedContentSender(sender)
  if (!senderCheck.ok) {
    return { ok: false, error: 'UNSUPPORTED_PAGE', message: senderCheck.reason }
  }

  // 2. Re-run the shared schema, canonical URL and total byte limit.
  let draft
  try {
    draft = parseCaptureDraft(request.draft)
  } catch (err) {
    const code: ErrorCode = isChatStashError(err) ? err.code : 'INVALID_CAPTURE'
    return { ok: false, error: code, message: undefined }
  }

  // 3. Sender URL, payload platform and payload source URL must agree.
  const senderUrl = sender.url ?? sender.tab?.url
  if (!senderUrl || !hostMatchesPlatform(senderUrl, draft.platform)) {
    return { ok: false, error: 'INVALID_SOURCE_URL', message: 'sender URL does not match platform' }
  }

  // 4. Restore/refresh the Extension session; getUser() validates remotely.
  const supabase = getSupabaseClient()
  const { data: user, error: userError } = await supabase.auth.getUser()
  if (userError || !user.user) {
    return { ok: false, error: 'AUTH_REQUIRED', message: undefined }
  }

  // 5. Persist via the versioned RPC; the database dedupes and owns atomicity.
  try {
    const { data, error } = await supabase.rpc('save_capture_v1', {
      p_source_platform: draft.platform,
      p_source_url: draft.sourceUrl,
      p_title: draft.title,
      p_user_markdown: draft.messages[0].contentMarkdown,
      p_assistant_markdown: draft.messages[1].contentMarkdown,
      p_source_conversation_id: draft.sourceConversationId ?? null,
      p_source_message_id: draft.sourceMessageId ?? null,
    })

    if (error) {
      return { ok: false, error: mapRpcError(error), message: undefined }
    }

    const row = data?.[0]
    if (!row) return { ok: false, error: 'SAVE_FAILED' }

    const response = saveCaptureResponseSchema.safeParse({
      outcome: row.outcome,
      conversationId: row.conversation_id,
    })
    if (!response.success) return { ok: false, error: 'SAVE_FAILED' }

    return { ok: true, data: response.data }
  } catch {
    return { ok: false, error: 'NETWORK_ERROR', message: undefined }
  }
}

function mapRpcError(error: { message: string; code?: string; details?: string }): ErrorCode {
  // Prefer structured code over substring matching; fall back to message for
  // PostgREST/RLS permission errors that surface as plain text.
  const text = `${error.code ?? ''} ${error.message ?? ''} ${error.details ?? ''}`
  if (
    text.includes('AUTH_REQUIRED') ||
    text.includes('permission denied') ||
    error.code === '42501'
  ) {
    return 'AUTH_EXPIRED'
  }
  if (text.includes('INVALID_')) return 'INVALID_CAPTURE'
  return 'SAVE_FAILED'
}
