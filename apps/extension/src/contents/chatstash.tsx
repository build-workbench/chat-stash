import { matchAdapter, registerEnabledAdapters, type AdapterTarget } from '@chatstash/adapters'
import type { PlasmoCSConfig, PlasmoCSUIAnchor } from 'plasmo'

import { ensureDevAdapters } from '@/content/dev-adapters'
import { SaveControl } from '@/ui/save-control/SaveControl'

registerEnabledAdapters()
ensureDevAdapters()

export const config: PlasmoCSConfig = {
  // Plasmo requires a static matches literal. The synthetic host is a
  // non-routable test TLD; production still omits the adapter (see ensureDevAdapters).
  matches: [
    'https://chat.deepseek.com/*',
    'https://chatgpt.com/*',
    '*://synthetic.chatstash.test/*',
  ],
}

export const getInlineAnchorList = async () => {
  const adapter = matchAdapter(new URL(location.href))
  if (!adapter) return []
  return adapter.findTargets(document).map((target) => target.mountPoint)
}

export default function ChatStashCSUI({ anchor }: { anchor: PlasmoCSUIAnchor }) {
  const element = anchor.element as HTMLElement | undefined
  const pageUrl = new URL(location.href)
  const adapter = matchAdapter(pageUrl)

  if (!adapter || !element) return null

  const target: AdapterTarget | undefined = adapter
    .findTargets(document)
    .find((candidate) => candidate.mountPoint === element || candidate.responseElement === element)

  if (!target) return null

  return <SaveControl adapter={adapter} target={target} pageUrl={pageUrl} />
}
