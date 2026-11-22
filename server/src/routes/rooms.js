// CRUD for /api/rooms.
import { Router } from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { validateBody, validateId } from '../middleware/validate.js';
import { PG, translateDbError } from '../utils/dbErrors.js';

const router = Router();

// PUT replaces the whole row, so it requires every field. If is_active had a default
// here, editing an inactive room without sending it would silently reactivate the room.
const updateSchema = z.object({
  room_number: z.string().trim().min(1).max(10),
  floor: z.number().int().min(-5).max(100),
  room_type_id: z.number().int().positive().max(2147483647),
  is_active: z.boolean(),
});

// New rooms are active unless stated otherwise.
const createSchema = updateSchema.extend({
  is_active: z.boolean().default(true),
});

const saveErrors = {
  [PG.UNIQUE_VIOLATION]: [409, 'A room with this number already exists'],
  [PG.FOREIGN_KEY_VIOLATION]: [400, 'The selected room type does not exist'],
};

const deleteErrors = {
  [PG.FOREIGN_KEY_VIOLATION]: [409, 'Cannot delete a room that has reservations; deactivate it instead'],
  [PG.RESTRICT_VIOLATION]: [409, 'Cannot delete a room that has reservations; deactivate it instead'],
};

// When GET /available is added, declare it above /:id, otherwise 'available' is read as an id.

// TODO(auth): requireAuth, requireRole('admin', 'receptionist')
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT r.id, r.room_number, r.floor, r.room_type_id, r.is_active,
            rt.name AS room_type_name, rt.capacity, rt.price_per_night
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     ORDER BY r.floor, r.room_number`,
  );
  res.json(rows);
});

// TODO(auth): requireAuth, requireRole('admin', 'receptionist')
router.get('/:id', validateId, async (req, res) => {
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

// TODO(auth): requireAuth, requireRole('admin')
router.post('/', validateBody(createSchema), async (req, res) => {
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

// TODO(auth): requireAuth, requireRole('admin')
router.put('/:id', validateId, validateBody(updateSchema), async (req, res) => {
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

// TODO(auth): requireAuth, requireRole('admin')
router.delete('/:id', validateId, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    res.status(204).end();
  } catch (err) {
    throw translateDbError(err, deleteErrors);
  }
});

export default router;
