import type { ErrorCode } from '@chatstash/shared'

export type SavePhase = 'unavailable' | 'idle' | 'saving' | 'saved' | 'duplicate' | 'error'

export interface SaveControlState {
  phase: SavePhase
  errorCode?: ErrorCode
}

export const INITIAL_STATE: SaveControlState = { phase: 'idle' }

/** A save may start only from idle; streaming/in-progress states are locked. */
export function canStartSave(state: SaveControlState): boolean {
  return state.phase === 'idle'
}

/** Mirror the adapter's streaming signal onto the state (idle <-> unavailable). */
export function applyStreaming(state: SaveControlState, streaming: boolean): SaveControlState {
  if (streaming && state.phase === 'idle') return { phase: 'unavailable' }
  if (!streaming && state.phase === 'unavailable') return { phase: 'idle' }
  return state
}

export function startSave(state: SaveControlState): SaveControlState {
  if (state.phase !== 'idle') return state
  return { phase: 'saving' }
}

export function completeSave(
  state: SaveControlState,
  outcome: 'created' | 'duplicate',
): SaveControlState {
  if (state.phase !== 'saving') return state
  return { phase: outcome === 'duplicate' ? 'duplicate' : 'saved' }
}

export function failSave(state: SaveControlState, errorCode: ErrorCode): SaveControlState {
  if (state.phase !== 'saving') return state
  return { phase: 'error', errorCode }
}

/** Retry moves an error state back to idle; a locked saving state never resets. */
export function retrySave(state: SaveControlState): SaveControlState {
  if (state.phase !== 'error') return state
  return { phase: 'idle' }
}
