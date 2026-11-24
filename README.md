# Mtkvari House | Hotel Reservation System

Team 10’s reservation app for Mtkvari House, a hotel in Tbilisi. Visitors can search for available rooms by dates and party size. Guests can register, book a stay, and manage their reservations. Receptionists handle arrivals and departures, and admins manage room types, rates, and rooms.

[View the Team 10 hotel design in Figma](https://www.figma.com/design/jDMZolTNYmQzSBik3uVHaj/Team10Hotel?node-id=1-353&t=vQTZof3QCo8Tik3b-1)

## Team

| Member | Responsibility |
| --- | --- |
| A: Kamil Nuriev | Authentication: registration, sign in and sign out, JWT session cookie, role checks, request origin protection, and the sign-in and registration pages |
| B: Dimitri Durmishian | Database and CRUD: PostgreSQL schema and seed data, room type and room management, availability search, booking and reservation status rules, the admin page, and the root scripts |
| C: Saba Giorbelidze | Design and client: Figma design, React client setup, search and room pages, booking, My bookings, and the reception desk |

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

`server/.env` holds your local database password and signing secret. It is listed in `.gitignore` and must never be committed. Only `server/.env.example`, which has placeholders, belongs in the repository.

## Scripts

Run these from the repository root.

| Command | What it does |
| --- | --- |
| `npm run setup` | Installs dependencies in the root, `server`, and `client`. Run it after cloning and whenever a teammate adds a package. |
| `npm run dev` | Starts the API on port 4000 and the client on port 5173 in one terminal. Output lines are labelled `[server]` and `[client]`. If either one fails to start, both stop. Press `Ctrl+C` to stop both. |
| `npm run db:reset` | Recreates all tables and inserts the demo data from `server/db/seed.js`. **Deletes all existing data.** |
| `npm run lint` | Checks the client code with oxlint. |
| `npm run build` | Builds the client for production into `client/dist`. |

The API restarts automatically when a file in `server` changes, and the browser updates as soon as a file in `client` is saved.

## Demo accounts

All seeded accounts use the local demo password `Password123!`. Select **Sign in** in the header and use one of these emails.

| Role | Email | What to try |
| --- | --- | --- |
| Guest | `guest@hotel.test` | Search for a stay, book an available room, then open **My bookings**. |
| Receptionist | `reception@hotel.test` | Open **Reception** to confirm a pending reservation or check in an arrival. |
| Admin | `admin@hotel.test` | Open **Manage rooms** to create a room type and a room. Delete the test room before deleting its type. |
| Guest | `giorgi@hotel.test`, `anna@hotel.test` | Extra guests whose bookings fill the reception desk. |

To try registration, choose **Create a guest account** on the sign-in page. To demonstrate server-side authorization, sign in as the seeded guest and open the [room inventory API](http://localhost:5173/api/rooms) in the same browser. It returns `403`. Sign in as the receptionist and open the same URL to see the inventory.

The seeded reservation dates are counted from the day you run `npm run db:reset`, so there is always a guest arriving today, a guest staying in the hotel, a pending request, a past stay, and a cancelled booking. Run the reset on the morning of a demo to start from this state.

## Project structure

```text
team10-hotel-reservation/
├── package.json             Root scripts: setup, dev, db:reset, lint, build
├── server/                  Express API
│   ├── .env.example         Template for server/.env
│   ├── db/
│   │   ├── schema.sql       Tables, constraints, and indexes
│   │   └── seed.js          Demo data used by npm run db:reset
│   └── src/
│       ├── index.js         Creates the app, registers middleware and routes, handles errors
│       ├── db.js            Shared PostgreSQL connection pool
│       ├── middleware/      Authentication, role checks, origin check, input validation
│       ├── routes/          auth, roomTypes, rooms, reservations
│       └── utils/           Date rules and PostgreSQL error translation
└── client/                  React app
    ├── public/              Photos, fonts, and the site icon
    └── src/
        ├── App.jsx          Page routes and the signed-in user
        ├── clientApi.js     request() and useApiData() for calling the API
        ├── stay.js          Date, price, and photo helpers
        ├── components/      Layout, search form, sign-in and role guards
        └── pages/           Rooms, Reservations (My bookings, Reception), Admin
```

## How it works

```text
Browser ──► Vite dev server (5173) ──/api──► Express API (4000) ──► PostgreSQL
              serves the React app            validates input,         enforces the
                                              checks the session        data rules
                                              and role, runs SQL
```

Every API request passes through the same steps. The origin check rejects write requests from other websites, the session cookie identifies the user, the role check decides what the user may do, and Zod validates the input before any SQL runs. All queries use placeholders such as `$1`, so user input is never inserted into SQL text. Expected database errors become clear `4xx` responses, and unexpected errors return `500` without internal details.

## Database

| Table | Holds | Key rules |
| --- | --- | --- |
| `users` | Guests, receptionists, and admins | Unique email, role must be `admin`, `receptionist`, or `guest`, and only a bcrypt hash of the password is stored |
| `room_types` | Name, description, capacity, and nightly price in GEL | Unique name, capacity and price above zero |
| `rooms` | Room number, floor, room type, and whether the room is open for booking | Unique room number. A room type cannot be deleted while rooms use it. |
| `reservations` | Room, guest, dates, guest count, total price, and status | Check-out after check-in. A room with reservations cannot be deleted. |

**No double bookings.** The `reservations_no_overlap` constraint makes PostgreSQL reject two active reservations of the same room with overlapping dates. The check-out day is not part of the stay, so one guest can leave and the next arrive on the same day. Cancelled reservations do not count, so cancelling frees the dates. When a guest books, the API also locks the room for the duration of the booking, so two guests booking the same room at the same moment receive one confirmation and one clear `409` instead of an error.

**Prices come from the database.** The total is calculated in SQL as nights × the room type’s nightly price. The client never sends a price.

**Reservation status** moves forward only:

```text
pending ──► confirmed ──► checked_in ──► checked_out
   │            │
   └────────────┴──► cancelled
```

Guests can cancel pending and confirmed bookings. Reception confirms, checks in on the stay dates, and checks out. A cancelled booking is kept for history, with its status set to `cancelled`.

**Changing the demo data.** Edits made on the **Manage rooms** page last until the next `npm run db:reset`. To change the data everyone starts with, edit the lists at the top of `server/db/seed.js` and run the reset. Room photos are matched by room type name in `client/src/stay.js`, so a renamed or new room type also needs an entry there.

## API

All endpoints start with `/api`. Request and response bodies are JSON.

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | Confirms the API can reach PostgreSQL |
| `POST` | `/auth/register` | Public | Creates a guest account |
| `POST` | `/auth/login` | Public | Signs in and sets the session cookie |
| `POST` | `/auth/logout` | Public | Clears the session cookie |
| `GET` | `/auth/me` | Signed in | Returns the current user |
| `GET` | `/room-types` | Public | Lists room types, cheapest first |
| `GET` | `/room-types/:id` | Public | Returns one room type |
| `POST` `PUT` `DELETE` | `/room-types`, `/room-types/:id` | Admin | Creates, replaces, or deletes a room type |
| `GET` | `/rooms/available?checkIn=&checkOut=&guests=` | Public | Lists rooms that are open, large enough, and free for the dates, with the total price |
| `GET` | `/rooms`, `/rooms/:id` | Admin, receptionist | Lists all rooms or returns one |
| `POST` `PUT` `DELETE` | `/rooms`, `/rooms/:id` | Admin | Creates, replaces, or deletes a room |
| `POST` | `/reservations` | Guest | Books a room. The booking starts as `pending`. |
| `GET` | `/reservations/mine` | Guest | Lists the guest’s own bookings |
| `DELETE` | `/reservations/:id` | Guest | Cancels the guest’s own pending or confirmed booking |
| `GET` | `/reservations` | Admin, receptionist | Lists all bookings with guest details |
| `PATCH` | `/reservations/:id/status` | Admin, receptionist | Moves a booking to its next status |

Dates use the `YYYY-MM-DD` format. Errors return `{ "error": "message" }`. Validation errors add a `details` list with the field and message for each problem.

| Status | Meaning |
| --- | --- |
| `400` | The input is invalid, for example a past check-in date or too many guests for the room |
| `401` | Not signed in, or the session has expired |
| `403` | Signed in, but the role is not allowed, or the request came from an untrusted website |
| `404` | Not found. A guest who asks for another guest’s booking also gets `404`. |
| `409` | Conflicts with the current data, for example the room is already booked, the name is taken, or the status change is not allowed |

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `createdb` or `psql` is not recognized | Add the PostgreSQL `bin` folder to `PATH`, for example `C:\Program Files\PostgreSQL\18\bin` on Windows, then open a new terminal. |
| `DATABASE_URL is not set` | `server/.env` is missing. Repeat step 3 of **Run locally**. |
| `Set JWT_SECRET to a private random value` | `JWT_SECRET` in `server/.env` is still the placeholder. Generate one with the command in step 3. |
| `password authentication failed` or `database "hotel" does not exist` | Check the user, password, and database name in `DATABASE_URL`, and create the database with step 2. |
| The health check returns `{"ok":false,"error":"Database unreachable"}` | PostgreSQL is not running, or `DATABASE_URL` points to the wrong server. |
| `npm run db:reset` fails with `permission denied to create extension "btree_gist"` | Create the extension once as a superuser: `psql -U postgres -d hotel -c "CREATE EXTENSION btree_gist"`. Then run the reset again. |
| `Port 5173 is already in use` or `EADDRINUSE` on port 4000 | Another copy of the client or API is still running. Close it and run `npm run dev` again. |
| Every change returns `403 Untrusted request origin` | Open the app at `http://localhost:5173`, not `127.0.0.1` or another address. |
| Signed in but the page asks you to sign in again | The session lasts one hour. Sign in again. |
