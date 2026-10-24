import { getDb } from './db.js';
import { config } from './config.js';
import { caboToday } from './dates.js';
import { fmtDate } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STYLE = `
  :root { --bg:#f6f7f9; --card:#fff; --ink:#1b2430; --muted:#667085; --line:#e4e7ec; --accent:#0e7490; }
  @media (prefers-color-scheme: dark) { :root { --bg:#0f1419; --card:#182029; --ink:#e6e9ee; --muted:#98a2b3; --line:#2a3440; --accent:#22d3ee; } }
  * { box-sizing:border-box } body { margin:0; font:15px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--ink) }
  main { max-width:1100px; margin:0 auto; padding:24px 16px } h1 { font-size:22px } h2 { font-size:17px; margin-top:28px }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:12px }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px; padding:14px }
  .card b { display:block; font-size:22px } .muted { color:var(--muted); font-size:13px }
  .scroll { overflow-x:auto } table { width:100%; border-collapse:collapse; background:var(--card); font-size:14px }
  th,td { padding:8px 10px; border-bottom:1px solid var(--line); text-align:left; vertical-align:top; white-space:nowrap }
  .tag { padding:2px 8px; border-radius:99px; font-size:12px; background:var(--line) }
  a { color:var(--accent) } button { font:inherit; padding:10px 18px; border-radius:8px; border:0; background:var(--accent); color:#fff; cursor:pointer }
`;

export function simplePage(title, html) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head><body><main style="max-width:520px;text-align:center;padding-top:15vh">
<h1>${esc(title)}</h1><p>${html}</p></main></body></html>`;
}

const ADMIN_TEXT = {
  en: {
    title: 'admin', commission: 'Commission', rentals: 'Rental revenue', paid: 'Paid bookings', waiting: 'Chats waiting for you',
    waitingTitle: '🙋 Chats waiting for a person', phone: 'Phone', step: 'Step', lastActivity: 'Last activity (UTC)', open: 'Open',
    waitingHelp: 'Answer from your phone with <code>REPLY &lt;phone&gt; message</code> to the bot number, then <code>BOT &lt;phone&gt;</code> to hand back.',
    upcoming: 'Upcoming bookings', date: 'Date', code: 'Code', type: 'Type', details: 'Details', client: 'Client', online: 'Online',
    cash: 'Cash', status: 'Status', source: 'Source', lang: 'Lang', none: 'No upcoming bookings', bySource: 'Bookings by source',
    bookings: 'Bookings', paidOnline: 'Paid online', noData: 'No data yet', qr: 'QR codes',
    qrHelp: (u) => `Print these for Airbnbs, villas, taxis and Instagram. Make one per place to track it: <code>${u}/qr/airbnb-casa-azul</code>. Add <code>?lang=es</code> for a Spanish greeting.`,
    captains: 'Captains', name: 'Name', boats: 'Boats', language: 'Language', other: 'Español',
    statuses: { confirmed: 'confirmed', pending_payment: 'waiting for payment', awaiting_captain: 'waiting for captain' },
    guests: 'pax',
  },
  es: {
    title: 'administración', commission: 'Comisión', rentals: 'Ingresos por rentas', paid: 'Reservas pagadas', waiting: 'Chats esperándote',
    waitingTitle: '🙋 Chats que esperan a una persona', phone: 'Teléfono', step: 'Paso', lastActivity: 'Última actividad (UTC)', open: 'Abrir',
    waitingHelp: 'Contesta desde tu teléfono con <code>RESPONDER &lt;teléfono&gt; mensaje</code> al número del bot, y luego <code>BOT &lt;teléfono&gt;</code> para devolverlo.',
    upcoming: 'Próximas reservas', date: 'Fecha', code: 'Código', type: 'Tipo', details: 'Detalles', client: 'Cliente', online: 'En línea',
    cash: 'Efectivo', status: 'Estado', source: 'Origen', lang: 'Idioma', none: 'No hay reservas próximas', bySource: 'Reservas por origen',
    bookings: 'Reservas', paidOnline: 'Pagado en línea', noData: 'Aún no hay datos', qr: 'Códigos QR',
    qrHelp: (u) => `Imprímelos para Airbnbs, villas, taxis e Instagram. Haz uno por lugar para medirlo: <code>${u}/qr/airbnb-casa-azul</code>. Agrega <code>?lang=es</code> para que el saludo salga en español.`,
    captains: 'Capitanes', name: 'Nombre', boats: 'Barcos', language: 'Idioma', other: 'English',
    statuses: { confirmed: 'confirmada', pending_payment: 'esperando pago', awaiting_captain: 'esperando capitán' },
    guests: 'pers.',
  },
};

export function adminPage(lang = config.ownerLang) {
  const L = ADMIN_TEXT[lang] ? lang : 'es';
  const x = ADMIN_TEXT[L];
  const db = getDb();
  const today = caboToday();
  const month = today.slice(0, 7);
  const stats = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN kind='fishing' THEN paid_online END), 0) AS commission,
      COALESCE(SUM(CASE WHEN kind='rental' THEN paid_online END), 0) AS rentals,
      COUNT(*) AS bookings
    FROM bookings WHERE status IN ('confirmed','completed') AND substr(confirmed_at, 1, 7) = ?
  `).get(month);
  const upcoming = db.prepare(`
    SELECT bk.*, bt.name AS boat_name, c.name AS captain_name FROM bookings bk
    LEFT JOIN boats bt ON bt.id = bk.boat_id LEFT JOIN captains c ON c.id = bt.captain_id
    WHERE bk.status IN ('confirmed','pending_payment','awaiting_captain') AND COALESCE(bk.end_date, bk.date) >= ? ORDER BY bk.date LIMIT 100
  `).all(today);
  const sources = db.prepare(`
    SELECT COALESCE(source, 'direct') AS source, COUNT(*) AS n, SUM(paid_online) AS revenue
    FROM bookings WHERE status IN ('confirmed','completed') GROUP BY 1 ORDER BY revenue DESC
  `).all();
  const human = db.prepare(`SELECT phone, state, updated_at FROM conversations WHERE human_mode = 1 ORDER BY updated_at DESC`).all();
  const captains = db.prepare(`
    SELECT c.name, c.phone, c.lang, GROUP_CONCAT(b.name, ', ') AS boats FROM captains c LEFT JOIN boats b ON b.captain_id = c.id
    WHERE c.active = 1 GROUP BY c.id ORDER BY c.name
  `).all();
  const qrSources = ['airbnb', 'villa', 'taxi', 'instagram'];

  return `<!doctype html><html lang="${L}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.businessName)} ${x.title}</title><style>${STYLE}</style></head><body><main>
<p style="float:right"><a href="?lang=${L === 'es' ? 'en' : 'es'}">${x.other}</a></p>
<h1>${esc(config.businessName)} — ${x.title}</h1>
<div class="cards">
  <div class="card"><span class="muted">${x.commission} (${month})</span><b>$${stats.commission}</b></div>
  <div class="card"><span class="muted">${x.rentals} (${month})</span><b>$${stats.rentals}</b></div>
  <div class="card"><span class="muted">${x.paid} (${month})</span><b>${stats.bookings}</b></div>
  <div class="card"><span class="muted">${x.waiting}</span><b>${human.length}</b></div>
</div>

${human.length ? `<h2>${x.waitingTitle}</h2><div class="scroll"><table><tr><th>${x.phone}</th><th>${x.step}</th><th>${x.lastActivity}</th><th>${x.open}</th></tr>
${human.map((h) => `<tr><td>+${esc(h.phone)}</td><td>${esc(h.state)}</td><td>${esc(h.updated_at)}</td><td><a href="https://wa.me/${esc(h.phone)}">WhatsApp</a></td></tr>`).join('')}
</table></div><p class="muted">${x.waitingHelp}</p>` : ''}

<h2>${x.upcoming}</h2><div class="scroll"><table>
<tr><th>${x.date}</th><th>${x.code}</th><th>${x.type}</th><th>${x.details}</th><th>${x.client}</th><th>${x.online}</th><th>${x.cash}</th><th>${x.status}</th><th>${x.source}</th><th>${x.lang}</th></tr>
${upcoming.map((b) => `<tr><td>${esc(fmtDate(b.date, L))}${b.end_date ? ' → ' + esc(fmtDate(b.end_date, L)) : ''}</td><td>${esc(b.code)}</td>
<td>${b.kind === 'fishing' ? '🎣' : '🏖️'}</td>
<td>${b.kind === 'fishing' ? `${esc(b.boat_name)} · Cap. ${esc(b.captain_name)} · ${b.hours}h · ${b.guests} ${x.guests}` : esc(b.delivery_address)}</td>
<td>${esc(b.customer_name)}<br><span class="muted">+${esc(b.customer_phone)}</span></td><td>$${b.paid_online}</td><td>$${b.balance_cash}</td>
<td><span class="tag">${esc(x.statuses[b.status] || b.status)}</span></td><td>${esc(b.source || 'direct')}</td><td>${esc(b.lang.toUpperCase())}</td></tr>`).join('') || `<tr><td colspan="10" class="muted">${x.none}</td></tr>`}
</table></div>

<h2>${x.bySource}</h2><div class="scroll"><table><tr><th>${x.source}</th><th>${x.bookings}</th><th>${x.paidOnline}</th></tr>
${sources.map((s) => `<tr><td>${esc(s.source)}</td><td>${s.n}</td><td>$${s.revenue}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">${x.noData}</td></tr>`}
</table></div>

<h2>${x.qr}</h2>
<p class="muted">${x.qrHelp(esc(config.publicUrl))}</p>
<div class="cards">${qrSources.map((s) => {
    const link = `${config.publicUrl}/qr/${s}`;
    return `<div class="card" style="text-align:center"><img alt="QR ${esc(s)}" width="150" height="150" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}"><br><b style="font-size:15px">${esc(s)}</b><span class="muted">${esc(link)}</span></div>`;
  }).join('')}</div>

<h2>${x.captains}</h2><div class="scroll"><table><tr><th>${x.name}</th><th>WhatsApp</th><th>${x.boats}</th><th>${x.language}</th></tr>
${captains.map((c) => `<tr><td>${esc(c.name)}</td><td>+${esc(c.phone)}</td><td>${esc(c.boats)}</td><td>${esc(c.lang.toUpperCase())}</td></tr>`).join('')}
</table></div>
</main></body></html>`;
}

export function devChatPage(db) {
  // Quick buttons to play each role: two tourists, every captain, and the owner.
  const roles = [
    { label: '🇺🇸 Tourist / Turista EN', phone: '15551234567', name: 'John Smith' },
    { label: '🇲🇽 Turista ES', phone: '5213310000000', name: 'Ana López' },
    ...db.prepare('SELECT name, phone FROM captains WHERE active = 1 ORDER BY id').all()
      .map((c) => ({ label: `🚤 Cap. ${c.name}`, phone: c.phone, name: c.name })),
    { label: '👤 Owner / Dueño', phone: config.ownerPhone, name: 'Owner' },
  ].filter((r) => r.phone);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bot simulator</title><style>${STYLE}
  #log { background:var(--card); border:1px solid var(--line); border-radius:10px; height:58vh; overflow-y:auto; padding:12px }
  .m { max-width:85%; margin:6px 0; padding:8px 12px; border-radius:10px; white-space:pre-wrap; word-wrap:break-word }
  .in { background:#dcf8c6; color:#111; margin-left:auto } .out { background:var(--bg); border:1px solid var(--line) }
  .opts button { margin:4px 4px 0 0; padding:6px 10px; font-size:13px }
  form { display:flex; gap:8px; margin-top:10px } input { flex:1; min-width:0; font:inherit; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--ink) }
  .roles { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px }
  .roles button { background:var(--card); color:var(--ink); border:1px solid var(--line); padding:6px 10px; font-size:13px }
  .roles button.on { background:var(--accent); color:#fff; border-color:var(--accent) }
</style></head><body><main style="max-width:640px">
<h1>WhatsApp bot simulator / Simulador</h1>
<p class="muted">Pick who you are. Each one has their own chat. / Elige quién eres. Cada uno tiene su propio chat.</p>
<div class="roles" id="roles"></div>
<div id="log"></div>
<form id="f"><input id="t" placeholder="Escribe un mensaje… / Type a message…" autocomplete="off"><button>Enviar / Send</button></form>
<script>
const ROLES = ${JSON.stringify(roles).replace(/</g, '\\u003c')};
let role = ROLES[0], since = 0;
const log = document.getElementById('log');
function bubble(cls, text, opts) {
  const d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text;
  d.innerHTML = d.innerHTML
    .replace(/\\*([^*\\n]+)\\*/g, '<b>$1</b>').replace(/(^|\\s)_([^_\\n]+)_/g, '$1<i>$2</i>')
    .replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  if (opts && opts.length) {
    const o = document.createElement('div'); o.className = 'opts';
    opts.forEach(op => { const b = document.createElement('button'); b.textContent = op.title; b.onclick = () => send(op.title, op.id); o.appendChild(b); });
    d.appendChild(o);
  }
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}
function pickRole(r) {
  role = r; since = 0; log.innerHTML = '';
  document.querySelectorAll('#roles button').forEach(b => b.classList.toggle('on', b.dataset.phone === r.phone));
  poll();
}
ROLES.forEach(r => {
  const b = document.createElement('button'); b.textContent = r.label; b.dataset.phone = r.phone; b.onclick = () => pickRole(r);
  document.getElementById('roles').appendChild(b);
});
async function send(text, replyId) {
  await fetch('/dev/send', { method: 'POST', body: JSON.stringify({ from: role.phone, text, replyId, name: role.name }) });
  poll();
}
let polling = false;
async function poll() {
  if (polling) return; polling = true;
  try {
    const r = await (await fetch('/dev/outbox?since=' + since)).json();
    since = r.last;
    r.items.filter(i => i.to === role.phone).forEach(i => {
      if (i.incoming) bubble('in', i.message.text);
      else bubble('out', i.message.text, i.message.buttons || (i.message.list && i.message.list.rows));
    });
  } finally { polling = false; }
}
document.getElementById('f').onsubmit = e => { e.preventDefault(); const t = document.getElementById('t'); if (t.value.trim()) send(t.value.trim()); t.value = ''; };
pickRole(ROLES[0]);
setInterval(poll, 1500);
</script></main></body></html>`;
}
