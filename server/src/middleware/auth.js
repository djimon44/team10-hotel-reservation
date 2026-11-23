import 'dotenv/config';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const secret = process.env.JWT_SECRET;
if (!secret?.trim() || secret === 'change-me-to-a-long-random-string') {
  throw new Error('Set JWT_SECRET to a private random value in server/.env');
}

export function issueToken(userId) {
  return jwt.sign({}, secret, {
    algorithm: 'HS256',
    subject: String(userId),
    expiresIn: '1h',
  });
}

export async function requireAuth(req, res, next) {
  const match = /^Bearer (\S+)$/i.exec(req.get('Authorization') || '');
  if (!match) return res.status(401).json({ error: 'Authentication required' });

  let claims;
  try {
    claims = jwt.verify(match[1], secret, { algorithms: ['HS256'] });
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
