import { matchAdapter, type AdapterTarget } from '@chatstash/adapters'
import type { PlasmoCSConfig, PlasmoCSUIAnchor } from 'plasmo'

import { ensureDevAdapters } from '@/content/dev-adapters'
import { SaveControl } from '@/ui/save-control/SaveControl'

// Register the synthetic adapter only for dev/test builds.
ensureDevAdapters()

// Stage 6: the synthetic fixture host is the only capture surface. Production
// builds (without PLASMO_PUBLIC_ENABLE_SYNTHETIC) inject no content script.
// Stage 6: the synthetic fixture host is the only capture surface. The
// synthetic adapter itself is registered only in dev/test builds, so the
// content script is inert in production. Stage 7/8 will replace this host
// with the real ChatGPT/DeepSeek origins.
export const config: PlasmoCSConfig = {
  matches: ['*://synthetic.chatstash.test/*'],
}

export const getInlineAnchorList = async () => {
  const adapter = matchAdapter(new URL(location.href))
  if (!adapter) return []
  return adapter.findTargets(document).map((target) => target.responseElement)
}

export default function ChatStashCSUI({ anchor }: { anchor: PlasmoCSUIAnchor }) {
  const element = anchor.element as HTMLElement | undefined
  const pageUrl = new URL(location.href)
  const adapter = matchAdapter(pageUrl)

  if (!adapter || !element) return null

  const target: AdapterTarget = {
    responseElement: element,
    mountPoint: element,
    localKey: element.dataset.chatstashMessageId ?? '',
  }

  return <SaveControl adapter={adapter} target={target} pageUrl={pageUrl} />
}
