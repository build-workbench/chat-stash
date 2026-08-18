'use client'

import { deleteConversation } from '@/features/conversations/actions'

export function ConfirmDelete({ id }: { id: string }) {
  return (
    <form
      action={deleteConversation}
      onSubmit={(event) => {
        if (!window.confirm('Delete this saved conversation? This cannot be undone.')) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="danger">
        Delete
      </button>
    </form>
  )
}
