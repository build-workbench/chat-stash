import { attachTag, detachTag, moveConversation } from './actions'
import { ConfirmDelete } from './ConfirmDelete'
import { ExportButton } from '@/features/export/ExportButton'
import { MarkdownView } from '@/features/markdown/MarkdownView'
import type { ConversationDetail, FolderRow, TagRow } from './types'

export function ConversationDetail({
  conversation,
  folders,
  tags,
}: {
  conversation: ConversationDetail
  folders: FolderRow[]
  tags: TagRow[]
}) {
  return (
    <article className="stack">
      <h1>{conversation.title}</h1>
      <p className="muted">
        {conversation.sourcePlatform} · saved {new Date(conversation.savedAt).toLocaleString()}
        {conversation.folderName ? ` · ${conversation.folderName}` : ''}
      </p>
      <p>
        <a href={conversation.sourceUrl} target="_blank" rel="noopener noreferrer">
          Open source
        </a>
      </p>

      <form action={moveConversation} className="row">
        <input type="hidden" name="conversationId" value={conversation.id} />
        <select name="folderId" defaultValue={conversation.folderId ?? ''}>
          <option value="">All Saves</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </select>
        <button type="submit">Move</button>
      </form>

      <div className="row">
        {conversation.tags.map((tag) => (
          <form key={tag.id} action={detachTag}>
            <input type="hidden" name="conversationId" value={conversation.id} />
            <input type="hidden" name="tagId" value={tag.id} />
            <button type="submit">{tag.name} ×</button>
          </form>
        ))}
        <form action={attachTag} className="row">
          <input type="hidden" name="conversationId" value={conversation.id} />
          <select name="tagId" defaultValue="">
            <option value="" disabled>
              Add tag
            </option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <button type="submit">Attach</button>
        </form>
      </div>

      {conversation.messages.map((message) => (
        <section key={`${message.role}-${message.position}`}>
          <h2>{message.role === 'user' ? 'User' : 'Assistant'}</h2>
          <MarkdownView markdown={message.contentMarkdown} />
        </section>
      ))}

      <div className="row">
        <ExportButton conversation={conversation} />
        <ConfirmDelete id={conversation.id} />
      </div>
    </article>
  )
}
