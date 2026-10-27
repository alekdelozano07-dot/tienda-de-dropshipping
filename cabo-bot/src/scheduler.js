import { getDb } from './db.js';
import { addDays, caboInstant, caboToday } from './dates.js';
import { availableBoats, freeTherapists, getBooking, itemAvailability, sqlTime } from './bookings.js';
import { captainAnswered } from './bot.js';
import { offerAgain, sendReminder, tellCaptain } from './notify.js';
import { t } from './i18n.js';
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
    await tellCaptain(b, 'capTimeout');
    await captainAnswered(b, 'timeout');
  }

  // 2. Expire unpaid holds and tell the customer.
  const expired = db.prepare(`
    SELECT code, customer_phone, lang FROM bookings WHERE status = 'pending_payment' AND hold_expires_at <= ?
  `).all(sqlTime(now));
  for (const b of expired) {
    db.prepare(`UPDATE bookings SET status = 'expired' WHERE code = ? AND status = 'pending_payment'`).run(b.code);
    db.prepare(`UPDATE conversations SET state = 'menu', data = json_object('name', json_extract(data, '$.name'))
                WHERE phone = ? AND state = 'awaiting_payment' AND json_extract(data, '$.code') = ?`).run(b.customer_phone, b.code);
    await sendMessage(b.customer_phone, { text: t(b.lang, 'holdExpired', b.code) }, { lang: b.lang });
  }

  // 2b. Three hours after an unpaid booking expired, offer it once more (inside WhatsApp's 24-hour window),
  //     but only if it is still free, still ahead, and the customer hasn't booked something else or moved on.
  const HOUR = 60 * 60 * 1000;
  const stale = db.prepare(`
    SELECT code FROM bookings WHERE status = 'expired' AND followup_sent = 0 AND hold_expires_at <= ? AND hold_expires_at > ?
  `).all(sqlTime(new Date(now.getTime() - 3 * HOUR)), sqlTime(new Date(now.getTime() - 20 * HOUR)));
  for (const { code } of stale) {
    db.prepare('UPDATE bookings SET followup_sent = 1 WHERE code = ?').run(code);
    const b = getBooking(code);
    if (worthFollowingUp(b, now)) await offerAgain(b);
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

  // 4. Wrap-up: fishing at 6 PM on trip day, massages at 9 PM (the last slot is 6 PM), rentals at 9 AM on the last day.
  //    Then mark completed.
  const today = caboToday(now);
  const due = [];
  if (now >= caboInstant(today, '18:00')) {
    due.push(...db.prepare(`SELECT code FROM bookings WHERE status = 'confirmed' AND reminder_same_day = 0 AND kind = 'fishing' AND date <= ?`).all(today));
  }
  if (now >= caboInstant(today, '21:00')) {
    due.push(...db.prepare(`SELECT code FROM bookings WHERE status = 'confirmed' AND reminder_same_day = 0 AND kind = 'massage' AND date <= ?`).all(today));
  }
  if (now >= caboInstant(today, '09:00')) {
    due.push(...db.prepare(`SELECT code FROM bookings WHERE status = 'confirmed' AND reminder_same_day = 0 AND kind = 'rental' AND end_date <= ?`).all(today));
  }
  for (const { code } of due) {
    const b = getBooking(code);
    const isToday = (b.kind === 'rental' ? b.end_date : b.date) === today;
    if (isToday) await sendReminder(b, 'wrap_up'); // don't send stale messages after downtime
    db.prepare(`UPDATE bookings SET reminder_same_day = 1, status = 'completed' WHERE id = ?`).run(b.id);
  }
}

function worthFollowingUp(b, now) {
  const db = getDb();
  if (b.date <= caboToday(now)) return false;
  const chat = db.prepare('SELECT state, human_mode FROM conversations WHERE phone = ?').get(b.customer_phone);
  if (!chat || chat.state !== 'menu' || chat.human_mode) return false;
  const bookedSince = db.prepare(`
    SELECT 1 FROM bookings WHERE customer_phone = ? AND id > ? AND status IN ('awaiting_captain', 'pending_payment', 'confirmed', 'completed')
  `).get(b.customer_phone, b.id);
  if (bookedSince) return false;
  if (b.kind === 'fishing') return availableBoats(b.date, b.hours, b.guests).some((x) => x.id === b.boat_id);
  if (b.kind === 'massage') return freeTherapists(b.date, b.start_time) >= b.guests;
  return b.items.every((i) => itemAvailability(i.item_id, b.date, b.end_date) >= i.qty);
}

export function startScheduler() {
  const run = () => tick().catch((e) => console.error('Scheduler error', e));
  run();
  return setInterval(run, 60_000);
}
