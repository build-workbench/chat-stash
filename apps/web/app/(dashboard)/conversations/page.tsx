import { ConversationList } from '@/features/conversations/ConversationList'
import { conversationListHref } from '@/features/conversations/href'
import { listConversations } from '@/features/conversations/queries'
import { searchConversations } from '@/features/search/queries'
import { SearchBox } from '@/features/search/SearchBox'
import { RetryButton } from '@/components/RetryButton'
import { LIMITS } from '@chatstash/shared'

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const folderId = first(params.folder)
  const tagId = first(params.tag)
  const query = first(params.q)?.trim() ?? ''
  const cursor = first(params.cursor)
  const searching = query.length >= LIMITS.searchQuery.min

  const result = searching
    ? await searchConversations({ query, folderId, tagId, cursor })
    : await listConversations({ folderId, tagId, cursor })

  const nextHref =
    result.ok && result.data.nextCursor
      ? conversationListHref({
          folderId,
          tagId,
          query: searching ? query : undefined,
          cursor: result.data.nextCursor,
        })
      : null

  return (
    <>
      <section className="list-pane stack">
        <SearchBox initialQuery={query} folderId={folderId} tagId={tagId} />
        {query.length === 1 ? (
          <p className="muted">Enter at least 2 characters to search.</p>
        ) : null}
        {!result.ok ? (
          <div className="banner error">
            {result.error === 'SEARCH_FAILED'
              ? 'Search failed. Check your connection and retry.'
              : 'Could not load conversations. Retry.'}
            <RetryButton />
          </div>
        ) : (
          <ConversationList
            items={result.data.items}
            nextHref={nextHref}
            emptyMessage={
              searching
                ? 'No conversations match this search.'
                : 'No saved conversations yet. Save a reply from the ChatStash extension.'
            }
          />
        )}
        {first(params.error) ? (
          <div className="banner error" role="alert">
            {first(params.error) === 'FOLDER_NAME_CONFLICT'
              ? 'A folder with that name already exists at this level. Rename it first.'
              : first(params.error) === 'FOLDER_CYCLE'
                ? 'A folder cannot be moved under itself or one of its descendants.'
                : first(params.error) === 'TAG_NAME_CONFLICT'
                  ? 'A tag with that name already exists.'
                  : 'The last action could not be completed.'}
          </div>
        ) : null}
      </section>
      <section className="detail-pane">
        <p className="muted">Select a conversation to read it.</p>
      </section>
    </>
  )
}
