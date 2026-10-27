// Reading free text without AI: typos, numbers written as words, and phrases like "full day" or "hora y media".

export const norm = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Words the bot cares about, spelled right (accents removed). Typos of these get fixed.
const DICTIONARY = [
  'tomorrow', 'today', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'january', 'february', 'april', 'august', 'september', 'october', 'november', 'december',
  'manana', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo',
  'enero', 'febrero', 'marzo', 'abril', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
  'fishing', 'charter', 'marlin', 'massage', 'kayak', 'paddle', 'paddleboard', 'rental',
  'pesca', 'pescar', 'masaje', 'renta', 'rentar',
];

function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

// "tomorow fising" -> "tomorrow fishing". Only words of 5+ letters are touched, so short words stay as they are.
export function fixTypos(text) {
  return norm(text).replace(/[a-z0-9]{5,}/g, (word) => {
    if (DICTIONARY.includes(word)) return word;
    const maxEdits = word.length >= 8 ? 2 : 1;
    let best = null;
    let bestDist = maxEdits + 1;
    for (const known of DICTIONARY) {
      if (Math.abs(known.length - word.length) > maxEdits) continue;
      const d = distance(word, known);
      if (d < bestDist) { best = known; bestDist = d; }
    }
    return best || word;
  });
}

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12,
};

// First number in a sentence: "we are 4" -> 4, "the four of us" -> 4, "somos cinco" -> 5. Null if none.
export function readNumber(text) {
  const t = norm(text);
  const digits = t.match(/\d+/);
  if (digits) return Number(digits[0]);
  if (/\b(just me|only me|myself|solo yo|nada mas yo)\b/.test(t)) return 1;
  if (/\b(a couple|couple of us|my wife and i|my husband and i|mi esposa y yo|mi esposo y yo|en pareja)\b/.test(t)) return 2;
  const word = t.split(/[^a-z]+/).find((w) => NUMBER_WORDS[w]);
  return word ? NUMBER_WORDS[word] : null;
}

// Number of people: like readNumber, but "2 adults and 2 kids" / "2 adultos y 3 niños" adds them up.
export function readPeople(text) {
  const t = norm(text);
  const groups = [...t.matchAll(/(\d+)\s*(adults?|grown ?ups?|kids?|child(?:ren)?|teens?|adultos?|ninos?|ninas?|menores)/g)];
  if (groups.length > 1) return groups.reduce((sum, g) => sum + Number(g[1]), 0);
  return readNumber(t);
}

// Fishing trip length: 4, 6 or 8 hours ("full day" = 8, "half day" = 4).
export function readHours(text) {
  const t = norm(text);
  if (/\b(full|all|whole|entire) day|dia (completo|entero)|todo el dia\b/.test(t)) return 8;
  if (/\bhalf[ -]?day|medio dia\b/.test(t)) return 4;
  return readNumber(t);
}

// Massage length: 60 or 90 minutes ("an hour and a half", "hora y media", "1.5" = 90).
export function readMinutes(text) {
  const t = norm(text);
  if (/\b90\b|1\.5|1 ?1\/2|hour and a half|hora y media/.test(t)) return 90;
  if (/\b60\b|\b(one|an|1) ?(hour|hr)\b|\b(una|1) hora\b/.test(t)) return 60;
  return null;
}
