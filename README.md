# Team 10 hotel reservation system

The Express API uses PostgreSQL for rooms, rates, reservations, and user accounts. Guests can search availability. Receptionists can view inventory and manage reservation status. Admins can also create, edit, and delete rooms and room types.

## Run the server

1. Create an empty local PostgreSQL database for the project. The database user needs permission to install the `btree_gist` extension.
2. In `server/`, run `npm ci`. For first-time setup, copy `.env.example` to `.env`, set `DATABASE_URL` to the new database, and set `JWT_SECRET` to a private random string. Generate one with `openssl rand -hex 32`.
3. Run `npm run db:reset` **only on a disposable development database**. This command drops and recreates the project tables and inserts demo data.
4. Run `npm run dev`. The default health endpoint is `http://localhost:4000/api/health`.

## Seeded demo accounts

| Role | Email |
| --- | --- |
| Admin | admin@hotel.test |
| Receptionist | reception@hotel.test |
| Guest | guest@hotel.test |

The seed password for these local accounts is `Password123!`.

## Authentication

| Endpoint | Request | Success |
| --- | --- | --- |
| `POST /api/auth/register` | JSON with `full_name`, `email`, `password` (at least 8 characters, at most 72 UTF-8 bytes) | `201 { user }` with the guest role |
| `POST /api/auth/login` | JSON with `email`, `password` | `200 { token, user }` |
| `GET /api/auth/me` | `Authorization: Bearer <token>` header | `200 { user }` with current account details |

A public user object contains `id`, `full_name`, `email`, and `role`. Emails are trimmed and lowercased. Invalid fields return 400 and an email already registered returns 409. A missing, invalid, or expired token on a protected route returns 401. A signed-in user with insufficient permissions receives 403.

Room-type reads and room availability search are public. Inventory reads, the reservation list, and reservation status updates require receptionist or admin access. Room and room-type writes require admin access. Guest booking handlers can use `req.user.id` after `requireAuth` and `requireRole('guest')` to scope records to their owner.

## React integration

The auth components live in `client/src/auth/`. The shared React app scaffold and page router are pending in this checkout.

- Wrap the app's route tree in `AuthProvider` from `AuthContext.jsx`. Mount the named `Login` and `Register` exports from `AuthPages.jsx` at `/login` and `/register`.
- Group restricted pages under a layout route such as `<Route element={<ProtectedRoute roles={['admin']} />}>`. To allow any signed-in user, omit `roles`.
- Render `AuthNav` in the header with a `links` array of `{ to, label, roles }` entries for mounted pages. For example, an admin inventory link can use `roles: ['admin']`.
- Use `apiFetch` from `session.js` in the shared API helper for same-origin `/api/` calls. It returns a standard fetch Response, attaches the tab's bearer token, and clears the session on an authenticated 401. For a 403, show the server's access-denied message and keep the session active.
- Configure the Vite dev proxy for `/api` to reach the Express server. Sessions restore through `/api/auth/me` on reload. Logout clears the tab's session. Tokens expire one hour after login.
