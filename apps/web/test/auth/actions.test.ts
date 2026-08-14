import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { forgotPassword, resetPassword, signIn, signOut, signUp } from '@/app/(auth)/actions'

describe('auth server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  })

  describe('signIn', () => {
    test('redirects with error on invalid input', async () => {
      const formData = new FormData()
      formData.set('email', 'not-an-email')
      formData.set('password', '123')

      await expect(signIn(formData)).rejects.toThrow('NEXT_REDIRECT:/sign-in?error=Invalid+input')
    })

    test('redirects with error on invalid credentials', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            error: { message: 'Invalid login credentials' },
          }),
        },
      })

      const formData = new FormData()
      formData.set('email', 'a@b.com')
      formData.set('password', '123456')

      await expect(signIn(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/sign-in?error=Invalid+credentials',
      )
    })

    test('redirects to safe path on success', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        },
      })

      const formData = new FormData()
      formData.set('email', 'a@b.com')
      formData.set('password', '123456')
      formData.set('next', '/conversations')

      await expect(signIn(formData)).rejects.toThrow('NEXT_REDIRECT:/conversations')
    })

    test('rejects open redirect on success', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
        },
      })

      const formData = new FormData()
      formData.set('email', 'a@b.com')
      formData.set('password', '123456')
      formData.set('next', 'https://evil.com')

      await expect(signIn(formData)).rejects.toThrow('NEXT_REDIRECT:/conversations')
    })
  })

  describe('signUp', () => {
    test('redirects with error on invalid input', async () => {
      const formData = new FormData()
      formData.set('email', 'not-an-email')
      formData.set('password', '123')

      await expect(signUp(formData)).rejects.toThrow('NEXT_REDIRECT:/sign-up?error=Invalid+input')
    })

    test('redirects with message on success', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signUp: vi.fn().mockResolvedValue({ error: null }),
        },
      })

      const formData = new FormData()
      formData.set('email', 'a@b.com')
      formData.set('password', '123456')

      await expect(signUp(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/sign-in?message=Check+your+email+to+confirm+your+account',
      )
    })
  })

  describe('forgotPassword', () => {
    test('redirects with generic message on success', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
        },
      })

      const formData = new FormData()
      formData.set('email', 'a@b.com')

      await expect(forgotPassword(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/forgot-password?message=If+an+account+exists%2C+a+reset+link+has+been+sent',
      )
    })

    test('redirects with generic message even on error', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          resetPasswordForEmail: vi.fn().mockResolvedValue({
            error: { message: 'User not found' },
          }),
        },
      })

      const formData = new FormData()
      formData.set('email', 'a@b.com')

      await expect(forgotPassword(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/forgot-password?message=If+an+account+exists%2C+a+reset+link+has+been+sent',
      )
    })
  })

  describe('resetPassword', () => {
    test('redirects with error on invalid input', async () => {
      const formData = new FormData()
      formData.set('password', '123')
      formData.set('confirmPassword', '456')

      await expect(resetPassword(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/reset-password?error=Invalid+input',
      )
    })

    test('redirects to sign-in on success', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          updateUser: vi.fn().mockResolvedValue({ error: null }),
        },
      })

      const formData = new FormData()
      formData.set('password', '123456')
      formData.set('confirmPassword', '123456')

      await expect(resetPassword(formData)).rejects.toThrow(
        'NEXT_REDIRECT:/sign-in?message=Password+updated+successfully',
      )
    })
  })

  describe('signOut', () => {
    test('redirects to sign-in', async () => {
      mockCreateClient.mockResolvedValue({
        auth: {
          signOut: vi.fn().mockResolvedValue({ error: null }),
        },
      })

      await expect(signOut()).rejects.toThrow('NEXT_REDIRECT:/sign-in')
    })
  })
})
