import type { CaptureDraft, SourcePlatform } from '@chatstash/shared'

export interface AdapterTarget {
  responseElement: HTMLElement
  mountPoint: HTMLElement
  localKey: string
}

export interface AdapterDiagnostic {
  capability: string
  tier: 'primary' | 'fallback' | 'invalid'
  message: string
}

export interface SiteAdapter {
  readonly platform: SourcePlatform

  matches(url: URL): boolean
  findTargets(root: ParentNode): AdapterTarget[]
  isStreaming(target: AdapterTarget): boolean
  extract(target: AdapterTarget, pageUrl: URL): CaptureDraft
  healthCheck(document: Document): AdapterDiagnostic[]
}
