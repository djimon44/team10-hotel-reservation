import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { request, useApiData } from '../clientApi.js'
import { RequestState, StayForm } from '../components/Hotel.jsx'
import { displayDate, money, plural, readStay, roomPhoto, stayQuery } from '../stay.js'

export function Search() {
  const roomTypes = useApiData('/room-types')
  return (
    <div className="shell home">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Tbilisi, Georgia</p>
          <h1>Stay in the heart of Tbilisi.</h1>
          <p>Explore the old town from Mtkvari House. Choose your dates to see which rooms are available.</p>
        </div>
        <figure className="hero-photo">
          <img src="/photos/tbilisi.jpg" alt="A street lined with carved wooden balconies in Tbilisi’s old town" />
          <figcaption>Old Tbilisi</figcaption>
        </figure>
      </section>
      <StayForm />
      <section className="catalogue" aria-labelledby="room-types-heading">
        <h2 id="room-types-heading">Our rooms</h2>
        <RequestState result={roomTypes} label="Loading room types…" />
        {roomTypes.data?.length === 0 && <p className="notice">No room types are listed yet.</p>}
        {roomTypes.data?.length > 0 && (
          <ul className="type-grid">
            {roomTypes.data.map((type) => (
              <li key={type.id}>
                <img src={roomPhoto(type.name)} alt="" loading="lazy" />
                <h3>{type.name}</h3>
                <p>Up to {plural(type.capacity, 'guest')}</p>
                <p><strong>{money(type.price_per_night)}</strong> per night</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function useAvailability(search) {
  const stay = readStay(search)
  const query = stay ? stayQuery(stay) : ''
  const result = useApiData(stay ? `/rooms/available?${query}` : null)
  return { stay, query, result }
}

export function Results() {
  const { search } = useLocation()
  const { stay, query, result } = useAvailability(search)
  const [sort, setSort] = useState('lowest')
  const types = [...new Set(result.data?.map((room) => room.room_type_name))]
  const [selectedType, setSelectedType] = useState('')
  const filter = types.includes(selectedType) ? selectedType : ''
  const rooms = result.data?.filter((room) => !filter || room.room_type_name === filter)
  if (sort === 'highest') rooms?.sort((a, b) => Number(b.price_per_night) - Number(a.price_per_night))

  return (
    <section className="shell page">
      <header className="page-heading"><h1>Available rooms</h1>
        {stay && <p>{displayDate(stay.checkIn)} to {displayDate(stay.checkOut)} · {plural(stay.guests, 'guest')}</p>}
      </header>
      <StayForm key={search} stay={stay} action="Update search" />
      {!stay && <p className="notice">Choose valid dates and guest count to see available rooms.</p>}
      <RequestState result={result} label="Finding available rooms…" />
      {rooms && (result.data.length ? (
        <div className="results-layout">
          <aside className="panel filters">
            <h2>Filter rooms</h2>
            <label>Room type<select value={filter} onChange={(event) => setSelectedType(event.target.value)}>
              <option value="">All room types</option>
              {types.map((name) => <option key={name}>{name}</option>)}
            </select></label>
            <label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}>
              <option value="lowest">Lowest price</option>
              <option value="highest">Highest price</option>
            </select></label>
          </aside>
          <div>
            <p className="results-count" role="status">{plural(rooms.length, 'room')} available</p>
            <div className="room-list">{rooms.map((room) => (
              <article className="room-card" key={room.id}>
                <img src={roomPhoto(room.room_type_name)} alt="" loading="lazy" />
                <div className="room-copy">
                  <p className="eyebrow">Room {room.room_number} · Floor {room.floor}</p>
                  <h2>{room.room_type_name}</h2>
                  <p>{room.description}</p>
                  <p className="muted">Up to {plural(room.capacity, 'guest')}</p>
                </div>
                <div className="room-price">
                  <strong>{money(room.price_per_night)}</strong><span>per night</span>
                  <Link className="button outline compact" to={`/rooms/${room.id}?${query}`}>View room</Link>
                </div>
              </article>
            ))}</div>
          </div>
        </div>
      ) : <p className="notice">No rooms are available for these dates and guest count. Try different dates or fewer guests.</p>)}
    </section>
  )
}

export function RoomDetail({ user }) {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { stay, query, result } = useAvailability(location.search)
  const room = result.data?.find((item) => String(item.id) === id)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState(null)
  const returnTo = location.pathname + location.search
  const resultsLink = query ? `/rooms?${query}` : '/'
  async function reserve() {
    setBusy(true)
    setFailure(null)
    try {
      const reservation = await request('/reservations', { method: 'POST', body: {
        room_id: room.id, check_in: stay.checkIn, check_out: stay.checkOut, guests: stay.guests,
      } })
      navigate('/my-bookings', { replace: true, state: { reserved: reservation.id } })
    } catch (error) {
      setFailure(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="shell page">
      <Link className="back" to={resultsLink}>← Back to room search</Link>
      <RequestState result={result} label="Checking the room’s availability…" />
      {!stay && <p className="notice">Select your stay dates to view or book this room.</p>}
      {result.data && !room && <p className="notice">This room is no longer available for those dates. Go back to see other rooms.</p>}
      {room && <>
        <header className="page-heading"><p className="eyebrow">Room {room.room_number} · Floor {room.floor}</p><h1>{room.room_type_name}</h1></header>
        <div className="detail-layout">
          <div>
            <img className="detail-photo" src={roomPhoto(room.room_type_name)} alt={`Illustrative photo for ${room.room_type_name}`} />
            <h2>About this room</h2><p>{room.description}</p><p className="muted">Up to {plural(room.capacity, 'guest')}</p>
          </div>
          <section className="panel booking">
            <h2>Your stay</h2>
            <dl>
              <div><dt>Check-in</dt><dd>{displayDate(stay.checkIn)}</dd></div>
              <div><dt>Check-out</dt><dd>{displayDate(stay.checkOut)}</dd></div>
              <div><dt>Guests</dt><dd>{stay.guests}</dd></div>
              <div><dt>{plural(room.nights, 'night')} × {money(room.price_per_night)}</dt><dd>{money(room.total_price)}</dd></div>
              <div className="total"><dt>Total</dt><dd>{money(room.total_price)}</dd></div>
            </dl>
            {failure && <p className="error" role="alert">{failure.message}{failure.status === 409 && <> <Link to={resultsLink}>Find another room</Link>.</>}</p>}
            {!user || failure?.status === 401 ? <Link className="button primary" to="/login" state={{ returnTo }}>Sign in to book</Link>
              : user.role === 'guest' ? <button className="button primary" disabled={busy || failure?.status === 409} onClick={reserve}>
                {busy ? 'Requesting…' : 'Request reservation'}
              </button> : <p className="notice">A guest account is required to book a room.</p>}
            <p className="muted small">Reception will confirm your request.</p>
          </section>
        </div>
      </>}
    </section>
  )
}
