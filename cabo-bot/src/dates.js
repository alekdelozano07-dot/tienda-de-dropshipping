// Los Cabos (Baja California Sur) is UTC-7 all year (no DST since 2022).
const CABO_OFFSET_MS = -7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const TRIP_START = { 4: '07:00', 6: '07:00', 8: '06:00' };

export function caboToday(now = new Date()) {
  return new Date(now.getTime() + CABO_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date, n) {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * DAY_MS).toISOString().slice(0, 10);
}

export function daysBetween(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / DAY_MS);
}

// Real instant (UTC Date) for a Cabo local date + "HH:MM".
export function caboInstant(date, time = '00:00') {
  return new Date(Date.parse(`${date}T${time}:00Z`) - CABO_OFFSET_MS);
}

function valid(y, m, d) {
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const t = new Date(iso + 'T00:00:00Z');
  return !isNaN(t) && t.toISOString().slice(0, 10) === iso ? iso : null;
}

// Pick the next occurrence of month/day on or after today.
function nextOccurrence(m, d, today) {
  const year = Number(today.slice(0, 4));
  const thisYear = valid(year, m, d);
  if (thisYear && thisYear >= today) return thisYear;
  return valid(year + 1, m, d);
}

// Month and weekday names in English and Spanish (accents removed before matching).
const MONTH_NAMES = [
  ['january', 'jan', 'enero', 'ene'], ['february', 'feb', 'febrero'], ['march', 'mar', 'marzo'],
  ['april', 'apr', 'abril', 'abr'], ['may', 'mayo'], ['june', 'jun', 'junio'], ['july', 'jul', 'julio'],
  ['august', 'aug', 'agosto', 'ago'], ['september', 'sept', 'sep', 'septiembre', 'setiembre', 'set'],
  ['october', 'oct', 'octubre'], ['november', 'nov', 'noviembre'], ['december', 'dec', 'diciembre', 'dic'],
];
const WEEKDAY_NAMES = [
  ['sunday', 'sun', 'domingo'], ['monday', 'mon', 'lunes'], ['tuesday', 'tue', 'martes'], ['wednesday', 'wed', 'miercoles'],
  ['thursday', 'thu', 'jueves'], ['friday', 'fri', 'viernes'], ['saturday', 'sat', 'sabado'],
];

// Understands, in English and Spanish: today/hoy, tomorrow/mañana, weekday names, 2026-11-03, Nov 3, 3 de noviembre,
// and slashes: 11/3 is Nov 3 in English, 3/11 is Nov 3 in Spanish (day first), unless one part is over 12.
export function parseDate(text, now = new Date(), lang = 'en') {
  const today = caboToday(now);
  const t = String(text).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ');

  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return valid(+m[1], +m[2], +m[3]);

  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    let [a, b] = [+m[1], +m[2]];
    const dayFirst = b > 12 ? false : a > 12 ? true : lang === 'es';
    const [month, day] = dayFirst ? [b, a] : [a, b];
    if (m[3]) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], month, day);
    return nextOccurrence(month, day, today);
  }

  const words = new Set(t.split(/[^a-z0-9]+/));
  const monthIdx = MONTH_NAMES.findIndex((names) => names.some((mo) => words.has(mo)));
  const dayNum = t.match(/\b(\d{1,2})\b/);
  if (monthIdx >= 0 && dayNum) return nextOccurrence(monthIdx + 1, +dayNum[1], today);

  if (/\b(today|tonight|hoy|esta noche)\b/.test(t)) return today;
  if (/\b(day after tomorrow|pasado manana)\b/.test(t)) return addDays(today, 2);
  if (/\b(tomorrow|tmrw|tmr|manana)\b/.test(t)) return addDays(today, 1);

  const wd = WEEKDAY_NAMES.findIndex((names) => names.some((w) => words.has(w)));
  if (wd >= 0) {
    const todayWd = new Date(today + 'T00:00:00Z').getUTCDay();
    let diff = (wd - todayWd + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(today, diff);
  }
  return null;
}

// Captains answer 7 AM–9 PM Cabo time. Requests made at night get their reply window from 7 AM.
export function captainDeadline(minutes, now = new Date()) {
  const hour = new Date(now.getTime() + CABO_OFFSET_MS).getUTCHours();
  if (hour >= 7 && hour < 21) return new Date(now.getTime() + minutes * 60_000);
  const day = hour >= 21 ? addDays(caboToday(now), 1) : caboToday(now);
  return new Date(caboInstant(day, '07:00').getTime() + minutes * 60_000);
}
