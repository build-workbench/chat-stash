import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { GET } from '@/app/auth/callback/route'

function makeRequest(url: string) {
  return new Request(url) as never
}

function mockAuth(overrides: Record<string, unknown> = {}) {
  return {
    exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  }
}

describe('auth callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('exchanges PKCE code and redirects to safe path', async () => {
    mockCreateClient.mockResolvedValue({ auth: mockAuth() })

    const request = makeRequest(
      'http://localhost:3000/auth/callback?code=abc123&next=/conversations',
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/conversations')
  })

  test('falls back on PKCE code exchange error', async () => {
    mockCreateClient.mockResolvedValue({
      auth: mockAuth({
        exchangeCodeForSession: vi.fn().mockResolvedValue({ error: { message: 'Invalid code' } }),
      }),
    })

    const request = makeRequest(
      'http://localhost:3000/auth/callback?code=abc123&next=/conversations',
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?error=Invalid+or+expired+confirmation+link',
    )
  })

  test('verifies email OTP token and redirects to safe path', async () => {
    mockCreateClient.mockResolvedValue({ auth: mockAuth() })

    const request = makeRequest(
      'http://localhost:3000/auth/callback?token_hash=abc&type=email&next=/conversations',
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/conversations')
  })

  test('redirects to fallback on missing code and token', async () => {
    const request = makeRequest('http://localhost:3000/auth/callback')
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?error=Invalid+or+expired+confirmation+link',
    )
  })

  test('redirects to fallback on verifyOtp error', async () => {
    mockCreateClient.mockResolvedValue({
      auth: mockAuth({
        verifyOtp: vi.fn().mockResolvedValue({ error: { message: 'Invalid token' } }),
      }),
    })

    const request = makeRequest(
      'http://localhost:3000/auth/callback?token_hash=abc&type=email&next=/conversations',
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?error=Invalid+or+expired+confirmation+link',
    )
  })

  test('rejects open redirect in next parameter', async () => {
    mockCreateClient.mockResolvedValue({ auth: mockAuth() })

    const request = makeRequest(
      'http://localhost:3000/auth/callback?code=abc123&next=https://evil.com',
    )
    const response = await GET(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost:3000/conversations')
  })

  test('drops auth query params from the success redirect', async () => {
    mockCreateClient.mockResolvedValue({ auth: mockAuth() })

    const request = makeRequest(
      'http://localhost:3000/auth/callback?code=abc123&next=/reset-password',
    )
    const response = await GET(request)

    const location = response.headers.get('location') ?? ''
    expect(location).not.toContain('code=')
    expect(location).toBe('http://localhost:3000/reset-password')
  })
})
