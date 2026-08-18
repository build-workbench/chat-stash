'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LIMITS } from '@chatstash/shared'
import { conversationListHref } from '@/features/conversations/href'

export function SearchBox({
  initialQuery,
  folderId,
  tagId,
}: {
  initialQuery: string
  folderId?: string
  tagId?: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(initialQuery)
  const skipDebounce = useRef(true)

  useEffect(() => {
    setValue(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    if (skipDebounce.current) {
      skipDebounce.current = false
      return
    }
    const handle = window.setTimeout(() => {
      const trimmed = value.trim()
      router.replace(
        conversationListHref({
          folderId,
          tagId,
          query: trimmed.length >= LIMITS.searchQuery.min ? trimmed : undefined,
        }),
      )
    }, 300)
    return () => window.clearTimeout(handle)
  }, [value, folderId, tagId, router])

  return (
    <label>
      Search
      <input
        type="search"
        name="q"
        value={value}
        maxLength={LIMITS.searchQuery.max}
        placeholder="Search titles and messages"
        onChange={(event) => setValue(event.target.value)}
      />
      {value.trim().length === 1 ? <p className="muted">Enter at least 2 characters.</p> : null}
    </label>
  )
}
