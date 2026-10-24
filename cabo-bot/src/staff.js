import { getDb } from './db.js';
import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { caboToday, parseDate, TRIP_START } from './dates.js';
import { approveRequest, captainRequests, declineRequest, getBooking, setStatus } from './bookings.js';
import { bookingSummary, tellCaptain } from './notify.js';
import { captainAnswered, customerLang, setHumanMode } from './bot.js';
import { fmtDate, fmtTime, langSwitch, t, usd } from './i18n.js';

const norm = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function isCaptain(phone) {
  return !!getDb().prepare('SELECT 1 FROM captains WHERE phone = ? AND active = 1').get(phone);
}

// YES/NO to a trip request. Accepts button replies, "YES CB1A2B3C" / "SÍ CB1A2B3C",
// or a bare "yes"/"sí"/"no" when only one request is open.
async function answerRequest(captain, text, replyId, reply) {
  const L = captain.lang;
  let answer, code;
  const btn = replyId?.match(/^cap_(yes|no)_(CB\w+)$/);
  if (btn) [, answer, code] = btn;
  else {
    const m = norm(text).match(/^(yes|y|si|sip|ok|claro|no|n)\b[\s,.!]*(cb[0-9a-f]{6})?/);
    if (!m) return false;
    answer = /^n/.test(m[1]) ? 'no' : 'yes';
    code = m[2]?.toUpperCase();
  }
  const open = captainRequests(captain.id);
  if (!code) {
    if (open.length === 1) code = open[0].code;
    else if (!open.length) return false; // not about a request: treat as a normal message
    else {
      await reply(t(L, 'capMultiple', open.length, open.map((b) => t(L, 'capMultipleLine', b.code, fmtDate(b.date, L), b.boat_name)).join('\n')));
      return true;
    }
  }
  const b = getBooking(code);
  if (!b || !open.some((o) => o.code === code)) {
    await reply(b ? t(L, 'capNotOpen', code) : t(L, 'capNotFound', code));
    return true;
  }
  if (answer === 'yes') {
    const approved = approveRequest(code);
    if (!approved) { await reply(t(L, 'capNotOpen', code)); return true; }
    await reply(t(L, 'capThanksYes'));
    await captainAnswered(approved, 'approved');
  } else {
    const declined = declineRequest(code);
    if (!declined) { await reply(t(L, 'capNotOpen', code)); return true; }
    await reply(t(L, 'capDeclined', fmtDate(b.date, L), b.boat_name, b.date));
    await captainAnswered(declined, 'declined');
  }
  return true;
}

// Commands work in both languages.
const CAPTAIN_COMMANDS = {
  TRIPS: 'trips', VIAJES: 'trips',
  BLOCK: 'block', BLOQUEAR: 'block', CERRAR: 'block',
  UNBLOCK: 'unblock', DESBLOQUEAR: 'unblock', ABRIR: 'unblock',
  BLOCKED: 'blocked', BLOQUEADOS: 'blocked', CERRADOS: 'blocked',
};

export async function handleCaptainMessage(phone, text, replyId = null) {
  const db = getDb();
  let captain = db.prepare('SELECT * FROM captains WHERE phone = ?').get(phone);
  const reply = (msg) => sendMessage(phone, { text: msg }, { lang: captain.lang });

  const switchTo = langSwitch(text);
  if (switchTo) {
    db.prepare('UPDATE captains SET lang = ? WHERE id = ?').run(switchTo, captain.id);
    captain = { ...captain, lang: switchTo };
    return reply(t(switchTo, 'languageSet') + '\n\n' + t(switchTo, 'capHelp'));
  }
  if (await answerRequest(captain, text, replyId, reply)) return;

  const L = captain.lang;
  const boats = db.prepare('SELECT id, name FROM boats WHERE captain_id = ?').all(captain.id);
  const [word, ...rest] = text.trim().split(/\s+/);
  const typed = norm(word || '').toUpperCase();
  const arg = rest.join(' ');

  switch (CAPTAIN_COMMANDS[typed]) {
    case 'trips': {
      const trips = db.prepare(`
        SELECT code FROM bookings WHERE kind = 'fishing' AND status = 'confirmed' AND date >= ?
          AND boat_id IN (SELECT id FROM boats WHERE captain_id = ?) ORDER BY date LIMIT 15
      `).all(caboToday(), captain.id).map((r) => getBooking(r.code));
      if (!trips.length) return reply(t(L, 'capNoTrips'));
      return reply(trips.map((b) => t(L, 'capTripLine', {
        date: fmtDate(b.date, L), time: fmtTime(TRIP_START[b.hours], L), boat: b.boat_name, hours: b.hours, guests: b.guests,
        client: b.customer_name, phone: b.customer_phone, cash: usd(b.balance_cash), code: b.code,
      })).join('\n'));
    }
    case 'block':
    case 'unblock': {
      const date = parseDate(arg, new Date(), L);
      if (!date) return reply(t(L, 'capBadDate', typed));
      if (CAPTAIN_COMMANDS[typed] === 'block') {
        const ins = db.prepare('INSERT OR IGNORE INTO boat_blocks (boat_id, date) VALUES (?, ?)');
        boats.forEach((b) => ins.run(b.id, date));
        const booked = db.prepare(`
          SELECT code FROM bookings WHERE kind = 'fishing' AND status = 'confirmed' AND date = ?
            AND boat_id IN (SELECT id FROM boats WHERE captain_id = ?)
        `).all(date, captain.id).map((r) => r.code).join(', ');
        if (booked) {
          await sendMessage(config.ownerPhone, {
            text: t(config.ownerLang, 'ownCaptainBlocked', captain.name, fmtDate(date, config.ownerLang), booked),
          }, { notification: true, lang: config.ownerLang });
          return reply(t(L, 'capBlockedWithTrips', fmtDate(date, L), booked));
        }
        return reply(t(L, 'capBlocked', fmtDate(date, L)));
      }
      const del = db.prepare('DELETE FROM boat_blocks WHERE boat_id = ? AND date = ?');
      boats.forEach((b) => del.run(b.id, date));
      return reply(t(L, 'capUnblocked', fmtDate(date, L)));
    }
    case 'blocked': {
      const rows = db.prepare(`
        SELECT DISTINCT date FROM boat_blocks WHERE date >= ? AND boat_id IN (SELECT id FROM boats WHERE captain_id = ?) ORDER BY date
      `).all(caboToday(), captain.id);
      return reply(rows.length ? t(L, 'capClosedDates', rows.map((r) => fmtDate(r.date, L)).join('\n')) : t(L, 'capNoClosed'));
    }
    default:
      // Anything else from a captain goes to the owner.
      await sendMessage(config.ownerPhone, { text: t(config.ownerLang, 'ownCaptainMsg', captain.name, phone, text) }, { lang: config.ownerLang });
      return reply(t(L, 'capHelp'));
  }
}

const OWNER_COMMANDS = {
  TODAY: 'today', HOY: 'today',
  TOMORROW: 'tomorrow', MANANA: 'tomorrow',
  REPLY: 'reply', RESPONDER: 'reply',
  BOT: 'bot',
  BOOKING: 'booking', RESERVA: 'booking',
  CANCEL: 'cancel', CANCELAR: 'cancel',
};

export async function handleOwnerMessage(text) {
  const L = config.ownerLang;
  const reply = (msg) => sendMessage(config.ownerPhone, { text: msg }, { lang: L });
  const m = text.trim().match(/^(\S+)\s*([\s\S]*)$/);
  const cmd = OWNER_COMMANDS[norm(m?.[1] || '').toUpperCase()];
  const arg = m?.[2] || '';

  switch (cmd) {
    case 'today':
    case 'tomorrow': {
      const date = parseDate(cmd, new Date(), 'en');
      const rows = getDb().prepare(`
        SELECT code FROM bookings WHERE status = 'confirmed' AND (date = ? OR (kind = 'rental' AND end_date = ?)) ORDER BY kind, date
      `).all(date, date).map((r) => getBooking(r.code));
      if (!rows.length) return reply(t(L, 'ownNothing', fmtDate(date, L)));
      return reply(`📋 ${fmtDate(date, L)}\n\n` + rows.map((b) =>
        (b.kind === 'rental' && b.end_date === date && b.date !== date ? t(L, 'ownPickupTag') + '\n' : '') + bookingSummary(b, L) + `\n📞 +${b.customer_phone}`,
      ).join('\n\n'));
    }
    case 'reply': {
      const [, phone, msg] = arg.match(/^\+?(\d{8,15})\s+([\s\S]+)$/) || [];
      if (!phone) return reply(t(L, 'ownReplyUsage'));
      await sendMessage(phone, { text: msg }, { lang: customerLang(phone) });
      return reply(t(L, 'ownReplySent', phone));
    }
    case 'bot': {
      const phone = arg.replace(/\D/g, '');
      if (!phone) return reply(t(L, 'ownBotUsage'));
      setHumanMode(phone, false);
      await sendMessage(phone, { text: t(customerLang(phone), 'botBack') });
      return reply(t(L, 'ownBotResumed', phone));
    }
    case 'booking': {
      const b = getBooking(arg.trim().toUpperCase());
      return reply(b ? t(L, 'ownBookingInfo', bookingSummary(b, L), b.status, b.customer_name, b.customer_phone, b.source, b.lang) : t(L, 'ownNotFound'));
    }
    case 'cancel': {
      const b = getBooking(arg.trim().toUpperCase());
      if (!b) return reply(t(L, 'ownNotFound'));
      setStatus(b.code, 'cancelled');
      await sendMessage(b.customer_phone, { text: t(b.lang, 'cancelledByOffice', b.code) }, { notification: true, lang: b.lang });
      if (b.kind === 'fishing') await tellCaptain(b, 'capTripCancelled');
      return reply(t(L, 'ownCancelled', b.code, usd(b.paid_online)));
    }
    default:
      return reply(t(L, 'ownHelp'));
  }
}
