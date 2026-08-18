'use client'

import { formatConversationMarkdown, safeExportFilename } from './format'
import type { ConversationDetail } from '@/features/conversations/types'

export function ExportButton({ conversation }: { conversation: ConversationDetail }) {
  function download() {
    const markdown = formatConversationMarkdown({
      title: conversation.title,
      sourcePlatform: conversation.sourcePlatform,
      sourceUrl: conversation.sourceUrl,
      savedAt: conversation.savedAt,
      sourceConversationId: conversation.sourceConversationId,
      sourceMessageId: conversation.sourceMessageId,
      messages: conversation.messages,
    })
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = safeExportFilename(conversation.title)
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <button type="button" onClick={download}>
      Export Markdown
    </button>
  )
}
