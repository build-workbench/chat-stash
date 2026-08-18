import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { MarkdownView } from '@/features/markdown/MarkdownView'

describe('safe markdown rendering', () => {
  test('does not execute raw HTML or javascript URLs', () => {
    const { container } = render(
      <MarkdownView
        markdown={'<script>window.__pwned=1</script>\n[bad](javascript:alert(1))\n**ok**'}
      />,
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('a[href^="javascript"]')).toBeNull()
    expect(container.textContent).toContain('ok')
    expect(container.textContent).toContain('bad')
  })

  test('renders GFM tables and fenced code', () => {
    const markdown = [
      '# Title',
      '',
      '| A | B |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '```js',
      'const x = 1',
      '```',
    ].join('\n')
    const { container } = render(<MarkdownView markdown={markdown} />)
    expect(container.querySelector('table')).not.toBeNull()
    expect(container.querySelector('pre code')).not.toBeNull()
    expect(container.textContent).toContain('const x = 1')
  })
})
