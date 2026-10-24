import { getDb } from './db.js';
import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { createCheckout } from './payments.js';
import { addDays, caboToday, formatDate, formatTime, parseDate, TRIP_START } from './dates.js';
import {
  availableBoats, createFishingHold, createRentalHold, getBooking, itemAvailability,
  rentalItems, rentalQuote, setPaymentRef, setStatus, upcomingForPhone,
} from './bookings.js';
import { bookingSummary } from './notify.js';
import { handleCaptainMessage, handleOwnerMessage, isCaptain } from './staff.js';

const usd = (n) => `$${n.toLocaleString('en-US')}`;
const MAX_DAYS_AHEAD = 180;

// ---------- Conversation storage ----------

function loadConversation(phone) {
  const row = getDb().prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
  if (!row) return { phone, state: 'new', data: {}, human_mode: 0, source: null };
  return { ...row, data: JSON.parse(row.data) };
}

function saveConversation(c) {
  getDb().prepare(`
    INSERT INTO conversations (phone, state, data, human_mode, source, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(phone) DO UPDATE SET state = excluded.state, data = excluded.data, human_mode = excluded.human_mode,
      source = excluded.source, updated_at = excluded.updated_at
  `).run(c.phone, c.state, JSON.stringify(c.data), c.human_mode, c.source);
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
      list: { button: message.listButton || 'See options', title: message.listTitle, rows: options },
    });
  }
}

function pick(c, input) {
  const opts = c.data.options || [];
  if (input.replyId) return opts.find((o) => o.id === input.replyId)?.id || null;
  const t = input.text.trim().toLowerCase();
  const n = Number(t);
  if (Number.isInteger(n) && n >= 1 && n <= opts.length) return opts[n - 1].id;
  return opts.find((o) => o.title.toLowerCase() === t)?.id
    || opts.find((o) => t.length >= 3 && o.title.toLowerCase().includes(t))?.id
    || null;
}

const say = (c, text) => sendMessage(c.phone, { text });

function firstName(name) {
  return name ? name.split(/\s+/)[0] : '';
}

// ---------- Entry point ----------

export async function handleIncoming({ from, name, text = '', replyId = null }) {
  getDb().prepare('INSERT INTO messages_log (phone, direction, body) VALUES (?, ?, ?)').run(from, 'in', text || replyId || '');

  if (config.ownerPhone && from === config.ownerPhone) return handleOwnerMessage(text);
  if (isCaptain(from)) return handleCaptainMessage(from, text);

  const c = loadConversation(from);
  const input = { text: text || '', replyId, profileName: name };
  const lower = input.text.trim().toLowerCase();

  // Track which QR / channel the customer came from: wa.me links prefill "... (ref: airbnb-casa-azul)"
  const ref = input.text.match(/\(ref:\s*([\w-]+)\)/i);
  if (ref && !c.source) c.source = ref[1].toLowerCase();

  if (c.human_mode) {
    // The owner is handling this chat by hand: forward and stay quiet.
    await sendMessage(config.ownerPhone, { text: `💬 +${from}${name ? ` (${name})` : ''}: ${input.text}\n\nReply with: REPLY ${from} your message\nHand back to bot: BOT ${from}` });
    saveConversation(c);
    return;
  }

  try {
    if (/^(human|agent|person|operator|help me|talk to (a )?(human|person|someone))$/.test(lower) || replyId === 'human') {
      await escalate(c, input, 'Customer asked for a person');
    } else if (/^(menu|start|restart|main menu|back)$/.test(lower) || replyId === 'menu') {
      await showMenu(c);
    } else if (/^(my bookings?|my trips?|my reservations?)$/.test(lower) || replyId === 'mybookings') {
      await showMyBookings(c);
    } else if (/^(cancel|stop)$/.test(lower) && c.state !== 'awaiting_payment') {
      await say(c, 'No problem, I cleared that. Type *menu* anytime to start again.');
      c.state = 'menu';
      c.data = { name: c.data.name };
    } else if (STATES[c.state]) {
      await STATES[c.state](c, input);
    } else {
      await welcome(c, input);
    }
  } catch (err) {
    console.error('Bot error', err);
    await escalate(c, input, `Bot error: ${err.message}`);
  }
  saveConversation(c);
}

// ---------- Menu ----------

async function welcome(c, input) {
  c.data.name = c.data.name || input.profileName || null;
  const hi = firstName(c.data.name);
  c.state = 'menu';
  await ask(c, {
    text:
      `Hi${hi ? ' ' + hi : ''}! 👋 Welcome to *${config.businessName}* in Los Cabos.\n\n` +
      `🎣 Book a *fishing charter* with trusted local captains\n` +
      `🏖️ Rent *beach & baby gear* delivered to your villa\n\n` +
      `What can I help you with?`,
  }, MENU_OPTIONS);
}

const MENU_OPTIONS = [
  { id: 'fish', title: '🎣 Fishing trip' },
  { id: 'rent', title: '🏖️ Beach/baby rental' },
  { id: 'human', title: '🙋 Talk to a person' },
];

async function showMenu(c) {
  c.state = 'menu';
  c.data = { name: c.data.name };
  await ask(c, { text: 'What would you like to do?' }, MENU_OPTIONS);
}

async function showMyBookings(c) {
  const list = upcomingForPhone(c.phone);
  if (!list.length) await say(c, "You don't have any upcoming bookings yet. Type *menu* to book one!");
  else await say(c, list.map(bookingSummary).join('\n\n') + '\n\nNeed to change something? Type *human*.');
}

async function escalate(c, input, reason) {
  c.human_mode = 1;
  await say(c, "I'm connecting you with our team 🙋 Someone will reply here shortly (usually within a few minutes, 7 AM–9 PM Cabo time).");
  await sendMessage(config.ownerPhone, {
    text:
      `🙋 HUMAN NEEDED — +${c.phone}${input.profileName ? ` (${input.profileName})` : ''}\n` +
      `Reason: ${reason}\nStep: ${c.state}\nLast message: "${input.text}"\n\n` +
      `Reply with: REPLY ${c.phone} your message\nHand back to bot: BOT ${c.phone}`,
  }, { notification: true });
}

// ---------- States ----------

const STATES = {
  new: welcome,

  async menu(c, input) {
    const choice = pick(c, input) || (/fish|boat|charter|marlin|tuna|dorado/.test(input.text.toLowerCase()) ? 'fish'
      : /rent|beach|umbrella|chair|cooler|stroller|crib|baby|car seat/.test(input.text.toLowerCase()) ? 'rent' : null);
    if (choice === 'fish') return startFishing(c);
    if (choice === 'rent') return startRental(c);
    return welcome(c, input);
  },

  // ----- Fishing -----

  async fish_date(c, input) {
    const date = readFutureDate(input.text);
    if (date.error) return say(c, date.error);
    c.data.date = date.value;
    c.state = 'fish_guests';
    await say(c, `${formatDate(date.value)} 👍 How many people will be fishing (including kids)?`);
  },

  async fish_guests(c, input) {
    const n = parseInt(input.text, 10);
    if (!(n >= 1 && n <= 30)) return say(c, 'Please send the number of guests, for example *4*.');
    c.data.guests = n;
    c.state = 'fish_hours';
    await ask(c, {
      text: `How long would you like to fish?\n\n• *4 hours* — great for first-timers and families\n• *6 hours* — more time to find the big ones\n• *8 hours* — full day, best for marlin & tuna`,
    }, [
      { id: 'h4', title: '4 hours' },
      { id: 'h6', title: '6 hours' },
      { id: 'h8', title: '8 hours (full day)' },
    ]);
  },

  async fish_hours(c, input) {
    const id = pick(c, input) || ({ 4: 'h4', 6: 'h6', 8: 'h8' })[parseInt(input.text, 10)];
    if (!id) return say(c, 'Please choose *4*, *6* or *8* hours.');
    c.data.hours = Number(id.slice(1));
    return showBoats(c);
  },

  async fish_boat(c, input) {
    const id = pick(c, input);
    if (id === 'otherdate') { c.state = 'fish_date'; return say(c, 'Sure! What other date works for you?'); }
    if (id === 'otherhours') { c.state = 'fish_guests'; return STATES.fish_guests(c, { text: String(c.data.guests) }); }
    if (!id?.startsWith('boat')) return say(c, 'Please pick one of the boats from the list (or type the number).');
    c.data.boatId = Number(id.slice(4));
    return askName(c, 'fish_confirm');
  },

  async ask_name(c, input) {
    const id = pick(c, input);
    const name = id === 'usename' ? c.data.name : input.text.trim();
    if (!name || name.length < 2 || name.length > 60) return say(c, 'Please send the full name for the reservation.');
    c.data.name = name;
    c.state = c.data.after_name;
    return c.state === 'fish_confirm' ? showFishingSummary(c) : showRentalSummary(c);
  },

  async fish_confirm(c, input) {
    const id = pick(c, input);
    if (id === 'change') return startFishing(c);
    if (id !== 'pay') return say(c, 'Tap *Confirm & pay* to lock the boat, or *Change* to edit.');
    const b = createFishingHold({
      phone: c.phone, name: c.data.name, source: c.source,
      date: c.data.date, hours: c.data.hours, guests: c.data.guests, boatId: c.data.boatId,
    });
    if (!b) {
      await say(c, 'Oh no, someone just booked that boat 😕 Here is what is still available:');
      return showBoats(c);
    }
    return sendPaymentLink(c, b, `Fishing charter ${b.code} – deposit`);
  },

  // ----- Rentals -----

  async rent_start(c, input) {
    const date = readFutureDate(input.text);
    if (date.error) return say(c, date.error);
    c.data.start = date.value;
    c.state = 'rent_days';
    await say(c, `Starting ${formatDate(date.value)} 👍 For how many days do you need the gear?`);
  },

  async rent_days(c, input) {
    const n = parseInt(input.text, 10);
    if (!(n >= 1 && n <= 30)) return say(c, 'Please send the number of days, for example *5*.');
    c.data.end = addDays(c.data.start, n - 1);
    c.data.cart = [];
    return showItems(c);
  },

  async rent_items(c, input) {
    const id = pick(c, input);
    if (id === 'checkout') {
      if (!c.data.cart.length) return showItems(c);
      c.state = 'rent_address';
      return say(c, '🚚 Where should we deliver? Send the villa/Airbnb name and address, or share your location 📍.');
    }
    if (!id?.startsWith('item')) return say(c, 'Please pick an item from the list (or type its number).');
    const itemId = Number(id.slice(4));
    const free = itemAvailability(itemId, c.data.start, c.data.end) - (c.data.cart.find((x) => x.itemId === itemId)?.qty || 0);
    const item = rentalItems().find((i) => i.id === itemId);
    if (free <= 0) {
      await say(c, `Sorry, *${item.name}* is fully booked for those dates.`);
      return showItems(c);
    }
    c.data.pendingItem = itemId;
    c.data.pendingMax = free;
    c.state = 'rent_qty';
    const opts = [1, 2, 3].filter((n) => n <= free).map((n) => ({ id: `q${n}`, title: String(n) }));
    await ask(c, { text: `How many *${item.name}*? (${free} available${free > 3 ? ' — you can also type a number' : ''})` }, opts);
  },

  async rent_qty(c, input) {
    const id = pick(c, input);
    const n = id ? Number(id.slice(1)) : parseInt(input.text, 10);
    if (!(n >= 1 && n <= c.data.pendingMax)) return say(c, `Please send a number from 1 to ${c.data.pendingMax}.`);
    const line = c.data.cart.find((x) => x.itemId === c.data.pendingItem);
    if (line) line.qty += n;
    else c.data.cart.push({ itemId: c.data.pendingItem, qty: n });
    delete c.data.pendingItem;
    delete c.data.pendingMax;
    return showItems(c);
  },

  async rent_address(c, input) {
    const addr = input.text.trim();
    if (addr.length < 6) return say(c, 'Please send the full delivery address (villa/Airbnb name, street, area), or share your location 📍.');
    c.data.address = addr.slice(0, 300);
    return askName(c, 'rent_confirm');
  },

  async rent_confirm(c, input) {
    const id = pick(c, input);
    if (id === 'change') return startRental(c);
    if (id !== 'pay') return say(c, 'Tap *Confirm & pay* to reserve the gear, or *Change* to edit.');
    const b = createRentalHold({
      phone: c.phone, name: c.data.name, source: c.source,
      start: c.data.start, end: c.data.end, items: c.data.cart, address: c.data.address,
    });
    if (!b) {
      await say(c, 'Sorry, one of the items just got booked by someone else 😕 Let\'s pick again.');
      c.data.cart = [];
      return showItems(c);
    }
    return sendPaymentLink(c, b, `Beach & baby rental ${b.code}`);
  },

  // ----- After the payment link -----

  async awaiting_payment(c, input) {
    const b = getBooking(c.data.code);
    if (!b || b.status !== 'pending_payment') {
      if (b?.status === 'confirmed') return say(c, `Your booking ${b.code} is confirmed ✅ Type *my bookings* to see it or *menu* for something else.`);
      await say(c, 'That payment link has expired.');
      return showMenu(c);
    }
    const id = pick(c, input);
    if (id === 'resend') return say(c, `Here's your payment link again: ${c.data.payUrl}`);
    if (id === 'cancelhold' || /^(cancel|stop)$/i.test(input.text.trim())) {
      setStatus(b.code, 'cancelled');
      await say(c, 'Reservation cancelled — nothing was charged.');
      return showMenu(c);
    }
    if (id === 'menu') return showMenu(c);
    await ask(c, {
      text: `Your reservation ${b.code} is waiting for payment. Once you pay, you'll get the confirmation here automatically.`,
    }, [
      { id: 'resend', title: 'Send link again' },
      { id: 'cancelhold', title: 'Cancel reservation' },
      { id: 'human', title: 'Talk to a person' },
    ]);
  },
};

// ---------- Flow steps ----------

function readFutureDate(text) {
  const date = parseDate(text);
  const today = caboToday();
  if (!date) return { error: 'Sorry, I didn\'t get the date 🙈 Try something like *tomorrow*, *Nov 14* or *11/14*.' };
  if (date < today) return { error: 'That date has already passed. Which upcoming date works for you?' };
  if (date === today) return { error: 'For same-day bookings please type *human* and our team will check what we can do. Or send another date.' };
  if (date > addDays(today, MAX_DAYS_AHEAD)) return { error: `We take bookings up to ${MAX_DAYS_AHEAD} days ahead. Please pick an earlier date.` };
  return { value: date };
}

async function startFishing(c) {
  c.state = 'fish_date';
  c.data = { name: c.data.name };
  await say(c, '🎣 Awesome! What date would you like to go fishing? (e.g. *tomorrow*, *Nov 14*)');
}

async function showBoats(c) {
  const { date, hours, guests } = c.data;
  const boats = availableBoats(date, hours, guests).slice(0, 8);
  c.state = 'fish_boat';
  if (!boats.length) {
    return ask(c, {
      text: `😕 No boats available on ${formatDate(date)} for ${guests} guests (${hours}h). Want to try something else?`,
    }, [
      { id: 'otherdate', title: 'Another date' },
      { id: 'otherhours', title: 'Another duration' },
      { id: 'human', title: 'Talk to a person' },
    ]);
  }
  const rows = boats.map((b) => ({
    id: `boat${b.id}`,
    title: `${b.name}${b.length_ft ? ` ${b.length_ft}ft` : ''}`,
    description: `${usd(b.price)} · up to ${b.max_guests} people · Capt. ${b.captain_name}`,
  }));
  rows.push({ id: 'otherdate', title: 'Another date' });
  const details = boats.map((b, i) => `*${i + 1}. ${b.name}* — ${usd(b.price)}\n${b.description || ''}`.trim()).join('\n\n');
  await ask(c, {
    text:
      `Here are the boats available on *${formatDate(date)}* (${hours}h, departs ${formatTime(TRIP_START[hours])}):\n\n${details}\n\n` +
      `You pay only a ${config.depositPercent}% deposit online to lock it in; the rest is paid in cash to the captain.`,
    listButton: 'Choose a boat',
    listTitle: 'Available boats',
  }, rows);
}

async function askName(c, next) {
  c.data.after_name = next;
  c.state = 'ask_name';
  if (c.data.name) {
    return ask(c, { text: `Who should the reservation be under? Tap below or type another name.` }, [{ id: 'usename', title: c.data.name.slice(0, 20) }]);
  }
  await say(c, 'What name should the reservation be under?');
}

async function showFishingSummary(c) {
  const { date, hours, guests, boatId } = c.data;
  const boat = availableBoats(date, hours, guests).find((b) => b.id === boatId);
  if (!boat) {
    await say(c, 'Sorry, that boat was just taken 😕');
    return showBoats(c);
  }
  const deposit = Math.ceil((boat.price * config.depositPercent) / 100);
  c.state = 'fish_confirm';
  await ask(c, {
    text:
      `Please confirm your trip:\n\n` +
      `🚤 ${boat.name} — Capt. ${boat.captain_name}\n📅 ${formatDate(date)}, ${formatTime(TRIP_START[hours])} (${hours} hours)\n` +
      `👥 ${guests} guests · 🙋 ${c.data.name}\n` +
      (boat.meeting_point ? `📍 ${boat.meeting_point}\n` : '') +
      `\n💵 Total *${usd(boat.price)}*\n• Pay now online: *${usd(deposit)}* (deposit)\n• Pay the captain in cash: *${usd(boat.price - deposit)}*`,
  }, [
    { id: 'pay', title: 'Confirm & pay' },
    { id: 'change', title: 'Change' },
    { id: 'human', title: 'Talk to a person' },
  ]);
}

async function startRental(c) {
  c.state = 'rent_start';
  c.data = { name: c.data.name };
  await say(c, '🏖️ Great! We deliver beach and baby gear right to your villa or Airbnb. What date should the rental start? (e.g. *tomorrow*, *Nov 14*)');
}

async function showItems(c) {
  c.state = 'rent_items';
  const days = Math.round((Date.parse(c.data.end) - Date.parse(c.data.start)) / 864e5) + 1;
  const rows = rentalItems()
    .filter((i) => itemAvailability(i.id, c.data.start, c.data.end) > (c.data.cart.find((x) => x.itemId === i.id)?.qty || 0))
    .slice(0, c.data.cart.length ? 9 : 10)
    .map((i) => ({ id: `item${i.id}`, title: i.name, description: `${usd(i.price_per_day)}/day · ${i.category === 'baby' ? '👶 Baby' : '🏖️ Beach'}` }));
  let text;
  if (c.data.cart.length) {
    const q = rentalQuote(c.data.cart, c.data.start, c.data.end);
    text = `🛒 Your cart (${days} day${days > 1 ? 's' : ''}):\n` +
      q.lines.map((l) => `• ${l.qty} × ${l.item.name} — ${usd(l.subtotal)}`).join('\n') +
      `\n\nAdd more items, or tap *Done – checkout*.`;
    rows.unshift({ id: 'checkout', title: '✅ Done – checkout', description: 'Continue to delivery details' });
  } else {
    text = `What would you like to rent from ${formatDate(c.data.start)} to ${formatDate(c.data.end)} (${days} day${days > 1 ? 's' : ''})? Pick one item at a time.`;
  }
  if (!rows.length) return ask(c, { text: 'Sorry, everything is booked for those dates 😕' }, [{ id: 'menu', title: 'Main menu' }, { id: 'human', title: 'Talk to a person' }]);
  await ask(c, { text, listButton: 'See items', listTitle: 'Rental gear' }, rows);
}

async function showRentalSummary(c) {
  const q = rentalQuote(c.data.cart, c.data.start, c.data.end);
  c.state = 'rent_confirm';
  await ask(c, {
    text:
      `Please confirm your rental:\n\n📅 ${formatDate(c.data.start)} → ${formatDate(c.data.end)} (${q.days} day${q.days > 1 ? 's' : ''})\n` +
      q.lines.map((l) => `• ${l.qty} × ${l.item.name} — ${usd(l.subtotal)}`).join('\n') +
      `\n• Delivery & pickup — ${usd(q.delivery)}\n🚚 ${c.data.address}\n🙋 ${c.data.name}\n\n💵 Total *${usd(q.total)}*, paid online.`,
  }, [
    { id: 'pay', title: 'Confirm & pay' },
    { id: 'change', title: 'Change' },
    { id: 'human', title: 'Talk to a person' },
  ]);
}

async function sendPaymentLink(c, b, description) {
  const { url, ref } = await createCheckout(b, description);
  setPaymentRef(b.code, ref);
  c.state = 'awaiting_payment';
  c.data = { name: c.data.name, code: b.code, payUrl: url };
  const what = b.kind === 'fishing'
    ? `your *${usd(b.paid_online)} deposit* to lock the boat. The remaining ${usd(b.balance_cash)} is paid in cash to the captain on the day.`
    : `*${usd(b.paid_online)}* to reserve your gear.`;
  await say(c, `💳 Pay ${what}\n\n👉 ${url}\n\nWe're holding it for you for ${config.holdMinutes} minutes. You'll get your confirmation here right after paying.`);
}
