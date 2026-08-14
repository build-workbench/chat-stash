import type { SupportedStorage } from '@supabase/supabase-js'

/**
 * Minimal `chrome.storage.local` adapter for the Extension's own Supabase session.
 * Only the background creates a Supabase client; popup and content never hold one.
 */
export function createChromeStorageAdapter(): SupportedStorage {
  return {
    async getItem(key) {
      const result = await chrome.storage.local.get(key)
      return (result[key] as string | undefined) ?? null
    },
    async setItem(key, value) {
      await chrome.storage.local.set({ [key]: value })
    },
    async removeItem(key) {
      await chrome.storage.local.remove(key)
    },
  }
}
