import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockGetUser = vi.fn()
const mockSignInWithPassword = vi.fn()
const mockSignOut = vi.fn()

vi.mock('@/auth/supabase-client', () => ({
  getSupabaseClient: () => ({
    auth: {
      getUser: mockGetUser,
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
    },
  }),
}))

import { getAuthStatus, signInWithPassword, signOut } from '@/auth/session'

describe('extension session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('getAuthStatus returns an authenticated user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null })
    await expect(getAuthStatus()).resolves.toEqual({ authenticated: true, email: 'a@b.com' })
  })

  test('getAuthStatus is unauthenticated when getUser errors', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } })
    await expect(getAuthStatus()).resolves.toEqual({ authenticated: false })
  })

  test('getAuthStatus is unauthenticated without a user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })
    await expect(getAuthStatus()).resolves.toEqual({ authenticated: false })
  })

  test('signInWithPassword returns the signed-in email', async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { user: { email: 'a@b.com' } }, error: null })
    await expect(signInWithPassword('a@b.com', 'secret')).resolves.toEqual({
      authenticated: true,
      email: 'a@b.com',
    })
  })

  test('signInWithPassword maps credential errors', async () => {
    mockSignInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })
    await expect(signInWithPassword('a@b.com', 'wrong')).resolves.toEqual({
      error: 'INVALID_CREDENTIALS',
    })
  })

  test('signInWithPassword maps network failures', async () => {
    mockSignInWithPassword.mockRejectedValue(new Error('fetch failed'))
    await expect(signInWithPassword('a@b.com', 'secret')).resolves.toEqual({
      error: 'NETWORK_ERROR',
    })
  })

  test('signOut clears the extension session', async () => {
    mockSignOut.mockResolvedValue({ error: null })
    await signOut()
    expect(mockSignOut).toHaveBeenCalledOnce()
  })
})
