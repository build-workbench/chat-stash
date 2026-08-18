import { LIMITS } from '@chatstash/shared'
import { z } from 'zod'

export const searchQuerySchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(LIMITS.searchQuery.min).max(LIMITS.searchQuery.max))
