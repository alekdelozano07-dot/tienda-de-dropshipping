import { getDb } from './db.js';
import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { caboToday, formatDate, formatTime, parseDate, TRIP_START } from './dates.js';
import { getBooking, setStatus } from './bookings.js';
import { bookingSummary } from './notify.js';
import { setHumanMode } from './bot.js';

export function isCaptain(phone) {
  return !!getDb().prepare('SELECT 1 FROM captains WHERE phone = ? AND active = 1').get(phone);
}

const CAPTAIN_HELP =
  'Captain commands:\n• *TRIPS* — your upcoming trips\n• *BLOCK 2026-11-20* — close a date (all your boats)\n• *UNBLOCK 2026-11-20* — reopen a date\n• *BLOCKED* — dates you closed';

export async function handleCaptainMessage(phone, text) {
  const db = getDb();
  const captain = db.prepare('SELECT * FROM captains WHERE phone = ?').get(phone);
  const boats = db.prepare('SELECT id, name FROM boats WHERE captain_id = ?').all(captain.id);
  const [cmd, ...rest] = text.trim().split(/\s+/);
  const arg = rest.join(' ');
  const reply = (t) => sendMessage(phone, { text: t });

  switch ((cmd || '').toUpperCase()) {
    case 'TRIPS': {
      const trips = db.prepare(`
        SELECT code FROM bookings WHERE kind = 'fishing' AND status = 'confirmed' AND date >= ?
          AND boat_id IN (SELECT id FROM boats WHERE captain_id = ?) ORDER BY date LIMIT 15
      `).all(caboToday(), captain.id).map((r) => getBooking(r.code));
      if (!trips.length) return reply('No upcoming trips yet.');
      return reply(trips.map((b) =>
        `${formatDate(b.date)} ${formatTime(TRIP_START[b.hours])} · ${b.boat_name} · ${b.hours}h · ${b.guests} guests · ${b.customer_name} +${b.customer_phone} · cash $${b.balance_cash} (${b.code})`,
      ).join('\n'));
    }
    case 'BLOCK':
    case 'UNBLOCK': {
      const date = parseDate(arg);
      if (!date) return reply(`I couldn't read that date. Example: ${cmd.toUpperCase()} 2026-11-20`);
      if (cmd.toUpperCase() === 'BLOCK') {
        const ins = db.prepare('INSERT OR IGNORE INTO boat_blocks (boat_id, date) VALUES (?, ?)');
        boats.forEach((b) => ins.run(b.id, date));
        const booked = db.prepare(`
          SELECT code FROM bookings WHERE kind = 'fishing' AND status = 'confirmed' AND date = ?
            AND boat_id IN (SELECT id FROM boats WHERE captain_id = ?)
        `).all(date, captain.id);
        if (booked.length) {
          await sendMessage(config.ownerPhone, {
            text: `⚠️ Capt. ${captain.name} blocked ${formatDate(date)} but has confirmed trips: ${booked.map((r) => r.code).join(', ')}. Please follow up.`,
          }, { notification: true });
          return reply(`Blocked ${formatDate(date)} for new bookings. ⚠️ You already have confirmed trips that day (${booked.map((r) => r.code).join(', ')}); the office will contact you.`);
        }
        return reply(`✅ ${formatDate(date)} is now closed for new bookings.`);
      }
      const del = db.prepare('DELETE FROM boat_blocks WHERE boat_id = ? AND date = ?');
      boats.forEach((b) => del.run(b.id, date));
      return reply(`✅ ${formatDate(date)} is open again.`);
    }
    case 'BLOCKED': {
      const rows = db.prepare(`
        SELECT DISTINCT date FROM boat_blocks WHERE date >= ? AND boat_id IN (SELECT id FROM boats WHERE captain_id = ?) ORDER BY date
      `).all(caboToday(), captain.id);
      return reply(rows.length ? 'Closed dates:\n' + rows.map((r) => formatDate(r.date)).join('\n') : 'You have no closed dates.');
    }
    default:
      // Anything else from a captain goes to the owner.
      await sendMessage(config.ownerPhone, { text: `🚤 Capt. ${captain.name} (+${phone}): ${text}` });
      return reply(`${CAPTAIN_HELP}\n\nOther messages are forwarded to the office.`);
  }
}

const OWNER_HELP =
  'Owner commands:\n• *TODAY* / *TOMORROW* — trips & deliveries\n• *REPLY <phone> <message>* — answer a customer\n' +
  '• *BOT <phone>* — hand the chat back to the bot\n• *BOOKING <code>* — booking details\n• *CANCEL <code>* — cancel a booking (refund in Stripe yourself)';

export async function handleOwnerMessage(text) {
  const reply = (t) => sendMessage(config.ownerPhone, { text: t });
  const m = text.trim().match(/^(\S+)\s*([\s\S]*)$/);
  const cmd = (m?.[1] || '').toUpperCase();
  const arg = m?.[2] || '';

  switch (cmd) {
    case 'TODAY':
    case 'TOMORROW': {
      const date = parseDate(cmd.toLowerCase());
      const rows = getDb().prepare(`
        SELECT code FROM bookings WHERE status = 'confirmed' AND (date = ? OR (kind = 'rental' AND end_date = ?)) ORDER BY kind, date
      `).all(date, date).map((r) => getBooking(r.code));
      if (!rows.length) return reply(`Nothing scheduled for ${formatDate(date)}.`);
      return reply(`📋 ${formatDate(date)}\n\n` + rows.map((b) =>
        (b.kind === 'rental' && b.end_date === date && b.date !== date ? '🔁 PICKUP\n' : '') + bookingSummary(b) + `\n📞 +${b.customer_phone}`,
      ).join('\n\n'));
    }
    case 'REPLY': {
      const [, phone, msg] = arg.match(/^\+?(\d{8,15})\s+([\s\S]+)$/) || [];
      if (!phone) return reply('Usage: REPLY 5216241234567 your message');
      await sendMessage(phone, { text: msg });
      return reply(`Sent to +${phone} ✅ (bot stays paused for this chat — send BOT ${phone} to resume)`);
    }
    case 'BOT': {
      const phone = arg.replace(/\D/g, '');
      if (!phone) return reply('Usage: BOT 5216241234567');
      setHumanMode(phone, false);
      await sendMessage(phone, { text: 'Thanks for your patience! 🙌 Type *menu* anytime to book a fishing trip or rentals.' });
      return reply(`🤖 Bot resumed for +${phone}`);
    }
    case 'BOOKING': {
      const b = getBooking(arg.trim().toUpperCase());
      return reply(b ? `${bookingSummary(b)}\nStatus: ${b.status}\nClient: ${b.customer_name} +${b.customer_phone}\nSource: ${b.source || '-'}` : 'Booking not found.');
    }
    case 'CANCEL': {
      const b = getBooking(arg.trim().toUpperCase());
      if (!b) return reply('Booking not found.');
      setStatus(b.code, 'cancelled');
      await sendMessage(b.customer_phone, { text: `Your booking ${b.code} has been cancelled. If you paid online, your refund is on its way. Questions? Just reply here.` });
      if (b.kind === 'fishing') await sendMessage(b.captain_phone, { text: `❌ Trip ${b.code} on ${formatDate(b.date)} was CANCELLED. The date is free again.` }, { notification: true });
      return reply(`Cancelled ${b.code}. Remember to refund $${b.paid_online} in Stripe if needed.`);
    }
    default:
      return reply(OWNER_HELP);
  }
}
