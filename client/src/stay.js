const hotelDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tbilisi', year: 'numeric', month: '2-digit', day: '2-digit',
})

export const today = () => hotelDate.format(new Date())

export function nextDay(date) {
  return new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10)
}

export function readStay(search) {
  const params = new URLSearchParams(search)
  const checkIn = params.get('checkIn') || ''
  const checkOut = params.get('checkOut') || ''
  const guests = Number(params.get('guests') || 2)
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value
  if (!isDate(checkIn) || !isDate(checkOut) || checkIn < today() || checkOut <= checkIn
    || !Number.isInteger(guests) || guests < 1 || guests > 20) return null
  return { checkIn, checkOut, guests }
}

export function stayQuery(stay) {
  return new URLSearchParams(stay).toString()
}

const dateLabel = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
})

export const displayDate = (date) => dateLabel.format(new Date(date.slice(0, 10)))
export const money = (value) => `${Number(value).toLocaleString('en-GB', { maximumFractionDigits: 2 })} GEL`
export const plural = (count, label) => `${count} ${label}${count === 1 ? '' : 's'}`

const photos = {
  'Standard Single': 'single',
  'Standard Double': 'double',
  'Deluxe King': 'king',
  'Family Suite': 'family',
}

export const roomPhoto = (name) => `/photos/${photos[name] || 'double'}.jpg`
