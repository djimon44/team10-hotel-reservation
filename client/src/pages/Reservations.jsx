import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { request, useApiData } from '../clientApi.js'
import { RequestState, Status } from '../components/Hotel.jsx'
import { displayDate, money, plural, today } from '../stay.js'

const guestCanCancel = ['pending', 'confirmed']

export function MyBookings() {
  const { state } = useLocation()
  const result = useApiData('/reservations/mine')
  const [message, setMessage] = useState(state?.reserved ? 'Reservation requested. Reception will confirm your stay.' : '')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const dialog = useRef(null)
  async function cancelBooking() {
    setBusy(true)
    setError('')
    try {
      await request(`/reservations/${selected.id}`, { method: 'DELETE' })
      dialog.current.close()
      setMessage('Reservation cancelled.')
      result.reload()
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="shell page">
      <header className="page-heading"><h1>My bookings</h1><p>Review your upcoming and past stays.</p></header>
      {message && <p className="notice positive" role="status">{message}</p>}
      <RequestState result={result} label="Loading your reservations…" />
      {result.data?.length === 0 && <div className="notice"><p>You don’t have any reservations yet.</p><Link to="/">Find a room</Link></div>}
      <div className="reservation-list">{result.data?.map((booking) => (
        <article className="panel reservation" key={booking.id}>
          <div>
            <p className="eyebrow">Booking #{booking.id} · Room {booking.room_number}</p>
            <h2>{booking.room_type_name}</h2>
            <p>{displayDate(booking.check_in)} to {displayDate(booking.check_out)}</p>
            <p className="muted">{plural(booking.guests, 'guest')} · {plural(booking.nights, 'night')} · {money(booking.total_price)}</p>
          </div>
          <div className="reservation-actions">
            <Status value={booking.status} />
            {guestCanCancel.includes(booking.status) && <button className="button outline compact" onClick={() => {
              setSelected(booking)
              setError('')
              dialog.current.showModal()
            }}>Cancel reservation</button>}
          </div>
        </article>
      ))}</div>
      <dialog ref={dialog} className="panel confirm" aria-labelledby="cancel-title" onCancel={(event) => {
        if (busy) event.preventDefault()
      }}>
        <h2 id="cancel-title">Cancel reservation?</h2>
        {selected && <p>This will release room {selected.room_number} for the dates you selected.</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button className="button outline" autoFocus disabled={busy} onClick={() => dialog.current.close()}>Keep reservation</button>
          <button className="button danger" disabled={busy} onClick={cancelBooking}>{busy ? 'Cancelling…' : 'Cancel reservation'}</button>
        </div>
      </dialog>
    </section>
  )
}

function sameDate(value, date) {
  return value.slice(0, 10) === date
}

function nextReceptionAction(booking, date) {
  if (booking.status === 'pending') return ['confirmed', 'Confirm']
  if (booking.status === 'confirmed' && booking.check_in.slice(0, 10) <= date && date < booking.check_out.slice(0, 10)) return ['checked_in', 'Check in']
  if (booking.status === 'checked_in') return ['checked_out', 'Check out']
  return null
}

export function Reception() {
  const date = today()
  const result = useApiData('/reservations')
  const [filter, setFilter] = useState('all')
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const active = result.data?.filter((booking) => booking.status !== 'cancelled') || []
  const arrivals = active.filter((booking) => sameDate(booking.check_in, date) && guestCanCancel.includes(booking.status))
  const departures = active.filter((booking) => sameDate(booking.check_out, date) && booking.status === 'checked_in')
  const awaiting = active.filter((booking) => booking.status === 'pending')
  const shown = { all: result.data, arrivals, departures, awaiting }[filter]

  async function changeStatus(id, status) {
    setBusy(id)
    setError('')
    setMessage('')
    try {
      await request(`/reservations/${id}/status`, { method: 'PATCH', body: { status } })
      setMessage(`Reservation #${id} updated.`)
      result.reload()
    } catch (failure) {
      setError(failure.message)
      if (failure.status === 409) result.reload()
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="shell page">
      <header className="page-heading"><h1>Reception desk</h1><p>{displayDate(date)} · Tbilisi local time</p></header>
      <RequestState result={result} label="Loading the reception dashboard…" />
      {message && <p className="notice positive" role="status">{message}</p>}
      {error && <p className="error" role="alert">{error}</p>}
      {result.data && <>
        <div className="desk-stats">
          <button className="panel" aria-pressed={filter === 'arrivals'} onClick={() => setFilter('arrivals')}><span>Today’s arrivals</span><strong>{arrivals.length}</strong></button>
          <button className="panel" aria-pressed={filter === 'departures'} onClick={() => setFilter('departures')}><span>Today’s departures</span><strong>{departures.length}</strong></button>
          <button className="panel" aria-pressed={filter === 'awaiting'} onClick={() => setFilter('awaiting')}><span>Awaiting confirmation</span><strong>{awaiting.length}</strong></button>
        </div>
        <div className="table-heading"><h2>Reservations</h2><label>Show<select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All reservations</option><option value="arrivals">Today’s arrivals</option>
          <option value="departures">Today’s departures</option><option value="awaiting">Awaiting confirmation</option>
        </select></label></div>
        {shown.length === 0 ? <p className="notice">There are no reservations in this view.</p> : (
          <div className="panel table-scroll" tabIndex="0" aria-label="Reservations table">
            <table>
              <thead><tr><th scope="col">Guest</th><th scope="col">Room</th><th scope="col">Stay</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
              <tbody>{shown.map((booking) => {
                const action = nextReceptionAction(booking, date)
                return <tr key={booking.id}>
                  <th scope="row">{booking.guest_name}<span className="muted">{booking.guest_email}</span></th>
                  <td>{booking.room_number}<span className="muted">{booking.room_type_name}</span></td>
                  <td>{displayDate(booking.check_in)}<span className="muted">to {displayDate(booking.check_out)}</span></td>
                  <td><Status value={booking.status} /></td>
                  <td>{action ? <button className="button outline compact" disabled={busy !== null} aria-label={`${action[1]} reservation ${booking.id}`} onClick={() => changeStatus(booking.id, action[0])}>{busy === booking.id ? 'Updating…' : action[1]}</button> : '—'}</td>
                </tr>
              })}</tbody>
            </table>
          </div>
        )}
      </>}
    </section>
  )
}
