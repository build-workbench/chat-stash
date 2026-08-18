import { LIMITS } from '@chatstash/shared'
import { z } from 'zod'

export const conversationIdSchema = z.string().uuid()

export const listQuerySchema = z.object({
  folderId: z.string().uuid().nullable().optional(),
  tagId: z.string().uuid().nullable().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(LIMITS.pageSize.max).default(LIMITS.pageSize.default),
})

export type ListQuery = z.infer<typeof listQuerySchema>
