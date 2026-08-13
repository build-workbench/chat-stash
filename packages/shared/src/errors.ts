export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'AUTH_EXPIRED',
  'INVALID_CREDENTIALS',
  'UNSUPPORTED_PAGE',
  'TARGET_NOT_FOUND',
  'PAIR_NOT_FOUND',
  'RESPONSE_STREAMING',
  'INVALID_CAPTURE',
  'PAYLOAD_TOO_LARGE',
  'INVALID_SOURCE_URL',
  'DUPLICATE_CAPTURE',
  'FOLDER_NAME_CONFLICT',
  'TAG_NAME_CONFLICT',
  'FOLDER_CYCLE',
  'NETWORK_ERROR',
  'SERVICE_UNAVAILABLE',
  'NOT_FOUND',
  'SAVE_FAILED',
  'SEARCH_FAILED',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export class ChatStashError extends Error {
  readonly code: ErrorCode

  constructor(code: ErrorCode, message: string) {
    super(message)
    this.name = 'ChatStashError'
    this.code = code
  }
}

export function isChatStashError(value: unknown): value is ChatStashError {
  return value instanceof ChatStashError
}
