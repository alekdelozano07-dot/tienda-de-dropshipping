// All user-facing text, in English and Spanish. Each person (tourist, captain, owner) has a language.
export const LANGS = ['en', 'es'];

export const usd = (n) => `$${Number(n).toLocaleString('en-US')} USD`;
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function fmtDate(date, lang = 'en') {
  const d = new Date(date + 'T00:00:00Z');
  return d.toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function fmtTime(time, lang = 'en') {
  const [h, m] = time.split(':').map(Number);
  const suffix = lang === 'es' ? (h < 12 ? 'a.m.' : 'p.m.') : (h < 12 ? 'AM' : 'PM');
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`;
}

const strip = (s) => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// The language a message is clearly written in, or null when it can't tell (a number, an emoji...).
export function guessLang(text) {
  const t = strip(text);
  if (/[¿¡ñ]/.test(String(text).toLowerCase())) return 'es';
  if (/\b(hola|buen[oa]s?|quiero|quisiera|pesca|pescar|renta|rentar|gracias|por favor|cuanto|precio|barco|lancha|playa|reserva[r]?|informacion|necesito|tienen|espanol|me interesa|disponible|masaje)\b/.test(t)) return 'es';
  if (/\b(hi|hello|hey|good (morning|afternoon|evening)|i'?d like|i want|fishing|rental|rent|boat|beach|book|price|english|please|thanks|massage)\b/.test(t)) return 'en';
  return null;
}

// Guess the language of a first message. Falls back to Spanish for Mexican numbers, English otherwise.
export function detectLang(text, phone = '') {
  return guessLang(text) || (String(phone).startsWith('52') ? 'es' : 'en');
}

// "español" / "english" typed at any time switches the language.
export function langSwitch(text) {
  const t = strip(text).trim();
  if (/^(espanol|spanish|en espanol|castellano)$/.test(t)) return 'es';
  if (/^(english|ingles|en ingles)$/.test(t)) return 'en';
  return null;
}

export const itemName = (item, lang) => (lang === 'es' && item.name_es) || item.name;
export const boatDescription = (boat, lang) => (lang === 'es' && boat.description_es) || boat.description || '';

const en = {
  // ----- Tourist -----
  welcome: (hi, biz) =>
    `Hi${hi ? ' ' + hi : ''}! 👋 Welcome to *${biz}* in Los Cabos.\n\n` +
    `🎣 Book a *fishing charter* with trusted local captains\n` +
    `🛶 Rent *paddleboards & kayaks* delivered to your villa\n` +
    `💆 Book a *massage at your villa* with a professional therapist\n\n` +
    `What can I help you with?\n\n🇲🇽 _Escribe *español* para cambiar de idioma._`,
  menuFish: '🎣 Fishing trip',
  menuRent: '🛶 Paddleboard & kayak',
  menuMassage: '💆 Massage at your villa',
  talkToPerson: '🙋 Talk to a person',
  whatToDo: 'What would you like to do?',
  noBookings: "You don't have any upcoming bookings yet. Type *menu* to book one!",
  bookingsFooter: 'Need to change something? Type *human*.',
  connecting: "I'm connecting you with our team 🙋 Someone will reply here shortly (usually within a few minutes, 7 AM–9 PM Cabo time).",
  cleared: 'No problem, I cleared that. Type *menu* anytime to start again.',
  seeOptions: 'See options',
  options: 'Options',

  dateNotUnderstood: "Sorry, I didn't get the date 🙈 Try something like *tomorrow*, *Nov 14* or *11/14*.",
  datePassed: 'That date has already passed. Which upcoming date works for you?',
  dateToday: 'For same-day bookings please type *human* and our team will check what we can do. Or send another date.',
  dateTooFar: (n) => `We take bookings up to ${n} days ahead. Please pick an earlier date.`,

  fishStart: '🎣 Awesome! What date would you like to go fishing? (e.g. *tomorrow*, *Nov 14*)',
  askGuests: (date) => `${date} 👍 How many people will be fishing (including kids)?`,
  guestsInvalid: 'Please send the number of guests, for example *4*.',
  askHours:
    'How long would you like to fish?\n\n• *4 hours* — great for first-timers and families\n' +
    '• *6 hours* — more time to find the big ones\n• *8 hours* — full day, best for marlin & tuna',
  h4: '4 hours', h6: '6 hours', h8: '8 hours (full day)',
  hoursInvalid: 'Please choose *4*, *6* or *8* hours.',
  otherDatePrompt: 'Sure! What other date works for you?',
  pickBoat: 'Please pick one of the boats from the list (or type the number).',
  askStyle: 'What kind of day are you looking for? I\'ll recommend the best boat for you.',
  style_fishing: '🎣 Serious fishing',
  style_family: '👪 Family fun',
  style_relaxed: '🍹 Relaxed day',
  pickStyle: 'Please pick one of the options, or type *fishing*, *family* or *relaxed*.',
  ourPick: (boat, why) => `⭐ *Our pick for you: ${boat}* — ${why}`,
  why_fishing: 'built for serious fishing: marlin, tuna & dorado.',
  why_family: 'comfortable and safe for the whole family.',
  why_relaxed: 'perfect for an easy, laid-back day on the water.',
  tag_popular: '⭐ Most popular',
  tag_value: '💰 Best value',
  tag_premium: '👑 Premium',
  tag_family: '👨‍👩‍👧 Great for families',
  upsellHours: (hours, extra) => `💡 Make it *${hours} hours* for just +${extra} — more time to find the big ones!`,
  upgradeButton: (hours) => `⏫ Make it ${hours}h`,
  bookMassage: '💆 Book a massage',
  crossSellMassage: '💆 After a day at sea, how about a massage at your villa? Tap below to book one.',
  offerJackets: '🦺 Add life jackets? We recommend them for everyone on a paddleboard or kayak, especially kids.',
  addJackets: '🦺 Add life jackets',
  noThanks: 'No thanks, continue',
  followUp: (name, what, date) =>
    `Hi${name ? ' ' + name : ''}! 👋 Still thinking about your ${what} on ${date}? It's still available — tap below to book it again.`,
  whatFishing: (boat) => `fishing trip on ${boat}`,
  whatMassage: 'massage at your villa',
  whatRental: 'paddleboard & kayak rental',
  rebook: '🔁 Book it again',
  noBoats: (date, guests, hours) => `😕 No boats available on ${date} for ${plural(guests, 'guest', 'guests')} (${hours}h). Want to try something else?`,
  anotherDate: 'Another date',
  anotherDuration: 'Another duration',
  boatRow: (price, max, captain) => `${price} · up to ${max} people · Capt. ${captain}`,
  boatsAvailable: (date, hours, time, details, pct) =>
    `Here are the boats available on *${date}* (${hours}h, departs ${time}):\n\n${details}\n\n` +
    `You pay only a ${pct}% deposit online to lock it in; the rest is paid in cash to the captain.`,
  chooseBoat: 'Choose a boat',
  availableBoats: 'Available boats',
  askNameDefault: 'Who should the reservation be under? Tap below or type another name.',
  askName: 'What name should the reservation be under?',
  nameInvalid: 'Please send the full name for the reservation.',
  boatJustTaken: 'Sorry, that boat was just taken 😕',
  boatJustTakenList: 'Oh no, someone just booked that boat 😕 Here is what is still available:',
  fishSummary: ({ boat, captain, date, time, hours, guests, name, meeting, total, deposit, cash }) =>
    `Please confirm your trip:\n\n🚤 ${boat} — Capt. ${captain}\n📅 ${date}, ${time} (${hours} hours)\n` +
    `👥 ${plural(guests, 'guest', 'guests')} · 🙋 ${name}\n` + (meeting ? `📍 ${meeting}\n` : '') +
    `\n💵 Total *${total}*\n• Pay now online: *${deposit}* (deposit)\n• Pay the captain in cash: *${cash}*`,
  confirmPay: 'Confirm & pay',
  change: 'Change',
  confirmFishHint: 'Tap *Confirm & pay* to lock the boat, or *Change* to edit.',
  checkingCaptain: (captain) =>
    `🙌 Great choice! I'm checking with Capt. ${captain} that the boat is ready for you. This usually takes a few minutes — you'll get the payment link right here. Nothing to pay yet.`,
  checkingCaptainNight: (captain) =>
    `🙌 Got it! Our captains are out until 7 AM, so Capt. ${captain} will confirm the boat first thing in the morning. You'll get the payment link right here — nothing to pay yet.`,
  waitingCaptain: (captain, code) => `Still waiting for Capt. ${captain} to confirm ${code} ⏳ You'll get the payment link here as soon as they reply.`,
  otherBoat: 'Pick another boat',
  cancelRequest: 'Cancel request',
  requestCancelled: 'Request cancelled — nothing was charged.',
  captainConfirmed: (captain, date) => `✅ Capt. ${captain} confirmed the boat for ${date}!\n\n`,
  captainDeclined: (captain, date) => `😕 Sorry, Capt. ${captain}'s boat is no longer available on ${date}. Here are other great options:`,
  captainTimeout: (captain, date) => `⏳ Capt. ${captain} hasn't confirmed yet, so let's not keep you waiting. Here are other boats available on ${date}:`,

  rentStart: '🛶 Great! We deliver paddleboards and kayaks right to your villa or Airbnb. What date should the rental start? (e.g. *tomorrow*, *Nov 14*)',
  askDays: (date) => `Starting ${date} 👍 For how many days do you need the gear?`,
  daysInvalid: 'Please send the number of days, for example *5*.',
  days: (n) => plural(n, 'day', 'days'),
  itemRow: (price) => `${price}/day`,
  cart: (days, lines) => `🛒 Your cart (${days}):\n${lines}\n\nAdd more items, or tap *Done – checkout*.`,
  doneCheckout: '✅ Done – checkout',
  doneCheckoutDesc: 'Continue to delivery details',
  rentWhat: (start, end, days) => `What would you like to rent from ${start} to ${end} (${days})? Pick one item at a time.`,
  everythingBooked: 'Sorry, everything is booked for those dates 😕',
  mainMenu: 'Main menu',
  seeItems: 'See items',
  rentalGear: 'Rental gear',
  pickItem: 'Please pick an item from the list (or type its number).',
  itemSoldOut: (name) => `Sorry, *${name}* is fully booked for those dates.`,
  askQty: (name, free) => `How many *${name}*? (${free} available${free > 3 ? ' — you can also type a number' : ''})`,
  qtyInvalid: (max) => `Please send a number from 1 to ${max}.`,
  askAddress: '🚚 Where should we deliver? Send the villa/Airbnb name and address, or share your location 📍.',
  addressInvalid: 'Please send the full delivery address (villa/Airbnb name, street, area), or share your location 📍.',
  rentSummary: ({ start, end, days, lines, delivery, address, name, total }) =>
    `Please confirm your rental:\n\n📅 ${start} → ${end} (${days})\n${lines}\n• Delivery & pickup — ${delivery}\n🚚 ${address}\n🙋 ${name}\n\n💵 Total *${total}*, paid online.`,
  confirmRentHint: 'Tap *Confirm & pay* to reserve the gear, or *Change* to edit.',
  itemJustTaken: "Sorry, one of the items just got booked by someone else 😕 Let's pick again.",

  massageStart: '💆 Lovely! A professional therapist comes to your villa or Airbnb and brings everything needed. What date would you like your massage? (e.g. *tomorrow*, *Nov 14*)',
  massagePeople: (date) => `${date} 👍 How many people will get a massage at the same time?`,
  massagePeopleInvalid: (max) => `Please send a number from 1 to ${max}. For a bigger group type *human*.`,
  massageLength: (p60, p90) => `How long should each massage be?\n\n• *60 minutes* — ${p60} per person\n• *90 minutes* — ${p90} per person`,
  m60: '60 minutes', m90: '90 minutes',
  massageLengthInvalid: 'Please choose *60* or *90* minutes.',
  massageTimes: (date) => `What time works best on *${date}*?`,
  chooseTime: 'Choose a time',
  availableTimes: 'Available times',
  pickTime: 'Please pick a time from the list (or type its number).',
  noMassageTimes: (date) => `😕 No therapists are free on ${date} for your group. Want to try another date?`,
  massageAddress: '📍 Where should the therapist go? Send the villa/Airbnb name and address, or share your location 📍.',
  massageSummary: ({ date, time, minutes, people, address, name, total, deposit, cash }) =>
    `Please confirm your massage:\n\n💆 ${plural(people, 'person', 'people')} · ${minutes} minutes\n📅 ${date}, ${time}\n📍 ${address}\n🙋 ${name}\n` +
    `\n💵 Total *${total}*\n• Pay now online: *${deposit}* (deposit)\n• Pay the therapist in cash: *${cash}*`,
  confirmMassageHint: 'Tap *Confirm & pay* to book the therapist, or *Change* to edit.',
  massageJustTaken: 'Sorry, that time was just booked 😕 Here is what is still available:',

  payFishing: (deposit, cash) => `your *${deposit} deposit* to lock the boat. The remaining ${cash} is paid in cash to the captain on the day.`,
  payRental: (total) => `*${total}* to reserve your gear.`,
  payMassage: (deposit, cash) => `your *${deposit} deposit* to book the therapist. The remaining ${cash} is paid in cash to the therapist.`,
  payLink: (what, url, minutes) => `💳 Pay ${what}\n\n👉 ${url}\n\nWe're holding it for you for ${minutes} minutes. You'll get your confirmation here right after paying.`,
  stripeFishing: (code) => `Fishing charter ${code} – deposit`,
  stripeRental: (code) => `Paddleboard & kayak rental ${code}`,
  stripeMassage: (code) => `In-villa massage ${code} – deposit`,
  alreadyConfirmed: (code) => `Your booking ${code} is confirmed ✅ Type *my bookings* to see it or *menu* for something else.`,
  linkExpired: 'That payment link has expired.',
  resendLink: (url) => `Here's your payment link again: ${url}`,
  reservationCancelled: 'Reservation cancelled — nothing was charged.',
  waitingPayment: (code) => `Your reservation ${code} is waiting for payment. Once you pay, you'll get the confirmation here automatically.`,
  resend: 'Send link again',
  cancelReservation: 'Cancel reservation',
  holdExpired: (code) => `⌛ Your reservation ${code} expired because the payment wasn't completed. No worries — type *menu* to book again.`,

  summaryFishing: ({ code, date, time, hours, boat, length, captain, guests, meeting, total, deposit, cash }) => [
    `🎣 *Fishing charter* — ${code}`,
    `📅 ${date}, ${time} (${hours} hours)`,
    `🚤 ${boat}${length ? ` (${length} ft)` : ''} — Capt. ${captain}`,
    `👥 ${plural(guests, 'guest', 'guests')}`,
    meeting ? `📍 Meeting point: ${meeting}` : null,
    `💵 Total ${total} · Deposit online ${deposit} · Cash to captain ${cash}`,
  ],
  summaryRental: ({ code, start, end, items, address, total }) => [
    `🛶 *Paddleboard & kayak rental* — ${code}`, `📅 ${start} → ${end}`, ...items, `🚚 Delivery to: ${address}`, `💵 Total ${total} (paid online)`,
  ],
  summaryMassage: ({ code, date, time, minutes, people, address, total, deposit, cash }) => [
    `💆 *Massage at your villa* — ${code}`,
    `📅 ${date}, ${time} (${minutes} min)`,
    `👥 ${plural(people, 'person', 'people')}`,
    `📍 ${address}`,
    `💵 Total ${total} · Deposit online ${deposit} · Cash to therapist ${cash}`,
  ],
  bookedFishing: (summary, cash) =>
    `✅ You're booked! Payment received.\n\n${summary}\n\nPlease be at the meeting point 15 minutes early. Bring sunscreen, a hat, snacks and *${cash} in cash* for the captain ` +
    `(tips are appreciated but optional). We'll send you a reminder the day before. 🐟`,
  bookedRental: (summary) => `✅ You're all set! Payment received.\n\n${summary}\n\nWe'll message you the day before to agree on a delivery time. Pickup is on the last day. 🛶`,
  bookedMassage: (summary, cash) =>
    `✅ You're booked! Payment received.\n\n${summary}\n\nThe therapist will arrive a few minutes early to set up. Please have *${cash} in cash* ready for the therapist. ` +
    `We'll send you a reminder the day before. 💆`,
  paymentConflict: (code) =>
    `😕 We received your payment for ${code}, but your reservation hold had expired and that spot was taken in the meantime. ` +
    `We'll refund you in full, and someone from our team will contact you shortly to find another option.`,
  reminderFishing: (summary, cash, captain) =>
    `⏰ Reminder: your fishing trip is tomorrow!\n\n${summary}\n\nBe there 15 minutes early and don't forget *${cash} in cash* for Capt. ${captain}. Questions? Just reply here.`,
  thankYouFishing: (captain) => `🐟 Hope you had an amazing day on the water with Capt. ${captain}! Want a paddleboard or kayak for the rest of your stay? Just type *menu*. 🛶`,
  reminderMassage: (summary, cash) =>
    `⏰ Reminder: your massage is tomorrow!\n\n${summary}\n\nDon't forget *${cash} in cash* for the therapist. Questions? Just reply here.`,
  thankYouMassage: '💆 We hope you enjoyed your massage! Want a fishing trip or a paddleboard for the rest of your stay? Just type *menu*. 🛶',
  rentalTomorrow: (code, address) => `🛶 Your rental (${code}) starts tomorrow! What time works best for delivery to ${address}? Just reply with a time.`,
  rentalPickup: (code) => `🔁 Today is the last day of your rental (${code}). We'll come by to pick up the gear — what time works for you? Want to keep it longer? Type *human*.`,
  cancelledByOffice: (code) => `Your booking ${code} has been cancelled. If you paid online, your refund is on its way. Questions? Just reply here.`,
  botBack: 'Thanks for your patience! 🙌 Type *menu* anytime to book a fishing trip or rentals.',
  languageSet: '🇺🇸 Great, we\'ll continue in English.',

  // ----- Captain -----
  capRequest: ({ code, boat, date, time, hours, guests, total, deposit, cash, deadline }) =>
    `🎣 NEW REQUEST — ${code}\nIs *${boat}* free on *${date}*, ${time} for ${hours}h, ${plural(guests, 'guest', 'guests')}?\n` +
    `Price: ${total} (client pays ${deposit} deposit online, you collect ${cash} cash)\n\n` +
    `Reply *YES ${code}* or *NO ${code}* ${deadline}.`,
  capWithin: (min) => `within ${min} min`,
  capByMorning: 'by 7:15 AM',
  capYes: '✅ YES, available',
  capNo: '❌ NO, busy',
  capConfirmed: ({ code, date, time, hours, boat, client, phone, guests, cash }) =>
    `🚤 NEW TRIP CONFIRMED — ${code}\nDate: ${date} ${time} (${hours}h)\nBoat: ${boat}\nClient: ${client} (+${phone}), ${plural(guests, 'guest', 'guests')}\n` +
    `Collect in cash: ${cash}\nReply BLOCK YYYY-MM-DD to close a date, TRIPS to see your upcoming trips.`,
  capReminder: ({ code, time, boat, guests, client, phone, cash }) =>
    `⏰ Trip tomorrow: ${code}, ${time}, ${boat}, ${plural(guests, 'guest', 'guests')}, client ${client} (+${phone}). Collect ${cash}.`,
  capCancelledByClient: (code, date) => `❌ Request ${code} (${date}) was cancelled by the client. No action needed.`,
  capTripCancelled: (code, date) => `❌ Trip ${code} on ${date} was CANCELLED. The date is free again.`,
  capTimeout: (code, date) => `⌛ Request ${code} (${date}) expired without an answer, so we offered the client other boats.`,
  capMultiple: (n, list) => `You have ${n} open requests. Please reply with the code:\n${list}`,
  capMultipleLine: (code, date, boat) => `• ${code}: ${date} ${boat} — YES ${code} / NO ${code}`,
  capNotOpen: (code) => `Request ${code} is no longer open.`,
  capNotFound: (code) => `I couldn't find request ${code}.`,
  capThanksYes: "👍 Thanks! We sent the payment link to the client. You'll get the final confirmation when they pay.",
  capDeclined: (date, boat, iso) => `OK, ${date} is now closed for ${boat}. Send UNBLOCK ${iso} if it frees up.`,
  capHelp:
    'Captain commands:\n• *YES CB1234* / *NO CB1234* — answer a trip request\n• *TRIPS* — your upcoming trips\n' +
    '• *BLOCK 2026-11-20* — close a date (all your boats)\n• *UNBLOCK 2026-11-20* — reopen a date\n• *BLOCKED* — dates you closed\n' +
    '• *ESPAÑOL* — cambiar a español\n\nOther messages are forwarded to the office.',
  capNoTrips: 'No upcoming trips yet.',
  capTripLine: ({ date, time, boat, hours, guests, client, phone, cash, code }) =>
    `${date} ${time} · ${boat} · ${hours}h · ${plural(guests, 'guest', 'guests')} · ${client} +${phone} · cash ${cash} (${code})`,
  capBadDate: (cmd) => `I couldn't read that date. Example: ${cmd} 2026-11-20`,
  capBlockedWithTrips: (date, codes) => `Blocked ${date} for new bookings. ⚠️ You already have confirmed trips that day (${codes}); the office will contact you.`,
  capBlocked: (date) => `✅ ${date} is now closed for new bookings.`,
  capUnblocked: (date) => `✅ ${date} is open again.`,
  capClosedDates: (list) => `Closed dates:\n${list}`,
  capNoClosed: 'You have no closed dates.',

  // ----- Owner -----
  ownForward: (phone, name, text, lang) =>
    `💬 +${phone}${name ? ` (${name})` : ''} [${lang.toUpperCase()}]: ${text}\n\nReply with: REPLY ${phone} your message\nHand back to bot: BOT ${phone}`,
  ownHuman: ({ phone, name, reason, state, text, lang }) =>
    `🙋 HUMAN NEEDED — +${phone}${name ? ` (${name})` : ''}\nLanguage: ${lang === 'es' ? 'Spanish' : 'English'}\nReason: ${reason}\nStep: ${state}\nLast message: "${text}"\n\n` +
    `Reply with: REPLY ${phone} your message\nHand back to bot: BOT ${phone}`,
  reasonAsked: 'Customer asked for a person',
  reasonAI: "The AI couldn't answer from knowledge.md (question, complaint or a person requested)",
  reasonError: (msg) => `Bot error: ${msg}`,
  reasonTooSoon: (date, boat, hours, guests) => `Trip too soon to auto-confirm with the captain (${date}, boat #${boat}, ${hours}h, ${guests} guests)`,
  reasonNoBoats: (captain, declined, code, date, hours, guests) =>
    `Capt. ${captain} ${declined ? 'said NO' : "didn't answer"} for ${code} and no other boats are free (${date}, ${hours}h, ${guests} guests)`,
  ownPaidFishing: (code, deposit, captain, date) => `💰 Fishing booking ${code} paid: deposit ${deposit} (your commission). Capt. ${captain}, ${date}.`,
  ownDelivery: (code, summary, client, phone) => `📦 DELIVERY TASK — ${code}\n${summary}\nClient: ${client} (+${phone})`,
  ownMassage: (code, summary, client, phone) => `💆 MASSAGE BOOKED — ${code}\n${summary}\nClient: ${client} (+${phone})\nPlease assign a therapist.`,
  ownMassageTomorrow: (code, summary, client, phone) => `💆 Massage tomorrow — ${code}\n${summary}\nClient ${client} +${phone}`,
  ownRefund: (code, phone, amount) => `⚠️ REFUND NEEDED — ${code} was paid after its hold expired and the slot is gone. Client +${phone}. Refund ${amount} in Stripe.`,
  ownDeliverTomorrow: (code, summary, client, phone) => `📦 Deliver tomorrow — ${code}\n${summary}\nClient ${client} +${phone}`,
  ownPickup: (code, address, client, phone) => `🔁 PICKUP today — ${code}\n${address}\nClient ${client} +${phone}`,
  ownCaptainBlocked: (captain, date, codes) => `⚠️ Capt. ${captain} blocked ${date} but has confirmed trips: ${codes}. Please follow up.`,
  ownCaptainMsg: (captain, phone, text) => `🚤 Capt. ${captain} (+${phone}): ${text}`,
  ownHelp:
    'Owner commands:\n• *TODAY* / *TOMORROW* — trips & deliveries\n• *REPLY <phone> <message>* — answer a customer\n' +
    '• *BOT <phone>* — hand the chat back to the bot\n• *BOOKING <code>* — booking details\n• *CANCEL <code>* — cancel a booking (refund in Stripe yourself)',
  ownNothing: (date) => `Nothing scheduled for ${date}.`,
  ownPickupTag: '🔁 PICKUP',
  ownReplyUsage: 'Usage: REPLY 5216241234567 your message',
  ownReplySent: (phone) => `Sent to +${phone} ✅ (bot stays paused for this chat — send BOT ${phone} to resume)`,
  ownBotUsage: 'Usage: BOT 5216241234567',
  ownBotResumed: (phone) => `🤖 Bot resumed for +${phone}`,
  ownNotFound: 'Booking not found.',
  ownBookingInfo: (summary, status, client, phone, source, lang) =>
    `${summary}\nStatus: ${status}\nClient: ${client} +${phone} (${lang.toUpperCase()})\nSource: ${source || '-'}`,
  ownCancelled: (code, amount) => `Cancelled ${code}. Remember to refund ${amount} in Stripe if needed.`,
};

const es = {
  // ----- Turista -----
  welcome: (hi, biz) =>
    `¡Hola${hi ? ' ' + hi : ''}! 👋 Te damos la bienvenida a *${biz}* en Los Cabos.\n\n` +
    `🎣 Reserva un *viaje de pesca* con capitanes locales de confianza\n` +
    `🛶 Renta *paddleboards y kayaks* con entrega en tu villa\n` +
    `💆 Reserva un *masaje en tu villa* con un terapeuta profesional\n\n` +
    `¿En qué te puedo ayudar?\n\n🇺🇸 _Type *english* to switch language._`,
  menuFish: '🎣 Viaje de pesca',
  menuRent: '🛶 Renta paddle/kayak',
  menuMassage: '💆 Masaje en tu villa',
  talkToPerson: '🙋 Con una persona',
  whatToDo: '¿Qué te gustaría hacer?',
  noBookings: 'Todavía no tienes reservas próximas. ¡Escribe *menú* para hacer una!',
  bookingsFooter: '¿Necesitas cambiar algo? Escribe *humano*.',
  connecting: 'Te comunico con nuestro equipo 🙋 Alguien te responderá aquí en breve (normalmente en unos minutos, de 7 a.m. a 9 p.m. hora de Cabo).',
  cleared: 'Listo, lo borré. Escribe *menú* cuando quieras para empezar de nuevo.',
  seeOptions: 'Ver opciones',
  options: 'Opciones',

  dateNotUnderstood: 'Perdón, no entendí la fecha 🙈 Prueba con algo como *mañana*, *14 de noviembre* o *14/11*.',
  datePassed: 'Esa fecha ya pasó. ¿Qué fecha próxima te queda bien?',
  dateToday: 'Para reservar el mismo día escribe *humano* y nuestro equipo verá qué se puede hacer. O envía otra fecha.',
  dateTooFar: (n) => `Aceptamos reservas hasta con ${n} días de anticipación. Elige una fecha más cercana.`,

  fishStart: '🎣 ¡Excelente! ¿Qué día te gustaría ir a pescar? (ej. *mañana*, *14 de noviembre*)',
  askGuests: (date) => `${date} 👍 ¿Cuántas personas van a pescar (incluyendo niños)?`,
  guestsInvalid: 'Envía el número de personas, por ejemplo *4*.',
  askHours:
    '¿Cuánto tiempo te gustaría pescar?\n\n• *4 horas* — ideal para principiantes y familias\n' +
    '• *6 horas* — más tiempo para buscar los grandes\n• *8 horas* — día completo, lo mejor para marlín y atún',
  h4: '4 horas', h6: '6 horas', h8: '8 horas (día entero)',
  hoursInvalid: 'Elige *4*, *6* u *8* horas.',
  otherDatePrompt: '¡Claro! ¿Qué otra fecha te queda bien?',
  pickBoat: 'Elige uno de los barcos de la lista (o escribe el número).',
  askStyle: '¿Qué tipo de día buscas? Te recomiendo el mejor barco para ti.',
  style_fishing: '🎣 Pesca en serio',
  style_family: '👪 Plan familiar',
  style_relaxed: '🍹 Día relajado',
  pickStyle: 'Elige una de las opciones, o escribe *pesca*, *familia* o *relajado*.',
  ourPick: (boat, why) => `⭐ *Te recomendamos: ${boat}* — ${why}`,
  why_fishing: 'hecho para pescar en serio: marlín, atún y dorado.',
  why_family: 'cómodo y seguro para toda la familia.',
  why_relaxed: 'perfecto para un día tranquilo en el mar.',
  tag_popular: '⭐ El más popular',
  tag_value: '💰 Mejor precio',
  tag_premium: '👑 Premium',
  tag_family: '👨‍👩‍👧 Ideal para familias',
  upsellHours: (hours, extra) => `💡 Hazlo de *${hours} horas* por solo +${extra}: ¡más tiempo para encontrar los grandes!`,
  upgradeButton: (hours) => `⏫ Que sean ${hours} h`,
  bookMassage: '💆 Reservar masaje',
  crossSellMassage: '💆 Después de un día en el mar, ¿qué tal un masaje en tu villa? Toca abajo para reservarlo.',
  offerJackets: '🦺 ¿Agregamos chalecos salvavidas? Los recomendamos para todos en paddleboard o kayak, sobre todo para niños.',
  addJackets: '🦺 Agregar chalecos',
  noThanks: 'No, gracias, seguir',
  followUp: (name, what, date) =>
    `¡Hola${name ? ' ' + name : ''}! 👋 ¿Sigues pensando en tu ${what} del ${date}? Todavía está disponible: toca abajo para reservarlo de nuevo.`,
  whatFishing: (boat) => `viaje de pesca en ${boat}`,
  whatMassage: 'masaje en tu villa',
  whatRental: 'renta de paddleboard y kayak',
  rebook: '🔁 Reservar de nuevo',
  noBoats: (date, guests, hours) => `😕 No hay barcos disponibles el ${date} para ${plural(guests, 'persona', 'personas')} (${hours} h). ¿Quieres probar otra opción?`,
  anotherDate: 'Otra fecha',
  anotherDuration: 'Otra duración',
  boatRow: (price, max, captain) => `${price} · hasta ${max} personas · Cap. ${captain}`,
  boatsAvailable: (date, hours, time, details, pct) =>
    `Estos son los barcos disponibles el *${date}* (${hours} h, salida ${time}):\n\n${details}\n\n` +
    `Solo pagas en línea un anticipo del ${pct}% para apartarlo; el resto se paga en efectivo al capitán.`,
  chooseBoat: 'Elegir barco',
  availableBoats: 'Barcos disponibles',
  askNameDefault: '¿A nombre de quién hacemos la reserva? Toca abajo o escribe otro nombre.',
  askName: '¿A nombre de quién hacemos la reserva?',
  nameInvalid: 'Envía el nombre completo para la reserva.',
  boatJustTaken: 'Perdón, alguien acaba de apartar ese barco 😕',
  boatJustTakenList: 'Ay, alguien acaba de reservar ese barco 😕 Esto es lo que sigue disponible:',
  fishSummary: ({ boat, captain, date, time, hours, guests, name, meeting, total, deposit, cash }) =>
    `Confirma tu viaje:\n\n🚤 ${boat} — Cap. ${captain}\n📅 ${date}, ${time} (${hours} horas)\n` +
    `👥 ${plural(guests, 'persona', 'personas')} · 🙋 ${name}\n` + (meeting ? `📍 ${meeting}\n` : '') +
    `\n💵 Total *${total}*\n• Pagas ahora en línea: *${deposit}* (anticipo)\n• Pagas al capitán en efectivo: *${cash}*`,
  confirmPay: 'Confirmar y pagar',
  change: 'Cambiar',
  confirmFishHint: 'Toca *Confirmar y pagar* para apartar el barco, o *Cambiar* para editar.',
  checkingCaptain: (captain) =>
    `🙌 ¡Excelente elección! Estoy confirmando con el Cap. ${captain} que el barco esté listo para ti. Normalmente tarda unos minutos; el link de pago te llegará aquí mismo. Todavía no tienes que pagar nada.`,
  checkingCaptainNight: (captain) =>
    `🙌 ¡Listo! Nuestros capitanes responden a partir de las 7 a.m., así que el Cap. ${captain} confirmará el barco a primera hora. El link de pago te llegará aquí mismo; todavía no tienes que pagar nada.`,
  waitingCaptain: (captain, code) => `Seguimos esperando que el Cap. ${captain} confirme ${code} ⏳ El link de pago te llegará aquí en cuanto responda.`,
  otherBoat: 'Elegir otro barco',
  cancelRequest: 'Cancelar solicitud',
  requestCancelled: 'Solicitud cancelada; no se cobró nada.',
  captainConfirmed: (captain, date) => `✅ ¡El Cap. ${captain} confirmó el barco para el ${date}!\n\n`,
  captainDeclined: (captain, date) => `😕 Lo sentimos, el barco del Cap. ${captain} ya no está disponible el ${date}. Aquí tienes otras opciones:`,
  captainTimeout: (captain, date) => `⏳ El Cap. ${captain} aún no confirma, así que no te hacemos esperar. Estos son otros barcos disponibles el ${date}:`,

  rentStart: '🛶 ¡Genial! Llevamos paddleboards y kayaks a tu villa o Airbnb. ¿Qué día empieza la renta? (ej. *mañana*, *14 de noviembre*)',
  askDays: (date) => `Desde el ${date} 👍 ¿Por cuántos días necesitas el equipo?`,
  daysInvalid: 'Envía el número de días, por ejemplo *5*.',
  days: (n) => plural(n, 'día', 'días'),
  itemRow: (price) => `${price}/día`,
  cart: (days, lines) => `🛒 Tu carrito (${days}):\n${lines}\n\nAgrega más cosas o toca *Listo – pagar*.`,
  doneCheckout: '✅ Listo – pagar',
  doneCheckoutDesc: 'Continuar con los datos de entrega',
  rentWhat: (start, end, days) => `¿Qué te gustaría rentar del ${start} al ${end} (${days})? Elige un artículo a la vez.`,
  everythingBooked: 'Lo sentimos, todo está reservado para esas fechas 😕',
  mainMenu: 'Menú principal',
  seeItems: 'Ver artículos',
  rentalGear: 'Equipo en renta',
  pickItem: 'Elige un artículo de la lista (o escribe su número).',
  itemSoldOut: (name) => `Lo sentimos, *${name}* está agotado para esas fechas.`,
  askQty: (name, free) => `¿Cuántos *${name}*? (${free} disponibles${free > 3 ? '; también puedes escribir un número' : ''})`,
  qtyInvalid: (max) => `Envía un número del 1 al ${max}.`,
  askAddress: '🚚 ¿Dónde lo entregamos? Envía el nombre y la dirección de la villa/Airbnb, o comparte tu ubicación 📍.',
  addressInvalid: 'Envía la dirección completa de entrega (nombre de la villa/Airbnb, calle, zona), o comparte tu ubicación 📍.',
  rentSummary: ({ start, end, days, lines, delivery, address, name, total }) =>
    `Confirma tu renta:\n\n📅 ${start} → ${end} (${days})\n${lines}\n• Entrega y recolección — ${delivery}\n🚚 ${address}\n🙋 ${name}\n\n💵 Total *${total}*, pagado en línea.`,
  confirmRentHint: 'Toca *Confirmar y pagar* para apartar el equipo, o *Cambiar* para editar.',
  itemJustTaken: 'Perdón, alguien acaba de reservar uno de los artículos 😕 Elijamos de nuevo.',

  massageStart: '💆 ¡Qué buena idea! Un terapeuta profesional va a tu villa o Airbnb y lleva todo lo necesario. ¿Qué día te gustaría tu masaje? (ej. *mañana*, *14 de noviembre*)',
  massagePeople: (date) => `${date} 👍 ¿Cuántas personas van a recibir masaje al mismo tiempo?`,
  massagePeopleInvalid: (max) => `Envía un número del 1 al ${max}. Para un grupo más grande escribe *humano*.`,
  massageLength: (p60, p90) => `¿Cuánto tiempo quieres cada masaje?\n\n• *60 minutos* — ${p60} por persona\n• *90 minutos* — ${p90} por persona`,
  m60: '60 minutos', m90: '90 minutos',
  massageLengthInvalid: 'Elige *60* o *90* minutos.',
  massageTimes: (date) => `¿A qué hora te queda mejor el *${date}*?`,
  chooseTime: 'Elegir horario',
  availableTimes: 'Horarios disponibles',
  pickTime: 'Elige un horario de la lista (o escribe su número).',
  noMassageTimes: (date) => `😕 No hay terapeutas libres el ${date} para tu grupo. ¿Quieres probar otra fecha?`,
  massageAddress: '📍 ¿A dónde va el terapeuta? Envía el nombre y la dirección de la villa/Airbnb, o comparte tu ubicación 📍.',
  massageSummary: ({ date, time, minutes, people, address, name, total, deposit, cash }) =>
    `Confirma tu masaje:\n\n💆 ${plural(people, 'persona', 'personas')} · ${minutes} minutos\n📅 ${date}, ${time}\n📍 ${address}\n🙋 ${name}\n` +
    `\n💵 Total *${total}*\n• Pagas ahora en línea: *${deposit}* (anticipo)\n• Pagas al terapeuta en efectivo: *${cash}*`,
  confirmMassageHint: 'Toca *Confirmar y pagar* para apartar al terapeuta, o *Cambiar* para editar.',
  massageJustTaken: 'Perdón, alguien acaba de reservar ese horario 😕 Esto es lo que sigue disponible:',

  payFishing: (deposit, cash) => `tu *anticipo de ${deposit}* para apartar el barco. Los ${cash} restantes se pagan en efectivo al capitán el día del viaje.`,
  payRental: (total) => `*${total}* para apartar tu equipo.`,
  payMassage: (deposit, cash) => `tu *anticipo de ${deposit}* para apartar al terapeuta. Los ${cash} restantes se pagan en efectivo al terapeuta.`,
  payLink: (what, url, minutes) => `💳 Paga ${what}\n\n👉 ${url}\n\nTe lo apartamos ${minutes} minutos. Tu confirmación te llegará aquí justo después de pagar.`,
  stripeFishing: (code) => `Viaje de pesca ${code} – anticipo`,
  stripeRental: (code) => `Renta de paddleboard y kayak ${code}`,
  stripeMassage: (code) => `Masaje en villa ${code} – anticipo`,
  alreadyConfirmed: (code) => `Tu reserva ${code} está confirmada ✅ Escribe *mis reservas* para verla o *menú* para otra cosa.`,
  linkExpired: 'Ese link de pago ya venció.',
  resendLink: (url) => `Aquí está otra vez tu link de pago: ${url}`,
  reservationCancelled: 'Reserva cancelada; no se cobró nada.',
  waitingPayment: (code) => `Tu reserva ${code} está esperando el pago. En cuanto pagues, te llegará la confirmación aquí automáticamente.`,
  resend: 'Enviar link otra vez',
  cancelReservation: 'Cancelar reserva',
  holdExpired: (code) => `⌛ Tu reserva ${code} venció porque no se completó el pago. No te preocupes: escribe *menú* para reservar de nuevo.`,

  summaryFishing: ({ code, date, time, hours, boat, length, captain, guests, meeting, total, deposit, cash }) => [
    `🎣 *Viaje de pesca* — ${code}`,
    `📅 ${date}, ${time} (${hours} horas)`,
    `🚤 ${boat}${length ? ` (${length} pies)` : ''} — Cap. ${captain}`,
    `👥 ${plural(guests, 'persona', 'personas')}`,
    meeting ? `📍 Punto de encuentro: ${meeting}` : null,
    `💵 Total ${total} · Anticipo en línea ${deposit} · Efectivo al capitán ${cash}`,
  ],
  summaryRental: ({ code, start, end, items, address, total }) => [
    `🛶 *Renta de paddleboard y kayak* — ${code}`, `📅 ${start} → ${end}`, ...items, `🚚 Entrega en: ${address}`, `💵 Total ${total} (pagado en línea)`,
  ],
  summaryMassage: ({ code, date, time, minutes, people, address, total, deposit, cash }) => [
    `💆 *Masaje en tu villa* — ${code}`,
    `📅 ${date}, ${time} (${minutes} min)`,
    `👥 ${plural(people, 'persona', 'personas')}`,
    `📍 ${address}`,
    `💵 Total ${total} · Anticipo en línea ${deposit} · Efectivo al terapeuta ${cash}`,
  ],
  bookedFishing: (summary, cash) =>
    `✅ ¡Reserva lista! Recibimos tu pago.\n\n${summary}\n\nLlega al punto de encuentro 15 minutos antes. Lleva bloqueador, gorra, botanas y *${cash} en efectivo* para el capitán ` +
    `(las propinas se agradecen pero son opcionales). Te mandaremos un recordatorio un día antes. 🐟`,
  bookedRental: (summary) => `✅ ¡Todo listo! Recibimos tu pago.\n\n${summary}\n\nTe escribiremos un día antes para acordar la hora de entrega. La recolección es el último día. 🛶`,
  bookedMassage: (summary, cash) =>
    `✅ ¡Reserva lista! Recibimos tu pago.\n\n${summary}\n\nEl terapeuta llegará unos minutos antes para preparar todo. Ten listos *${cash} en efectivo* para el terapeuta. ` +
    `Te mandaremos un recordatorio un día antes. 💆`,
  paymentConflict: (code) =>
    `😕 Recibimos tu pago de ${code}, pero tu apartado había vencido y mientras tanto alguien más tomó ese lugar. ` +
    `Te haremos el reembolso completo y alguien de nuestro equipo te contactará en breve para buscar otra opción.`,
  reminderFishing: (summary, cash, captain) =>
    `⏰ Recordatorio: ¡tu viaje de pesca es mañana!\n\n${summary}\n\nLlega 15 minutos antes y no olvides *${cash} en efectivo* para el Cap. ${captain}. ¿Dudas? Responde aquí.`,
  thankYouFishing: (captain) => `🐟 ¡Esperamos que hayas disfrutado tu día en el mar con el Cap. ${captain}! ¿Quieres un paddleboard o kayak para el resto de tu estancia? Escribe *menú*. 🛶`,
  reminderMassage: (summary, cash) =>
    `⏰ Recordatorio: ¡tu masaje es mañana!\n\n${summary}\n\nNo olvides *${cash} en efectivo* para el terapeuta. ¿Dudas? Responde aquí.`,
  thankYouMassage: '💆 ¡Esperamos que hayas disfrutado tu masaje! ¿Quieres un viaje de pesca o un paddleboard para el resto de tu estancia? Escribe *menú*. 🛶',
  rentalTomorrow: (code, address) => `🛶 ¡Tu renta (${code}) empieza mañana! ¿A qué hora te conviene la entrega en ${address}? Responde con una hora.`,
  rentalPickup: (code) => `🔁 Hoy es el último día de tu renta (${code}). Pasaremos a recoger el equipo; ¿a qué hora te conviene? ¿Quieres quedártelo más días? Escribe *humano*.`,
  cancelledByOffice: (code) => `Tu reserva ${code} fue cancelada. Si pagaste en línea, tu reembolso ya está en camino. ¿Dudas? Responde aquí.`,
  botBack: '¡Gracias por tu paciencia! 🙌 Escribe *menú* cuando quieras para reservar pesca o rentas.',
  languageSet: '🇲🇽 Perfecto, seguimos en español.',

  // ----- Capitán -----
  capRequest: ({ code, boat, date, time, hours, guests, total, deposit, cash, deadline }) =>
    `🎣 NUEVA SOLICITUD — ${code}\n¿Está libre *${boat}* el *${date}*, ${time} por ${hours} h, ${plural(guests, 'persona', 'personas')}?\n` +
    `Precio: ${total} (el cliente paga ${deposit} de anticipo en línea, tú cobras ${cash} en efectivo)\n\n` +
    `Responde *SÍ ${code}* o *NO ${code}* ${deadline}.`,
  capWithin: (min) => `en menos de ${min} min`,
  capByMorning: 'antes de las 7:15 a.m.',
  capYes: '✅ SÍ, disponible',
  capNo: '❌ NO, ocupado',
  capConfirmed: ({ code, date, time, hours, boat, client, phone, guests, cash }) =>
    `🚤 NUEVO VIAJE CONFIRMADO — ${code}\nFecha: ${date} ${time} (${hours} h)\nBarco: ${boat}\nCliente: ${client} (+${phone}), ${plural(guests, 'persona', 'personas')}\n` +
    `Cobrar en efectivo: ${cash}\nResponde BLOQUEAR AAAA-MM-DD para cerrar un día, VIAJES para ver tus próximos viajes.`,
  capReminder: ({ code, time, boat, guests, client, phone, cash }) =>
    `⏰ Viaje mañana: ${code}, ${time}, ${boat}, ${plural(guests, 'persona', 'personas')}, cliente ${client} (+${phone}). Cobrar ${cash}.`,
  capCancelledByClient: (code, date) => `❌ El cliente canceló la solicitud ${code} (${date}). No tienes que hacer nada.`,
  capTripCancelled: (code, date) => `❌ El viaje ${code} del ${date} fue CANCELADO. Ese día vuelve a estar libre.`,
  capTimeout: (code, date) => `⌛ La solicitud ${code} (${date}) venció sin respuesta, así que le ofrecimos otros barcos al cliente.`,
  capMultiple: (n, list) => `Tienes ${n} solicitudes abiertas. Responde con el código:\n${list}`,
  capMultipleLine: (code, date, boat) => `• ${code}: ${date} ${boat} — SÍ ${code} / NO ${code}`,
  capNotOpen: (code) => `La solicitud ${code} ya no está abierta.`,
  capNotFound: (code) => `No encontré la solicitud ${code}.`,
  capThanksYes: '👍 ¡Gracias! Le mandamos el link de pago al cliente. Te llegará la confirmación final cuando pague.',
  capDeclined: (date, boat, iso) => `OK, el ${date} queda cerrado para ${boat}. Manda DESBLOQUEAR ${iso} si se libera.`,
  capHelp:
    'Comandos para capitanes:\n• *SÍ CB1234* / *NO CB1234* — responder una solicitud\n• *VIAJES* — tus próximos viajes\n' +
    '• *BLOQUEAR 2026-11-20* — cerrar un día (todos tus barcos)\n• *DESBLOQUEAR 2026-11-20* — abrir un día\n• *BLOQUEADOS* — días que cerraste\n' +
    '• *ENGLISH* — switch to English\n\nCualquier otro mensaje se reenvía a la oficina.',
  capNoTrips: 'Todavía no tienes viajes próximos.',
  capTripLine: ({ date, time, boat, hours, guests, client, phone, cash, code }) =>
    `${date} ${time} · ${boat} · ${hours} h · ${plural(guests, 'persona', 'personas')} · ${client} +${phone} · efectivo ${cash} (${code})`,
  capBadDate: (cmd) => `No entendí la fecha. Ejemplo: ${cmd} 2026-11-20`,
  capBlockedWithTrips: (date, codes) => `Cerré el ${date} para nuevas reservas. ⚠️ Ya tienes viajes confirmados ese día (${codes}); la oficina te va a contactar.`,
  capBlocked: (date) => `✅ El ${date} queda cerrado para nuevas reservas.`,
  capUnblocked: (date) => `✅ El ${date} vuelve a estar abierto.`,
  capClosedDates: (list) => `Días cerrados:\n${list}`,
  capNoClosed: 'No tienes días cerrados.',

  // ----- Dueño -----
  ownForward: (phone, name, text, lang) =>
    `💬 +${phone}${name ? ` (${name})` : ''} [${lang.toUpperCase()}]: ${text}\n\nResponde con: RESPONDER ${phone} tu mensaje\nDevolver al bot: BOT ${phone}`,
  ownHuman: ({ phone, name, reason, state, text, lang }) =>
    `🙋 SE NECESITA UNA PERSONA — +${phone}${name ? ` (${name})` : ''}\nIdioma: ${lang === 'es' ? 'español' : 'inglés'}\nMotivo: ${reason}\nPaso: ${state}\nÚltimo mensaje: "${text}"\n\n` +
    `Responde con: RESPONDER ${phone} tu mensaje\nDevolver al bot: BOT ${phone}`,
  reasonAsked: 'El cliente pidió hablar con una persona',
  reasonAI: 'La IA no pudo contestar con knowledge.md (pregunta, queja o pidió una persona)',
  reasonError: (msg) => `Error del bot: ${msg}`,
  reasonTooSoon: (date, boat, hours, guests) => `Viaje demasiado pronto para confirmar con el capitán (${date}, barco #${boat}, ${hours} h, ${guests} personas)`,
  reasonNoBoats: (captain, declined, code, date, hours, guests) =>
    `El Cap. ${captain} ${declined ? 'dijo que NO' : 'no contestó'} a ${code} y no hay otros barcos libres (${date}, ${hours} h, ${guests} personas)`,
  ownPaidFishing: (code, deposit, captain, date) => `💰 Reserva de pesca ${code} pagada: anticipo ${deposit} (tu comisión). Cap. ${captain}, ${date}.`,
  ownDelivery: (code, summary, client, phone) => `📦 ENTREGA PENDIENTE — ${code}\n${summary}\nCliente: ${client} (+${phone})`,
  ownMassage: (code, summary, client, phone) => `💆 MASAJE RESERVADO — ${code}\n${summary}\nCliente: ${client} (+${phone})\nAsigna un terapeuta.`,
  ownMassageTomorrow: (code, summary, client, phone) => `💆 Masaje mañana — ${code}\n${summary}\nCliente ${client} +${phone}`,
  ownRefund: (code, phone, amount) => `⚠️ HACER REEMBOLSO — ${code} se pagó después de vencer su apartado y el lugar ya no está. Cliente +${phone}. Reembolsa ${amount} en Stripe.`,
  ownDeliverTomorrow: (code, summary, client, phone) => `📦 Entregar mañana — ${code}\n${summary}\nCliente ${client} +${phone}`,
  ownPickup: (code, address, client, phone) => `🔁 RECOGER hoy — ${code}\n${address}\nCliente ${client} +${phone}`,
  ownCaptainBlocked: (captain, date, codes) => `⚠️ El Cap. ${captain} bloqueó el ${date} pero tiene viajes confirmados: ${codes}. Dale seguimiento.`,
  ownCaptainMsg: (captain, phone, text) => `🚤 Cap. ${captain} (+${phone}): ${text}`,
  ownHelp:
    'Comandos del dueño:\n• *HOY* / *MAÑANA* — viajes, entregas y recolecciones\n• *RESPONDER <teléfono> <mensaje>* — contestar a un cliente\n' +
    '• *BOT <teléfono>* — devolverle el chat al bot\n• *RESERVA <código>* — detalles de una reserva\n• *CANCELAR <código>* — cancelar una reserva (el reembolso lo haces tú en Stripe)',
  ownNothing: (date) => `No hay nada programado para el ${date}.`,
  ownPickupTag: '🔁 RECOGER',
  ownReplyUsage: 'Uso: RESPONDER 5216241234567 tu mensaje',
  ownReplySent: (phone) => `Enviado a +${phone} ✅ (el bot sigue en pausa en este chat; manda BOT ${phone} para reactivarlo)`,
  ownBotUsage: 'Uso: BOT 5216241234567',
  ownBotResumed: (phone) => `🤖 Bot reactivado para +${phone}`,
  ownNotFound: 'No encontré esa reserva.',
  ownBookingInfo: (summary, status, client, phone, source, lang) =>
    `${summary}\nEstado: ${status}\nCliente: ${client} +${phone} (${lang.toUpperCase()})\nOrigen: ${source || '-'}`,
  ownCancelled: (code, amount) => `Cancelé ${code}. Acuérdate de reembolsar ${amount} en Stripe si aplica.`,
};

const DICT = { en, es };

export function t(lang, key, ...args) {
  const entry = (DICT[lang] || en)[key] ?? en[key];
  if (entry === undefined) throw new Error(`Missing translation: ${key}`);
  return typeof entry === 'function' ? entry(...args) : entry;
}
