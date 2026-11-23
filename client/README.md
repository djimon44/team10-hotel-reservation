# Mtkvari House client

This client implements Member C's search, room results, booking, My bookings and reception views.

## Run locally

1. Copy `server/.env.example` to `server/.env` and configure your PostgreSQL connection and JWT secret. Run `npm ci` and then `npm run db:reset` in `server` to seed an empty local demo database. The reset recreates its tables.
2. Run `npm run dev` in `server`.
3. In `client`, run `npm ci` and `npm run dev`. Use http://localhost:5173 so requests match the server's development origin. Vite proxies `/api` to Express on port 4000.
4. Use the guest or receptionist demo account printed by the seed command. The built-in sign-in page supports the booking and reception flows. Member A can wire in the team's auth pages in `src/App.jsx`.

Run `npm run lint` and `npm run build` in `client`.

## Photo credits

The room photos illustrate room types. [Unsplash License](https://unsplash.com/license)

- Old Tbilisi streetscape by Inna Nasonova. [Photo](https://unsplash.com/photos/a-group-of-people-walking-down-a-street-next-to-tall-buildings-VcbjEhgdR9A)
- Standard Single illustration. [Photo](https://unsplash.com/photos/a-simple-hotel-room-with-a-bed-nightstand-and-curtains-ig3TQMJElAw)
- Standard Double illustration by Alef Morais. [Photo](https://unsplash.com/photos/a-hotel-room-with-a-bed-and-television-1b6fWdOEMM8)
- Deluxe King illustration by Patrick Robert Doyle. [Photo](https://unsplash.com/photos/white-bed-mattress-and-two-pillows-pZ6W7HuuY6w)

- Family Suite illustration. [Original photograph on Unsplash](https://images.unsplash.com/photo-1611892440504-42a792e24d32)

Lora and Source Sans 3 are bundled locally. Their Open Font Licenses are in public/fonts/.
