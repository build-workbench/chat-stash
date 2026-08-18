'use client'

export function RetryButton({ label = 'Retry' }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.location.reload()}>
      {label}
    </button>
  )
}
