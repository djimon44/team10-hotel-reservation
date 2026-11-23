import { BrowserRouter, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<main><h1>Hotel reservation</h1></main>} />
      </Routes>
    </BrowserRouter>
  )
}
