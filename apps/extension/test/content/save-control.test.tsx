// @vitest-environment jsdom

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import type { AdapterTarget } from '@chatstash/adapters'
import { syntheticAdapter } from '@chatstash/adapters'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { SaveControl } from '@/ui/save-control/SaveControl'

const mockSendMessage = vi.fn()

beforeEach(() => {
  mockSendMessage.mockReset()
  vi.stubGlobal('chrome', {
    runtime: {
      id: 'test-ext-id',
      sendMessage: mockSendMessage,
    },
  })
})

afterEach(() => {
  cleanup()
})

function loadTarget(fixture: string, messageId: string): AdapterTarget {
  const html = readFileSync(
    resolve('../../packages/adapters/fixtures/synthetic', `${fixture}.html`),
    'utf8',
  )
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const element = doc.querySelector(`[data-chatstash-message-id="${messageId}"]`) as HTMLElement
  return { responseElement: element, mountPoint: element, localKey: messageId }
}

const pageUrl = new URL('https://synthetic.chatstash.test/c/1')

describe('SaveControl', () => {
  test('renders a save button in the idle state', () => {
    render(
      <SaveControl
        adapter={syntheticAdapter}
        target={loadTarget('basic', 'a1')}
        pageUrl={pageUrl}
      />,
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
  })

  test('disables the button while the response is streaming', () => {
    render(
      <SaveControl
        adapter={syntheticAdapter}
        target={loadTarget('streaming', 'a1')}
        pageUrl={pageUrl}
      />,
    )
    const button = screen.getByRole('button', { name: 'Generating…' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  test('a completed response becomes saveable again after streaming ends', async () => {
    const target = loadTarget('streaming', 'a1')
    const { rerender } = render(
      <SaveControl adapter={syntheticAdapter} target={target} pageUrl={pageUrl} />,
    )
    expect(screen.getByRole('button', { name: 'Generating…' })).toBeDefined()

    target.responseElement.dataset.chatstashState = 'complete'
    target.responseElement.querySelector('[data-chatstash-streaming-indicator]')?.remove()
    rerender(<SaveControl adapter={syntheticAdapter} target={target} pageUrl={pageUrl} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
    })
  })

  test('extracts and saves via the background on click', async () => {
    mockSendMessage.mockResolvedValue({
      ok: true,
      data: { outcome: 'created', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })

    render(
      <SaveControl
        adapter={syntheticAdapter}
        target={loadTarget('basic', 'a1')}
        pageUrl={pageUrl}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Saved ✓' })).toBeDefined()
    })

    const sent = mockSendMessage.mock.calls[0][0]
    expect(sent.type).toBe('save-capture')
    expect(sent.draft.messages).toHaveLength(2)
    expect(sent.draft.messages[0].role).toBe('user')
    expect(sent.draft.messages[1].role).toBe('assistant')
  })

  test('shows the duplicate state when the background reports duplicate', async () => {
    mockSendMessage.mockResolvedValue({
      ok: true,
      data: { outcome: 'duplicate', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })

    render(
      <SaveControl
        adapter={syntheticAdapter}
        target={loadTarget('basic', 'a1')}
        pageUrl={pageUrl}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Already saved' })).toBeDefined()
    })
  })

  test('locks the control while saving', async () => {
    let resolveMessage: (value: unknown) => void
    mockSendMessage.mockReturnValue(new Promise((resolveFn) => (resolveMessage = resolveFn)))

    render(
      <SaveControl
        adapter={syntheticAdapter}
        target={loadTarget('basic', 'a1')}
        pageUrl={pageUrl}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saving = screen.getByRole('button', { name: 'Saving…' })
    expect((saving as HTMLButtonElement).disabled).toBe(true)
    expect(mockSendMessage).toHaveBeenCalledTimes(1)

    resolveMessage!({
      ok: true,
      data: { outcome: 'created', conversationId: 'f5b5e7a0-1f1e-4b2a-9c3d-4e5f6a7b8c9d' },
    })
  })

  test('shows an error state with retry on a failed save', async () => {
    mockSendMessage.mockResolvedValue({ ok: false, error: 'NETWORK_ERROR' })

    render(
      <SaveControl
        adapter={syntheticAdapter}
        target={loadTarget('basic', 'a1')}
        pageUrl={pageUrl}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeDefined()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toBeDefined()
    })
  })

  test('maps an extraction failure to an error state', async () => {
    // An orphaned assistant has no paired prompt: extraction throws PAIR_NOT_FOUND.
    const target = loadTarget('invalid', 'a1')
    render(<SaveControl adapter={syntheticAdapter} target={target} pageUrl={pageUrl} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeDefined()
    })
    expect(mockSendMessage).not.toHaveBeenCalled()
  })
})
