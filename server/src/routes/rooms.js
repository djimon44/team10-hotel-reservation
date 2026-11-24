// CRUD for /api/rooms.
import { Router } from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validateBody, validateId, validateQuery } from '../middleware/validate.js';
import { checkInDate, dateString } from '../utils/dates.js';
import { PG, translateDbError } from '../utils/dbErrors.js';

const router = Router();

// PUT replaces the whole row, so it requires every field. If is_active had a default
// here, editing an inactive room without sending it would silently reactivate the room.
const updateSchema = z.object({
  room_number: z.string().trim().min(1, 'Room number is required').max(10),
  floor: z.number().int().min(-5).max(100),
  room_type_id: z.number().int().positive().max(2147483647),
  is_active: z.boolean(),
});

// New rooms are active unless stated otherwise.
const createSchema = updateSchema.extend({
  is_active: z.boolean().default(true),
});

// Query values always arrive as strings, so guests is converted to a number.
const availabilitySchema = z
  .object({
    checkIn: checkInDate,
    checkOut: dateString,
    guests: z.coerce.number().int().min(1).max(20).default(1),
  })
  .refine((query) => query.checkOut > query.checkIn, {
    path: ['checkOut'],
    message: 'Check-out must be after check-in',
  });

const saveErrors = {
  [PG.UNIQUE_VIOLATION]: [409, 'A room with this number already exists'],
  [PG.FOREIGN_KEY_VIOLATION]: [400, 'The selected room type does not exist'],
};

const deleteErrors = {
  [PG.FOREIGN_KEY_VIOLATION]: [409, 'Cannot delete a room that has reservations; deactivate it instead'],
  [PG.RESTRICT_VIOLATION]: [409, 'Cannot delete a room that has reservations; deactivate it instead'],
};

// Public. Must stay above /:id, otherwise 'available' is read as an id.
// A room is taken if a non-cancelled booking starts before our check-out and ends
// after our check-in. Same rule as the reservations_no_overlap constraint.
router.get('/available', validateQuery(availabilitySchema), async (req, res) => {
  const { checkIn, checkOut, guests } = res.locals.query;
  const { rows } = await pool.query(
    `SELECT r.id, r.room_number, r.floor, r.room_type_id,
            rt.name AS room_type_name, rt.description, rt.capacity, rt.price_per_night,
            $2::date - $1::date AS nights,
            ($2::date - $1::date) * rt.price_per_night AS total_price
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.is_active
       AND rt.capacity >= $3
       AND NOT EXISTS (
         SELECT 1
         FROM reservations b
         WHERE b.room_id = r.id
           AND b.status <> 'cancelled'
           AND b.check_in < $2
           AND b.check_out > $1
       )
     ORDER BY rt.price_per_night, r.room_number`,
    [checkIn, checkOut, guests],
  );
  res.json(rows);
});

router.get('/', requireAuth, requireRole('admin', 'receptionist'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.room_number, r.floor, r.room_type_id, r.is_active,
            rt.name AS room_type_name, rt.capacity, rt.price_per_night
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     ORDER BY r.floor, r.room_number`,
  );
  res.json(rows);
});

router.get('/:id', requireAuth, requireRole('admin', 'receptionist'), validateId, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.room_number, r.floor, r.room_type_id, r.is_active,
            rt.name AS room_type_name, rt.capacity, rt.price_per_night
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     WHERE r.id = $1`,
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });
  res.json(rows[0]);
});

router.post('/', requireAuth, requireRole('admin'), validateBody(createSchema), async (req, res) => {
  const { room_number, floor, room_type_id, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO rooms (room_number, floor, room_type_id, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING id, room_number, floor, room_type_id, is_active`,
      [room_number, floor, room_type_id, is_active],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    throw translateDbError(err, saveErrors);
  }
});

router.put('/:id', requireAuth, requireRole('admin'), validateId, validateBody(updateSchema), async (req, res) => {
  const { room_number, floor, room_type_id, is_active } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE rooms
       SET room_number = $1, floor = $2, room_type_id = $3, is_active = $4
       WHERE id = $5
       RETURNING id, room_number, floor, room_type_id, is_active`,
      [room_number, floor, room_type_id, is_active, req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Room not found' });
    res.json(rows[0]);
  } catch (err) {
    throw translateDbError(err, saveErrors);
  }
});

router.delete('/:id', requireAuth, requireRole('admin'), validateId, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    res.status(204).end();
  } catch (err) {
    throw translateDbError(err, deleteErrors);
  }
});

export default router;
