// Los Cabos (Baja California Sur) is UTC-7 all year (no DST since 2022).
const CABO_OFFSET_MS = -7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

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

export function formatDate(date) {
  const d = new Date(date + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatTime(time) {
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
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

// Understands: today, tomorrow, weekday names, 2026-11-03, 11/3, 11/3/2026, Nov 3, 3 Nov, November 3rd.
export function parseDate(text, now = new Date()) {
  const today = caboToday(now);
  const t = String(text).toLowerCase().trim().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ');

  if (/\btoday\b|\btonight\b/.test(t)) return today;
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2);
  if (/\btomorrow\b|\btmrw\b|\btmr\b/.test(t)) return addDays(today, 1);

  let m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/);
  if (m) return valid(+m[1], +m[2], +m[3]);

  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (m) {
    if (m[3]) return valid(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[1], +m[2]);
    return nextOccurrence(+m[1], +m[2], today);
  }

  const monthIdx = MONTHS.findIndex((mo) => new RegExp(`\\b${mo}[a-z]*\\b`).test(t));
  if (monthIdx >= 0) {
    const day = t.match(/\b(\d{1,2})\b/);
    if (day) return nextOccurrence(monthIdx + 1, +day[1], today);
  }

  const wd = WEEKDAYS.findIndex((w) => t.includes(w) || new RegExp(`\\b${w.slice(0, 3)}\\b`).test(t));
  if (wd >= 0) {
    const todayWd = new Date(today + 'T00:00:00Z').getUTCDay();
    let diff = (wd - todayWd + 7) % 7;
    if (diff === 0 || /\bnext\b/.test(t)) diff = diff || 7;
    return addDays(today, diff);
  }
  return null;
}
