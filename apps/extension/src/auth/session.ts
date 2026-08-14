import { getSupabaseClient } from './supabase-client'

export type AuthStatus = { authenticated: true; email: string } | { authenticated: false }

export type SignInFailure = 'INVALID_CREDENTIALS' | 'NETWORK_ERROR'

/**
 * Resolve the current Extension auth state. `getUser()` restores the persisted
 * session from `chrome.storage.local` and refreshes it if needed; it never
 * trusts a locally parsed JWT.
 */
export async function getAuthStatus(): Promise<AuthStatus> {
  const supabase = getSupabaseClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return { authenticated: false }
  return { authenticated: true, email: data.user.email ?? '' }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<AuthStatus | { error: SignInFailure }> {
  const supabase = getSupabaseClient()
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'INVALID_CREDENTIALS' }
    return { authenticated: true, email: data.user?.email ?? email }
  } catch {
    return { error: 'NETWORK_ERROR' }
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabaseClient()
  await supabase.auth.signOut()
}
