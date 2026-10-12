import { useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

async function refreshCsrfToken() {
  const response = await fetch(`${API_URL}/api/auth/csrf`, {
    credentials: 'include',
  })
  if (!response.ok) {
    throw new Error('Could not initialize a secure connection. Please try again.')
  }
}

function csrfCookie() {
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('XSRF-TOKEN='))
  return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : ''
}

async function apiRequest(path, options = {}) {
  const headers = { ...options.headers }
  if (options.body) headers['Content-Type'] = 'application/json'

  if (options.method && options.method !== 'GET') {
    if (!csrfCookie()) await refreshCsrfToken()
    headers['X-XSRF-TOKEN'] = csrfCookie()
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  const body = response.status === 204 ? null : await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.message || 'Something went wrong. Please try again.')
  }

  return body
}

function App() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [user, setUser] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        await refreshCsrfToken()
        const currentUser = await apiRequest('/api/auth/me')
        if (active) setUser(currentUser)
      } catch (sessionError) {
        if (active && sessionError.message.includes('initialize a secure connection')) {
          setError(sessionError.message)
        }
      } finally {
        if (active) setCheckingSession(false)
      }
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        await apiRequest('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, displayName }),
        })
        await refreshCsrfToken()
      }

      const signedInUser = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setUser(signedInUser)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setError('')
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' })
      setUser(null)
      setPassword('')
      setMode('login')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return <main className="app-shell loading-screen"><span className="loader" />Securing your session…</main>
  }

  if (user) {
    return (
      <main className="app-shell">
        <section className="welcome-card" aria-live="polite">
          <div className="brand-mark"><SparkleIcon /></div>
          <span className="eyebrow">YOUR SPACE IS READY</span>
          <h1>Welcome in, {user.displayName}.</h1>
          <p>You’re signed in and ready to pick up where your ideas take you.</p>
          <div className="profile-chip">
            <span className="avatar">{user.displayName?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span><strong>{user.displayName}</strong><small>{user.email}</small></span>
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="submit-button" type="button" onClick={handleLogout} disabled={loading}>
            {loading ? 'Signing out…' : 'Sign out'}
            {!loading && <ArrowIcon />}
          </button>
        </section>
        <p className="page-note">A little clarity goes a long way.</p>
      </main>
    )
  }

  const isRegistering = mode === 'register'

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <a className="brand" href="/" aria-label="Clarity home">
          <span className="brand-mark"><SparkleIcon /></span>
          <span>clarity<span className="brand-period">.</span></span>
        </a>
        <span className="topbar-note">A calmer kind of conversation</span>
      </header>

      <section className="auth-layout">
        <div className="intro-panel">
          <span className="eyebrow"><span className="status-dot" /> YOUR THOUGHTS, IN GOOD COMPANY</span>
          <h1>Make space for<br /><em>what matters.</em></h1>
          <p className="intro-copy">A thoughtful place to explore ideas, untangle questions, and find your next bright thought.</p>
          <div className="quote-card">
            <span className="quote-symbol">“</span>
            <p>Somewhere between a question and an answer, a new idea appears.</p>
            <span className="quote-rule" />
            <span className="quote-label">A NOTE TO SELF</span>
          </div>
          <div className="orbit orbit-large" />
          <div className="orbit orbit-small" />
          <span className="sparkle sparkle-top">✳</span>
          <span className="sparkle sparkle-bottom">✳</span>
        </div>

        <div className="form-panel">
          <div className="form-heading">
            <div className="mobile-brand-mark"><SparkleIcon /></div>
            <span className="eyebrow">{isRegistering ? 'A FRESH START' : 'GOOD TO HAVE YOU BACK'}</span>
            <h2>{isRegistering ? 'Create your account' : 'Welcome back'}</h2>
            <p>{isRegistering ? 'Your next conversation is just a moment away.' : 'Sign in to continue your conversation.'}</p>
          </div>

          <div className="mode-switch" role="tablist" aria-label="Account action">
            <button
              type="button"
              role="tab"
              aria-selected={!isRegistering}
              className={!isRegistering ? 'active' : ''}
              onClick={() => { setMode('login'); setError('') }}
            >Sign in</button>
            <button
              type="button"
              role="tab"
              aria-selected={isRegistering}
              className={isRegistering ? 'active' : ''}
              onClick={() => { setMode('register'); setError('') }}
            >Create account</button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {isRegistering && (
              <label className="field">
                <span>Your name</span>
                <input
                  type="text"
                  name="displayName"
                  placeholder="How should we address you?"
                  autoComplete="name"
                  maxLength="80"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </label>
            )}
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                maxLength="254"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                placeholder={isRegistering ? 'At least 8 characters' : 'Enter your password'}
                autoComplete={isRegistering ? 'new-password' : 'current-password'}
                minLength={isRegistering ? '8' : undefined}
                maxLength="72"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error && <p className="form-error" role="alert">{error}</p>}

            <button className="submit-button" type="submit" disabled={loading}>
              {loading ? 'One moment…' : isRegistering ? 'Create your account' : 'Sign in'}
              {!loading && <ArrowIcon />}
            </button>
          </form>

          <div className="form-footer">
            <span className="lock-icon"><LockIcon /></span>
            <span>Your conversations stay yours. Always.</span>
          </div>
        </div>
      </section>
      <footer className="page-note">Made for the moments when you need a little more clarity.</footer>
    </main>
  )
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 14.6 9.4 21.5 12l-6.9 2.6L12 21.5l-2.6-6.9L2.5 12l6.9-2.6L12 2.5Z" />
      <path d="m19 2 .8 2.2L22 5l-2.2.8L19 8l-.8-2.2L16 5l2.2-.8L19 2Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11m-4-4 4 4-4 4" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V4.5a2.5 2.5 0 0 1 5 0V7" />
    </svg>
  )
}

export default App
