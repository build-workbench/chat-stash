import { matchAdapter, type SiteAdapter } from '@chatstash/adapters'

/** Resolve the single adapter responsible for the current top-level URL. */
export function resolveAdapter(url: URL): SiteAdapter | undefined {
  return matchAdapter(url)
}

/** True when the URL is a page the Extension should capture on. */
export function isSupportedPage(url: URL): boolean {
  return matchAdapter(url) !== undefined
}
