import { beforeEach, describe, expect, test, vi } from 'vitest'

const mockRedirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})

vi.mock('next/navigation', () => ({
  redirect: (url: string) => mockRedirect(url),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const mockFrom = vi.fn()
const mockRpc = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  }),
}))

import { deleteConversation, moveConversation } from '@/features/conversations/actions'
import { getConversation, listConversations } from '@/features/conversations/queries'
import { deleteFolder } from '@/features/folders/actions'

const ownedId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'

function chain(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    or: vi.fn(() => query),
    maybeSingle: vi.fn(async () => result),
    then(
      resolve: (value: { data: unknown; error: unknown }) => unknown,
      reject?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(resolve, reject)
    },
  }
  return query
}

describe('conversation queries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
  })

  test('lists owned summaries in saved_at desc order', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          conversation_id: ownedId,
          title: 'One',
          source_platform: 'deepseek',
          source_url: 'https://chat.deepseek.com/a/chat/s/1',
          folder_id: null,
          saved_at: '2026-01-02T00:00:00.000Z',
        },
      ],
      error: null,
    })
    mockFrom.mockImplementation(() => chain({ data: [], error: null }))

    const result = await listConversations({})
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.items[0].title).toBe('One')
      expect(result.data.items[0].id).toBe(ownedId)
    }
    expect(mockRpc).toHaveBeenCalledWith(
      'list_conversations_v1',
      expect.objectContaining({ p_limit: 31 }),
    )
  })

  test('returns the same not-found for missing and unowned rows', async () => {
    mockFrom.mockImplementation(() => chain({ data: null, error: null }))
    const missing = await getConversation(ownedId)
    const unowned = await getConversation(otherId)
    expect(missing).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(unowned).toEqual({ ok: false, error: 'NOT_FOUND' })
  })
})

describe('conversation mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
  })

  test('deleteConversation redirects after a successful delete', async () => {
    mockFrom.mockImplementation(() => {
      const query = {
        delete: vi.fn(() => query),
        eq: vi.fn(() => query),
        select: vi.fn(async () => ({ data: [{ id: ownedId }], error: null })),
      }
      return query
    })
    const formData = new FormData()
    formData.set('id', ownedId)
    await expect(deleteConversation(formData)).rejects.toThrow('NEXT_REDIRECT:/conversations')
  })

  test('moveConversation updates folder_id', async () => {
    mockFrom.mockImplementation(() => {
      const query = {
        update: vi.fn(() => query),
        eq: vi.fn(() => query),
        select: vi.fn(async () => ({ data: [{ id: ownedId }], error: null })),
      }
      return query
    })
    const formData = new FormData()
    formData.set('conversationId', ownedId)
    formData.set('folderId', otherId)
    await expect(moveConversation(formData)).resolves.toBeUndefined()
  })
})

describe('folder delete RPC mapping', () => {
  test('maps FOLDER_NAME_CONFLICT', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null })
    mockRpc.mockResolvedValue({ error: { message: 'FOLDER_NAME_CONFLICT' } })
    const formData = new FormData()
    formData.set('id', ownedId)
    await expect(deleteFolder(formData)).rejects.toThrow(
      'NEXT_REDIRECT:/conversations?error=FOLDER_NAME_CONFLICT',
    )
  })
})
