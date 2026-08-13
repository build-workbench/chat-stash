import { z } from 'zod'

import { LIMITS } from '../limits'
import { sourcePlatformSchema } from './capture'

export const listCursorSchema = z
  .object({
    savedAt: z.string().datetime(),
    id: z.string().uuid(),
  })
  .strict()

export type ListCursor = z.infer<typeof listCursorSchema>

export const searchCursorSchema = z
  .object({
    rank: z.number(),
    savedAt: z.string().datetime(),
    id: z.string().uuid(),
  })
  .strict()

export type SearchCursor = z.infer<typeof searchCursorSchema>

export const searchRequestSchema = z
  .object({
    query: z.string().trim().min(LIMITS.searchQuery.min).max(LIMITS.searchQuery.max),
    folderId: z.string().uuid().nullable().optional(),
    tagId: z.string().uuid().nullable().optional(),
    cursor: searchCursorSchema.nullable().optional(),
    limit: z.number().int().min(1).max(LIMITS.pageSize.max).default(LIMITS.pageSize.default),
  })
  .strict()

export type SearchRequest = z.infer<typeof searchRequestSchema>

export const searchResultSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string(),
  sourcePlatform: sourcePlatformSchema,
  sourceUrl: z.string(),
  folderId: z.string().uuid().nullable(),
  savedAt: z.string().datetime(),
  rank: z.number(),
})

export type SearchResult = z.infer<typeof searchResultSchema>
