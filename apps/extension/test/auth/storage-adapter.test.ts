import { beforeEach, describe, expect, test, vi } from 'vitest'

import { createChromeStorageAdapter } from '@/auth/storage-adapter'

const mockGet = vi.fn()
const mockSet = vi.fn()
const mockRemove = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal('chrome', {
    storage: {
      local: { get: mockGet, set: mockSet, remove: mockRemove },
    },
  })
})

describe('chrome storage adapter', () => {
  test('getItem returns the stored value', async () => {
    mockGet.mockResolvedValue({ session: 'value' })
    const adapter = createChromeStorageAdapter()
    await expect(adapter.getItem('session')).resolves.toBe('value')
    expect(mockGet).toHaveBeenCalledWith('session')
  })

  test('getItem returns null for a missing key', async () => {
    mockGet.mockResolvedValue({})
    const adapter = createChromeStorageAdapter()
    await expect(adapter.getItem('missing')).resolves.toBeNull()
  })

  test('setItem stores a value', async () => {
    mockSet.mockResolvedValue(undefined)
    const adapter = createChromeStorageAdapter()
    await adapter.setItem('session', 'payload')
    expect(mockSet).toHaveBeenCalledWith({ session: 'payload' })
  })

  test('removeItem removes a key', async () => {
    mockRemove.mockResolvedValue(undefined)
    const adapter = createChromeStorageAdapter()
    await adapter.removeItem('session')
    expect(mockRemove).toHaveBeenCalledWith('session')
  })
})
