import { getDb } from './db.js';
import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { createCheckout } from './payments.js';
import { addDays, caboInstant, caboToday, captainDeadline, parseDate, TRIP_START } from './dates.js';
import {
  availableBoats, createFishingRequest, createMassageHold, createRentalHold, freeTherapists, getBooking, itemAvailability,
  MASSAGE_TIMES, massagePrice, massageSplit, rentalItems, rentalQuote, setPaymentRef, setStatus, upcomingForPhone,
} from './bookings.js';
import { askCaptain, bookingSummary, tellCaptain } from './notify.js';
import { handleCaptainMessage, handleOwnerMessage, isCaptain } from './staff.js';
import { boatDescription, detectLang, fmtDate, fmtTime, guessLang, itemName, langSwitch, t } from './i18n.js';
import { aiEnabled, interpret } from './ai.js';

const usd = (n) => `$${n.toLocaleString('en-US')}`;
const MAX_DAYS_AHEAD = 180;
const owner = config.ownerLang;

// ---------- Conversation storage ----------

function loadConversation(phone) {
  const row = getDb().prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
  if (!row) return { phone, state: 'new', data: {}, human_mode: 0, source: null, lang: null };
  return { ...row, data: JSON.parse(row.data) };
}

function saveConversation(c) {
  getDb().prepare(`
    INSERT INTO conversations (phone, state, data, human_mode, source, lang, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(phone) DO UPDATE SET state = excluded.state, data = excluded.data, human_mode = excluded.human_mode,
      source = excluded.source, lang = excluded.lang, updated_at = excluded.updated_at
  `).run(c.phone, c.state, JSON.stringify(c.data), c.human_mode, c.source, c.lang);
}

export function customerLang(phone) {
  return loadConversation(phone).lang || 'en';
}

export function setHumanMode(phone, on) {
  const c = loadConversation(phone);
  c.human_mode = on ? 1 : 0;
  if (!on) { c.state = 'menu'; c.data = { name: c.data.name }; }
  saveConversation(c);
}

// ---------- Helpers ----------

// Sends a message with options and remembers them so we can match "2", the title, or the button id.
async function ask(c, message, options) {
  c.data.options = options.map((o) => ({ id: o.id, title: o.title }));
  if (options.length <= 3 && !message.listButton) {
    await sendMessage(c.phone, { text: message.text, buttons: options });
  } else {
    await sendMessage(c.phone, {
      text: message.text,
      list: { button: message.listButton || T(c, 'seeOptions'), title: message.listTitle || T(c, 'options'), rows: options },
    });
  }
}

const norm = (s) => String(s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function pick(c, input) {
  const opts = c.data.options || [];
  if (input.replyId) return opts.find((o) => o.id === input.replyId)?.id || null;
  const text = norm(input.text);
  const n = Number(text);
  if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1].id;
  return opts.find((o) => norm(o.title) === text)?.id
    || opts.find((o) => text.length >= 3 && norm(o.title).includes(text))?.id
    || null;
}

const T = (c, key, ...args) => t(c.lang, key, ...args);
const say = (c, text) => sendMessage(c.phone, { text });
const D = (c, date) => fmtDate(date, c.lang);

function firstName(name) {
  return name ? name.split(/\s+/)[0] : '';
}

const HUMAN = /^(human|agent|person|operator|help me|talk to (a )?(human|person|someone)|humano|persona|agente|asesor|ayuda|hablar con (alguien|una persona|un humano))$/;
const MENU = /^(menu|start|restart|main menu|back|inicio|volver|regresar|menu principal)$/;
const MY_BOOKINGS = /^(my bookings?|my trips?|my reservations?|mis reservas?|mis viajes?|mi reserva(cion)?)$/;
const CANCEL = /^(cancel|stop|cancelar|parar|alto)$/;

// ---------- Entry point ----------

export async function handleIncoming({ from, name, text = '', replyId = null }) {
  getDb().prepare('INSERT INTO messages_log (phone, direction, body) VALUES (?, ?, ?)').run(from, 'in', text || replyId || '');

  if (config.ownerPhone && from === config.ownerPhone) return handleOwnerMessage(text);
  if (isCaptain(from)) return handleCaptainMessage(from, text, replyId);

  const c = loadConversation(from);
  const input = { text: text || '', replyId, profileName: name };
  const lower = norm(input.text);
  if (!c.lang) c.lang = detectLang(input.text, from);
  // Before a booking starts, follow the language the customer is actually writing in.
  else if (['new', 'menu'].includes(c.state) && !replyId) c.lang = guessLang(input.text) || c.lang;

  // Track which QR / channel the customer came from: wa.me links prefill "... (ref: airbnb-casa-azul)"
  const ref = input.text.match(/\(ref:\s*([\w-]+)\)/i);
  if (ref && !c.source) c.source = ref[1].toLowerCase();

  if (c.human_mode) {
    // The owner is handling this chat by hand: forward and stay quiet.
    await sendMessage(config.ownerPhone, { text: t(owner, 'ownForward', from, name, input.text, c.lang) }, { lang: owner });
    saveConversation(c);
    return;
  }

  try {
    const switchTo = langSwitch(input.text);
    if (switchTo) {
      c.lang = switchTo;
      // Reminders for upcoming bookings follow the new language too.
      getDb().prepare(`UPDATE bookings SET lang = ? WHERE customer_phone = ? AND status IN ('awaiting_captain', 'pending_payment', 'confirmed')`)
        .run(switchTo, c.phone);
      await say(c, T(c, 'languageSet'));
      if (STATES[c.state] && !['new', 'menu'].includes(c.state)) await repeatStep(c);
      else await showMenu(c);
    } else if (HUMAN.test(lower) || replyId === 'human') {
      await escalate(c, input, t(owner, 'reasonAsked'));
    } else if (MENU.test(lower) || replyId === 'menu') {
      await showMenu(c);
    } else if (MY_BOOKINGS.test(lower) || replyId === 'mybookings') {
      await showMyBookings(c);
    } else if (CANCEL.test(lower) && !['awaiting_payment', 'awaiting_captain'].includes(c.state)) {
      await say(c, T(c, 'cleared'));
      c.state = 'menu';
      c.data = { name: c.data.name };
    } else if (STATES[c.state]) {
      await STATES[c.state](c, input);
    } else {
      await welcome(c, input);
    }
  } catch (err) {
    console.error('Bot error', err);
    await escalate(c, input, t(owner, 'reasonError', err.message));
  }
  saveConversation(c);
}

// Asks the current question again (after a language switch, or after answering a question mid-flow).
async function repeatStep(c) {
  const d = c.data;
  switch (c.state) {
    case 'new':
    case 'menu': return showMenu(c);
    case 'fish_date': return say(c, T(c, 'fishStart'));
    case 'fish_guests': return say(c, T(c, 'askGuests', D(c, d.date)));
    case 'fish_hours': return STATES.fish_guests(c, { text: String(d.guests) });
    case 'fish_boat': return showBoats(c);
    case 'ask_name': return askName(c, d.after_name);
    case 'fish_confirm': return showFishingSummary(c);
    case 'rent_start': return say(c, T(c, 'rentStart'));
    case 'rent_days': return say(c, T(c, 'askDays', D(c, d.start)));
    case 'rent_items':
    case 'rent_qty': return showItems(c);
    case 'rent_address': return say(c, T(c, 'askAddress'));
    case 'rent_confirm': return showRentalSummary(c);
    case 'massage_date': return say(c, T(c, 'massageStart'));
    case 'massage_people': return askMassagePeople(c);
    case 'massage_length': return askMassageLength(c);
    case 'massage_time': return showMassageTimes(c);
    case 'massage_address': return say(c, T(c, 'massageAddress'));
    case 'massage_confirm': return showMassageSummary(c);
    default: return STATES[c.state](c, { text: '' });
  }
}

// ---------- Menu ----------

const menuOptions = (c) => [
  { id: 'fish', title: T(c, 'menuFish') },
  { id: 'rent', title: T(c, 'menuRent') },
  { id: 'massage', title: T(c, 'menuMassage') },
  { id: 'human', title: T(c, 'talkToPerson') },
];

async function welcome(c, input) {
  c.data.name = c.data.name || input.profileName || null;
  c.state = 'menu';
  await ask(c, { text: T(c, 'welcome', firstName(c.data.name), config.businessName) }, menuOptions(c));
}

async function showMenu(c) {
  c.state = 'menu';
  c.data = { name: c.data.name };
  await ask(c, { text: T(c, 'whatToDo') }, menuOptions(c));
}

async function showMyBookings(c) {
  const list = upcomingForPhone(c.phone);
  if (!list.length) await say(c, T(c, 'noBookings'));
  else await say(c, list.map((b) => bookingSummary(b, c.lang)).join('\n\n') + '\n\n' + T(c, 'bookingsFooter'));
}

async function escalate(c, input, reason) {
  c.human_mode = 1;
  await say(c, T(c, 'connecting'));
  await sendMessage(config.ownerPhone, {
    text: t(owner, 'ownHuman', { phone: c.phone, name: input.profileName, reason, state: c.state, text: input.text, lang: c.lang }),
  }, { notification: true, lang: owner });
}

// ---------- AI fallback ----------
// When the keyword rules don't understand a message, Claude says what the customer meant (see ai.js).
// The bot still does every booking step itself; the AI only fills in values, switches activity,
// answers questions from knowledge.md, or hands the chat to a person.

const EXPECTS = {
  menu: 'which activity they want: fishing, rental (beach/baby gear) or massage',
  fish_date: 'the date of the fishing trip',
  fish_guests: 'how many people are going fishing',
  fish_hours: 'trip length: 4, 6 or 8 hours',
  fish_boat: 'which boat (option_id)',
  fish_confirm: 'confirm and pay (option "pay") or change the trip (option "change")',
  awaiting_captain: 'nothing: they are waiting for the captain to confirm the boat',
  rent_start: 'the date the rental starts',
  rent_days: 'for how many days they need the gear',
  rent_items: 'which item to add (option_id), or "checkout" when done',
  rent_qty: 'how many units of the item',
  rent_confirm: 'confirm and pay (option "pay") or change the rental (option "change")',
  massage_date: 'the date of the massage',
  massage_people: 'how many people get a massage at the same time',
  massage_length: 'massage length: 60 or 90 minutes',
  massage_time: 'which time slot (option_id)',
  massage_confirm: 'confirm and pay (option "pay") or change the booking (option "change")',
  awaiting_payment: 'nothing: they have a payment link to pay',
};

const flowOf = (state) => (state.startsWith('fish') ? 'fishing' : state.startsWith('rent') ? 'rental' : state.startsWith('massage') ? 'massage' : 'none');

function aiContext(c, input) {
  const recent = getDb().prepare('SELECT direction, body FROM messages_log WHERE phone = ? ORDER BY id DESC LIMIT 8').all(c.phone)
    .reverse().map((m) => ({ from: m.direction === 'in' ? 'customer' : 'bot', text: m.body.slice(0, 400) }));
  return {
    today: caboToday(), customer_language: c.lang, step: c.state, step_expects: EXPECTS[c.state] || '',
    options: c.data.options || [], recent_conversation: recent, last_message: input.text,
  };
}

// Returns true when the AI understood the message and the bot already replied.
async function understand(c, input) {
  if (input.ai || input.replyId || !input.text.trim() || !aiEnabled()) return false;
  const r = await interpret(aiContext(c, input));
  if (!r) return false;
  switch (r.action) {
    case 'answer':
      if (!r.reply) return false;
      await say(c, r.reply);
      await repeatStep(c);
      return true;
    case 'human':
      await escalate(c, input, t(owner, 'reasonAI'));
      return true;
    case 'switch':
      // Don't drop a booking that is waiting for the captain or the payment.
      if (r.flow === 'none' || ['awaiting_captain', 'awaiting_payment'].includes(c.state)) return false;
      await fillFlow(c, r.flow, r);
      return true;
    case 'value':
      return useValue(c, r);
    default:
      return false;
  }
}

// Feeds the value the AI extracted back into the current step, as if the customer had typed it plainly.
async function useValue(c, r) {
  const again = (fields) => STATES[c.state](c, { text: '', ...fields, ai: true }).then(() => true);
  switch (c.state) {
    case 'menu':
      return r.flow !== 'none' && fillFlow(c, r.flow, r).then(() => true);
    case 'fish_date':
    case 'rent_start':
    case 'massage_date':
      return !!r.date && fillFlow(c, flowOf(c.state), r).then(() => true);
    case 'fish_guests':
    case 'rent_days':
    case 'rent_qty':
    case 'massage_people':
      return r.number > 0 && again({ text: String(r.number) });
    case 'fish_hours':
      return [4, 6, 8].includes(r.hours) && again({ text: String(r.hours) });
    case 'massage_length':
      return [60, 90].includes(r.minutes) && again({ text: String(r.minutes) });
    default:
      if (r.option_id === 'human') return escalate(c, { text: '' }, t(owner, 'reasonAsked')).then(() => true);
      if (!(c.data.options || []).some((o) => o.id === r.option_id)) return false;
      return again({ replyId: r.option_id });
  }
}

// Starts a flow with whatever the customer already told us and asks only what is still missing.
// r.number means people for fishing and massage, days for rentals.
async function fillFlow(c, flow, r) {
  const start = { fishing: startFishing, rental: startRental, massage: startMassage }[flow];
  if (!r.date) return start(c);
  const d = readFutureDate(c, r.date);
  c.data = { name: c.data.name };
  if (d.error) {
    c.state = { fishing: 'fish_date', rental: 'rent_start', massage: 'massage_date' }[flow];
    return say(c, d.error);
  }
  if (flow === 'fishing') {
    c.data.date = d.value;
    if (!(r.number >= 1 && r.number <= 30)) {
      c.state = 'fish_guests';
      return say(c, T(c, 'askGuests', D(c, d.value)));
    }
    if (![4, 6, 8].includes(r.hours)) return STATES.fish_guests(c, { text: String(r.number) });
    c.data.guests = r.number;
    c.data.hours = r.hours;
    return showBoats(c);
  }
  if (flow === 'rental') {
    c.data.start = d.value;
    if (!(r.number >= 1 && r.number <= 30)) {
      c.state = 'rent_days';
      return say(c, T(c, 'askDays', D(c, d.value)));
    }
    c.data.end = addDays(d.value, r.number - 1);
    c.data.cart = [];
    return showItems(c);
  }
  c.data.date = d.value;
  if (config.massageTherapists === 1) c.data.people = 1;
  else if (r.number >= 1 && r.number <= config.massageTherapists) c.data.people = r.number;
  else return askMassagePeople(c);
  if (![60, 90].includes(r.minutes)) return askMassageLength(c);
  c.data.minutes = r.minutes;
  return showMassageTimes(c);
}

// The step didn't understand the message: try the AI, otherwise send the step's usual hint.
async function notUnderstood(c, input, text) {
  if (await understand(c, input)) return;
  await say(c, text);
}

// ---------- States ----------

const FISH_WORDS = /fish|boat|charter|marlin|tuna|dorado|pesca|pescar|barco|lancha|atun/;
const RENT_WORDS = /rent|beach|umbrella|chair|cooler|stroller|crib|baby|car seat|renta|playa|sombrilla|silla|hielera|carriola|cuna|bebe/;
const MASSAGE_WORDS = /massage|masaje|spa/;

const STATES = {
  // A first message that already names an activity skips the welcome and goes straight to it.
  async new(c, input) {
    const text = norm(input.text);
    if (![FISH_WORDS, RENT_WORDS, MASSAGE_WORDS].some((re) => re.test(text))) return welcome(c, input);
    c.data.name = c.data.name || input.profileName || null;
    return STATES.menu(c, input);
  },

  async menu(c, input) {
    const text = norm(input.text);
    const picked = pick(c, input);
    const choice = picked
      || (FISH_WORDS.test(text) ? 'fish' : MASSAGE_WORDS.test(text) ? 'massage' : RENT_WORDS.test(text) ? 'rent' : null);
    // A longer free-text message ("4 of us want to fish next Friday") goes to the AI to pick up the details.
    if (!picked && (!choice || text.split(/\s+/).length > 3) && await understand(c, input)) return;
    if (choice === 'fish') return startFishing(c);
    if (choice === 'rent') return startRental(c);
    if (choice === 'massage') return startMassage(c);
    return welcome(c, input);
  },

  // ----- Fishing -----

  async fish_date(c, input) {
    const date = readFutureDate(c, input.text);
    if (date.error) return date.unparsed ? notUnderstood(c, input, date.error) : say(c, date.error);
    c.data.date = date.value;
    delete c.data.excludeBoats;
    c.state = 'fish_guests';
    await say(c, T(c, 'askGuests', D(c, date.value)));
  },

  async fish_guests(c, input) {
    const n = parseInt(input.text, 10);
    if (!(n >= 1 && n <= 30)) return notUnderstood(c, input, T(c, 'guestsInvalid'));
    c.data.guests = n;
    c.state = 'fish_hours';
    await ask(c, { text: T(c, 'askHours') }, [
      { id: 'h4', title: T(c, 'h4') },
      { id: 'h6', title: T(c, 'h6') },
      { id: 'h8', title: T(c, 'h8') },
    ]);
  },

  async fish_hours(c, input) {
    const id = pick(c, input) || ({ 4: 'h4', 6: 'h6', 8: 'h8' })[parseInt(input.text, 10)];
    if (!id) return notUnderstood(c, input, T(c, 'hoursInvalid'));
    c.data.hours = Number(id.slice(1));
    return showBoats(c);
  },

  async fish_boat(c, input) {
    const id = pick(c, input);
    if (id === 'otherdate') { c.state = 'fish_date'; return say(c, T(c, 'otherDatePrompt')); }
    if (id === 'otherhours') { c.state = 'fish_guests'; return STATES.fish_guests(c, { text: String(c.data.guests) }); }
    if (!id?.startsWith('boat')) return notUnderstood(c, input, T(c, 'pickBoat'));
    c.data.boatId = Number(id.slice(4));
    return askName(c, 'fish_confirm');
  },

  async ask_name(c, input) {
    const id = pick(c, input);
    const name = id === 'usename' ? c.data.name : input.text.trim();
    if (!name || name.length < 2 || name.length > 60) return say(c, T(c, 'nameInvalid'));
    c.data.name = name;
    c.state = c.data.after_name;
    const summary = { fish_confirm: showFishingSummary, rent_confirm: showRentalSummary, massage_confirm: showMassageSummary };
    return summary[c.state](c);
  },

  async fish_confirm(c, input) {
    const id = pick(c, input);
    if (id === 'change') return startFishing(c);
    if (id !== 'pay') return notUnderstood(c, input, T(c, 'confirmFishHint'));
    const expiresAt = captainDeadline(config.captainReplyMinutes);
    // Too close to departure to wait for the captain (e.g. booked late at night for tomorrow morning).
    const departure = caboInstant(c.data.date, TRIP_START[c.data.hours]);
    if (departure.getTime() - expiresAt.getTime() < 3 * 60 * 60 * 1000) {
      return escalate(c, input, t(owner, 'reasonTooSoon', fmtDate(c.data.date, owner), c.data.boatId, c.data.hours, c.data.guests));
    }
    const b = createFishingRequest({
      phone: c.phone, name: c.data.name, source: c.source, lang: c.lang,
      date: c.data.date, hours: c.data.hours, guests: c.data.guests, boatId: c.data.boatId, expiresAt,
    });
    if (!b) {
      await say(c, T(c, 'boatJustTakenList'));
      return showBoats(c);
    }
    await askCaptain(b);
    c.state = 'awaiting_captain';
    c.data.code = b.code;
    const night = expiresAt.getTime() - Date.now() > (config.captainReplyMinutes + 1) * 60_000;
    await say(c, T(c, night ? 'checkingCaptainNight' : 'checkingCaptain', b.captain_name));
  },

  async awaiting_captain(c, input) {
    const b = getBooking(c.data.code);
    if (!b || b.status !== 'awaiting_captain') return showMenu(c);
    const id = pick(c, input);
    if (id === 'cancelreq' || CANCEL.test(norm(input.text))) {
      setStatus(b.code, 'cancelled');
      await tellCaptain(b, 'capCancelledByClient');
      await say(c, T(c, 'requestCancelled'));
      return showMenu(c);
    }
    if (id === 'otherboat') {
      setStatus(b.code, 'cancelled');
      await tellCaptain(b, 'capCancelledByClient');
      c.data = { ...restoreTrip(b), name: c.data.name, excludeBoats: [b.boat_id] };
      return showBoats(c);
    }
    if (!id && await understand(c, input)) return;
    await ask(c, { text: T(c, 'waitingCaptain', b.captain_name, b.code) }, [
      { id: 'otherboat', title: T(c, 'otherBoat') },
      { id: 'cancelreq', title: T(c, 'cancelRequest') },
      { id: 'human', title: T(c, 'talkToPerson') },
    ]);
  },

  // ----- Rentals -----

  async rent_start(c, input) {
    const date = readFutureDate(c, input.text);
    if (date.error) return date.unparsed ? notUnderstood(c, input, date.error) : say(c, date.error);
    c.data.start = date.value;
    c.state = 'rent_days';
    await say(c, T(c, 'askDays', D(c, date.value)));
  },

  async rent_days(c, input) {
    const n = parseInt(input.text, 10);
    if (!(n >= 1 && n <= 30)) return notUnderstood(c, input, T(c, 'daysInvalid'));
    c.data.end = addDays(c.data.start, n - 1);
    c.data.cart = [];
    return showItems(c);
  },

  async rent_items(c, input) {
    const id = pick(c, input);
    if (id === 'checkout') {
      if (!c.data.cart.length) return showItems(c);
      c.state = 'rent_address';
      return say(c, T(c, 'askAddress'));
    }
    if (!id?.startsWith('item')) return notUnderstood(c, input, T(c, 'pickItem'));
    const itemId = Number(id.slice(4));
    const free = itemAvailability(itemId, c.data.start, c.data.end) - (c.data.cart.find((x) => x.itemId === itemId)?.qty || 0);
    const item = rentalItems().find((i) => i.id === itemId);
    if (free <= 0) {
      await say(c, T(c, 'itemSoldOut', itemName(item, c.lang)));
      return showItems(c);
    }
    c.data.pendingItem = itemId;
    c.data.pendingMax = free;
    c.state = 'rent_qty';
    const opts = [1, 2, 3].filter((n) => n <= free).map((n) => ({ id: `q${n}`, title: String(n) }));
    await ask(c, { text: T(c, 'askQty', itemName(item, c.lang), free) }, opts);
  },

  async rent_qty(c, input) {
    const id = pick(c, input);
    const n = id ? Number(id.slice(1)) : parseInt(input.text, 10);
    if (!(n >= 1 && n <= c.data.pendingMax)) return notUnderstood(c, input, T(c, 'qtyInvalid', c.data.pendingMax));
    const line = c.data.cart.find((x) => x.itemId === c.data.pendingItem);
    if (line) line.qty += n;
    else c.data.cart.push({ itemId: c.data.pendingItem, qty: n });
    delete c.data.pendingItem;
    delete c.data.pendingMax;
    return showItems(c);
  },

  async rent_address(c, input) {
    const addr = input.text.trim();
    if (addr.length < 6) return say(c, T(c, 'addressInvalid'));
    c.data.address = addr.slice(0, 300);
    return askName(c, 'rent_confirm');
  },

  async rent_confirm(c, input) {
    const id = pick(c, input);
    if (id === 'change') return startRental(c);
    if (id !== 'pay') return notUnderstood(c, input, T(c, 'confirmRentHint'));
    const b = createRentalHold({
      phone: c.phone, name: c.data.name, source: c.source, lang: c.lang,
      start: c.data.start, end: c.data.end, items: c.data.cart, address: c.data.address,
    });
    if (!b) {
      await say(c, T(c, 'itemJustTaken'));
      c.data.cart = [];
      return showItems(c);
    }
    return sendPaymentLink(c, b, t(b.lang, 'stripeRental', b.code));
  },

  // ----- Massages -----

  async massage_date(c, input) {
    const date = readFutureDate(c, input.text);
    if (date.error) return date.unparsed ? notUnderstood(c, input, date.error) : say(c, date.error);
    c.data.date = date.value;
    // With a single therapist there is nothing to ask: one person per slot.
    if (config.massageTherapists === 1) {
      c.data.people = 1;
      return askMassageLength(c);
    }
    return askMassagePeople(c);
  },

  async massage_people(c, input) {
    const id = pick(c, input);
    const n = id ? Number(id.slice(1)) : parseInt(input.text, 10);
    if (!(n >= 1 && n <= config.massageTherapists)) return notUnderstood(c, input, T(c, 'massagePeopleInvalid', config.massageTherapists));
    c.data.people = n;
    return askMassageLength(c);
  },

  async massage_length(c, input) {
    const id = pick(c, input) || ({ 60: 'm60', 90: 'm90' })[parseInt(input.text, 10)];
    if (!id) return notUnderstood(c, input, T(c, 'massageLengthInvalid'));
    c.data.minutes = Number(id.slice(1));
    return showMassageTimes(c);
  },

  async massage_time(c, input) {
    const id = pick(c, input);
    if (id === 'otherdate') { c.state = 'massage_date'; return say(c, T(c, 'otherDatePrompt')); }
    if (!id?.startsWith('time')) return notUnderstood(c, input, T(c, 'pickTime'));
    c.data.time = id.slice(4);
    c.state = 'massage_address';
    await say(c, T(c, 'massageAddress'));
  },

  async massage_address(c, input) {
    const addr = input.text.trim();
    if (addr.length < 6) return say(c, T(c, 'addressInvalid'));
    c.data.address = addr.slice(0, 300);
    return askName(c, 'massage_confirm');
  },

  async massage_confirm(c, input) {
    const id = pick(c, input);
    if (id === 'change') return startMassage(c);
    if (id !== 'pay') return notUnderstood(c, input, T(c, 'confirmMassageHint'));
    const b = createMassageHold({
      phone: c.phone, name: c.data.name, source: c.source, lang: c.lang,
      date: c.data.date, time: c.data.time, minutes: c.data.minutes, people: c.data.people, address: c.data.address,
    });
    if (!b) {
      await say(c, T(c, 'massageJustTaken'));
      return showMassageTimes(c);
    }
    return sendPaymentLink(c, b, t(b.lang, 'stripeMassage', b.code));
  },

  // ----- After the payment link -----

  async awaiting_payment(c, input) {
    const b = getBooking(c.data.code);
    if (!b || b.status !== 'pending_payment') {
      if (b?.status === 'confirmed') return say(c, T(c, 'alreadyConfirmed', b.code));
      await say(c, T(c, 'linkExpired'));
      return showMenu(c);
    }
    const id = pick(c, input);
    if (id === 'resend') return say(c, T(c, 'resendLink', c.data.payUrl));
    if (id === 'cancelhold' || CANCEL.test(norm(input.text))) {
      setStatus(b.code, 'cancelled');
      await say(c, T(c, 'reservationCancelled'));
      return showMenu(c);
    }
    if (id === 'menu') return showMenu(c);
    if (!id && await understand(c, input)) return;
    await ask(c, { text: T(c, 'waitingPayment', b.code) }, [
      { id: 'resend', title: T(c, 'resend') },
      { id: 'cancelhold', title: T(c, 'cancelReservation') },
      { id: 'human', title: T(c, 'talkToPerson') },
    ]);
  },
};

// ---------- Flow steps ----------

function readFutureDate(c, text) {
  const date = parseDate(text, new Date(), c.lang);
  const today = caboToday();
  if (!date) return { error: T(c, 'dateNotUnderstood'), unparsed: true };
  if (date < today) return { error: T(c, 'datePassed') };
  if (date === today) return { error: T(c, 'dateToday') };
  if (date > addDays(today, MAX_DAYS_AHEAD)) return { error: T(c, 'dateTooFar', MAX_DAYS_AHEAD) };
  return { value: date };
}

async function startFishing(c) {
  c.state = 'fish_date';
  c.data = { name: c.data.name };
  await say(c, T(c, 'fishStart'));
}

async function showBoats(c) {
  const { date, hours, guests } = c.data;
  const exclude = c.data.excludeBoats || [];
  const boats = availableBoats(date, hours, guests).filter((b) => !exclude.includes(b.id)).slice(0, 8);
  c.state = 'fish_boat';
  if (!boats.length) {
    return ask(c, { text: T(c, 'noBoats', D(c, date), guests, hours) }, [
      { id: 'otherdate', title: T(c, 'anotherDate') },
      { id: 'otherhours', title: T(c, 'anotherDuration') },
      { id: 'human', title: T(c, 'talkToPerson') },
    ]);
  }
  const rows = boats.map((b) => ({
    id: `boat${b.id}`,
    title: `${b.name}${b.length_ft ? ` ${b.length_ft}ft` : ''}`,
    description: T(c, 'boatRow', usd(b.price), b.max_guests, b.captain_name),
  }));
  rows.push({ id: 'otherdate', title: T(c, 'anotherDate') });
  const details = boats.map((b, i) => `*${i + 1}. ${b.name}* — ${usd(b.price)}\n${boatDescription(b, c.lang)}`.trim()).join('\n\n');
  await ask(c, {
    text: T(c, 'boatsAvailable', D(c, date), hours, fmtTime(TRIP_START[hours], c.lang), details, config.depositPercent),
    listButton: T(c, 'chooseBoat'),
    listTitle: T(c, 'availableBoats'),
  }, rows);
}

async function askName(c, next) {
  c.data.after_name = next;
  c.state = 'ask_name';
  if (c.data.name) return ask(c, { text: T(c, 'askNameDefault') }, [{ id: 'usename', title: c.data.name.slice(0, 20) }]);
  await say(c, T(c, 'askName'));
}

async function showFishingSummary(c) {
  const { date, hours, guests, boatId } = c.data;
  const boat = availableBoats(date, hours, guests).find((b) => b.id === boatId);
  if (!boat) {
    await say(c, T(c, 'boatJustTaken'));
    return showBoats(c);
  }
  const deposit = Math.ceil((boat.price * config.depositPercent) / 100);
  c.state = 'fish_confirm';
  await ask(c, {
    text: T(c, 'fishSummary', {
      boat: boat.name, captain: boat.captain_name, date: D(c, date), time: fmtTime(TRIP_START[hours], c.lang), hours, guests,
      name: c.data.name, meeting: boat.meeting_point, total: usd(boat.price), deposit: usd(deposit), cash: usd(boat.price - deposit),
    }),
  }, [
    { id: 'pay', title: T(c, 'confirmPay') },
    { id: 'change', title: T(c, 'change') },
    { id: 'human', title: T(c, 'talkToPerson') },
  ]);
}

async function startRental(c) {
  c.state = 'rent_start';
  c.data = { name: c.data.name };
  await say(c, T(c, 'rentStart'));
}

function cartLines(c, q) {
  return q.lines.map((l) => `• ${l.qty} × ${itemName(l.item, c.lang)} — ${usd(l.subtotal)}`).join('\n');
}

async function showItems(c) {
  c.state = 'rent_items';
  delete c.data.pendingItem;
  delete c.data.pendingMax;
  const days = T(c, 'days', Math.round((Date.parse(c.data.end) - Date.parse(c.data.start)) / 864e5) + 1);
  const rows = rentalItems()
    .filter((i) => itemAvailability(i.id, c.data.start, c.data.end) > (c.data.cart.find((x) => x.itemId === i.id)?.qty || 0))
    .slice(0, c.data.cart.length ? 9 : 10)
    .map((i) => ({ id: `item${i.id}`, title: itemName(i, c.lang), description: T(c, 'itemRow', usd(i.price_per_day), i.category) }));
  let text;
  if (c.data.cart.length) {
    text = T(c, 'cart', days, cartLines(c, rentalQuote(c.data.cart, c.data.start, c.data.end)));
    rows.unshift({ id: 'checkout', title: T(c, 'doneCheckout'), description: T(c, 'doneCheckoutDesc') });
  } else {
    text = T(c, 'rentWhat', D(c, c.data.start), D(c, c.data.end), days);
  }
  if (!rows.length) {
    return ask(c, { text: T(c, 'everythingBooked') }, [{ id: 'menu', title: T(c, 'mainMenu') }, { id: 'human', title: T(c, 'talkToPerson') }]);
  }
  await ask(c, { text, listButton: T(c, 'seeItems'), listTitle: T(c, 'rentalGear') }, rows);
}

async function showRentalSummary(c) {
  const q = rentalQuote(c.data.cart, c.data.start, c.data.end);
  c.state = 'rent_confirm';
  await ask(c, {
    text: T(c, 'rentSummary', {
      start: D(c, c.data.start), end: D(c, c.data.end), days: T(c, 'days', q.days), lines: cartLines(c, q),
      delivery: usd(q.delivery), address: c.data.address, name: c.data.name, total: usd(q.total),
    }),
  }, [
    { id: 'pay', title: T(c, 'confirmPay') },
    { id: 'change', title: T(c, 'change') },
    { id: 'human', title: T(c, 'talkToPerson') },
  ]);
}

async function startMassage(c) {
  c.state = 'massage_date';
  c.data = { name: c.data.name };
  await say(c, T(c, 'massageStart'));
}

async function askMassagePeople(c) {
  c.state = 'massage_people';
  const opts = [1, 2, 3].filter((n) => n <= config.massageTherapists).map((n) => ({ id: `p${n}`, title: String(n) }));
  await ask(c, { text: T(c, 'massagePeople', D(c, c.data.date)) }, opts);
}

async function askMassageLength(c) {
  c.state = 'massage_length';
  await ask(c, { text: T(c, 'massageLength', usd(massagePrice(60)), usd(massagePrice(90))) }, [
    { id: 'm60', title: T(c, 'm60') },
    { id: 'm90', title: T(c, 'm90') },
  ]);
}

async function showMassageTimes(c) {
  const { date, people } = c.data;
  c.state = 'massage_time';
  const rows = MASSAGE_TIMES.filter((time) => freeTherapists(date, time) >= people)
    .map((time) => ({ id: `time${time}`, title: fmtTime(time, c.lang) }));
  if (!rows.length) {
    return ask(c, { text: T(c, 'noMassageTimes', D(c, date)) }, [
      { id: 'otherdate', title: T(c, 'anotherDate') },
      { id: 'human', title: T(c, 'talkToPerson') },
    ]);
  }
  rows.push({ id: 'otherdate', title: T(c, 'anotherDate') });
  await ask(c, { text: T(c, 'massageTimes', D(c, date)), listButton: T(c, 'chooseTime'), listTitle: T(c, 'availableTimes') }, rows);
}

async function showMassageSummary(c) {
  const { date, time, minutes, people } = c.data;
  if (freeTherapists(date, time) < people) {
    await say(c, T(c, 'massageJustTaken'));
    return showMassageTimes(c);
  }
  const { total, deposit, cash } = massageSplit(minutes, people);
  c.state = 'massage_confirm';
  await ask(c, {
    text: T(c, 'massageSummary', {
      date: D(c, date), time: fmtTime(time, c.lang), minutes, people, address: c.data.address, name: c.data.name,
      total: usd(total), deposit: usd(deposit), cash: usd(cash),
    }),
  }, [
    { id: 'pay', title: T(c, 'confirmPay') },
    { id: 'change', title: T(c, 'change') },
    { id: 'human', title: T(c, 'talkToPerson') },
  ]);
}

function restoreTrip(b) {
  return { date: b.date, hours: b.hours, guests: b.guests };
}

// Called when a captain answers a request (or doesn't in time).
// outcome: 'approved' | 'declined' | 'timeout'
export async function captainAnswered(b, outcome) {
  const c = loadConversation(b.customer_phone);
  c.lang = c.lang || b.lang;
  if (outcome === 'approved') {
    await sendPaymentLink(c, b, t(b.lang, 'stripeFishing', b.code), T(c, 'captainConfirmed', b.captain_name, D(c, b.date)));
  } else {
    const excludeBoats = [...new Set([...(c.data.code === b.code ? c.data.excludeBoats || [] : []), b.boat_id])];
    c.data = { ...restoreTrip(b), name: c.data.name || b.customer_name, excludeBoats };
    const others = availableBoats(b.date, b.hours, b.guests).filter((x) => !excludeBoats.includes(x.id));
    if (!others.length) {
      await escalate(c, { text: '', profileName: b.customer_name },
        t(owner, 'reasonNoBoats', b.captain_name, outcome === 'declined', b.code, fmtDate(b.date, owner), b.hours, b.guests));
    } else {
      await say(c, T(c, outcome === 'declined' ? 'captainDeclined' : 'captainTimeout', b.captain_name, D(c, b.date)));
      await showBoats(c);
    }
  }
  saveConversation(c);
}

async function sendPaymentLink(c, b, description, intro = '') {
  const { url, ref } = await createCheckout(b, description);
  setPaymentRef(b.code, ref);
  c.state = 'awaiting_payment';
  c.data = { name: c.data.name, code: b.code, payUrl: url };
  const what = b.kind === 'fishing' ? T(c, 'payFishing', usd(b.paid_online), usd(b.balance_cash))
    : b.kind === 'massage' ? T(c, 'payMassage', usd(b.paid_online), usd(b.balance_cash))
      : T(c, 'payRental', usd(b.paid_online));
  await say(c, intro + T(c, 'payLink', what, url, config.holdMinutes));
}
