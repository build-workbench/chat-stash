import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <main className="auth-card">
        <div className="auth-brand">
          <span className="auth-mark" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 12a8 8 0 0 1-8 8H4l2.3-2.9A8 8 0 1 1 21 12Z" />
            </svg>
          </span>
          <span className="auth-wordmark">ChatStash</span>
        </div>
        {children}
      </main>
      <p className="auth-footnote">Local-first AI conversation archive</p>
    </div>
  )
}
