import { useContext, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AuthContext } from '../AuthContext.js'
import { request } from '../clientApi.js'

export function BookingAccess({ registering = false }) {
  const { user, pending: checkingSession, reload } = useContext(AuthContext)
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const previous = location.state?.returnTo
  const returnTo = typeof previous === 'string' && /^\/(?![/\\])/.test(previous) &&
    !['/login', '/register'].includes(previous.split(/[?#]/)[0]) ? previous : '/'

  async function submit(event) {
    event.preventDefault()
    const data = Object.fromEntries(new FormData(event.currentTarget))
    setPending(true)
    setError('')
    try {
      if (registering) {
        const { user: guest } = await request('/auth/register', { method: 'POST', body: data })
        navigate('/login', { replace: true, state: { returnTo, registeredEmail: guest.email } })
      } else {
        const session = await request('/auth/login', { method: 'POST', body: data })
        reload()
        navigate(returnTo === '/' && session.user.role !== 'guest' ? '/reception' : returnTo, { replace: true })
      }
    } catch (failure) {
      const detail = failure.details?.[0]
      setError(detail ? detail.field + ': ' + detail.message : failure.message)
      setPending(false)
    }
  }

  if (checkingSession) return <p className="shell notice" role="status">Checking your session…</p>
  if (user && !pending) return <Navigate replace to={returnTo} />

  return (
    <section className="shell page access-layout">
      <div className="panel access">
        <h1>{registering ? 'Create a guest account' : 'Sign in'}</h1>
        {registering ? <p>Book a room and manage your reservations.</p>
          : location.state?.registeredEmail ? <p role="status">Your account is ready. Sign in to continue.</p>
          : <p>Access your reservations or the reception dashboard.</p>}
        <form onSubmit={submit}>
          {registering && <label>Full name<input name="full_name" autoComplete="name" maxLength={100} required /></label>}
          <label>Email<input name="email" type="email" autoComplete="username" maxLength={255}
            defaultValue={registering ? '' : location.state?.registeredEmail} required /></label>
          <label>Password<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'}
            minLength={registering ? 8 : undefined} required /></label>
          {registering && <small>Use at least 8 characters.</small>}
          {error && <p className="error" role="alert">{error}</p>}
          <button className="button primary" disabled={pending}>
            {registering ? (pending ? 'Creating account…' : 'Create account') : (pending ? 'Signing in…' : 'Sign in')}
          </button>
        </form>
        <p><Link to={registering ? '/login' : '/register'} state={{ returnTo }}>
          {registering ? 'Already have an account? Sign in' : 'Create a guest account'}
        </Link></p>
      </div>
    </section>
  )
}

export function BookingRole({ roles, children }) {
  const { user, pending, error, reload } = useContext(AuthContext)
  const location = useLocation()
  if (pending) return <p className="shell notice" role="status">Checking your session…</p>
  if (error) return <section className="shell page"><p role="alert">Could not check your session.</p>
    <button className="button outline" onClick={reload}>Try again</button></section>
  if (!user) return (
    <section className="shell page"><h1>Sign in to continue</h1>
      <Link className="button primary" to="/login" state={{ returnTo: location.pathname + location.search }}>Sign in</Link>
    </section>
  )
  if (!roles.includes(user.role)) return <section className="shell page"><h1>Access unavailable</h1><p>This page isn’t available to your account.</p><Link to="/">Find a room</Link></section>
  return children
}
