import { registerAdapter, syntheticAdapter } from '@chatstash/adapters'

/**
 * Stage 6: register the repository-owned synthetic adapter only in dev/test
 * builds so the content runtime can be exercised without touching real AI
 * pages. Production builds never register it.
 */
export function ensureDevAdapters(): void {
  if (process.env.PLASMO_PUBLIC_ENABLE_SYNTHETIC === 'true') {
    registerAdapter(syntheticAdapter)
  }
}
