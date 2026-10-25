import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { config, devMode } from './config.js';
import { getDb } from './db.js';
import { handleIncoming } from './bot.js';
import { outbox, parseWebhook, recordIncoming, verifySignature } from './whatsapp.js';
import { parseStripeEvent } from './payments.js';
import { markPaid } from './bookings.js';
import { onConfirmed, onPaymentConflict } from './notify.js';
import { startScheduler } from './scheduler.js';
import { adminPage, devChatPage, simplePage } from './pages.js';

export async function handlePayment(code) {
  const { booking, outcome } = markPaid(code);
  if (outcome === 'confirmed') await onConfirmed(booking);
  else if (outcome === 'conflict') await onPaymentConflict(booking);
  if (booking && outcome !== 'missing') {
    getDb().prepare(`UPDATE conversations SET state = 'menu', data = json_object('name', json_extract(data, '$.name'))
                     WHERE phone = ? AND state = 'awaiting_payment'`).run(booking.customer_phone);
  }
  return outcome;
}

function alreadyProcessed(id) {
  const r = getDb().prepare('INSERT OR IGNORE INTO processed_events (id) VALUES (?)').run(id);
  return r.changes === 0;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function send(res, status, body, type = 'text/plain; charset=utf-8', headers = {}) {
  res.writeHead(status, { 'Content-Type': type, ...headers });
  res.end(body);
}

function isAdmin(req) {
  const h = req.headers.authorization || '';
  const [user, pass] = Buffer.from(h.replace(/^Basic /, ''), 'base64').toString().split(':');
  return user === 'admin' && pass === config.adminPassword;
}

export async function route(req, res) {
  const url = new URL(req.url, config.publicUrl);
  const path = url.pathname;

  // --- WhatsApp webhook verification (Meta calls this once when you set the webhook) ---
  if (req.method === 'GET' && path === '/webhook') {
    const ok = !!config.whatsapp.verifyToken && url.searchParams.get('hub.mode') === 'subscribe'
      && url.searchParams.get('hub.verify_token') === config.whatsapp.verifyToken;
    return ok ? send(res, 200, url.searchParams.get('hub.challenge')) : send(res, 403, 'Forbidden');
  }

  // --- Incoming WhatsApp messages ---
  if (req.method === 'POST' && path === '/webhook') {
    const raw = await readBody(req);
    if (!verifySignature(raw, req.headers['x-hub-signature-256'])) return send(res, 401, 'Bad signature');
    send(res, 200, 'OK'); // answer Meta right away, then process
    for (const msg of parseWebhook(JSON.parse(raw || '{}'))) {
      if (alreadyProcessed('wa_' + msg.id)) continue;
      await handleIncoming(msg).catch((e) => console.error('handleIncoming failed', e));
    }
    return;
  }

  // --- Stripe webhook ---
  if (req.method === 'POST' && path === '/stripe/webhook') {
    const raw = await readBody(req);
    const event = parseStripeEvent(raw, req.headers['stripe-signature']);
    if (!event) return send(res, 400, 'Bad signature');
    if (!alreadyProcessed('st_' + event.id) && event.type === 'checkout.session.completed') {
      const s = event.data.object;
      if (s.payment_status === 'paid' && s.metadata?.booking_code) await handlePayment(s.metadata.booking_code);
    }
    return send(res, 200, 'OK');
  }

  // --- QR links: /qr/airbnb-casa-azul → opens WhatsApp chat with a prefilled, tagged message ---
  if (req.method === 'GET' && path.startsWith('/qr/')) {
    const source = path.slice(4).replace(/[^\w-]/g, '').slice(0, 40) || 'qr';
    const text = url.searchParams.get('lang') === 'es'
      ? `¡Hola! Quiero reservar un viaje de pesca o rentar equipo de playa (ref: ${source})`
      : `Hi! I'd like to book a fishing trip or beach rentals (ref: ${source})`;
    return send(res, 302, '', 'text/plain', { Location: `https://wa.me/${config.botPhone}?text=${encodeURIComponent(text)}` });
  }

  if (req.method === 'GET' && path === '/paid') {
    return send(res, 200, simplePage('Payment received ✅ / Pago recibido ✅',
      'Thank you! Your confirmation is on its way to your WhatsApp. You can close this page.<br><br>¡Gracias! Tu confirmación va en camino a tu WhatsApp. Ya puedes cerrar esta página.'), 'text/html; charset=utf-8');
  }
  if (req.method === 'GET' && path === '/cancelled') {
    return send(res, 200, simplePage('Payment not completed / Pago no completado',
      'No charge was made. Go back to WhatsApp to try again or ask us anything.<br><br>No se hizo ningún cargo. Regresa a WhatsApp para intentarlo de nuevo o preguntarnos lo que quieras.'), 'text/html; charset=utf-8');
  }

  // --- Admin dashboard ---
  if (req.method === 'GET' && path === '/admin') {
    if (!isAdmin(req)) return send(res, 401, 'Login required', 'text/plain', { 'WWW-Authenticate': 'Basic realm="admin"' });
    return send(res, 200, adminPage(url.searchParams.get('lang') || undefined), 'text/html; charset=utf-8');
  }

  if (req.method === 'GET' && path === '/health') return send(res, 200, 'ok');

  // --- Local test mode only ---
  if (devMode.whatsapp || devMode.stripe) {
    if (req.method === 'GET' && path.startsWith('/dev/pay/')) {
      const code = path.slice(9);
      return send(res, 200, simplePage('Test payment', `<p>This is a fake checkout for booking <b>${code.replace(/\W/g, '')}</b>.</p>
        <form method="post"><button>Pay (test)</button></form>`), 'text/html; charset=utf-8');
    }
    if (req.method === 'POST' && path.startsWith('/dev/pay/')) {
      const outcome = await handlePayment(path.slice(9).replace(/\W/g, ''));
      return send(res, 200, simplePage('Test payment', `Result: <b>${outcome}</b>. Check the chat.`), 'text/html; charset=utf-8');
    }
  }
  if (devMode.whatsapp) {
    if (req.method === 'GET' && path === '/dev/chat') return send(res, 200, devChatPage(getDb()), 'text/html; charset=utf-8');
    if (req.method === 'POST' && path === '/dev/send') {
      const { from, text, replyId, name } = JSON.parse(await readBody(req));
      const phone = String(from).replace(/\D/g, '');
      recordIncoming(phone, text);
      await handleIncoming({ from: phone, text, replyId, name });
      return send(res, 200, '{}', 'application/json');
    }
    if (req.method === 'GET' && path === '/dev/outbox') {
      const since = Number(url.searchParams.get('since') || 0);
      const items = outbox.filter((m) => m.seq > since);
      return send(res, 200, JSON.stringify({ last: outbox.at(-1)?.seq || 0, items }), 'application/json');
    }
  }

  send(res, 404, 'Not found');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  getDb();
  http.createServer((req, res) => route(req, res).catch((e) => {
    console.error(e);
    if (!res.headersSent) send(res, 500, 'Server error');
  })).listen(config.port, () => {
    console.log(`${config.businessName} bot listening on ${config.publicUrl} (port ${config.port})`);
    if (devMode.whatsapp) console.log(`Local test mode: open ${config.publicUrl}/dev/chat to chat with the bot`);
    if (devMode.stripe) console.log('Stripe not configured: payments use a fake test page');
  });
  startScheduler();
}
