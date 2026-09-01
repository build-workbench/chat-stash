import {
  listCursorSchema,
  searchCursorSchema,
  type ListCursor,
  type SearchCursor,
} from '@chatstash/shared'

function encodeJson(value: unknown): string {
  const json = JSON.stringify(value)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function decodeJson(raw: string): unknown {
  let base64 = raw.replace(/-/g, '+').replace(/_/g, '/')
  const pad = base64.length % 4
  if (pad) base64 += '='.repeat(4 - pad)
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}

export function encodeListCursor(cursor: ListCursor): string {
  return encodeJson(cursor)
}

export function decodeListCursor(raw: string | undefined): ListCursor | null {
  if (!raw) return null
  try {
    const parsed = listCursorSchema.safeParse(decodeJson(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export function encodeSearchCursor(cursor: SearchCursor): string {
  return encodeJson(cursor)
}

export function decodeSearchCursor(raw: string | undefined): SearchCursor | null {
  if (!raw) return null
  try {
    const parsed = searchCursorSchema.safeParse(decodeJson(raw))
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}
