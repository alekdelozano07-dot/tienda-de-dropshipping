import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.js';

let db;

export function getDb() {
  if (!db) openDb(config.dbPath);
  return db;
}

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

// Columns added after the first release; ALTER TABLE fails harmlessly if they already exist.
const MIGRATIONS = [
  "ALTER TABLE captains ADD COLUMN lang TEXT NOT NULL DEFAULT 'es'",
  'ALTER TABLE boats ADD COLUMN description_es TEXT',
  'ALTER TABLE rental_items ADD COLUMN name_es TEXT',
  "ALTER TABLE bookings ADD COLUMN lang TEXT NOT NULL DEFAULT 'en'",
  'ALTER TABLE conversations ADD COLUMN lang TEXT',
  'ALTER TABLE bookings ADD COLUMN start_time TEXT',
  'ALTER TABLE bookings ADD COLUMN duration_min INTEGER',
];

function migrate(db) {
  for (const sql of MIGRATIONS) {
    try { db.exec(sql); } catch (e) { if (!/duplicate column/i.test(e.message)) throw e; }
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS captains (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS boats (
  id INTEGER PRIMARY KEY,
  captain_id INTEGER NOT NULL REFERENCES captains(id),
  name TEXT NOT NULL,
  length_ft INTEGER,
  max_guests INTEGER NOT NULL,
  description TEXT,
  meeting_point TEXT,
  price_4h INTEGER,
  price_6h INTEGER,
  price_8h INTEGER,
  active INTEGER NOT NULL DEFAULT 1
);

-- Dates a captain marked as unavailable (weather, maintenance, private trip)
CREATE TABLE IF NOT EXISTS boat_blocks (
  boat_id INTEGER NOT NULL REFERENCES boats(id),
  date TEXT NOT NULL,
  PRIMARY KEY (boat_id, date)
);

CREATE TABLE IF NOT EXISTS rental_items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- beach | baby
  price_per_day INTEGER NOT NULL,
  stock INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL, -- fishing | rental | massage
  status TEXT NOT NULL, -- pending_payment | confirmed | cancelled | expired | completed
  customer_phone TEXT NOT NULL,
  customer_name TEXT,
  source TEXT,
  date TEXT NOT NULL,            -- trip date or rental start (YYYY-MM-DD, Cabo time)
  end_date TEXT,                 -- rental last day (inclusive)
  boat_id INTEGER REFERENCES boats(id),
  hours INTEGER,
  guests INTEGER,
  delivery_address TEXT,
  total INTEGER NOT NULL,        -- USD
  paid_online INTEGER NOT NULL,  -- USD charged online (deposit or full)
  balance_cash INTEGER NOT NULL, -- USD paid in cash to captain
  payment_ref TEXT,
  hold_expires_at TEXT,
  reminder_day_before INTEGER NOT NULL DEFAULT 0,
  reminder_same_day INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS bookings_date ON bookings(date, status);

CREATE TABLE IF NOT EXISTS booking_items (
  booking_id INTEGER NOT NULL REFERENCES bookings(id),
  item_id INTEGER NOT NULL REFERENCES rental_items(id),
  qty INTEGER NOT NULL,
  PRIMARY KEY (booking_id, item_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  phone TEXT PRIMARY KEY,
  state TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  human_mode INTEGER NOT NULL DEFAULT 0, -- 1 = owner took over, bot stays quiet
  source TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages_log (
  id INTEGER PRIMARY KEY,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL, -- in | out
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS processed_events (
  id TEXT PRIMARY KEY
);
`;
