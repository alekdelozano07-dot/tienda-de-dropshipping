import crypto from 'node:crypto';
import { getDb } from './db.js';
import { config } from './config.js';
import { addDays, daysBetween } from './dates.js';

// A booking "holds" inventory while confirmed/completed, or while unpaid and its hold has not expired.
const HOLDING = `(status IN ('confirmed', 'completed') OR (status = 'pending_payment' AND hold_expires_at > datetime('now')))`;

export function newCode() {
  return 'CB' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

export function depositFor(total) {
  return Math.ceil((total * config.depositPercent) / 100);
}

// ---------- Fishing ----------

export const TRIP_HOURS = [4, 6, 8];

export function availableBoats(date, hours, guests, { excludeBookingId = 0 } = {}) {
  if (!TRIP_HOURS.includes(hours)) throw new Error(`Invalid trip length: ${hours}`);
  return getDb().prepare(`
    SELECT b.*, c.name AS captain_name, c.phone AS captain_phone, b.price_${hours}h AS price
    FROM boats b JOIN captains c ON c.id = b.captain_id
    WHERE b.active = 1 AND c.active = 1
      AND b.max_guests >= ?
      AND b.price_${hours}h IS NOT NULL
      AND b.id NOT IN (SELECT boat_id FROM boat_blocks WHERE date = ?)
      AND b.id NOT IN (SELECT boat_id FROM bookings WHERE kind = 'fishing' AND date = ? AND id != ? AND ${HOLDING})
    ORDER BY price ASC
  `).all(guests, date, date, excludeBookingId);
}

export function createFishingHold({ phone, name, source, date, hours, guests, boatId }) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const boat = availableBoats(date, hours, guests).find((b) => b.id === boatId);
    if (!boat) { db.exec('ROLLBACK'); return null; }
    const total = boat.price;
    const deposit = depositFor(total);
    const code = newCode();
    db.prepare(`
      INSERT INTO bookings (code, kind, status, customer_phone, customer_name, source, date, boat_id, hours, guests,
                            total, paid_online, balance_cash, hold_expires_at)
      VALUES (?, 'fishing', 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
    `).run(code, phone, name, source, date, boatId, hours, guests, total, deposit, total - deposit, `+${config.holdMinutes} minutes`);
    db.exec('COMMIT');
    return getBooking(code);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- Rentals ----------

export function rentalItems() {
  return getDb().prepare('SELECT * FROM rental_items WHERE active = 1 ORDER BY category, name').all();
}

// Units of an item free on every day of [start, end].
export function itemAvailability(itemId, start, end, { excludeBookingId = 0 } = {}) {
  const db = getDb();
  const item = db.prepare('SELECT * FROM rental_items WHERE id = ?').get(itemId);
  if (!item) return 0;
  const rows = db.prepare(`
    SELECT bk.date, bk.end_date, bi.qty FROM booking_items bi JOIN bookings bk ON bk.id = bi.booking_id
    WHERE bi.item_id = ? AND bk.kind = 'rental' AND bk.id != ? AND ${HOLDING}
      AND bk.date <= ? AND bk.end_date >= ?
  `).all(itemId, excludeBookingId, end, start);
  let worst = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    const used = rows.filter((r) => r.date <= d && r.end_date >= d).reduce((s, r) => s + r.qty, 0);
    worst = Math.max(worst, used);
  }
  return Math.max(0, item.stock - worst);
}

export function rentalQuote(items, start, end) {
  const days = daysBetween(start, end) + 1;
  const all = Object.fromEntries(rentalItems().map((i) => [i.id, i]));
  const lines = items.map(({ itemId, qty }) => {
    const item = all[itemId];
    return { item, qty, subtotal: item.price_per_day * qty * days };
  });
  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  return { days, lines, delivery: config.rentalDeliveryFee, total: subtotal + config.rentalDeliveryFee };
}

export function createRentalHold({ phone, name, source, start, end, items, address }) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const { itemId, qty } of items) {
      if (itemAvailability(itemId, start, end) < qty) { db.exec('ROLLBACK'); return null; }
    }
    const quote = rentalQuote(items, start, end);
    const code = newCode();
    const { lastInsertRowid } = db.prepare(`
      INSERT INTO bookings (code, kind, status, customer_phone, customer_name, source, date, end_date, delivery_address,
                            total, paid_online, balance_cash, hold_expires_at)
      VALUES (?, 'rental', 'pending_payment', ?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now', ?))
    `).run(code, phone, name, source, start, end, address, quote.total, quote.total, `+${config.holdMinutes} minutes`);
    const ins = db.prepare('INSERT INTO booking_items (booking_id, item_id, qty) VALUES (?, ?, ?)');
    for (const { itemId, qty } of items) ins.run(lastInsertRowid, itemId, qty);
    db.exec('COMMIT');
    return getBooking(code);
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---------- Common ----------

export function getBooking(code) {
  const db = getDb();
  const b = db.prepare(`
    SELECT bk.*, bt.name AS boat_name, bt.meeting_point, bt.length_ft, c.name AS captain_name, c.phone AS captain_phone
    FROM bookings bk LEFT JOIN boats bt ON bt.id = bk.boat_id LEFT JOIN captains c ON c.id = bt.captain_id
    WHERE bk.code = ?
  `).get(code);
  if (b && b.kind === 'rental') {
    b.items = db.prepare(`
      SELECT ri.name, ri.price_per_day, bi.qty, bi.item_id FROM booking_items bi JOIN rental_items ri ON ri.id = bi.item_id
      WHERE bi.booking_id = ?
    `).all(b.id);
  }
  return b;
}

export function setPaymentRef(code, ref) {
  getDb().prepare('UPDATE bookings SET payment_ref = ? WHERE code = ?').run(ref, code);
}

// Marks a booking paid. Returns { booking, outcome } where outcome is
// 'confirmed' | 'already' | 'conflict' (paid after the hold expired and the slot was taken).
export function markPaid(code) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const b = getBooking(code);
    if (!b) { db.exec('ROLLBACK'); return { booking: null, outcome: 'missing' }; }
    if (b.status === 'confirmed' || b.status === 'completed') { db.exec('ROLLBACK'); return { booking: b, outcome: 'already' }; }

    let stillFree = true;
    if (b.status !== 'pending_payment' || new Date(b.hold_expires_at.replace(' ', 'T') + 'Z') <= new Date()) {
      // Hold lapsed (or booking cancelled): only confirm if the inventory is still free.
      stillFree = b.kind === 'fishing'
        ? availableBoats(b.date, b.hours, b.guests, { excludeBookingId: b.id }).some((x) => x.id === b.boat_id)
        : b.items.every((i) => itemAvailability(i.item_id, b.date, b.end_date, { excludeBookingId: b.id }) >= i.qty);
    }
    if (!stillFree) {
      db.prepare(`UPDATE bookings SET status = 'cancelled' WHERE id = ?`).run(b.id);
      db.exec('COMMIT');
      return { booking: getBooking(code), outcome: 'conflict' };
    }
    db.prepare(`UPDATE bookings SET status = 'confirmed', confirmed_at = datetime('now') WHERE id = ?`).run(b.id);
    db.exec('COMMIT');
    return { booking: getBooking(code), outcome: 'confirmed' };
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function setStatus(code, status) {
  getDb().prepare('UPDATE bookings SET status = ? WHERE code = ?').run(status, code);
}

export function upcomingForPhone(phone) {
  return getDb().prepare(`
    SELECT code FROM bookings WHERE customer_phone = ? AND status = 'confirmed' AND COALESCE(end_date, date) >= date('now', '-7 hours')
    ORDER BY date
  `).all(phone).map((r) => getBooking(r.code));
}
