import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../db.js';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { PG, translateDbError } from '../utils/dbErrors.js';

const router = Router();
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
const email = z.string().trim().toLowerCase().pipe(z.email().max(255));
const password = z.string().min(1).refine(value => !bcrypt.truncates(value), {
  message: 'Password must be at most 72 bytes',
});
const login = z.strictObject({ email, password });
const registration = login.extend({
  full_name: z.string().trim().min(1).max(100),
  password: password.min(8),
});

router.post('/register', validateBody(registration), async (req, res) => {
  const { full_name, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      `INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, full_name, email, role`,
      [full_name, email, hash],
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    throw translateDbError(err, {
      [PG.UNIQUE_VIOLATION]: [409, 'Email is already registered'],
    });
  }
});

router.post('/login', validateBody(login), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, full_name, email, role, password_hash FROM users WHERE email = $1',
    [req.body.email],
  );
  const account = rows[0];
  if (!account || !await bcrypt.compare(req.body.password, account.password_hash)) {
    return res.status(401).json({ error: 'Incorrect email or password' });
  }
  const { id, full_name, email, role } = account;
  setSessionCookie(res, id);
  res.json({ user: { id, full_name, email, role } });
});

router.post('/logout', (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

router.get('/me', requireAuth, (req, res) => res.json({ user: req.user }));

export default router;
