// @vitest-environment jsdom

import { readFileSync } from 'node:fs'

import { describe, expect, test } from 'vitest'

import { convertElementToMarkdown, extractReadableText } from '../../src/markdown/convert'

function loadFixture(name: string): string {
  return readFileSync(`fixtures/common/${name}`, 'utf8')
}

describe('DOM to Markdown conversion', () => {
  test('converts GFM structures and removes noise', () => {
    document.body.innerHTML = loadFixture('rich-response.html')
    const markdown = convertElementToMarkdown(
      document.querySelector('.assistant-message') as HTMLElement,
    )

    expect(markdown).toContain('## Overview')
    expect(markdown).toContain('| Name | Value |')
    expect(markdown).toContain('const answer = 42')
    expect(markdown).toContain('keep = "indent"')
    expect(markdown).toContain('[docs](https://example.com/docs)')
    expect(markdown).toContain('$E=mc^2$')
    expect(markdown).toContain('danger')
    expect(markdown).not.toContain('Copy')
    expect(markdown).not.toContain('javascript:')
  })

  test('drops scripts, styles, iframes, forms, and unsafe destinations', () => {
    document.body.innerHTML = loadFixture('unsafe-response.html')
    const markdown = convertElementToMarkdown(
      document.querySelector('.assistant-message') as HTMLElement,
    )

    expect(markdown).toContain('Safe text remains.')
    expect(markdown).not.toContain('window.pwned')
    expect(markdown).not.toContain('<style')
    expect(markdown).not.toContain('<iframe')
    expect(markdown).not.toContain('javascript:')
    expect(markdown).not.toContain('draft')
  })

  test('preserves nested list and code indentation', () => {
    document.body.innerHTML = `
      <div class="message">
        <ul>
          <li>one<ul><li>nested</li></ul></li>
        </ul>
        <pre><code>line1
  indented
line3</code></pre>
      </div>
    `
    const markdown = convertElementToMarkdown(document.querySelector('.message') as HTMLElement)

    expect(markdown).toMatch(/[-*]\s+one/)
    expect(markdown).toMatch(/[-*]\s+nested/)
    expect(markdown).toContain('line1')
    expect(markdown).toContain('  indented')
    expect(markdown).toContain('line3')
  })

  test('returns an empty string for content with only noise', () => {
    document.body.innerHTML = loadFixture('empty-response.html')
    expect(
      convertElementToMarkdown(document.querySelector('.assistant-message') as HTMLElement),
    ).toBe('')
  })

  test('extractReadableText removes noise and collapses whitespace', () => {
    document.body.innerHTML = loadFixture('rich-response.html')
    const text = extractReadableText(document.querySelector('.assistant-message') as HTMLElement)

    expect(text).toContain('Overview')
    expect(text).toContain('docs')
    expect(text).not.toContain('Copy')
  })
})
