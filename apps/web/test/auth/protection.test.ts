import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockCreateClient = vi.fn()

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/features/folders/queries', () => ({
  listFolders: async () => ({ ok: true, data: [] }),
  listTags: async () => ({ ok: true, data: [] }),
}))

import DashboardLayout from '@/app/(dashboard)/layout'

describe('dashboard route protection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('redirects unauthenticated users to sign-in', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    })

    await expect(DashboardLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT:/sign-in')
  })

  test('redirects on getUser error', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid JWT' },
        }),
      },
    })

    await expect(DashboardLayout({ children: null })).rejects.toThrow('NEXT_REDIRECT:/sign-in')
  })

  test('renders children for authenticated users', async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-1', email: 'a@b.com' } },
          error: null,
        }),
      },
    })

    const result = await DashboardLayout({ children: 'protected-content' })
    expect(result).toBeDefined()
  })
})
