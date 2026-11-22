// One shared PostgreSQL connection pool for the whole app.
// Every route imports this and runs parameterized queries, e.g.
//   const { rows } = await pool.query('SELECT * FROM rooms WHERE id = $1', [id]);
import 'dotenv/config';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy server/.env.example to server/.env and fill it in.');
}

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of JS Date objects.
// Otherwise pg converts them to midnight in the server's local time zone, and
// check-in dates can shift by a day when serialized to JSON.
const DATE_OID = 1082;
pg.types.setTypeParser(DATE_OID, (value) => value);

// Return NUMERIC columns (our prices) as numbers instead of strings like '190.00',
// so the client can send back exactly what it received. NUMERIC(10,2) is small
// enough to fit in a JS number. Do money arithmetic in SQL, not in JS.
const NUMERIC_OID = 1700;
pg.types.setTypeParser(NUMERIC_OID, Number);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
