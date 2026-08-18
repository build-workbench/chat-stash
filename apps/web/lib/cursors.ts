import {
  listCursorSchema,
  searchCursorSchema,
  type ListCursor,
  type SearchCursor,
} from '@chatstash/shared'

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url')
}

function decodeJson(raw: string): unknown {
  return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
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
