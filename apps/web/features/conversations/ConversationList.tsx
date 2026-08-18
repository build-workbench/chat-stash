import type { ConversationSummary } from '@/features/conversations/types'

export function ConversationList({
  items,
  selectedId,
  nextHref,
  emptyMessage,
}: {
  items: ConversationSummary[]
  selectedId?: string
  nextHref?: string | null
  emptyMessage: string
}) {
  if (items.length === 0) {
    return <p className="muted">{emptyMessage}</p>
  }

  return (
    <div className="stack">
      {items.map((item) => (
        <a
          key={item.id}
          href={`/conversations/${item.id}`}
          className="card"
          aria-current={selectedId === item.id ? 'page' : undefined}
        >
          <strong>{item.title}</strong>
          <p className="muted">
            {item.sourcePlatform} · {new Date(item.savedAt).toLocaleString()}
          </p>
          {item.tagNames.length > 0 ? <p className="muted">{item.tagNames.join(', ')}</p> : null}
        </a>
      ))}
      {nextHref ? (
        <a href={nextHref} className="button">
          Next page
        </a>
      ) : null}
    </div>
  )
}
