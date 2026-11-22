// Resets the database: runs schema.sql (drops + recreates tables), then inserts seed data.
// Usage: npm run db:reset
import { readFileSync } from 'node:fs';
import bcrypt from 'bcryptjs';
import pool from '../src/db.js';

const SEED_PASSWORD = 'Password123!';

const users = [
  { fullName: 'Nino Kapanadze',   email: 'admin@hotel.test',     role: 'admin' },
  { fullName: 'Levan Gelashvili', email: 'reception@hotel.test', role: 'receptionist' },
  { fullName: 'Mariam Tsiklauri', email: 'guest@hotel.test',     role: 'guest' },
  { fullName: 'Giorgi Abashidze', email: 'giorgi@hotel.test',    role: 'guest' },
  { fullName: 'Anna Müller',      email: 'anna@hotel.test',      role: 'guest' },
];

// Prices are per night, in GEL.
const roomTypes = [
  {
    name: 'Standard Single',
    description: 'Compact room with a single bed, work desk and rain shower. Faces the inner courtyard.',
    capacity: 1,
    price: 140,
  },
  {
    name: 'Standard Double',
    description: 'Queen bed, small seating corner and a view of Rustaveli Avenue.',
    capacity: 2,
    price: 190,
  },
  {
    name: 'Deluxe King',
    description: 'Spacious room with a king bed, bathtub, espresso machine and a balcony over the old town.',
    capacity: 2,
    price: 280,
  },
  {
    name: 'Family Suite',
    description: 'Two connected rooms: a king bed and two singles, plus a living area with a sofa bed.',
    capacity: 4,
    price: 420,
  },
];

// [room_number, floor, room type name]
const rooms = [
  ['101', 1, 'Standard Single'],
  ['102', 1, 'Standard Single'],
  ['103', 1, 'Standard Double'],
  ['104', 1, 'Standard Double'],
  ['201', 2, 'Standard Double'],
  ['202', 2, 'Standard Double'],
  ['203', 2, 'Deluxe King'],
  ['204', 2, 'Deluxe King'],
  ['301', 3, 'Deluxe King'],
  ['302', 3, 'Deluxe King'],
  ['303', 3, 'Family Suite'],
  ['304', 3, 'Family Suite'],
];

// Dates are offsets in days from today, so the demo data always looks current.
// [guest email, room number, check-in offset, nights, guests, status]
const reservations = [
  ['guest@hotel.test',  '203', -2, 4, 2, 'checked_in'],   // in house right now
  ['guest@hotel.test',  '303', 14, 3, 3, 'pending'],      // upcoming, awaiting confirmation
  ['giorgi@hotel.test', '103',  0, 2, 2, 'confirmed'],    // arrives today
  ['giorgi@hotel.test', '101', -10, 3, 1, 'checked_out'], // past stay
  ['anna@hotel.test',   '301',  3, 5, 2, 'confirmed'],
  ['anna@hotel.test',   '204',  1, 2, 2, 'cancelled'],    // cancelled, so 204 is free again
];

async function seed() {
  // 1. Schema. A single query string with several statements is fine here because
  //    it has no parameters and comes from our own file, not from user input.
  const schemaSql = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');
  await pool.query(schemaSql);
  console.log('Schema created');

  // 2. Data, all in one transaction: either everything is inserted or nothing.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
    for (const u of users) {
      await client.query(
        'INSERT INTO users (full_name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        [u.fullName, u.email, passwordHash, u.role],
      );
    }

    for (const t of roomTypes) {
      await client.query(
        'INSERT INTO room_types (name, description, capacity, price_per_night) VALUES ($1, $2, $3, $4)',
        [t.name, t.description, t.capacity, t.price],
      );
    }

    for (const [roomNumber, floor, typeName] of rooms) {
      await client.query(
        `INSERT INTO rooms (room_number, floor, room_type_id)
         SELECT $1, $2, id FROM room_types WHERE name = $3`,
        [roomNumber, floor, typeName],
      );
    }

    // total_price = nights * price_per_night, computed by Postgres from the room's type.
    for (const [email, roomNumber, offset, nights, guests, status] of reservations) {
      await client.query(
        `INSERT INTO reservations (room_id, guest_id, check_in, check_out, guests, total_price, status)
         SELECT r.id, u.id,
                CURRENT_DATE + $3::int,
                CURRENT_DATE + $3::int + $4::int,
                $5, $4::int * rt.price_per_night, $6
         FROM rooms r
         JOIN room_types rt ON rt.id = r.room_type_id
         JOIN users u ON u.email = $2
         WHERE r.room_number = $1`,
        [roomNumber, email, offset, nights, guests, status],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(
    `Seeded ${users.length} users, ${roomTypes.length} room types, ` +
      `${rooms.length} rooms, ${reservations.length} reservations`,
  );
  console.log(`Test logins (password ${SEED_PASSWORD}): admin@hotel.test, reception@hotel.test, guest@hotel.test`);
}

seed()
  .catch((err) => {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
