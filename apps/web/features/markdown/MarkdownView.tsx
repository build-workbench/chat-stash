'use client'

import type { ReactNode } from 'react'
import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import remarkGfm from 'remark-gfm'

const CODE_HIGHLIGHT_MAX = 20_000
const SAFE_HREF = /^(https?:|mailto:|#)/i

export function MarkdownView({ markdown }: { markdown: string }) {
  const remarkPlugins = useMemo(() => [remarkGfm], [])
  const rehypePlugins = useMemo(() => [rehypeHighlight], [])

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{ a: SafeLink, code: CodeBlock }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}

function SafeLink({ href, children }: { href?: string; children?: ReactNode }) {
  if (!href || !SAFE_HREF.test(href)) {
    return <span>{children}</span>
  }
  const external = href.startsWith('http')
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  )
}

function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const text = String(children ?? '')
  if (text.length > CODE_HIGHLIGHT_MAX) {
    return <code>{children}</code>
  }
  return <code className={className}>{children}</code>
}
