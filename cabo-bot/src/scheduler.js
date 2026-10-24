import { getDb } from './db.js';
import { addDays, caboInstant, caboToday, formatDate } from './dates.js';
import { getBooking, sqlTime } from './bookings.js';
import { captainAnswered } from './bot.js';
import { sendReminder } from './notify.js';
import { sendMessage } from './whatsapp.js';

// Runs every minute: releases unpaid holds and sends reminders. Safe to run repeatedly.
export async function tick(now = new Date()) {
  const db = getDb();

  // 1. Captains who didn't answer in time: offer the customer other boats.
  const unanswered = db.prepare(`
    SELECT code FROM bookings WHERE status = 'awaiting_captain' AND hold_expires_at <= ?
  `).all(sqlTime(now));
  for (const { code } of unanswered) {
    const r = db.prepare(`UPDATE bookings SET status = 'no_reply' WHERE code = ? AND status = 'awaiting_captain'`).run(code);
    if (!r.changes) continue;
    const b = getBooking(code);
    await sendMessage(b.captain_phone, { text: `⌛ Request ${code} (${formatDate(b.date)}) expired without an answer, so we offered the client other boats.` }, { notification: true });
    await captainAnswered(b, 'timeout');
  }

  // 2. Expire unpaid holds and tell the customer.
  const expired = db.prepare(`
    SELECT code, customer_phone FROM bookings WHERE status = 'pending_payment' AND hold_expires_at <= ?
  `).all(sqlTime(now));
  for (const b of expired) {
    db.prepare(`UPDATE bookings SET status = 'expired' WHERE code = ? AND status = 'pending_payment'`).run(b.code);
    db.prepare(`UPDATE conversations SET state = 'menu', data = json_object('name', json_extract(data, '$.name'))
                WHERE phone = ? AND state = 'awaiting_payment' AND json_extract(data, '$.code') = ?`).run(b.customer_phone, b.code);
    await sendMessage(b.customer_phone, { text: `⌛ Your reservation ${b.code} expired because the payment wasn't completed. No worries — type *menu* to book again.` });
  }

  // 3. Day-before reminders at 5 PM Cabo time.
  const tomorrow = addDays(caboToday(now), 1);
  if (now >= caboInstant(caboToday(now), '17:00')) {
    for (const { code } of db.prepare(`
      SELECT code FROM bookings WHERE status = 'confirmed' AND reminder_day_before = 0 AND date = ?
    `).all(tomorrow)) {
      const b = getBooking(code);
      // Skip if they booked after 3 PM today: the confirmation is fresh enough.
      if (b.confirmed_at && new Date(b.confirmed_at.replace(' ', 'T') + 'Z') < caboInstant(caboToday(now), '15:00')) {
        await sendReminder(b, 'day_before');
      }
      db.prepare('UPDATE bookings SET reminder_day_before = 1 WHERE id = ?').run(b.id);
    }
  }

  // 4. Wrap-up: fishing at 6 PM on trip day, rentals at 9 AM on the last day. Then mark completed.
  const today = caboToday(now);
  const due = [];
  if (now >= caboInstant(today, '18:00')) {
    due.push(...db.prepare(`SELECT code FROM bookings WHERE status = 'confirmed' AND reminder_same_day = 0 AND kind = 'fishing' AND date <= ?`).all(today));
  }
  if (now >= caboInstant(today, '09:00')) {
    due.push(...db.prepare(`SELECT code FROM bookings WHERE status = 'confirmed' AND reminder_same_day = 0 AND kind = 'rental' AND end_date <= ?`).all(today));
  }
  for (const { code } of due) {
    const b = getBooking(code);
    const isToday = (b.kind === 'fishing' ? b.date : b.end_date) === today;
    if (isToday) await sendReminder(b, 'wrap_up'); // don't send stale messages after downtime
    db.prepare(`UPDATE bookings SET reminder_same_day = 1, status = 'completed' WHERE id = ?`).run(b.id);
  }
}

export function startScheduler() {
  const run = () => tick().catch((e) => console.error('Scheduler error', e));
  run();
  return setInterval(run, 60_000);
}
