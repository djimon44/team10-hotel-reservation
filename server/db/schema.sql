-- Hotel reservation system schema (PostgreSQL 16+).
-- Run through `npm run db:reset`, which executes this file and then inserts seed data.

-- Drops make the reset repeatable. CASCADE also drops objects that depend on these tables.
DROP TABLE IF EXISTS reservations, rooms, room_types, users CASCADE;

-- btree_gist lets a GiST index combine plain equality (room_id =) with
-- range overlap (&&), which the EXCLUDE constraint on reservations needs.
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE users (
    id            SERIAL PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'guest'
                  CHECK (role IN ('admin', 'receptionist', 'guest')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE room_types (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(80)   NOT NULL UNIQUE,
    description     TEXT,
    capacity        INTEGER       NOT NULL CHECK (capacity > 0),
    price_per_night NUMERIC(10,2) NOT NULL CHECK (price_per_night > 0)  -- GEL
);

-- One room type has many rooms. RESTRICT: a type cannot be deleted while rooms use it.
CREATE TABLE rooms (
    id           SERIAL PRIMARY KEY,
    room_number  VARCHAR(10) NOT NULL UNIQUE,
    floor        INTEGER     NOT NULL,
    room_type_id INTEGER     NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    is_active    BOOLEAN     NOT NULL DEFAULT true
);

CREATE TABLE reservations (
    id          SERIAL PRIMARY KEY,
    room_id     INTEGER       NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
    guest_id    INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    check_in    DATE          NOT NULL,
    check_out   DATE          NOT NULL,
    guests      INTEGER       NOT NULL CHECK (guests > 0),
    total_price NUMERIC(10,2) NOT NULL CHECK (total_price >= 0),  -- nights * price_per_night, GEL
    status      VARCHAR(20)   NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled')),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CHECK (check_out > check_in),

    -- The database itself refuses two non-cancelled bookings of the same room on
    -- overlapping dates. '[)' means check-out day is excluded, so one guest can
    -- check out on the same day the next one checks in. Violations raise SQLSTATE 23P01.
    CONSTRAINT reservations_no_overlap EXCLUDE USING gist (
        room_id WITH =,
        daterange(check_in, check_out, '[)') WITH &&
    ) WHERE (status <> 'cancelled')
);

-- Speeds up "my reservations" and foreign-key lookups.
CREATE INDEX reservations_guest_id_idx ON reservations (guest_id);
CREATE INDEX rooms_room_type_id_idx ON rooms (room_type_id);

-- TODO for the final milestone: amenities + room_type_amenities (many-to-many).
