export function formatConversationMarkdown(input: {
  title: string
  sourcePlatform: 'chatgpt' | 'deepseek'
  sourceUrl: string
  savedAt: string
  sourceConversationId?: string | null
  sourceMessageId?: string | null
  messages: { role: 'user' | 'assistant'; contentMarkdown: string }[]
}): string {
  const platform = input.sourcePlatform === 'chatgpt' ? 'ChatGPT' : 'DeepSeek'
  const lines = [
    `# ${input.title}`,
    '',
    `Source: ${platform}`,
    `URL: ${input.sourceUrl}`,
    `Saved: ${toIso8601(input.savedAt)}`,
  ]

  if (input.sourceConversationId) lines.push(`Conversation: ${input.sourceConversationId}`)
  if (input.sourceMessageId) lines.push(`Message: ${input.sourceMessageId}`)

  for (const message of input.messages) {
    const heading = message.role === 'user' ? 'User' : 'Assistant'
    lines.push('', `## ${heading}`, '', message.contentMarkdown.replace(/\n+$/u, ''))
  }

  return `${lines.join('\n')}\n`
}

function toIso8601(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString()
}

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i

export function safeExportFilename(title: string): string {
  let name = title
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/[\p{Cc}]/gu, '')
    .trim()
  name = name.replace(/^\.+$/g, '')
  if (WINDOWS_RESERVED.test(name)) name = `chatstash-${name}`
  if (name.length > 80) name = name.slice(0, 80).trim()
  if (name === '') return 'chatstash-export.md'
  return `${name}.md`
}
