import { getDb } from './db.js';
import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { caboToday, formatDate, formatTime, parseDate, TRIP_START } from './dates.js';
import { approveRequest, captainRequests, declineRequest, getBooking, setStatus } from './bookings.js';
import { bookingSummary } from './notify.js';
import { captainAnswered, setHumanMode } from './bot.js';

export function isCaptain(phone) {
  return !!getDb().prepare('SELECT 1 FROM captains WHERE phone = ? AND active = 1').get(phone);
}

const CAPTAIN_HELP =
  'Captain commands:\n• *YES CB1234* / *NO CB1234* — answer a trip request\n• *TRIPS* — your upcoming trips\n• *BLOCK 2026-11-20* — close a date (all your boats)\n• *UNBLOCK 2026-11-20* — reopen a date\n• *BLOCKED* — dates you closed';

// YES/NO to a trip request. Accepts button replies, "YES CB1A2B3C", or a bare "yes"/"sí" when only one request is open.
async function answerRequest(captain, text, replyId, reply) {
  let answer, code;
  const btn = replyId?.match(/^cap_(yes|no)_(CB\w+)$/);
  if (btn) [, answer, code] = btn;
  else {
    const m = text.trim().match(/^(yes|y|si|sí|ok|no|n)\b[\s,.!]*(CB[0-9A-F]{6})?/i);
    if (!m) return false;
    answer = /^n/i.test(m[1]) ? 'no' : 'yes';
    code = m[2]?.toUpperCase();
  }
  const open = captainRequests(captain.id);
  if (!code) {
    if (open.length === 1) code = open[0].code;
    else if (!open.length) return false; // not about a request: treat as a normal message
    else {
      await reply(`You have ${open.length} open requests. Please reply with the code:\n` +
        open.map((b) => `• ${b.code}: ${formatDate(b.date)} ${b.boat_name} — YES ${b.code} / NO ${b.code}`).join('\n'));
      return true;
    }
  }
  const b = getBooking(code);
  if (!b || !open.some((o) => o.code === code)) {
    await reply(b ? `Request ${code} is no longer open (status: ${b.status.replace('_', ' ')}).` : `I couldn't find request ${code}.`);
    return true;
  }
  if (answer === 'yes') {
    const approved = approveRequest(code);
    if (!approved) { await reply(`Request ${code} is no longer open.`); return true; }
    await reply(`👍 Thanks! We sent the payment link to the client. You'll get the final confirmation when they pay.`);
    await captainAnswered(approved, 'approved');
  } else {
    const declined = declineRequest(code);
    if (!declined) { await reply(`Request ${code} is no longer open.`); return true; }
    await reply(`OK, ${formatDate(b.date)} is now closed for ${b.boat_name}. Send UNBLOCK ${b.date} if it frees up.`);
    await captainAnswered(declined, 'declined');
  }
  return true;
}

export async function handleCaptainMessage(phone, text, replyId = null) {
  const db = getDb();
  const captain = db.prepare('SELECT * FROM captains WHERE phone = ?').get(phone);
  const boats = db.prepare('SELECT id, name FROM boats WHERE captain_id = ?').all(captain.id);
  if (await answerRequest(captain, text, replyId, (t) => sendMessage(phone, { text: t }))) return;
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
