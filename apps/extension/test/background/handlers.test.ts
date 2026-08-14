import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthStatus: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  saveCapture: vi.fn(),
}))

vi.mock('@/auth/session', () => ({
  getAuthStatus: mocks.getAuthStatus,
  signInWithPassword: mocks.signInWithPassword,
  signOut: mocks.signOut,
}))

vi.mock('@/capture/save', () => ({
  saveCapture: mocks.saveCapture,
}))

import { handleMessage } from '@/messaging/handlers'

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('chrome', { runtime: { id: 'test-ext-id' } })
})

function popupSender() {
  return { id: 'test-ext-id', url: 'chrome-extension://test-ext-id/popup.html' } as never
}

function contentSender() {
  return {
    id: 'test-ext-id',
    frameId: 0,
    url: 'https://chatgpt.com/c/1',
    tab: { id: 7 },
  } as never
}

describe('handleMessage', () => {
  test('auth-status from the popup returns the status', async () => {
    mocks.getAuthStatus.mockResolvedValue({ authenticated: true, email: 'a@b.com' })
    const result = await handleMessage({ type: 'auth-status' }, popupSender())
    expect(result).toEqual({ ok: true, data: { authenticated: true, email: 'a@b.com' } })
  })

  test('auth-status from a content script is rejected', async () => {
    const result = await handleMessage({ type: 'auth-status' }, contentSender())
    expect(result).toMatchObject({ ok: false, error: 'AUTH_REQUIRED' })
    expect(mocks.getAuthStatus).not.toHaveBeenCalled()
  })

  test('sign-in from the popup succeeds', async () => {
    mocks.signInWithPassword.mockResolvedValue({ authenticated: true, email: 'a@b.com' })
    const result = await handleMessage(
      { type: 'sign-in', email: 'a@b.com', password: 'secret1' },
      popupSender(),
    )
    expect(result).toEqual({ ok: true, data: { authenticated: true, email: 'a@b.com' } })
    expect(mocks.signInWithPassword).toHaveBeenCalledWith('a@b.com', 'secret1')
  })

  test('sign-in from a content script is rejected', async () => {
    const result = await handleMessage(
      { type: 'sign-in', email: 'a@b.com', password: 'secret1' },
      contentSender(),
    )
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CREDENTIALS' })
    expect(mocks.signInWithPassword).not.toHaveBeenCalled()
  })

  test('sign-in with malformed input is rejected', async () => {
    const result = await handleMessage(
      { type: 'sign-in', email: 'not-an-email', password: 'x' },
      popupSender(),
    )
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' })
  })

  test('sign-out from the popup clears the session', async () => {
    mocks.signOut.mockResolvedValue(undefined)
    const result = await handleMessage({ type: 'sign-out' }, popupSender())
    expect(result).toEqual({ ok: true, data: { authenticated: false } })
    expect(mocks.signOut).toHaveBeenCalledOnce()
  })

  test('save-capture delegates to the save handler', async () => {
    mocks.saveCapture.mockResolvedValue({
      ok: true,
      data: { outcome: 'created', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })
    const draft = {
      platform: 'chatgpt',
      sourceUrl: 'https://chatgpt.com/c/1',
      title: 't',
      messages: [
        { role: 'user', contentMarkdown: 'a' },
        { role: 'assistant', contentMarkdown: 'b' },
      ],
    }
    const result = await handleMessage({ type: 'save-capture', draft }, contentSender())
    expect(result).toEqual({
      ok: true,
      data: { outcome: 'created', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })
    expect(mocks.saveCapture).toHaveBeenCalledOnce()
  })

  test('save-capture with a malformed draft is rejected before delegation', async () => {
    const result = await handleMessage(
      { type: 'save-capture', draft: { platform: 'bogus' } },
      contentSender(),
    )
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' })
    expect(mocks.saveCapture).not.toHaveBeenCalled()
  })

  test('an unknown operation is rejected', async () => {
    const result = await handleMessage({ type: 'fetch-anything' }, popupSender())
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' })
  })

  test('a malformed message is rejected', async () => {
    const result = await handleMessage(null, popupSender())
    expect(result).toMatchObject({ ok: false, error: 'INVALID_CAPTURE' })
  })
})
