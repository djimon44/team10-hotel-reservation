// Staff routes for /api/reservations: list bookings and move them through their statuses.
import { Router } from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateId } from '../middleware/validate.js';
import { today } from '../utils/dates.js';

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

  // "AND status = $3" works like JPA's @Version: if someone changed the status after
  // our SELECT, nothing is updated and we answer 409 instead of overwriting their change.
  const { rows } = await pool.query(
    `UPDATE reservations
     SET status = $1
     WHERE id = $2 AND status = $3
     RETURNING id, room_id, guest_id, check_in, check_out, guests, total_price, status, created_at`,
    [status, id, current.status],
  );
  if (rows.length === 0) {
    return res.status(409).json({ error: 'The reservation was just changed by someone else, reload and try again' });
  }
  res.json(rows[0]);
});

export default router;
