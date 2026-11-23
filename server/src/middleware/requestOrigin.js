import 'dotenv/config';

const production = process.env.NODE_ENV === 'production';
if (production && !process.env.APP_ORIGIN) {
  throw new Error('Set APP_ORIGIN to the public HTTPS origin of the app');
}
const origins = process.env.APP_ORIGIN ? [process.env.APP_ORIGIN] : [
  'http://localhost:5173',
  'http://localhost:' + (process.env.PORT || 4000),
];
export const trustedOrigins = origins.map(value => {
  const url = new URL(value);
  if (url.origin !== value || (production && url.protocol !== 'https:')) {
    throw new Error('APP_ORIGIN must be an exact origin, with HTTPS in production');
  }
  return url.origin;
});

export function checkWriteOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  let origin = req.get('Origin');
  if (!origin && req.get('Referer')) {
    try {
      origin = new URL(req.get('Referer')).origin;
    } catch {
      return res.status(403).json({ error: 'Invalid request origin' });
    }
  }
  if (origin && trustedOrigins.includes(origin)) return next();

  // Origin-less API clients can send JSON or a non-simple method. A cross-origin
  // browser would need a successful CORS preflight to send either.
  if (!origin && !req.get('Sec-Fetch-Site') &&
      (req.is('application/json') || ['PUT', 'PATCH', 'DELETE'].includes(req.method))) return next();
  return res.status(403).json({ error: 'Untrusted request origin' });
}
