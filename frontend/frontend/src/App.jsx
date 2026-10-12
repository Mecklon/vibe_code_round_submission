import { useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:9090'

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
    .split(';')
    .map((entry) => entry.trim())
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

async function streamMessage(conversationId, message, tonePreference, onToken) {
  if (!csrfCookie()) await refreshCsrfToken()

  const response = await fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': csrfCookie(),
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ message, tonePreference }),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.message || 'Could not send your message. Please try again.')
  }

  if (!response.body) throw new Error('Streaming is not available in this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  function processEvent(block) {
    let eventName = 'message'
    const data = []

    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim()
      if (line.startsWith('data:')) data.push(line.slice(5).trimStart())
    }

    const value = data.join('\n')
    if (eventName === 'token') onToken(value)
    if (eventName === 'error') throw new Error(value || 'The AI could not complete the reply.')
  }

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')

    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)
      if (block) processEvent(block)
      boundary = buffer.indexOf('\n\n')
    }

    if (done) break
  }

  if (buffer.trim()) processEvent(buffer)
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
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [draft, setDraft] = useState('')
  const [tone, setTone] = useState('PROFESSIONAL')
  const [streaming, setStreaming] = useState(false)
  const conversationEndRef = useRef(null)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      try {
        await refreshCsrfToken()
        const currentUser = await apiRequest('/api/auth/me')
        if (active) {
          setUser(currentUser)
          setTone(currentUser.tonePreference || 'PROFESSIONAL')
        }
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

  useEffect(() => {
    if (!user) return

    let active = true
    apiRequest('/api/conversations')
      .then((items) => {
        if (active) setConversations(items)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })

    return () => {
      active = false
    }
  }, [user])

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [activeConversation?.messages, streaming])

  async function startConversation() {
    setError('')
    try {
      const conversation = await apiRequest('/api/conversations', { method: 'POST' })
      setActiveConversation(conversation)
      setConversations((items) => [conversation, ...items])
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function openConversation(id) {
    setError('')
    try {
      const conversation = await apiRequest(`/api/conversations/${id}`)
      setActiveConversation(conversation)
      setTone(conversation.tonePreference || tone)
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  async function changeTone(event) {
    const nextTone = event.target.value
    const previousTone = tone
    setTone(nextTone)
    try {
      const updatedUser = await apiRequest('/api/auth/preferences/tone', {
        method: 'POST',
        body: JSON.stringify({ tonePreference: nextTone }),
      })
      setUser(updatedUser)
    } catch (requestError) {
      setTone(previousTone)
      setError(requestError.message)
    }
  }

  async function sendMessage(event) {
    event.preventDefault()
    const message = draft.trim()
    if (!message || streaming) return

    setError('')
    setDraft('')
    setStreaming(true)

    try {
      let conversation = activeConversation
      if (!conversation) {
        conversation = await apiRequest('/api/conversations', { method: 'POST' })
        setActiveConversation(conversation)
      }

      const userMessage = { role: 'user', content: message, createdAt: new Date().toISOString() }
      setActiveConversation((current) => ({
        ...(current || conversation),
        messages: [...(current?.messages || conversation.messages || []), userMessage, {
          role: 'assistant',
          content: '',
          createdAt: new Date().toISOString(),
        }],
      }))

      let streamedText = ''
      await streamMessage(conversation.id, message, tone, (chunk) => {
        streamedText += chunk
        setActiveConversation((current) => {
          if (!current) return current
          const messages = [...current.messages]
          messages[messages.length - 1] = { ...messages[messages.length - 1], content: streamedText }
          return { ...current, messages }
        })
      })

      const refreshed = await apiRequest(`/api/conversations/${conversation.id}`)
      setActiveConversation(refreshed)
      setConversations((items) => [
        { ...conversation, title: refreshed.title, tonePreference: tone, updatedAt: refreshed.updatedAt },
        ...items.filter((item) => item.id !== conversation.id),
      ])
    } catch (requestError) {
      setError(requestError.message)
      setActiveConversation((current) => {
        if (!current?.messages?.length) return current
        const messages = [...current.messages]
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === 'assistant' && !lastMessage.content) {
          messages[messages.length - 1] = {
            ...lastMessage,
            content: 'This reply was interrupted. Your message is saved; please try again.',
          }
        }
        return { ...current, messages }
      })
    } finally {
      setStreaming(false)
    }
  }

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
      setTone(signedInUser.tonePreference || 'PROFESSIONAL')
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
      setConversations([])
      setActiveConversation(null)
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
      <main className="workspace">
        <aside className="workspace-sidebar">
          <a className="brand" href="/" aria-label="Clarity home">
            <span className="brand-mark"><SparkleIcon /></span>
            <span>clarity<span className="brand-period">.</span></span>
          </a>
          <button className="new-chat-button" type="button" onClick={startConversation}>
            <span>＋</span> New conversation
          </button>
          <div className="sidebar-label">YOUR CONVERSATIONS</div>
          <nav className="conversation-list" aria-label="Previous conversations">
            {conversations.map((conversation) => (
              <button
                type="button"
                key={conversation.id}
                className={`conversation-link${activeConversation?.id === conversation.id ? ' selected' : ''}`}
                onClick={() => openConversation(conversation.id)}
              >
                <span className="conversation-icon">◷</span>
                <span className="conversation-title">{conversation.title || 'New conversation'}</span>
              </button>
            ))}
            {!conversations.length && <p className="empty-history">Your conversations will appear here.</p>}
          </nav>
          <div className="sidebar-user">
            <span className="avatar">{user.displayName?.charAt(0)?.toUpperCase() || 'U'}</span>
            <span className="sidebar-user-copy"><strong>{user.displayName}</strong><small>{user.email}</small></span>
            <button className="logout-button" type="button" onClick={handleLogout} disabled={loading} aria-label="Sign out">
              <LogoutIcon />
            </button>
          </div>
        </aside>

        <section className="chat-workspace">
          <header className="chat-topbar">
            <div className="current-chat-title">
              <span className="online-indicator" />
              <span>{activeConversation?.title || 'A space to think'}</span>
            </div>
            <label className="tone-select">
              <span>TONE</span>
              <select value={tone} onChange={changeTone} aria-label="Response tone">
                <option value="PROFESSIONAL">Professional</option>
                <option value="CASUAL">Casual</option>
                <option value="CONCISE">Concise</option>
              </select>
            </label>
          </header>

          <div className={`chat-content${activeConversation?.messages?.length ? ' has-messages' : ''}`}>
            {activeConversation?.messages?.length ? (
              <div className="message-thread" aria-live="polite">
                {activeConversation.messages.map((message, index) => (
                  <article className={`chat-message ${message.role}`} key={`${message.createdAt}-${index}`}>
                    {message.role === 'assistant' && <span className="assistant-avatar"><SparkleIcon /></span>}
                    <div className="message-body">
                      {message.role === 'assistant' && <span className="message-author">Clarity</span>}
                      <p>{message.content || (streaming && index === activeConversation.messages.length - 1
                        ? <span className="typing-indicator"><i /><i /><i /></span>
                        : '')}</p>
                    </div>
                  </article>
                ))}
                <div ref={conversationEndRef} />
              </div>
            ) : (
              <div className="chat-welcome">
                <span className="welcome-mark"><SparkleIcon /></span>
                <span className="eyebrow">A LITTLE SPACE TO THINK</span>
                <h1>What’s on your mind?</h1>
                <p>Ask a question, explore an idea, or simply start wherever you are.</p>
                <div className="suggestion-chips">
                  {['Help me think through an idea', 'Explain something simply', 'Help me get started'].map((suggestion) => (
                    <button type="button" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}<ArrowIcon /></button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="composer-area">
            {error && <p className="workspace-error" role="alert">{error}</p>}
            <form className="message-composer" onSubmit={sendMessage}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form.requestSubmit()
                  }
                }}
                placeholder="Write your message…"
                aria-label="Write your message"
                rows="1"
                maxLength="12000"
                disabled={streaming}
              />
              <button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim() || streaming}>
                {streaming ? <span className="send-spinner" /> : <ArrowIcon />}
              </button>
            </form>
            <p className="composer-note">Thoughtful responses, one message at a time · Enter to send · Shift + Enter for a new line</p>
          </div>
        </section>
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

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M8 4H4.5A1.5 1.5 0 0 0 3 5.5v9A1.5 1.5 0 0 0 4.5 16H8m4-3 3-3-3-3m3 3H7" />
    </svg>
  )
}

export default App
