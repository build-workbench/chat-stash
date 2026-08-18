import { LIMITS } from '@chatstash/shared'
import { z } from 'zod'

const nameSchema = z
  .string()
  .trim()
  .min(LIMITS.folderTagName.min)
  .max(LIMITS.folderTagName.max)
  .refine((value) => !/[\n\r\p{Cc}]/u.test(value), 'Name must be a single line')

export const folderNameSchema = nameSchema
export const tagNameSchema = nameSchema
export const uuidSchema = z.string().uuid()

export const createFolderSchema = z.object({
  name: folderNameSchema,
  parentId: uuidSchema.nullable().optional(),
})

export const renameFolderSchema = z.object({
  id: uuidSchema,
  name: folderNameSchema,
})

export const reparentFolderSchema = z.object({
  id: uuidSchema,
  parentId: uuidSchema.nullable(),
})

export const moveConversationSchema = z.object({
  conversationId: uuidSchema,
  folderId: uuidSchema.nullable(),
})

export const tagAttachSchema = z.object({
  conversationId: uuidSchema,
  tagId: uuidSchema,
})
