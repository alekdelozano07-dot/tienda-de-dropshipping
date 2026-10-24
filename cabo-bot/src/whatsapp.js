import crypto from 'node:crypto';
import { config, devMode } from './config.js';
import { getDb } from './db.js';

// In local test mode outgoing messages are kept here (the /dev/chat page reads them).
export const outbox = [];

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

// message: { text } | { text, buttons: [{id,title}] } | { text, list: { button, rows: [{id,title,description}] } }
export function toCloudPayload(to, message) {
  if (message.buttons?.length) {
    return {
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: clip(message.text, 1024) },
        action: {
          buttons: message.buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id, title: clip(b.title, 20) } })),
        },
      },
    };
  }
  if (message.list?.rows?.length) {
    return {
      messaging_product: 'whatsapp', to, type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: clip(message.text, 4096) },
        action: {
          button: clip(message.list.button || 'Choose', 20),
          sections: [{
            title: clip(message.list.title || 'Options', 24),
            rows: message.list.rows.slice(0, 10).map((r) => ({
              id: r.id, title: clip(r.title, 24), ...(r.description ? { description: clip(r.description, 72) } : {}),
            })),
          }],
        },
      },
    };
  }
  return { messaging_product: 'whatsapp', to, type: 'text', text: { body: clip(message.text, 4096), preview_url: true } };
}

// Plain-text rendering, used for logs, the dev chat, and as fallback.
export function renderText(message) {
  let out = message.text;
  if (message.buttons?.length) out += '\n' + message.buttons.map((b) => `[ ${b.title} ]`).join('  ');
  if (message.list?.rows?.length) {
    out += '\n' + message.list.rows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ' — ' + r.description : ''}`).join('\n');
  }
  return out;
}

// WhatsApp only allows free-form messages within 24h of the person's last message.
// Captain alerts and reminders can fall outside that window, so they are sent as an
// approved template (one body variable {{1}}) when WHATSAPP_NOTIFY_TEMPLATE is set.
function templatePayload(to, message) {
  const text = renderText(message).replace(/\s*\n+\s*/g, ' · ').replace(/ {4,}/g, ' ');
  return {
    messaging_product: 'whatsapp', to, type: 'template',
    template: {
      name: config.whatsapp.notifyTemplate,
      language: { code: config.whatsapp.notifyTemplateLang },
      components: [{ type: 'body', parameters: [{ type: 'text', text: clip(text, 1000) }] }],
    },
  };
}

export async function sendMessage(to, message, { notification = false } = {}) {
  if (typeof message === 'string') message = { text: message };
  if (!to) return;
  getDb().prepare('INSERT INTO messages_log (phone, direction, body) VALUES (?, ?, ?)').run(to, 'out', renderText(message));

  if (devMode.whatsapp) {
    outbox.push({ to, message, at: new Date().toISOString() });
    if (outbox.length > 500) outbox.shift();
    if (process.env.NODE_ENV !== 'test') console.log(`\n→ WhatsApp to ${to}:\n${renderText(message)}\n`);
    return;
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${config.whatsapp.phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.whatsapp.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(
      notification && config.whatsapp.notifyTemplate ? templatePayload(to, message) : toCloudPayload(to, message),
    ),
  });
  if (!res.ok) console.error(`WhatsApp send to ${to} failed: ${res.status} ${await res.text()}`);
}

// Turns a Cloud API webhook body into [{ id, from, name, text, replyId }]
export function parseWebhook(body) {
  const out = [];
  for (const entry of body?.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const names = Object.fromEntries((value.contacts || []).map((c) => [c.wa_id, c.profile?.name]));
      for (const m of value.messages || []) {
        const msg = { id: m.id, from: m.from, name: names[m.from] || null, text: '', replyId: null };
        if (m.type === 'text') msg.text = m.text.body;
        else if (m.type === 'interactive') {
          const r = m.interactive.button_reply || m.interactive.list_reply;
          msg.replyId = r?.id || null;
          msg.text = r?.title || '';
        } else if (m.type === 'button') msg.text = m.button.text;
        else if (m.type === 'location') msg.text = `📍 ${m.location.name || ''} ${m.location.address || ''} (${m.location.latitude},${m.location.longitude})`.trim();
        else msg.text = `[${m.type}]`;
        out.push(msg);
      }
    }
  }
  return out;
}

export function verifySignature(rawBody, signatureHeader) {
  if (!config.whatsapp.appSecret) return true;
  if (!signatureHeader) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
