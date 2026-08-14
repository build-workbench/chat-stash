import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { createChromeStorageAdapter } from './storage-adapter'

let client: SupabaseClient | null = null

/**
 * The only Supabase client in the Extension, created lazily in the background.
 * `autoRefreshToken` is off because an MV3 worker is suspended between messages;
 * sessions are restored and refreshed per request instead.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = process.env.PLASMO_PUBLIC_SUPABASE_URL
  const key = process.env.PLASMO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) {
    throw new Error(
      'PLASMO_PUBLIC_SUPABASE_URL and PLASMO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be configured',
    )
  }

  client = createClient(url, key, {
    auth: {
      storage: createChromeStorageAdapter(),
      autoRefreshToken: false,
      persistSession: true,
      detectSessionInUrl: false,
    },
  })
  return client
}

export function resetSupabaseClient(): void {
  client = null
}
