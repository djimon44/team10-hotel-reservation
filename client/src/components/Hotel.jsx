import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { nextDay, today } from '../stay.js'

export function HotelLayout({ user, onLogout, children }) {
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header className="site-header">
        <div className="shell header-row">
          <Link className="wordmark" to="/">Mtkvari House</Link>
          <nav aria-label="Main navigation">
            <NavLink to="/" end>Find a room</NavLink>
            {user?.role === 'guest' && <NavLink to="/my-bookings">My bookings</NavLink>}
            {['receptionist', 'admin'].includes(user?.role) && <NavLink to="/reception">Reception</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">Manage rooms</NavLink>}
            {user ? (
              <button className="button outline compact" onClick={async () => {
                setMessage('')
                try {
                  await onLogout()
                  navigate('/')
                } catch (error) {
                  setMessage(error.message)
                }
              }}>Sign out</button>
            ) : <Link className="button outline compact" to="/login" state={{ returnTo: location.pathname + location.search }}>Sign in</Link>}
          </nav>
        </div>
        {message && <p className="shell error" role="alert">{message}</p>}
      </header>
      <main id="content">{children}</main>
      <footer className="site-footer"><div className="shell footer-row"><Link className="wordmark" to="/">Mtkvari House</Link><span>Tbilisi, Georgia</span></div></footer>
    </>
  )
}

export function StayForm({ stay, action = 'Check availability' }) {
  const navigate = useNavigate()
  const minimum = today()
  const [checkIn, setCheckIn] = useState(stay?.checkIn || minimum)
  const [checkOut, setCheckOut] = useState(stay?.checkOut || nextDay(checkIn))
  const [guests, setGuests] = useState(stay?.guests || 2)
  const earliestCheckout = nextDay(checkIn || minimum)

  return (
    <form className="stay-form" onSubmit={(event) => {
      event.preventDefault()
      const query = new URLSearchParams({ checkIn, checkOut, guests })
      navigate(`/rooms?${query}`)
    }}>
      <label>Check-in<input name="checkIn" type="date" min={minimum} value={checkIn} onChange={(event) => {
        const date = event.target.value
        setCheckIn(date)
        if (date && checkOut <= date) setCheckOut(nextDay(date))
      }} required /></label>
      <label>Check-out<input name="checkOut" type="date" min={earliestCheckout} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} required /></label>
      <label>Guests<input name="guests" type="number" min="1" max="20" value={guests} onChange={(event) => setGuests(event.target.value)} required /></label>
      <button className="button primary">{action}</button>
    </form>
  )
}

export function RequestState({ result, label = 'Loading…' }) {
  if (result.loading) return <p className="notice" role="status">{label}</p>
  if (!result.error) return null
  return (
    <div className="notice" role="alert">
      <p>{result.error.message}</p>
      <button className="button outline compact" onClick={result.reload}>Try again</button>
    </div>
  )
}

const statusLabels = {
  pending: 'Pending', confirmed: 'Confirmed', checked_in: 'Checked in',
  checked_out: 'Checked out', cancelled: 'Cancelled',
}

export function Status({ value }) {
  return <span className={`status status-${value}`}>{statusLabels[value] || value}</span>
}
