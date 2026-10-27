import './env.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, getDb } from '../src/db.js';
import { outbox } from '../src/whatsapp.js';
import { handleIncoming } from '../src/bot.js';
import { handlePayment } from '../src/server.js';
import { tick } from '../src/scheduler.js';
import { addDays, caboInstant, caboToday, parseDate } from '../src/dates.js';
import { availableBoats } from '../src/bookings.js';
import { setInterpreter } from '../src/ai.js';
import { faqAnswer } from '../src/faq.js';
import { fixTypos, readHours, readMinutes, readNumber, readPeople } from '../src/words.js';

const OWNER = '5210000000000';
const CAPTAIN = '5216241000001';
const CAPTAIN2 = '5216241000002';
const TOURIST = '15551234567';

function seed() {
  const db = openDb(':memory:');
  // Captain 1 reads Spanish (the default), captain 2 English. The owner reads Spanish.
  db.prepare(`INSERT INTO captains (id, name, phone, lang) VALUES (1, 'Juan', ?, 'es'), (2, 'Miguel', ?, 'en')`).run(CAPTAIN, CAPTAIN2);
  db.prepare(`INSERT INTO boats (id, captain_id, name, length_ft, max_guests, price_4h, price_6h, price_8h, meeting_point)
              VALUES (1, 1, 'La Reina', 31, 6, 450, 600, 750, 'Dock M'),
                     (2, 2, 'Pescadora', 26, 4, 350, 450, NULL, 'Dock A')`).run();
  db.prepare(`INSERT INTO rental_items (id, name, name_es, category, price_per_day, stock)
              VALUES (1, 'Beach umbrella', 'Sombrilla', 'beach', 10, 2), (2, 'Stroller', 'Carriola', 'baby', 12, 1)`).run();
}

const say = (text, from = TOURIST, replyId = null) => handleIncoming({ from, name: 'Jane Doe', text, replyId });
const lastTo = (phone) => [...outbox].reverse().find((m) => m.to === phone)?.message;
const payCode = (phone) => lastTo(phone).text.match(/dev\/pay\/(CB\w+)/)[1];
const allTo = (phone) => outbox.filter((m) => m.to === phone).map((m) => m.message.text).join('\n---\n');

beforeEach(() => { outbox.length = 0; seed(); setInterpreter(null); });

// A fake AI answer: every field the real schema requires, with the given ones filled in.
const AI = (fields) => ({ action: 'unknown', reply: '', flow: 'none', date: '', number: 0, hours: 0, minutes: 0, option_id: '', ...fields });

test('parses common date formats', () => {
  const now = new Date('2026-10-24T18:00:00Z'); // Sat Oct 24 in Cabo
  assert.equal(parseDate('tomorrow', now), '2026-10-25');
  assert.equal(parseDate('Nov 3rd', now), '2026-11-03');
  assert.equal(parseDate('11/3', now), '2026-11-03');
  assert.equal(parseDate('2026-12-01', now), '2026-12-01');
  assert.equal(parseDate('March 2', now), '2027-03-02');
  assert.equal(parseDate('monday', now), '2026-10-26');
  assert.equal(parseDate('blah', now), null);
  assert.equal(parseDate('2/30', now), null);
});

test('full fishing booking: availability, deposit, captain notified', async () => {
  const date = addDays(caboToday(), 3);
  await say('Hi! (ref: airbnb-casa-azul)');
  assert.match(lastTo(TOURIST).text, /Welcome/);
  await say('Fishing trip', TOURIST, 'fish');
  await say(date);
  await say('4');
  await say('8 hours', TOURIST, 'h8');
  const boats = lastTo(TOURIST);
  assert.match(boats.text, /La Reina/);
  await say('La Reina', TOURIST, 'boat1');
  await say('Jane Doe', TOURIST, 'usename');
  assert.match(lastTo(TOURIST).text, /Pay now online: \*\$150\*/);
  assert.match(lastTo(TOURIST).text, /cash: \*\$600\*/);
  await say('Confirm & pay', TOURIST, 'pay');
  assert.match(lastTo(TOURIST).text, /Nothing to pay yet/);

  // The captain is asked first; the boat is held meanwhile.
  const request = lastTo(CAPTAIN);
  assert.match(request.text, /NUEVA SOLICITUD/);
  assert.equal(availableBoats(date, 8, 2).length, 0);
  const code = request.text.match(/(CB[0-9A-F]{6})/)[1];
  assert.equal(request.buttons[0].id, `cap_yes_${code}`);

  await say('✅ SÍ, disponible', CAPTAIN, `cap_yes_${code}`);
  assert.match(lastTo(CAPTAIN).text, /mandamos el link de pago/);
  assert.match(lastTo(TOURIST).text, /Capt\. Juan confirmed/);
  assert.equal(payCode(TOURIST), code);
  assert.equal(availableBoats(date, 8, 2).length, 0);

  assert.equal(await handlePayment(code), 'confirmed');
  assert.match(lastTo(TOURIST).text, /You're booked/);
  assert.match(lastTo(CAPTAIN).text, /NUEVO VIAJE CONFIRMADO/);
  assert.match(lastTo(CAPTAIN).text, /Cobrar en efectivo: \$600/);
  assert.match(allTo(OWNER), /anticipo \$150 USD/);

  const b = getDb().prepare('SELECT * FROM bookings WHERE code = ?').get(code);
  assert.equal(b.status, 'confirmed');
  assert.equal(b.source, 'airbnb-casa-azul');

  // Paying twice is harmless
  assert.equal(await handlePayment(code), 'already');

  // Another tourist sees no boats that day
  await say('hi', '15559999999');
  await say('fish', '15559999999');
  await say(date, '15559999999');
  await say('2', '15559999999');
  await say('8 hours', '15559999999'); // only La Reina does 8h, and it's taken
  assert.match(lastTo('15559999999').text, /No boats available/);
});

test('rental booking with stock limits and full online payment', async () => {
  const start = addDays(caboToday(), 2);
  await say('hello');
  await say('rent');
  await say(start);
  await say('3'); // days
  await say('Stroller', TOURIST, 'item2');
  await say('1', TOURIST, 'q1');
  assert.match(lastTo(TOURIST).text, /1 × Stroller — \$36/);
  await say('Beach umbrella', TOURIST, 'item1');
  await say('2');
  await say('checkout', TOURIST, 'checkout');
  await say('Villa Paraiso, Pedregal 123, Cabo San Lucas');
  await say('Jane Doe', TOURIST, 'usename');
  assert.match(lastTo(TOURIST).text, /Total \*\$121\*/); // 36 + 60 + 25 delivery
  await say('pay', TOURIST, 'pay');
  const code = lastTo(TOURIST).text.match(/dev\/pay\/(CB\w+)/)[1];
  assert.equal(await handlePayment(code), 'confirmed');
  assert.match(allTo(OWNER), /ENTREGA PENDIENTE/);

  // Overlapping rental: stroller and umbrellas are gone, list should be empty
  const other = '15558888888';
  await say('hi', other);
  await say('rent', other);
  await say(addDays(start, 1), other);
  await say('2', other);
  assert.match(lastTo(other).text, /everything is booked/);
});

test('massage booking: fixed cash to therapist, margin online, slot capacity', async () => {
  const date = addDays(caboToday(), 2);
  await say('hi');
  await say('Massage', TOURIST, 'massage');
  assert.match(lastTo(TOURIST).text, /What date would you like your massage/);
  await say(date); // one therapist by default: no "how many people" question
  assert.match(lastTo(TOURIST).text, /How long should each massage be/);
  await say('90 minutes', TOURIST, 'm90');
  assert.deepEqual(lastTo(TOURIST).list.rows.map((r) => r.id), ['time09:00', 'time12:00', 'time15:00', 'time18:00', 'otherdate']);
  await say('3:00 PM', TOURIST, 'time15:00');
  await say('Villa Paraiso, Pedregal 123, Cabo San Lucas');
  await say('Jane Doe', TOURIST, 'usename');
  assert.match(lastTo(TOURIST).text, /Total \*\$170\*/);
  assert.match(lastTo(TOURIST).text, /Pay now online: \*\$75\*/); // 170 - 95 cash
  assert.match(lastTo(TOURIST).text, /therapist in cash: \*\$95\*/);
  await say('pay', TOURIST, 'pay');
  const code = payCode(TOURIST);
  assert.equal(await handlePayment(code), 'confirmed');
  assert.match(lastTo(TOURIST).text, /You're booked/);
  assert.match(allTo(OWNER), /MASAJE RESERVADO/);
  assert.match(allTo(OWNER), /Efectivo al terapeuta \$95 USD/);

  // The therapist is taken at 3 PM, so another guest can't pick that time
  const other = '15558888888';
  for (const t of ['hi', 'massage', date, '60']) await say(t, other);
  assert.match(lastTo(other).text, /\*\$67\*|What time/);
  assert.deepEqual(lastTo(other).list.rows.map((r) => r.id), ['time09:00', 'time12:00', 'time18:00', 'otherdate']);
});

test('massage in Spanish and day-before reminder', async () => {
  const MX = '5213310000000';
  await say('Hola, quiero un masaje', MX); // names the activity: skips the welcome
  assert.match(lastTo(MX).text, /Qué día te gustaría tu masaje/);

  const date = addDays(caboToday(), 1);
  getDb().prepare(`INSERT INTO bookings (code, kind, status, customer_phone, customer_name, date, start_time, duration_min, guests,
      delivery_address, total, paid_online, balance_cash, confirmed_at)
    VALUES ('CBMASS', 'massage', 'confirmed', ?, 'Jane', ?, '12:00', 60, 1, 'Villa Sol', 120, 24, 96, datetime('now', '-2 days'))`).run(TOURIST, date);
  await tick(new Date(caboInstant(caboToday(), '17:05')));
  assert.match(lastTo(TOURIST).text, /massage is tomorrow/);
  assert.match(lastTo(OWNER).text, /Masaje mañana/);
});

test('AI: a free-text request goes straight to the boats with date, people and hours filled in', async () => {
  const date = addDays(caboToday(), 3);
  const calls = [];
  setInterpreter(async (ctx) => { calls.push(ctx); return AI({ action: 'switch', flow: 'fishing', date, number: 4, hours: 8 }); });
  await say('hi');
  assert.equal(calls.length, 0); // greetings never reach the AI
  await say(`we are 4 and want the full day trip on ${date}`);
  assert.equal(calls[0].step, 'menu');
  assert.equal(calls[0].last_message, `we are 4 and want the full day trip on ${date}`);
  assert.match(lastTo(TOURIST).text, /boats available/);
  assert.match(lastTo(TOURIST).text, /La Reina/);
});

test('AI: answers a question mid-flow, then asks the same step again', async () => {
  setInterpreter(async () => AI({ action: 'answer', reply: 'Yes! Rods and bait are included.' }));
  await say('hi');
  await say('Fishing trip', TOURIST, 'fish');
  await say(addDays(caboToday(), 3));
  await say('are rods included?');
  const [answer, again] = outbox.filter((m) => m.to === TOURIST).slice(-2).map((m) => m.message.text);
  assert.equal(answer, 'Yes! Rods and bait are included.');
  assert.match(again, /How many people/);
});

test('AI: fills the value of the current step from a sentence', async () => {
  setInterpreter(async () => AI({ action: 'value', number: 4 }));
  await say('hi');
  await say('Fishing trip', TOURIST, 'fish');
  await say(addDays(caboToday(), 3));
  await say('the four of us');
  assert.match(lastTo(TOURIST).text, /How long would you like to fish/);
});

test('AI: hands the chat to a person, and falls back to the usual hint when it fails', async () => {
  setInterpreter(async () => null); // API down or no key
  await say('hi');
  await say('Fishing trip', TOURIST, 'fish');
  await say(addDays(caboToday(), 3));
  await say('blah');
  assert.match(lastTo(TOURIST).text, /number of guests/);

  setInterpreter(async () => AI({ action: 'human' }));
  await say('my boat yesterday was terrible, I want a refund');
  assert.match(lastTo(TOURIST).text, /connecting you with our team/);
  assert.match(lastTo(OWNER).text, /La IA no pudo contestar/);
});

test('human handoff and owner reply', async () => {
  await say('hi');
  await say('human');
  assert.match(lastTo(OWNER).text, /SE NECESITA UNA PERSONA/);
  await say('My kid is allergic to shellfish, is lunch ok?');
  assert.match(lastTo(OWNER).text, /allergic/);
  await say(`REPLY ${TOURIST} Yes, we can do a chicken lunch!`, OWNER);
  assert.match(lastTo(TOURIST).text, /chicken lunch/);
  await say(`BOT ${TOURIST}`, OWNER);
  await say('menu');
  assert.match(lastTo(TOURIST).text, /What would you like to do/);
});

test('captain can block dates', async () => {
  const date = addDays(caboToday(), 5);
  await say(`BLOCK ${date}`, CAPTAIN);
  assert.match(lastTo(CAPTAIN).text, /cerrado para nuevas reservas/);
  assert.equal(availableBoats(date, 4, 2).length, 1);
  await say(`UNBLOCK ${date}`, CAPTAIN);
  assert.equal(availableBoats(date, 4, 2).length, 2);
});

test('expired holds are released and late payments are flagged', async () => {
  const date = addDays(caboToday(), 3);
  for (const t of ['hi', 'fish', date, '2']) await say(t);
  await say('4 hours', TOURIST, 'h4');
  await say('x', TOURIST, 'boat1');
  await say('x', TOURIST, 'usename');
  await say('x', TOURIST, 'pay');
  await say('yes', CAPTAIN);
  const code = payCode(TOURIST);
  getDb().prepare(`UPDATE bookings SET hold_expires_at = datetime('now', '-1 minute') WHERE code = ?`).run(code);
  await tick();
  assert.match(lastTo(TOURIST).text, /expired/);
  assert.equal(availableBoats(date, 4, 2).length, 2);
  // Paid late but the boat is still free → confirm anyway
  assert.equal(await handlePayment(code), 'confirmed');
});

test('day-before reminder goes to client and captain', async () => {
  const date = addDays(caboToday(), 1);
  getDb().prepare(`INSERT INTO bookings (code, kind, status, customer_phone, customer_name, date, boat_id, hours, guests, total, paid_online, balance_cash, confirmed_at)
    VALUES ('CBTEST', 'fishing', 'confirmed', ?, 'Jane', ?, 1, 4, 2, 450, 90, 360, datetime('now', '-2 days'))`).run(TOURIST, date);
  await tick(new Date(caboInstant(caboToday(), '17:05')));
  assert.match(lastTo(TOURIST).text, /trip is tomorrow/);
  assert.match(lastTo(CAPTAIN).text, /Viaje mañana/);
  outbox.length = 0;
  await tick(new Date(caboInstant(caboToday(), '17:10')));
  assert.equal(outbox.length, 0); // not sent twice
});

async function requestBoat(boatId, date, guests = 2) {
  for (const t of ['hi', 'fish', date, String(guests)]) await say(t);
  await say('4 hours', TOURIST, 'h4');
  await say('x', TOURIST, `boat${boatId}`);
  await say('x', TOURIST, 'usename');
  await say('x', TOURIST, 'pay');
}

test('captain says NO: date closed for that boat, client gets other boats', async () => {
  const date = addDays(caboToday(), 4);
  await requestBoat(1, date);
  await say('No', CAPTAIN);
  assert.match(lastTo(CAPTAIN).text, /queda cerrado/);
  const offer = lastTo(TOURIST);
  assert.match(allTo(TOURIST), /no longer available/);
  assert.deepEqual(offer.list.rows.map((r) => r.id), ['boat2', 'otherdate']);
  assert.equal(getDb().prepare('SELECT COUNT(*) n FROM boat_blocks WHERE boat_id = 1 AND date = ?').get(date).n, 1);
  // Client picks the other boat and that captain is asked
  await say('Pescadora', TOURIST, 'boat2');
  await say('x', TOURIST, 'usename');
  await say('x', TOURIST, 'pay');
  assert.match(lastTo(CAPTAIN2).text, /NEW REQUEST/); // captain 2 reads English
});

test('captain does not answer: other boats offered, then a person if none left', async () => {
  const date = addDays(caboToday(), 4);
  await requestBoat(1, date);
  const code = lastTo(CAPTAIN).text.match(/(CB[0-9A-F]{6})/)[1];
  getDb().prepare(`UPDATE bookings SET hold_expires_at = datetime('now', '-1 minute') WHERE code = ?`).run(code);
  await tick();
  assert.match(allTo(TOURIST), /hasn't confirmed yet/);
  assert.match(lastTo(CAPTAIN).text, /venció sin respuesta/);
  // Late YES is rejected
  await say(`YES ${code}`, CAPTAIN);
  assert.match(lastTo(CAPTAIN).text, /ya no está abierta/);

  await say('Pescadora', TOURIST, 'boat2');
  await say('x', TOURIST, 'usename');
  await say('x', TOURIST, 'pay');
  const code2 = lastTo(CAPTAIN2).text.match(/(CB[0-9A-F]{6})/)[1];
  getDb().prepare(`UPDATE bookings SET hold_expires_at = datetime('now', '-1 minute') WHERE code = ?`).run(code2);
  await tick();
  assert.match(lastTo(OWNER).text, /SE NECESITA UNA PERSONA/);
  assert.match(lastTo(TOURIST).text, /connecting you with our team/);
});

test('client can cancel while waiting for the captain', async () => {
  await requestBoat(1, addDays(caboToday(), 4));
  await say('cancel');
  assert.match(lastTo(TOURIST).text, /What would you like to do/);
  assert.match(lastTo(CAPTAIN).text, /cliente canceló/);
});

test('night requests give the captain until 7 AM', async () => {
  const { captainDeadline } = await import('../src/dates.js');
  const night = new Date('2026-10-25T06:00:00Z'); // 11 PM Oct 24 in Cabo
  assert.equal(captainDeadline(15, night).toISOString(), '2026-10-25T14:15:00.000Z'); // 7:15 AM Oct 25 Cabo
  const day = new Date('2026-10-25T18:00:00Z'); // 11 AM Cabo
  assert.equal(captainDeadline(15, day).toISOString(), '2026-10-25T18:15:00.000Z');
});

test('detects the language of the first message', async () => {
  const { detectLang } = await import('../src/i18n.js');
  assert.equal(detectLang('Hola, quiero pescar'), 'es');
  assert.equal(detectLang('¿Tienen barcos?'), 'es');
  assert.equal(detectLang('Hi! I want to go fishing'), 'en');
  assert.equal(detectLang('👍', '5216241234567'), 'es'); // ambiguous: Mexican number
  assert.equal(detectLang('👍', '15551234567'), 'en');
});

test('reads numbers, typos and phrases without AI', () => {
  assert.equal(readNumber('we are 4'), 4);
  assert.equal(readNumber('the four of us'), 4);
  assert.equal(readNumber('somos cinco'), 5);
  assert.equal(readNumber('just me'), 1);
  assert.equal(readNumber('blah'), null);
  assert.equal(readPeople('2 adults and 2 kids'), 4);
  assert.equal(readPeople('3 adultos y 2 niños'), 5);
  assert.equal(readHours('full day'), 8);
  assert.equal(readHours('medio día'), 4);
  assert.equal(readHours('6 hours'), 6);
  assert.equal(readMinutes('an hour and a half'), 90);
  assert.equal(readMinutes('una hora'), 60);
  assert.equal(fixTypos('tomorow fising'), 'tomorrow fishing');
  assert.equal(fixTypos('masage'), 'massage');
});

test('FAQ: picks the right answer in English and Spanish', () => {
  assert.match(faqAnswer('Is the tip included?', 'en'), /Tips are not included/);
  assert.match(faqAnswer('is lunch included?', 'en'), /depends on the boat/);
  assert.match(faqAnswer('¿Qué pasa si llueve?', 'es'), /Capitanía de Puerto/);
  assert.match(faqAnswer('can I cancel and get my money back?', 'en'), /48 hours/);
  assert.match(faqAnswer('how much is it?', 'en'), /start at \$350/);
  assert.equal(faqAnswer('hello there', 'en'), null);
});

test('without AI: answers a question mid-flow, then asks the same step again', async () => {
  await say('hi');
  await say('Fishing trip', TOURIST, 'fish');
  await say('can my kids come?');
  const [answer, again] = outbox.filter((m) => m.to === TOURIST).slice(-2).map((m) => m.message.text);
  assert.match(answer, /kids are welcome/);
  assert.match(again, /What date would you like to go fishing/);
});

test('without AI: questions in the first message or the menu get answered', async () => {
  await say('do you take credit cards?');
  const msgs = outbox.filter((m) => m.to === TOURIST).map((m) => m.message.text);
  assert.match(msgs[0], /pay securely by card/);
  assert.match(msgs[1], /Welcome/);

  await say('how much does it cost?');
  const [price, menu] = outbox.filter((m) => m.to === TOURIST).slice(-2).map((m) => m.message.text);
  assert.match(price, /start at \$350/);
  assert.match(menu, /What would you like to do/);

  // A question that also names an activity: answer it, then start that activity
  await say('I want to rent a kayak, do I need experience?');
  const [tip, rent] = outbox.filter((m) => m.to === TOURIST).slice(-2).map((m) => m.message.text);
  assert.match(tip, /No experience needed/);
  assert.match(rent, /paddleboards and kayaks/);
});

test('without AI: typos and sentences still get through a fishing booking', async () => {
  await say('hi');
  await say('i want to go fising');
  assert.match(lastTo(TOURIST).text, /What date would you like to go fishing/);
  await say('tomorow');
  assert.match(lastTo(TOURIST).text, /How many people/);
  await say('2 adults and 2 kids');
  assert.match(lastTo(TOURIST).text, /How long would you like to fish/);
  await say('the full day please');
  assert.match(lastTo(TOURIST).text, /boats available/);
  assert.match(lastTo(TOURIST).text, /La Reina/);
});

test('without AI: massage length in words', async () => {
  const MX = '5213310000000';
  await say('quiero un masaje', MX);
  await say(addDays(caboToday(), 2), MX);
  await say('hora y media', MX);
  assert.match(lastTo(MX).text, /A qué hora te queda mejor/);
});

test('a QR scan always gets the welcome; a first message naming an activity goes straight to it', async () => {
  await say("Hi! I'd like to book a fishing trip (ref: villa-sol)");
  assert.match(lastTo(TOURIST).text, /Welcome/);
  const other = '15558888888';
  await say('I want to rent a kayak', other);
  assert.match(lastTo(other).text, /paddleboards and kayaks/);
});

test('before a booking starts, the bot follows the language the customer writes in', async () => {
  await say('hola buenos dias');
  assert.match(lastTo(TOURIST).text, /Te damos la bienvenida/);
  await say('hi good morning');
  assert.match(lastTo(TOURIST).text, /Welcome/);
  assert.equal(lastTo(TOURIST).list.rows[0].title, '🎣 Fishing trip');
  // Once a booking is under way, a stray word doesn't flip the language
  await say('Fishing trip', TOURIST, 'fish');
  await say('mañana');
  assert.match(lastTo(TOURIST).text, /How many people/);
});

test('Spanish-speaking tourist books a trip in Spanish, captain 2 gets it in English', async () => {
  const MX = '5213310000000';
  const date = addDays(caboToday(), 4);
  const [y, m, d] = date.split('-');
  await say('Hola! Quiero reservar (ref: taxi-7)', MX);
  assert.match(lastTo(MX).text, /Te damos la bienvenida/);
  assert.equal(lastTo(MX).list.rows[0].title, '🎣 Viaje de pesca');
  await say('pesca', MX);
  assert.match(lastTo(MX).text, /Qué día/);
  await say(`${+d}/${+m}`, MX); // day first in Spanish
  assert.match(lastTo(MX).text, /Cuántas personas/);
  await say('3', MX);
  await say('4 horas', MX);
  assert.match(lastTo(MX).text, /barcos disponibles/);
  await say('x', MX, 'boat2');
  await say('x', MX, 'usename');
  assert.match(lastTo(MX).text, /Pagas ahora en línea: \*\$70\*/);
  await say('Confirmar y pagar', MX);
  assert.match(lastTo(MX).text, /Todavía no tienes que pagar nada/);
  assert.match(lastTo(CAPTAIN2).text, /NEW REQUEST/);
  await say('yes', CAPTAIN2);
  assert.match(lastTo(CAPTAIN2).text, /We sent the payment link/);
  assert.match(lastTo(MX).text, /confirmó el barco/);
  const code = payCode(MX);
  assert.equal(getDb().prepare('SELECT lang FROM bookings WHERE code = ?').get(code).lang, 'es');
  await handlePayment(code);
  assert.match(lastTo(MX).text, /Reserva lista/);
  assert.match(lastTo(MX).text, /Viaje de pesca/);
  assert.match(lastTo(CAPTAIN2).text, /NEW TRIP CONFIRMED/);
});

test('switching language mid-flow repeats the question in the new language', async () => {
  await say('hi');
  await say('rent');
  await say(addDays(caboToday(), 2));
  await say('2');
  assert.match(lastTo(TOURIST).text, /What would you like to rent/);
  await say('español');
  const msgs = outbox.filter((x) => x.to === TOURIST).slice(-2);
  assert.match(msgs[0].message.text, /seguimos en español/);
  assert.match(msgs[1].message.text, /Qué te gustaría rentar/);
  assert.deepEqual(msgs[1].message.list.rows.map((r) => r.title).sort(), ['Carriola', 'Sombrilla']);
  await say('english');
  assert.match(lastTo(TOURIST).text, /What would you like to rent/);
});

test('captain and owner commands work in Spanish and English', async () => {
  const date = addDays(caboToday(), 6);
  await say(`BLOQUEAR ${date}`, CAPTAIN);
  assert.equal(availableBoats(date, 4, 2).length, 1);
  await say(`desbloquear ${date}`, CAPTAIN);
  assert.equal(availableBoats(date, 4, 2).length, 2);
  await say('viajes', CAPTAIN);
  assert.match(lastTo(CAPTAIN).text, /no tienes viajes/i);
  await say('english', CAPTAIN);
  assert.match(lastTo(CAPTAIN).text, /Captain commands/);
  await say('TRIPS', CAPTAIN);
  assert.match(lastTo(CAPTAIN).text, /No upcoming trips/);

  await say('HOY', OWNER);
  assert.match(lastTo(OWNER).text, /No hay nada programado/);
  await say('hola');
  await say('humano');
  assert.match(lastTo(TOURIST).text, /Te comunico con nuestro equipo/);
  await say(`RESPONDER ${TOURIST} ¡Claro que sí!`, OWNER);
  assert.match(lastTo(TOURIST).text, /Claro que sí/);
  await say(`BOT ${TOURIST}`, OWNER);
  assert.match(lastTo(TOURIST).text, /Gracias por tu paciencia/);
});
