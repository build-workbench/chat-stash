import { useEffect, useState } from 'react'

type AuthState =
  | { status: 'loading' }
  | { status: 'signed-out'; error?: string }
  | { status: 'signed-in'; email: string }

type BackgroundResponse = { ok: true; data: unknown } | { ok: false; error: string }

export function PopupApp() {
  const [state, setState] = useState<AuthState>({ status: 'loading' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    chrome.runtime
      .sendMessage({ type: 'auth-status' })
      .then((res: BackgroundResponse | undefined) => {
        if (cancelled) return
        if (res?.ok && isAuthStatus(res.data) && res.data.authenticated) {
          setState({ status: 'signed-in', email: res.data.email ?? '' })
        } else {
          setState({ status: 'signed-out' })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'signed-out' })
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSignIn(event: React.FormEvent) {
    event.preventDefault()
    if (!email || !password || busy) return
    setBusy(true)
    setState({ status: 'signed-out' })
    try {
      const res = (await chrome.runtime.sendMessage({ type: 'sign-in', email, password })) as
        BackgroundResponse | undefined
      if (res?.ok && isAuthStatus(res.data) && res.data.authenticated) {
        setState({ status: 'signed-in', email: res.data.email ?? '' })
      } else if (res?.ok === false && res.error === 'INVALID_CREDENTIALS') {
        setState({ status: 'signed-out', error: 'Invalid email or password.' })
      } else {
        setState({ status: 'signed-out', error: 'Unable to sign in. Please try again.' })
      }
    } catch {
      setState({ status: 'signed-out', error: 'Unable to reach the extension.' })
    } finally {
      setBusy(false)
    }
  }

  async function handleSignOut() {
    try {
      await chrome.runtime.sendMessage({ type: 'sign-out' })
    } finally {
      setState({ status: 'signed-out' })
    }
  }

  if (state.status === 'loading') {
    return <main style={styles.main}>Loading…</main>
  }

  if (state.status === 'signed-in') {
    return (
      <main style={styles.main}>
        <h1 style={styles.title}>ChatStash</h1>
        <p style={styles.muted}>Signed in as {state.email}</p>
        <button style={styles.button} onClick={handleSignOut}>
          Sign out
        </button>
      </main>
    )
  }

  return (
    <main style={styles.main}>
      <h1 style={styles.title}>Sign in to ChatStash</h1>
      <form onSubmit={handleSignIn} style={styles.form}>
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
          required
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          required
        />
        {state.error ? (
          <p role="alert" style={styles.error}>
            {state.error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} style={styles.button}>
          {busy ? 'Working…' : 'Sign in'}
        </button>
      </form>
      <p style={styles.muted}>
        No account?{' '}
        <a
          href={`${process.env.PLASMO_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/sign-up`}
          target="_blank"
          rel="noreferrer"
        >
          Sign up on the web
        </a>
      </p>
    </main>
  )
}

function isAuthStatus(value: unknown): value is { authenticated: boolean; email: string | null } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'authenticated' in value &&
    typeof (value as { authenticated: unknown }).authenticated === 'boolean'
  )
}

const styles: Record<string, React.CSSProperties> = {
  main: { width: 280, padding: 16, fontFamily: 'system-ui, sans-serif' },
  title: { fontSize: 16, margin: '0 0 12px' },
  form: { display: 'flex', flexDirection: 'column', gap: 8 },
  input: { padding: '6px 8px', fontSize: 14, border: '1px solid #ccc', borderRadius: 4 },
  button: {
    padding: '8px 12px',
    fontSize: 14,
    border: 'none',
    borderRadius: 4,
    background: '#1a73e8',
    color: '#fff',
    cursor: 'pointer',
  },
  error: { color: '#d93025', fontSize: 13, margin: 0 },
  muted: { color: '#5f6368', fontSize: 13 },
}
