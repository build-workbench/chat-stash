import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const NOISE_SELECTORS = [
  'script',
  'style',
  'button',
  'textarea',
  'input',
  'select',
  '[aria-hidden="true"]',
  '[hidden]',
  '[data-testid*="copy"]',
  '[data-testid*="feedback"]',
  '[data-testid*="save"]',
]

function removeNoise(root: HTMLElement): void {
  root.querySelectorAll(NOISE_SELECTORS.join(',')).forEach((node) => node.remove())
}

function isSafeLinkDestination(href: string): boolean {
  return /^(https?:|mailto:)/i.test(href)
}

function createTurndownService(): TurndownService {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    strongDelimiter: '**',
    linkStyle: 'inlined',
    hr: '---',
  })

  service.use(gfm)

  service.addRule('safeLinks', {
    filter: (node) => node.nodeName === 'A',
    replacement: (_content, node) => {
      const href = node.getAttribute('href') ?? ''
      const label = node.textContent ?? ''
      return isSafeLinkDestination(href) && label.trim() !== '' ? `[${label}](${href})` : label
    },
  })

  service.addRule('safeImages', {
    filter: 'img',
    replacement: (_content, node) => {
      const src = node.getAttribute('src') ?? ''
      const alt = node.getAttribute('alt') ?? ''
      return isSafeLinkDestination(src) && src !== '' ? `![${alt}](${src})` : alt
    },
  })

  service.addRule('mathAnnotation', {
    filter: (node) =>
      node.nodeName === 'ANNOTATION' && node.getAttribute('encoding') === 'application/x-tex',
    replacement: (_content, node) => `$${node.textContent ?? ''}$`,
  })

  service.addRule('formulaAttribute', {
    filter: (node) => node.hasAttribute('data-formula'),
    replacement: (_content, node) => `$${node.getAttribute('data-formula') ?? ''}$`,
  })

  service.addRule('unsafeElements', {
    filter: ['iframe', 'object', 'embed', 'form'],
    replacement: () => '',
  })

  return service
}

function normalizeMarkdown(input: string): string {
  const trimmed = input.replace(/^\s+/, '').replace(/\s+$/, '')
  return trimmed === '' ? '' : `${trimmed}\n`
}

export function convertElementToMarkdown(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  removeNoise(clone)
  return normalizeMarkdown(createTurndownService().turndown(clone))
}

export function extractReadableText(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement
  removeNoise(clone)
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim()
}
