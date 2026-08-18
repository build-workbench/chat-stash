import { describe, expect, test } from 'vitest'

import { searchQuerySchema } from '@/lib/validation/search'
import { folderNameSchema } from '@/lib/validation/organization'

describe('search query contract', () => {
  test('rejects blank and one-character queries', () => {
    expect(searchQuerySchema.safeParse('').success).toBe(false)
    expect(searchQuerySchema.safeParse('  ').success).toBe(false)
    expect(searchQuerySchema.safeParse('a').success).toBe(false)
    expect(searchQuerySchema.safeParse('ab').success).toBe(true)
  })

  test('trims and enforces the 200 character maximum', () => {
    expect(searchQuerySchema.safeParse(`  ${'x'.repeat(200)}  `).success).toBe(true)
    expect(searchQuerySchema.safeParse('x'.repeat(201)).success).toBe(false)
  })
})

describe('organization names', () => {
  test('rejects empty, multiline, and oversized names', () => {
    expect(folderNameSchema.safeParse('').success).toBe(false)
    expect(folderNameSchema.safeParse('Work\nHome').success).toBe(false)
    expect(folderNameSchema.safeParse('A'.repeat(81)).success).toBe(false)
    expect(folderNameSchema.safeParse('  Notes  ').success).toBe(true)
  })
})
