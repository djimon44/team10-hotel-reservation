import { useState } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { request, useApiData } from './clientApi.js'
import { BookingAccess, BookingRole } from './components/BookingAccess.jsx'
import { HotelLayout } from './components/Hotel.jsx'
import { Search, Results, RoomDetail } from './pages/Rooms.jsx'
import { MyBookings, Reception } from './pages/Reservations.jsx'

function HotelApp() {
  const session = useApiData('/auth/me')
  const [userOverride, setUserOverride] = useState(undefined)
  const user = userOverride === undefined ? session.data?.user : userOverride
  const roleProps = { user, pending: session.loading && userOverride === undefined }

  return (
    <HotelLayout user={user} onLogout={async () => {
      await request('/auth/logout', { method: 'POST', body: {} })
      setUserOverride(null)
    }}>
      <Routes>
        <Route path="/" element={<Search />} />
        <Route path="/rooms" element={<Results />} />
        <Route path="/rooms/:id" element={<RoomDetail user={user} />} />
        <Route path="/login" element={<BookingAccess user={user} onSignIn={setUserOverride} />} />
        <Route path="/my-bookings" element={<BookingRole {...roleProps} roles={['guest']}><MyBookings /></BookingRole>} />
        <Route path="/reception" element={<BookingRole {...roleProps} roles={['receptionist', 'admin']}><Reception /></BookingRole>} />
        <Route path="*" element={<section className="shell page"><h1>Page not found</h1><Link to="/">Find a room</Link></section>} />
      </Routes>
    </HotelLayout>
  )
}

export default function App() {
  return <BrowserRouter><HotelApp /></BrowserRouter>
}
