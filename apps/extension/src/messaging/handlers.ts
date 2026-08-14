import {
  authStatusRequestSchema,
  saveCaptureRequestSchema,
  signInRequestSchema,
  signOutRequestSchema,
  type ErrorCode,
} from '@chatstash/shared'

import { saveCapture } from '@/capture/save'
import { getAuthStatus, signInWithPassword, signOut } from '@/auth/session'
import { isPopupSender } from './sender'

export type HandlerResult =
  { ok: true; data: unknown } | { ok: false; error: ErrorCode; message?: string }

/**
 * The finite set of message handlers. There is no generic fetch proxy and no
 * `externally_connectable` declaration; each handler re-checks its sender.
 */
export async function handleMessage(
  message: unknown,
  sender: chrome.runtime.MessageSender,
): Promise<HandlerResult> {
  if (!isRecord(message) || typeof message.type !== 'string') {
    return { ok: false, error: 'INVALID_CAPTURE', message: 'malformed message' }
  }

  switch (message.type) {
    case 'auth-status': {
      const parsed = authStatusRequestSchema.safeParse(message)
      if (!parsed.success)
        return { ok: false, error: 'INVALID_CAPTURE', message: 'invalid auth-status' }
      const popup = isPopupSender(sender)
      if (!popup.ok) return { ok: false, error: 'AUTH_REQUIRED', message: popup.reason }
      return { ok: true, data: await getAuthStatus() }
    }

    case 'sign-in': {
      const parsed = signInRequestSchema.safeParse(message)
      if (!parsed.success)
        return { ok: false, error: 'INVALID_CAPTURE', message: 'invalid sign-in' }
      const popup = isPopupSender(sender)
      if (!popup.ok) return { ok: false, error: 'INVALID_CREDENTIALS', message: popup.reason }
      const result = await signInWithPassword(parsed.data.email, parsed.data.password)
      if ('error' in result) return { ok: false, error: result.error, message: undefined }
      return { ok: true, data: result }
    }

    case 'sign-out': {
      const parsed = signOutRequestSchema.safeParse(message)
      if (!parsed.success)
        return { ok: false, error: 'INVALID_CAPTURE', message: 'invalid sign-out' }
      const popup = isPopupSender(sender)
      if (!popup.ok) return { ok: false, error: 'AUTH_REQUIRED', message: popup.reason }
      await signOut()
      return { ok: true, data: { authenticated: false } }
    }

    case 'save-capture': {
      const parsed = saveCaptureRequestSchema.safeParse(message)
      if (!parsed.success)
        return { ok: false, error: 'INVALID_CAPTURE', message: 'invalid save-capture' }
      return await saveCapture(parsed.data, sender)
    }

    default:
      return { ok: false, error: 'INVALID_CAPTURE', message: 'unknown operation' }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
