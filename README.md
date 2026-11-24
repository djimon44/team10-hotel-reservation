# Mtkvari House | Hotel Reservation System

Team 10’s reservation app for Mtkvari House, a hotel in Tbilisi. Visitors can search for available rooms by dates and party size. Guests can register, book a stay, and manage their reservations. Receptionists handle arrivals and departures, and admins manage room types, rates, and rooms.

[View the Team 10 hotel design in Figma](https://www.figma.com/design/jDMZolTNYmQzSBik3uVHaj/Team10Hotel?node-id=1-353&t=vQTZof3QCo8Tik3b-1)

## Stack

- **Client:** React, React Router, and Vite.
- **API:** Node.js and Express, with Zod for request validation. Passwords are hashed with bcrypt. A one-hour JWT travels in an `HttpOnly`, `SameSite=Lax` cookie, and the server checks the user’s role on protected routes.
- **Database:** PostgreSQL with parameterized queries through `pg`. Each room has a room type that sets its capacity and nightly rate in GEL. PostgreSQL prevents overlapping reservations for the same room while allowing one stay to begin on another guest’s check-out date.

## Run locally

Use Node.js 24 with npm and a running PostgreSQL 16 or newer. Run the following commands from the repository root.

1. Install dependencies for the root, client, and server.

   ```sh
   npm run setup
   ```

2. Create a dedicated development database. This example uses the local PostgreSQL role `postgres`. If your role has a different name, use it here and in `DATABASE_URL`. The database owner needs permission to create the `btree_gist` extension.

   ```sh
   createdb -h localhost -U postgres hotel
   ```

3. On first setup, copy the environment template and generate a signing secret.

   ```sh
   cp server/.env.example server/.env
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   In `server/.env`, set `JWT_SECRET` to the generated value and `DATABASE_URL` to the connection URL for the database you just created. For example, replace `YOUR_PASSWORD` in `postgres://postgres:YOUR_PASSWORD@localhost:5432/hotel`. Keep `PORT=4000` for the default Vite proxy.

4. Initialize the schema and demo accounts. **This command drops and recreates the project tables in the database selected by `DATABASE_URL`.** Run it on the dedicated development database.

   ```sh
   npm run db:reset
   ```

5. Start the API and client together.

   ```sh
   npm run dev
   ```

   Open [Mtkvari House locally](http://localhost:5173). Vite forwards `/api` requests to Express on port 4000. To confirm that the API can reach PostgreSQL, open the [health check](http://localhost:4000/api/health) and look for `{"ok":true}`. On subsequent runs, start PostgreSQL and run `npm run dev`.

## Demo accounts

All three seeded accounts use the local demo password `Password123!`. Select **Sign in** in the header and use one of these emails.

| Role | Email | What to try |
| --- | --- | --- |
| Guest | `guest@hotel.test` | Search for a stay, book an available room, then open **My bookings**. |
| Receptionist | `reception@hotel.test` | Open **Reception** to confirm a pending reservation or check in an arrival. |
| Admin | `admin@hotel.test` | Open **Manage rooms** to create a room type and a room. Delete the test room before deleting its type. |

To try registration, choose **Create a guest account** on the sign-in page. To demonstrate server-side authorization, sign in as the seeded guest and open the [room inventory API](http://localhost:5173/api/rooms) in the same browser. It returns `403`. Sign in as the receptionist and open the same URL to see the inventory.
