import { useEffect } from 'react'
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom'
import { request, sessionUnauthorized, useApiData } from './clientApi.js'
import { BookingAccess, BookingRole } from './components/BookingAccess.jsx'
import { HotelLayout } from './components/Hotel.jsx'
import { Search, Results, RoomDetail } from './pages/Rooms.jsx'
import { MyBookings, Reception } from './pages/Reservations.jsx'
import { AuthContext } from './AuthContext.js'
import { Admin } from './pages/Admin.jsx'

function HotelApp() {
  const session = useApiData('/auth/me')
  const { reload } = session
  const user = session.data?.user
  useEffect(() => {
    window.addEventListener(sessionUnauthorized, reload)
    return () => window.removeEventListener(sessionUnauthorized, reload)
  }, [reload])

  async function logout() {
    await request('/auth/logout', { method: 'POST', body: {} })
    reload()
  }

  return (
    <AuthContext.Provider value={{ user, pending: session.loading, error: session.error?.status === 401 ? null : session.error, reload }}>
      <HotelLayout user={user} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Search />} />
          <Route path="/rooms" element={<Results />} />
          <Route path="/rooms/:id" element={<RoomDetail user={user} />} />
          <Route path="/login" element={<BookingAccess key="login" />} />
          <Route path="/register" element={<BookingAccess key="register" registering />} />
          <Route path="/my-bookings" element={<BookingRole roles={['guest']}><MyBookings /></BookingRole>} />
          <Route path="/reception" element={<BookingRole roles={['receptionist', 'admin']}><Reception /></BookingRole>} />
          <Route path="/admin" element={<BookingRole roles={['admin']}><Admin /></BookingRole>} />
          <Route path="*" element={<section className="shell page"><h1>Page not found</h1><Link to="/">Find a room</Link></section>} />
        </Routes>
      </HotelLayout>
    </AuthContext.Provider>
  )
}

export default function App() {
  return <BrowserRouter><HotelApp /></BrowserRouter>
}
