import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { TRIP_START } from './dates.js';
import { fmtDate, fmtTime, itemName, t, usd } from './i18n.js';

const owner = config.ownerLang;
const toOwner = (text) => sendMessage(config.ownerPhone, { text }, { notification: true, lang: owner });
const toCaptain = (b, message) => sendMessage(b.captain_phone, message, { notification: true, lang: b.captain_lang });
const toClient = (b, text, notification = false) => sendMessage(b.customer_phone, { text }, { notification, lang: b.lang });

// Booking summary in the reader's language.
export function bookingSummary(b, lang = b.lang) {
  let lines;
  if (b.kind === 'fishing') {
    lines = t(lang, 'summaryFishing', {
      code: b.code, date: fmtDate(b.date, lang), time: fmtTime(TRIP_START[b.hours], lang), hours: b.hours,
      boat: b.boat_name, length: b.length_ft, captain: b.captain_name, guests: b.guests, meeting: b.meeting_point,
      total: usd(b.total), deposit: usd(b.paid_online), cash: usd(b.balance_cash),
    });
  } else if (b.kind === 'massage') {
    lines = t(lang, 'summaryMassage', {
      code: b.code, date: fmtDate(b.date, lang), time: fmtTime(b.start_time, lang), minutes: b.duration_min, people: b.guests,
      address: b.delivery_address, total: usd(b.total), deposit: usd(b.paid_online), cash: usd(b.balance_cash),
    });
  } else {
    lines = t(lang, 'summaryRental', {
      code: b.code, start: fmtDate(b.date, lang), end: fmtDate(b.end_date, lang),
      items: b.items.map((i) => `• ${i.qty} × ${itemName(i, lang)}`), address: b.delivery_address, total: usd(b.total),
    });
  }
  return lines.filter(Boolean).join('\n');
}

function tripFields(b, lang) {
  return {
    code: b.code, boat: b.boat_name, date: fmtDate(b.date, lang), time: fmtTime(TRIP_START[b.hours], lang), hours: b.hours,
    guests: b.guests, client: b.customer_name, phone: b.customer_phone,
    total: usd(b.total), deposit: usd(b.paid_online), cash: usd(b.balance_cash),
  };
}

// Asks the captain to confirm the boat is free before the customer pays.
export async function askCaptain(b) {
  const lang = b.captain_lang;
  const deadline = new Date(b.hold_expires_at.replace(' ', 'T') + 'Z');
  const minutes = Math.max(1, Math.round((deadline - Date.now()) / 60_000));
  await toCaptain(b, {
    text: t(lang, 'capRequest', { ...tripFields(b, lang), deadline: minutes <= 120 ? t(lang, 'capWithin', minutes) : t(lang, 'capByMorning') }),
    buttons: [
      { id: `cap_yes_${b.code}`, title: t(lang, 'capYes') },
      { id: `cap_no_${b.code}`, title: t(lang, 'capNo') },
    ],
  });
}

export async function onConfirmed(b) {
  if (b.kind === 'fishing') {
    // The confirmation also offers a massage for after the trip, one tap away.
    await sendMessage(b.customer_phone, {
      text: `${t(b.lang, 'bookedFishing', bookingSummary(b), usd(b.balance_cash))}\n\n${t(b.lang, 'crossSellMassage')}`,
      buttons: [{ id: 'massage', title: t(b.lang, 'bookMassage') }],
    }, { lang: b.lang });
    await toCaptain(b, { text: t(b.captain_lang, 'capConfirmed', tripFields(b, b.captain_lang)) });
    await toOwner(t(owner, 'ownPaidFishing', b.code, usd(b.paid_online), b.captain_name, fmtDate(b.date, owner)));
  } else if (b.kind === 'massage') {
    await toClient(b, t(b.lang, 'bookedMassage', bookingSummary(b), usd(b.balance_cash)));
    await toOwner(t(owner, 'ownMassage', b.code, bookingSummary(b, owner), b.customer_name, b.customer_phone));
  } else {
    await toClient(b, t(b.lang, 'bookedRental', bookingSummary(b)));
    await toOwner(t(owner, 'ownDelivery', b.code, bookingSummary(b, owner), b.customer_name, b.customer_phone));
  }
}

export async function onPaymentConflict(b) {
  await toClient(b, t(b.lang, 'paymentConflict', b.code));
  await toOwner(t(owner, 'ownRefund', b.code, b.customer_phone, usd(b.paid_online)));
}

// which: 'day_before' (5 PM the day before) | 'wrap_up' (fishing/massage: evening of the day; rental: morning of pickup day)
export async function sendReminder(b, which) {
  if (b.kind === 'massage' && which === 'day_before') {
    await toClient(b, t(b.lang, 'reminderMassage', bookingSummary(b), usd(b.balance_cash)), true);
    await toOwner(t(owner, 'ownMassageTomorrow', b.code, bookingSummary(b, owner), b.customer_name, b.customer_phone));
  } else if (b.kind === 'massage') {
    await toClient(b, t(b.lang, 'thankYouMassage'), true);
  } else if (b.kind === 'fishing' && which === 'day_before') {
    await toClient(b, t(b.lang, 'reminderFishing', bookingSummary(b), usd(b.balance_cash), b.captain_name), true);
    await toCaptain(b, { text: t(b.captain_lang, 'capReminder', tripFields(b, b.captain_lang)) });
  } else if (b.kind === 'fishing') {
    await toClient(b, t(b.lang, 'thankYouFishing', b.captain_name), true);
  } else if (which === 'day_before') {
    await toClient(b, t(b.lang, 'rentalTomorrow', b.code, b.delivery_address), true);
    await toOwner(t(owner, 'ownDeliverTomorrow', b.code, bookingSummary(b, owner), b.customer_name, b.customer_phone));
  } else {
    await toClient(b, t(b.lang, 'rentalPickup', b.code), true);
    await toOwner(t(owner, 'ownPickup', b.code, b.delivery_address, b.customer_name, b.customer_phone));
  }
}

// Follow-up for a booking that expired unpaid: offer it once more with a "Book it again" button.
export async function offerAgain(b) {
  const what = b.kind === 'fishing' ? t(b.lang, 'whatFishing', b.boat_name)
    : b.kind === 'massage' ? t(b.lang, 'whatMassage') : t(b.lang, 'whatRental');
  const name = (b.customer_name || '').split(/\s+/)[0];
  await sendMessage(b.customer_phone, {
    text: t(b.lang, 'followUp', name, what, fmtDate(b.date, b.lang)),
    buttons: [{ id: `rebook_${b.code}`, title: t(b.lang, 'rebook') }],
  }, { lang: b.lang });
}

// Short notices to captains about a request or trip.
export async function tellCaptain(b, key) {
  await toCaptain(b, { text: t(b.captain_lang, key, b.code, fmtDate(b.date, b.captain_lang)) });
}
