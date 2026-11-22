// CRUD for /api/room-types.
import { Router } from 'express';
import { z } from 'zod';
import pool from '../db.js';
import { validateBody, validateId } from '../middleware/validate.js';
import { PG, translateDbError } from '../utils/dbErrors.js';

const router = Router();

// PUT replaces the whole row, so it requires every field.
const updateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(1000).nullable(),
  capacity: z.number().int().min(1).max(20),
  price_per_night: z.number().positive().max(99999999.99).multipleOf(0.01),
});

// POST may leave out the description.
const createSchema = updateSchema.extend({
  description: updateSchema.shape.description.default(null),
});

const saveErrors = {
  [PG.UNIQUE_VIOLATION]: [409, 'A room type with this name already exists'],
};

const deleteErrors = {
  [PG.FOREIGN_KEY_VIOLATION]: [409, 'Cannot delete a room type that still has rooms'],
  [PG.RESTRICT_VIOLATION]: [409, 'Cannot delete a room type that still has rooms'],
};

// Public
router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, capacity, price_per_night
     FROM room_types
     ORDER BY price_per_night, id`,
  );
  res.json(rows);
});

// Public
router.get('/:id', validateId, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, name, description, capacity, price_per_night
     FROM room_types
     WHERE id = $1`,
    [req.params.id],
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Room type not found' });
  res.json(rows[0]);
});

// TODO(auth): requireAuth, requireRole('admin')
router.post('/', validateBody(createSchema), async (req, res) => {
  const { name, description, capacity, price_per_night } = req.body;
  try {
    const { rows } = await pool.query(
      `INSERT INTO room_types (name, description, capacity, price_per_night)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, description, capacity, price_per_night`,
      [name, description, capacity, price_per_night],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    throw translateDbError(err, saveErrors);
  }
});

// TODO(auth): requireAuth, requireRole('admin')
router.put('/:id', validateId, validateBody(updateSchema), async (req, res) => {
  const { name, description, capacity, price_per_night } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE room_types
       SET name = $1, description = $2, capacity = $3, price_per_night = $4
       WHERE id = $5
       RETURNING id, name, description, capacity, price_per_night`,
      [name, description, capacity, price_per_night, req.params.id],
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Room type not found' });
    res.json(rows[0]);
  } catch (err) {
    throw translateDbError(err, saveErrors);
  }
});

// TODO(auth): requireAuth, requireRole('admin')
router.delete('/:id', validateId, async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM room_types WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Room type not found' });
    res.status(204).end();
  } catch (err) {
    throw translateDbError(err, deleteErrors);
  }
});

export default router;
