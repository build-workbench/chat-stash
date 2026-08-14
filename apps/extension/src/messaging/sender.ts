import type { SourcePlatform } from '@chatstash/shared'

/** Platform hosts are the same allowlist the shared canonicalizer enforces. */
const PLATFORM_HOSTS: Record<SourcePlatform, readonly string[]> = {
  // synthetic.chatstash.test is the dev/test fixture host (Stage 6); it is
  // removed once real platform adapters replace the synthetic vertical slice.
  chatgpt: ['chatgpt.com', 'synthetic.chatstash.test'],
  deepseek: ['chat.deepseek.com'],
}

export type SenderCheck = { ok: true } | { ok: false; reason: string }

/**
 * Popup messages must come from this extension's own popup page: no tab is
 * attached and the sender URL is the extension's own chrome-extension origin.
 */
export function isPopupSender(sender: chrome.runtime.MessageSender): SenderCheck {
  if (sender.id !== chrome.runtime.id) return { ok: false, reason: 'unknown-extension-sender' }
  if (sender.tab) return { ok: false, reason: 'expected-popup-sender' }
  return { ok: true }
}

/**
 * Save messages must come from this extension's top-level content script on a
 * supported AI host. Optionally narrows the check to one platform.
 */
export function isSupportedContentSender(
  sender: chrome.runtime.MessageSender,
  platform?: SourcePlatform,
): SenderCheck {
  if (sender.id !== chrome.runtime.id) return { ok: false, reason: 'unknown-extension-sender' }
  if (!sender.tab) return { ok: false, reason: 'expected-content-sender' }
  if (sender.frameId !== 0) return { ok: false, reason: 'not-top-frame' }

  const rawUrl = sender.url ?? sender.tab.url
  if (!rawUrl) return { ok: false, reason: 'missing-sender-url' }

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    return { ok: false, reason: 'invalid-sender-url' }
  }

  const hosts = platform ? PLATFORM_HOSTS[platform] : Object.values(PLATFORM_HOSTS).flat()
  if (!hosts.includes(url.hostname)) return { ok: false, reason: 'unsupported-host' }

  return { ok: true }
}

export function hostMatchesPlatform(rawUrl: string, platform: SourcePlatform): boolean {
  try {
    return PLATFORM_HOSTS[platform].includes(new URL(rawUrl).hostname)
  } catch {
    return false
  }
}
