import { useEffect, useRef, useState } from 'react'

import {
  isChatStashError,
  type CaptureDraft,
  type ErrorCode,
  type SaveCaptureResponse,
} from '@chatstash/shared'
import type { AdapterTarget, SiteAdapter } from '@chatstash/adapters'

import { applyStreaming, canStartSave, type SaveControlState } from './state'

export interface SaveControlProps {
  adapter: SiteAdapter
  target: AdapterTarget
  pageUrl: URL
}

type BackgroundResponse = { ok: true; data: SaveCaptureResponse } | { ok: false; error: ErrorCode }

export function SaveControl({ adapter, target, pageUrl }: SaveControlProps) {
  const [state, setState] = useState<SaveControlState>({ phase: 'idle' })
  const stateRef = useRef(state)
  stateRef.current = state

  // Mirror the adapter's streaming signal onto the finite state machine.
  const streaming = adapter.isStreaming(target)
  useEffect(() => {
    setState((prev) => applyStreaming(prev, streaming))
  }, [streaming])

  async function handleSave() {
    if (!canStartSave(stateRef.current)) return

    setState({ phase: 'saving' })
    try {
      const draft: CaptureDraft = adapter.extract(target, pageUrl)
      const res = (await chrome.runtime.sendMessage({
        type: 'save-capture',
        draft,
      })) as BackgroundResponse | undefined

      if (res?.ok) {
        setState({ phase: res.data.outcome === 'duplicate' ? 'duplicate' : 'saved' })
      } else {
        setState({ phase: 'error', errorCode: res?.error ?? 'SAVE_FAILED' })
      }
    } catch (err) {
      setState({
        phase: 'error',
        errorCode: isChatStashError(err) ? err.code : 'INVALID_CAPTURE',
      })
    }
  }

  if (state.phase === 'error') {
    return (
      <div data-chatstash-control data-chatstash-state="error">
        <span>Save failed</span>
        <button type="button" onClick={() => setState({ phase: 'idle' })}>
          Retry
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      data-chatstash-control
      data-chatstash-state={state.phase}
      disabled={state.phase !== 'idle'}
      onClick={handleSave}
      title={state.phase === 'unavailable' ? 'Response is still generating' : undefined}
    >
      {labelFor(state)}
    </button>
  )
}

function labelFor(state: SaveControlState): string {
  switch (state.phase) {
    case 'unavailable':
      return 'Generating…'
    case 'saving':
      return 'Saving…'
    case 'saved':
      return 'Saved ✓'
    case 'duplicate':
      return 'Already saved'
    case 'error':
      return 'Save failed'
    default:
      return 'Save'
  }
}
