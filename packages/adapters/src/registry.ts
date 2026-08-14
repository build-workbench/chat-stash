import type { SourcePlatform } from '@chatstash/shared'

import type { SiteAdapter } from './types'

const adapters = new Map<SourcePlatform, SiteAdapter>()

/** Register an adapter for its platform. Later registrations replace earlier ones. */
export function registerAdapter(adapter: SiteAdapter): void {
  adapters.set(adapter.platform, adapter)
}

export function unregisterAdapter(platform: SourcePlatform): void {
  adapters.delete(platform)
}

export function getAdapter(platform: SourcePlatform): SiteAdapter | undefined {
  return adapters.get(platform)
}

/** Return the single adapter that matches the URL, or undefined on unsupported pages. */
export function matchAdapter(url: URL): SiteAdapter | undefined {
  for (const adapter of adapters.values()) {
    if (adapter.matches(url)) return adapter
  }
  return undefined
}

export function clearAdapters(): void {
  adapters.clear()
}
