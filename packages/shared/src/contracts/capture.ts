import { z } from 'zod'

import { ChatStashError } from '../errors'
import { LIMITS } from '../limits'
import { SOURCE_PLATFORMS, canonicalizeSourceUrl } from '../platform'

export const sourcePlatformSchema = z.enum(SOURCE_PLATFORMS)

const boundedText = (max: number) => z.string().trim().min(1).max(max)

export const captureDraftSchema = z
  .object({
    platform: sourcePlatformSchema,
    sourceUrl: z.string().trim().min(LIMITS.sourceUrl.min).max(LIMITS.sourceUrl.max),
    sourceConversationId: boundedText(LIMITS.sourceId.max).nullable().optional(),
    sourceMessageId: boundedText(LIMITS.sourceId.max).nullable().optional(),
    title: boundedText(LIMITS.title.max),
    messages: z.tuple([
      z.object({
        role: z.literal('user'),
        contentMarkdown: boundedText(LIMITS.messageMarkdown.max),
      }),
      z.object({
        role: z.literal('assistant'),
        contentMarkdown: boundedText(LIMITS.messageMarkdown.max),
      }),
    ]),
  })
  .strict()

export type CaptureDraft = z.infer<typeof captureDraftSchema>

export function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength
}

export function parseCaptureDraft(input: unknown): CaptureDraft {
  const parsed = captureDraftSchema.parse(input)
  const canonicalUrl = canonicalizeSourceUrl(parsed.sourceUrl, parsed.platform)
  const draft: CaptureDraft = { ...parsed, sourceUrl: canonicalUrl }

  if (jsonByteLength(draft) > LIMITS.captureJsonBytes) {
    throw new ChatStashError('PAYLOAD_TOO_LARGE', 'Capture payload exceeds the byte limit')
  }

  return draft
}

export type CaptureRole = CaptureDraft['messages'][number]['role']
