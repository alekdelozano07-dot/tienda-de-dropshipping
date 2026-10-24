import { config } from './config.js';
import { sendMessage } from './whatsapp.js';
import { formatDate, formatTime, TRIP_START } from './dates.js';

const usd = (n) => `$${n.toLocaleString('en-US')} USD`;

export function bookingSummary(b) {
  if (b.kind === 'fishing') {
    return [
      `🎣 *Fishing charter* — ${b.code}`,
      `📅 ${formatDate(b.date)}, ${formatTime(TRIP_START[b.hours])} (${b.hours} hours)`,
      `🚤 ${b.boat_name}${b.length_ft ? ` (${b.length_ft} ft)` : ''} — Capt. ${b.captain_name}`,
      `👥 ${b.guests} guest${b.guests > 1 ? 's' : ''}`,
      b.meeting_point ? `📍 Meeting point: ${b.meeting_point}` : null,
      `💵 Total ${usd(b.total)} · Deposit online ${usd(b.paid_online)} · Cash to captain ${usd(b.balance_cash)}`,
    ].filter(Boolean).join('\n');
  }
  return [
    `🏖️ *Beach & baby rental* — ${b.code}`,
    `📅 ${formatDate(b.date)} → ${formatDate(b.end_date)}`,
    ...b.items.map((i) => `• ${i.qty} × ${i.name}`),
    `🚚 Delivery to: ${b.delivery_address}`,
    `💵 Total ${usd(b.total)} (paid online)`,
  ].join('\n');
}

// Asks the captain to confirm the boat is free before the customer pays.
export async function askCaptain(b) {
  const deadline = new Date(b.hold_expires_at.replace(' ', 'T') + 'Z');
  const minutes = Math.max(1, Math.round((deadline - Date.now()) / 60_000));
  await sendMessage(b.captain_phone, {
    text:
      `🎣 NEW REQUEST — ${b.code}\n` +
      `Is *${b.boat_name}* free on *${formatDate(b.date)}*, ${formatTime(TRIP_START[b.hours])} for ${b.hours}h, ${b.guests} guests?\n` +
      `Price: ${usd(b.total)} (client pays ${usd(b.paid_online)} deposit online, you collect ${usd(b.balance_cash)} cash)\n\n` +
      `Reply *YES ${b.code}* or *NO ${b.code}*` + (minutes <= 120 ? ` within ${minutes} min.` : ' by 7:15 AM.'),
    buttons: [
      { id: `cap_yes_${b.code}`, title: '✅ YES, available' },
      { id: `cap_no_${b.code}`, title: '❌ NO, busy' },
    ],
  }, { notification: true });
}

export async function onConfirmed(b) {
  if (b.kind === 'fishing') {
    await sendMessage(b.customer_phone, {
      text:
        `✅ You're booked! Payment received.\n\n${bookingSummary(b)}\n\n` +
        `Please be at the meeting point 15 minutes early. Bring sunscreen, a hat, snacks and *${usd(b.balance_cash)} in cash* for the captain ` +
        `(tips are appreciated but optional). We'll send you a reminder the day before. 🐟`,
    });
    await sendMessage(b.captain_phone, {
      text:
        `🚤 NEW TRIP CONFIRMED — ${b.code}\n` +
        `Date: ${formatDate(b.date)} ${formatTime(TRIP_START[b.hours])} (${b.hours}h)\n` +
        `Boat: ${b.boat_name}\nClient: ${b.customer_name} (+${b.customer_phone}), ${b.guests} guests\n` +
        `Collect in cash: ${usd(b.balance_cash)}\n` +
        `Reply BLOCK YYYY-MM-DD to close a date, TRIPS to see your upcoming trips.`,
    }, { notification: true });
    await sendMessage(config.ownerPhone, {
      text: `💰 Fishing booking ${b.code} paid: deposit ${usd(b.paid_online)} (your commission). Capt. ${b.captain_name}, ${formatDate(b.date)}.`,
    }, { notification: true });
  } else {
    await sendMessage(b.customer_phone, {
      text:
        `✅ You're all set! Payment received.\n\n${bookingSummary(b)}\n\n` +
        `We'll message you the day before to agree on a delivery time. Pickup is on the last day. 🏖️`,
    });
    await sendMessage(config.ownerPhone, {
      text: `📦 DELIVERY TASK — ${b.code}\n${bookingSummary(b)}\nClient: ${b.customer_name} (+${b.customer_phone})`,
    }, { notification: true });
  }
}

export async function onPaymentConflict(b) {
  await sendMessage(b.customer_phone, {
    text:
      `😕 We received your payment for ${b.code}, but your reservation hold had expired and that spot was taken in the meantime. ` +
      `We'll refund you in full, and someone from our team will contact you shortly to find another option.`,
  });
  await sendMessage(config.ownerPhone, {
    text: `⚠️ REFUND NEEDED — ${b.code} was paid after its hold expired and the slot is gone. Client +${b.customer_phone}. Refund ${usd(b.paid_online)} in Stripe.`,
  }, { notification: true });
}

// which: 'day_before' (5 PM the day before) | 'wrap_up' (fishing: evening of the trip; rental: morning of pickup day)
export async function sendReminder(b, which) {
  if (b.kind === 'fishing' && which === 'day_before') {
    await sendMessage(b.customer_phone, {
      text:
        `⏰ Reminder: your fishing trip is tomorrow!\n\n${bookingSummary(b)}\n\n` +
        `Be there 15 minutes early and don't forget *${usd(b.balance_cash)} in cash* for Capt. ${b.captain_name}. Questions? Just reply here.`,
    }, { notification: true });
    await sendMessage(b.captain_phone, {
      text: `⏰ Trip tomorrow: ${b.code}, ${formatTime(TRIP_START[b.hours])}, ${b.boat_name}, ${b.guests} guests, client ${b.customer_name} (+${b.customer_phone}). Collect ${usd(b.balance_cash)}.`,
    }, { notification: true });
  } else if (b.kind === 'fishing') {
    await sendMessage(b.customer_phone, {
      text: `🐟 Hope you had an amazing day on the water with Capt. ${b.captain_name}! Need beach chairs, umbrellas or baby gear for the rest of your stay? Just type *menu*. 🏖️`,
    }, { notification: true });
  } else if (which === 'day_before') {
    await sendMessage(b.customer_phone, {
      text: `🏖️ Your rental (${b.code}) starts tomorrow! What time works best for delivery to ${b.delivery_address}? Just reply with a time.`,
    }, { notification: true });
    await sendMessage(config.ownerPhone, {
      text: `📦 Deliver tomorrow — ${b.code}\n${bookingSummary(b)}\nClient ${b.customer_name} +${b.customer_phone}`,
    }, { notification: true });
  } else {
    await sendMessage(b.customer_phone, {
      text: `🔁 Today is the last day of your rental (${b.code}). We'll come by to pick up the gear — what time works for you? Want to keep it longer? Type *human*.`,
    }, { notification: true });
    await sendMessage(config.ownerPhone, {
      text: `🔁 PICKUP today — ${b.code}\n${b.delivery_address}\nClient ${b.customer_name} +${b.customer_phone}`,
    }, { notification: true });
  }
}
