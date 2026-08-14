import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/auth/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: { getUser: mockGetUser },
    rpc: mockRpc,
  }),
}))

import type { SaveCaptureRequest } from '@chatstash/shared'

import { saveCapture } from '@/capture/save'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('chrome', { runtime: { id: 'test-ext-id' } })
})

const validDraft = {
  platform: 'chatgpt',
  sourceUrl: 'https://chatgpt.com/c/abc',
  title: 'A question',
  messages: [
    { role: 'user', contentMarkdown: 'Hello' },
    { role: 'assistant', contentMarkdown: 'Hi there' },
  ],
} as const

function contentSender(overrides: Record<string, unknown> = {}) {
  return {
    id: 'test-ext-id',
    frameId: 0,
    url: 'https://chatgpt.com/c/abc',
    tab: { id: 7 },
    ...overrides,
  } as chrome.runtime.MessageSender
}

function request(draft: unknown): SaveCaptureRequest {
  return { type: 'save-capture', draft } as SaveCaptureRequest
}

describe('saveCapture', () => {
  test('rejects a forged sender before any RPC call', async () => {
    const result = await saveCapture(request(validDraft), { id: 'test-ext-id' } as never)
    expect(result).toMatchObject({ ok: false, error: 'UNSUPPORTED_PAGE' })
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  test('rejects a sender URL that does not match the platform', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    const result = await saveCapture(
      request(validDraft),
      contentSender({ url: 'https://chat.deepseek.com/' }),
    )
    expect(result).toMatchObject({ ok: false, error: 'INVALID_SOURCE_URL' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  test('rejects a malformed draft', async () => {
    const result = await saveCapture(
      request({ ...validDraft, messages: [{ role: 'user', contentMarkdown: 'only one' }] }),
      contentSender(),
    )
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' })
  })

  test('rejects an oversized payload against the byte limit', async () => {
    // Each field is under the 500k-char field limit, but the combined UTF-8
    // payload exceeds the 1.1M-byte transport budget.
    const big = '中'.repeat(400_000)
    const result = await saveCapture(
      request({
        ...validDraft,
        messages: [
          { role: 'user', contentMarkdown: big },
          { role: 'assistant', contentMarkdown: big },
        ],
      }),
      contentSender(),
    )
    expect(result).toMatchObject({ ok: false, error: 'PAYLOAD_TOO_LARGE' })
  })

  test('requires an authenticated extension session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toMatchObject({ ok: false, error: 'AUTH_REQUIRED' })
    expect(mockRpc).not.toHaveBeenCalled()
  })

  test('maps the RPC created outcome', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockResolvedValue({
      data: [{ conversation_id: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d', outcome: 'created' }],
      error: null,
    })

    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toEqual({
      ok: true,
      data: { outcome: 'created', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })
    expect(mockRpc).toHaveBeenCalledWith(
      'save_capture_v1',
      expect.objectContaining({
        p_source_platform: 'chatgpt',
        p_source_url: 'https://chatgpt.com/c/abc',
        p_title: 'A question',
        p_user_markdown: 'Hello',
        p_assistant_markdown: 'Hi there',
      }),
    )
  })

  test('maps the RPC duplicate outcome', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockResolvedValue({
      data: [{ conversation_id: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d', outcome: 'duplicate' }],
      error: null,
    })

    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toEqual({
      ok: true,
      data: { outcome: 'duplicate', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })
  })

  test('maps an RPC auth error to AUTH_EXPIRED', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'AUTH_REQUIRED' } })

    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toMatchObject({ ok: false, error: 'AUTH_EXPIRED' })
  })

  test('maps an RPC validation error to INVALID_CAPTURE', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'INVALID_TITLE' } })

    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' })
  })

  test('maps an RPC failure to SAVE_FAILED', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockResolvedValue({ data: null, error: { message: 'something broke' } })

    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toMatchObject({ ok: false, error: 'SAVE_FAILED' })
  })

  test('maps a network failure to NETWORK_ERROR', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockRejectedValue(new Error('fetch failed'))

    const result = await saveCapture(request(validDraft), contentSender())
    expect(result).toMatchObject({ ok: false, error: 'NETWORK_ERROR' })
  })

  test('passes nullable source ids to the RPC', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })
    mockRpc.mockResolvedValue({
      data: [{ conversation_id: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d', outcome: 'created' }],
      error: null,
    })

    const draft = {
      ...validDraft,
      sourceConversationId: 'conv-1',
      sourceMessageId: 'msg-1',
    }
    await saveCapture(request(draft), contentSender())
    expect(mockRpc).toHaveBeenCalledWith(
      'save_capture_v1',
      expect.objectContaining({
        p_source_conversation_id: 'conv-1',
        p_source_message_id: 'msg-1',
      }),
    )
  })
})
