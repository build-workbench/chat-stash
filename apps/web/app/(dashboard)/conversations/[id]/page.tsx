import { ConversationDetail } from '@/features/conversations/ConversationDetail'
import { ConversationList } from '@/features/conversations/ConversationList'
import { getConversation, listConversations } from '@/features/conversations/queries'
import { listFolders, listTags } from '@/features/folders/queries'
import { RetryButton } from '@/components/RetryButton'

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [detail, list, folders, tags] = await Promise.all([
    getConversation(id),
    listConversations({}),
    listFolders(),
    listTags(),
  ])

  return (
    <>
      <section className="list-pane">
        {list.ok ? (
          <ConversationList
            items={list.data.items}
            selectedId={id}
            nextHref={
              list.data.nextCursor
                ? `/conversations?cursor=${encodeURIComponent(list.data.nextCursor)}`
                : null
            }
            emptyMessage="No saved conversations yet."
          />
        ) : (
          <div className="banner error">
            Could not load conversations. Retry.
            <RetryButton />
          </div>
        )}
      </section>
      <section className="detail-pane">
        {!detail.ok ? (
          <div className="banner error">Conversation not found.</div>
        ) : (
          <ConversationDetail
            conversation={detail.data}
            folders={folders.ok ? folders.data : []}
            tags={tags.ok ? tags.data : []}
          />
        )}
      </section>
    </>
  )
}
