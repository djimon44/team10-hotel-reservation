import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const secret = process.env.JWT_SECRET;
if (!secret?.trim() || secret === 'change-me-to-a-long-random-string') {
  throw new Error('Set JWT_SECRET to a private random value in server/.env');
}

const cookieName = 'hotel_session';
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api',
};

export function setSessionCookie(res, userId) {
  const token = jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: '1h',
  });
  res.cookie(cookieName, token, { ...cookieOptions, maxAge: 60 * 60 * 1000 });
}

export function clearSessionCookie(res) {
  res.clearCookie(cookieName, cookieOptions);
}

export async function requireAuth(req, res, next) {
  const token = req.cookies[cookieName];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let claims;
  try {
    claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  if (!/^[1-9]\d*$/.test(claims.sub) || Number(claims.sub) > 2147483647) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  const { rows } = await pool.query(
    'SELECT id, full_name, email, role FROM users WHERE id = $1',
    [claims.sub],
  );
  if (!rows.length) return res.status(401).json({ error: 'Account unavailable' });
  req.user = rows[0];
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Access denied' });
    next();
  };
}
