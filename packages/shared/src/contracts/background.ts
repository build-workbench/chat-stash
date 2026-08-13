import { z } from 'zod'

import { captureDraftSchema } from './capture'

export const saveCaptureRequestSchema = z
  .object({
    type: z.literal('save-capture'),
    draft: captureDraftSchema,
  })
  .strict()

export type SaveCaptureRequest = z.infer<typeof saveCaptureRequestSchema>

export const saveCaptureResponseSchema = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('created'),
    conversationId: z.string().uuid(),
  }),
  z.object({
    outcome: z.literal('duplicate'),
    conversationId: z.string().uuid(),
  }),
])

export type SaveCaptureResponse = z.infer<typeof saveCaptureResponseSchema>

export const authStatusRequestSchema = z
  .object({
    type: z.literal('auth-status'),
  })
  .strict()

export const authStatusResponseSchema = z.object({
  authenticated: z.boolean(),
  email: z.string().email().nullable(),
})

export type AuthStatusResponse = z.infer<typeof authStatusResponseSchema>

export const signInRequestSchema = z
  .object({
    type: z.literal('sign-in'),
    email: z.string().email(),
    password: z.string().min(6).max(200),
  })
  .strict()

export const signOutRequestSchema = z
  .object({
    type: z.literal('sign-out'),
  })
  .strict()
