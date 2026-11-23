// Entry point: creates the Express app, registers middleware and routes, starts the server.
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pool from './db.js';
import roomTypesRouter from './routes/roomTypes.js';
import authRouter from './routes/auth.js';
import roomsRouter from './routes/rooms.js';
import reservationsRouter from './routes/reservations.js';

const app = express();

app.use(cors());          // allow the React dev server to call the API
app.use(express.json());  // parse JSON request bodies into req.body

// Health check: confirms the API is up and can reach the database.
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error('Health check failed:', err.code || err.message);
    res.status(503).json({ ok: false, error: 'Database unreachable' });
  }
});

// Feature routers
app.use('/api/auth', authRouter);
app.use('/api/room-types', roomTypesRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/reservations', reservationsRouter);

// Unknown /api routes get a JSON 404 instead of Express's HTML page.
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Central error handler. Express 5 forwards errors thrown in async handlers here.
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err); // 4xx are the caller's mistakes, no stack trace needed
  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
