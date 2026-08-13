import { ChatStashError } from './errors'
import { LIMITS } from './limits'

export const SOURCE_PLATFORMS = ['chatgpt', 'deepseek'] as const

export type SourcePlatform = (typeof SOURCE_PLATFORMS)[number]

type PlatformUrlRule = {
  allowedHostnames: readonly string[]
  allowedQueryParams: readonly string[]
}

const PLATFORM_URL_RULES: Record<SourcePlatform, PlatformUrlRule> = {
  chatgpt: {
    allowedHostnames: ['chatgpt.com'],
    // Populate from adapter evidence in Stage 7/8; empty means strip all query params.
    allowedQueryParams: [],
  },
  deepseek: {
    allowedHostnames: ['chat.deepseek.com'],
    allowedQueryParams: [],
  },
}

export function canonicalizeSourceUrl(value: string | URL, platform: SourcePlatform): string {
  const rule = PLATFORM_URL_RULES[platform]
  let url: URL

  try {
    url = typeof value === 'string' ? new URL(value) : new URL(value.toString())
  } catch {
    throw new ChatStashError('INVALID_SOURCE_URL', 'Source URL is not a valid URL')
  }

  if (url.protocol !== 'https:') {
    throw new ChatStashError('INVALID_SOURCE_URL', 'Source URL must use HTTPS')
  }

  if (!rule.allowedHostnames.includes(url.hostname)) {
    throw new ChatStashError('INVALID_SOURCE_URL', `Source host is not allowed for ${platform}`)
  }

  if (url.port !== '') {
    throw new ChatStashError('INVALID_SOURCE_URL', 'Source URL must use the default HTTPS port')
  }

  url.username = ''
  url.password = ''
  url.hash = ''

  const allowed = new Set(rule.allowedQueryParams)
  for (const key of [...url.searchParams.keys()]) {
    if (!allowed.has(key)) {
      url.searchParams.delete(key)
    }
  }

  const canonical = `https://${url.hostname}${url.pathname || '/'}`

  if (canonical.length < LIMITS.sourceUrl.min || canonical.length > LIMITS.sourceUrl.max) {
    throw new ChatStashError(
      'INVALID_SOURCE_URL',
      'Canonical source URL exceeds the allowed length',
    )
  }

  return canonical
}
