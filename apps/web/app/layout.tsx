import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import 'highlight.js/styles/github.css'

export const metadata: Metadata = {
  title: 'ChatStash',
  description: 'Save and organize AI conversations',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
