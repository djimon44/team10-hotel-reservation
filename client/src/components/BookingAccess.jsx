import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { request } from '../clientApi.js'

export function BookingAccess({ user, onSignIn }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const previous = location.state?.returnTo
  const returnTo = typeof previous === 'string' && /^\/(?![/\\])/.test(previous) && previous !== '/login'
    ? previous : '/'

  async function signIn(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setPending(true)
    setError('')
    try {
      const session = await request('/auth/login', { method: 'POST', body: data })
      onSignIn(session.user)
      navigate(returnTo === '/' && session.user.role !== 'guest' ? '/reception' : returnTo, { replace: true })
    } catch (failure) {
      setError(failure.message)
      setPending(false)
    }
  }

  if (user && !pending) return <Navigate replace to={returnTo} />

  return (
    <section className="shell page access-layout">
      <div className="panel access">
        <h1>Sign in</h1><p>Access your reservations or the reception dashboard.</p>
        <form onSubmit={signIn}>
          <label>Email<input name="email" type="email" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
        </form>
      </div>
    </section>
  )
}

export function BookingRole({ user, pending, roles, children }) {
  const location = useLocation()
  if (pending) return <p className="shell notice" role="status">Checking your session…</p>
  if (!user) return (
    <section className="shell page"><h1>Sign in to continue</h1>
      <Link className="button primary" to="/login" state={{ returnTo: location.pathname + location.search }}>Sign in</Link>
    </section>
  )
  if (!roles.includes(user.role)) return <section className="shell page"><h1>Access unavailable</h1><p>This page isn’t available to your account.</p><Link to="/">Find a room</Link></section>
  return children
}
