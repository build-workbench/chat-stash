import { z } from 'zod'

export const signInSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const signUpSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
})

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(6, 'Password must be at least 6 characters'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export function safeRedirectPath(value: string | null | undefined, fallback = '/conversations') {
  if (!value) return fallback
  // Only allow same-origin relative paths. Reject protocol-relative and absolute URLs.
  if (!value.startsWith('/') || value.startsWith('//')) return fallback
  // Reject control characters and whitespace that could enable header injection.
  if (/[\p{Cc}\s]/u.test(value)) return fallback
  return value
}
