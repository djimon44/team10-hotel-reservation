// Routes for /api/reservations.
//   Guests: book a room, see their own bookings, cancel their own booking.
//   Staff:  list all bookings and move them through their statuses.
import { Router } from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateId } from '../middleware/validate.js';
import { checkInDate, dateString, today } from '../utils/dates.js';
import { PG, translateDbError } from '../utils/dbErrors.js';

const router = Router();

// For each current status, the statuses it may move to.
//   pending -> confirmed -> checked_in -> checked_out
//   pending and confirmed can also be cancelled
const NEXT_STATUSES = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: [],
  cancelled: [],
};

const statusSchema = z.object({
  status: z.enum(Object.keys(NEXT_STATUSES)),
});

const bookingSchema = z
  .object({
    room_id: z.number().int().positive().max(2147483647),
    check_in: checkInDate,
    check_out: dateString,
    guests: z.number().int().min(1).max(20),
  })
  .refine((booking) => booking.check_out > booking.check_in, {
    path: ['check_out'],
    message: 'Check-out must be after check-in',
  });

const bookingErrors = {
  // Safety net only: the room lock in createBooking should make this unreachable.
  [PG.EXCLUSION_VIOLATION]: [409, 'This room is already booked for these dates'],
  [PG.NUMERIC_OVERFLOW]: [400, 'This stay is too long'],
};

// Returns the reason a change is not allowed, or null if it is allowed.
function findStatusError(reservation, newStatus) {
  if (!NEXT_STATUSES[reservation.status].includes(newStatus)) {
    return `Cannot change a reservation from ${reservation.status} to ${newStatus}`;
  }
  if (newStatus === 'checked_in') {
    const date = today();
    if (date < reservation.check_in) return `Cannot check in before ${reservation.check_in}`;
    if (date >= reservation.check_out) return 'Cannot check in, the stay dates have already passed';
  }
  return null;
}

// "AND status = $3" works like JPA's @Version: if someone changed the status after
// we read it, nothing is updated and the caller answers 409 instead of overwriting.
// Returns the updated reservation, or undefined if it changed in the meantime.
async function changeStatus(id, fromStatus, toStatus) {
  const { rows } = await pool.query(
    `UPDATE reservations
     SET status = $1
     WHERE id = $2 AND status = $3
     RETURNING id, room_id, guest_id, check_in, check_out, guests, total_price, status, created_at`,
    [toStatus, id, fromStatus],
  );
  return rows[0];
}

const CHANGED_MEANWHILE = 'The reservation was just changed by someone else, reload and try again';

// Runs inside a transaction. Returns [HTTP status, response body].
async function createBooking(client, guestId, { room_id, check_in, check_out, guests }) {
  // FOR UPDATE locks this room's row until COMMIT, like JPA's PESSIMISTIC_WRITE.
  // Two guests booking the same room now wait in line instead of colliding, so the
  // second one sees the first one's booking in the overlap check below.
  const found = await client.query(
    `SELECT r.is_active, rt.capacity
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.id = $1
     FOR UPDATE OF r`,
    [room_id],
  );
  const room = found.rows[0];
  if (!room) return [404, { error: 'Room not found' }];
  if (!room.is_active) return [409, { error: 'This room is not available for booking' }];
  if (guests > room.capacity) return [400, { error: `This room fits at most ${room.capacity} guests` }];

  // Same overlap rule as the availability search and the reservations_no_overlap constraint.
  const overlap = await client.query(
    `SELECT 1
     FROM reservations
     WHERE room_id = $1
       AND status <> 'cancelled'
       AND check_in < $3
       AND check_out > $2`,
    [room_id, check_in, check_out],
  );
  if (overlap.rows.length > 0) return [409, { error: 'This room is already booked for these dates' }];

  // total_price = nights * price per night. Subtracting two DATEs gives the number of nights.
  // The price comes from the database, never from the request.
  const { rows } = await client.query(
    `INSERT INTO reservations (room_id, guest_id, check_in, check_out, guests, total_price)
     SELECT r.id, $2, $3, $4, $5, ($4::date - $3::date) * rt.price_per_night
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.id = $1
     RETURNING id, room_id, guest_id, check_in, check_out, guests, total_price, status, created_at`,
    [room_id, guestId, check_in, check_out, guests],
  );
  return [201, rows[0]];
}

// Guest books a room. New bookings start as 'pending' until reception confirms them.
router.post('/', requireAuth, requireRole('guest'), validateBody(bookingSchema), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const [status, body] = await createBooking(client, req.user.id, req.body);
    await client.query(status === 201 ? 'COMMIT' : 'ROLLBACK');
    res.status(status).json(body);
  } catch (err) {
    await client.query('ROLLBACK');
    throw translateDbError(err, bookingErrors);
  } finally {
    client.release();
  }
});

// The logged-in guest's own bookings, newest stay first.
router.get('/mine', requireAuth, requireRole('guest'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.status, b.check_in, b.check_out, b.check_out - b.check_in AS nights,
            b.guests, b.total_price, b.created_at,
            b.room_id, r.room_number, rt.name AS room_type_name, rt.price_per_night
     FROM reservations b
     JOIN rooms r ON r.id = b.room_id
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE b.guest_id = $1
     ORDER BY b.check_in DESC, b.id DESC`,
    [req.user.id],
  );
  res.json(rows);
});

// Guest cancels their own booking. The row is kept with status 'cancelled', which
// frees the dates because the overlap rule ignores cancelled bookings.
router.delete('/:id', requireAuth, requireRole('guest'), validateId, async (req, res) => {
  const { id } = req.params;

  // "AND guest_id = $2": another guest's booking looks the same as a missing one.
  const found = await pool.query(
    'SELECT status FROM reservations WHERE id = $1 AND guest_id = $2',
    [id, req.user.id],
  );
  if (found.rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });

  const current = found.rows[0];
  if (!NEXT_STATUSES[current.status].includes('cancelled')) {
    return res.status(409).json({ error: `A ${current.status} reservation cannot be cancelled` });
  }

  const updated = await changeStatus(id, current.status, 'cancelled');
  if (!updated) return res.status(409).json({ error: CHANGED_MEANWHILE });
  res.json(updated);
});

router.get('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res) => {
  // Columns are listed one by one so users.password_hash can never end up in the response.
  const { rows } = await pool.query(
    `SELECT b.id, b.status, b.check_in, b.check_out, b.check_out - b.check_in AS nights,
            b.guests, b.total_price, b.created_at,
            b.room_id, r.room_number, rt.name AS room_type_name,
            b.guest_id, u.full_name AS guest_name, u.email AS guest_email
     FROM reservations b
     JOIN rooms r ON r.id = b.room_id
     JOIN room_types rt ON rt.id = r.room_type_id
     JOIN users u ON u.id = b.guest_id
     ORDER BY b.check_in, b.id`,
  );
  res.json(rows);
});

router.patch('/:id/status', requireAuth, requireRole('admin', 'receptionist'), validateId, validateBody(statusSchema), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const found = await pool.query(
    'SELECT status, check_in, check_out FROM reservations WHERE id = $1',
    [id],
  );
  if (found.rows.length === 0) return res.status(404).json({ error: 'Reservation not found' });

  const current = found.rows[0];
  const error = findStatusError(current, status);
  if (error) return res.status(409).json({ error });

  const updated = await changeStatus(id, current.status, status);
  if (!updated) return res.status(409).json({ error: CHANGED_MEANWHILE });
  res.json(updated);
});

export default router;
