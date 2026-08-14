import { describe, expect, test } from 'vitest'
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  safeRedirectPath,
  signInSchema,
  signUpSchema,
} from '@/lib/validation/auth'

describe('auth validation', () => {
  test('signInSchema accepts valid input', () => {
    const result = signInSchema.safeParse({ email: 'a@b.com', password: '123456' })
    expect(result.success).toBe(true)
  })

  test('signInSchema rejects invalid email', () => {
    const result = signInSchema.safeParse({ email: 'not-an-email', password: '123456' })
    expect(result.success).toBe(false)
  })

  test('signInSchema rejects short password', () => {
    const result = signInSchema.safeParse({ email: 'a@b.com', password: '12345' })
    expect(result.success).toBe(false)
  })

  test('signUpSchema accepts valid input', () => {
    const result = signUpSchema.safeParse({ email: 'a@b.com', password: '123456' })
    expect(result.success).toBe(true)
  })

  test('forgotPasswordSchema accepts valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'a@b.com' })
    expect(result.success).toBe(true)
  })

  test('resetPasswordSchema rejects mismatched passwords', () => {
    const result = resetPasswordSchema.safeParse({ password: '123456', confirmPassword: '654321' })
    expect(result.success).toBe(false)
  })

  test('resetPasswordSchema accepts matching passwords', () => {
    const result = resetPasswordSchema.safeParse({ password: '123456', confirmPassword: '123456' })
    expect(result.success).toBe(true)
  })
})

describe('safeRedirectPath', () => {
  test('allows same-origin relative paths', () => {
    expect(safeRedirectPath('/conversations')).toBe('/conversations')
    expect(safeRedirectPath('/conversations/123')).toBe('/conversations/123')
  })

  test('rejects protocol-relative URLs', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/conversations')
  })

  test('rejects absolute URLs', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/conversations')
    expect(safeRedirectPath('http://evil.com')).toBe('/conversations')
  })

  test('rejects paths with control characters', () => {
    expect(safeRedirectPath('/foo\nbar')).toBe('/conversations')
    expect(safeRedirectPath('/foo\rbar')).toBe('/conversations')
    expect(safeRedirectPath('/foo\tbar')).toBe('/conversations')
  })

  test('rejects paths with spaces', () => {
    expect(safeRedirectPath('/foo bar')).toBe('/conversations')
  })

  test('returns fallback for empty or null input', () => {
    expect(safeRedirectPath('')).toBe('/conversations')
    expect(safeRedirectPath(null)).toBe('/conversations')
    expect(safeRedirectPath(undefined)).toBe('/conversations')
  })

  test('uses custom fallback when provided', () => {
    expect(safeRedirectPath('//evil.com', '/sign-in')).toBe('/sign-in')
  })
})
