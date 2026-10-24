import { getDb } from './db.js';
import { config } from './config.js';
import { caboToday, formatDate } from './dates.js';

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

export function adminPage() {
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
    SELECT c.name, c.phone, GROUP_CONCAT(b.name, ', ') AS boats FROM captains c LEFT JOIN boats b ON b.captain_id = c.id
    WHERE c.active = 1 GROUP BY c.id ORDER BY c.name
  `).all();
  const qrSources = ['airbnb', 'villa', 'taxi', 'instagram'];

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(config.businessName)} admin</title><style>${STYLE}</style></head><body><main>
<h1>${esc(config.businessName)} — admin</h1>
<div class="cards">
  <div class="card"><span class="muted">Commission (${month})</span><b>$${stats.commission}</b></div>
  <div class="card"><span class="muted">Rental revenue (${month})</span><b>$${stats.rentals}</b></div>
  <div class="card"><span class="muted">Paid bookings (${month})</span><b>${stats.bookings}</b></div>
  <div class="card"><span class="muted">Chats waiting for you</span><b>${human.length}</b></div>
</div>

${human.length ? `<h2>🙋 Chats waiting for a person</h2><div class="scroll"><table><tr><th>Phone</th><th>Step</th><th>Last activity (UTC)</th><th>Open</th></tr>
${human.map((h) => `<tr><td>+${esc(h.phone)}</td><td>${esc(h.state)}</td><td>${esc(h.updated_at)}</td><td><a href="https://wa.me/${esc(h.phone)}">WhatsApp</a></td></tr>`).join('')}
</table></div><p class="muted">Answer from your phone with <code>REPLY &lt;phone&gt; message</code> to the bot number, then <code>BOT &lt;phone&gt;</code> to hand back.</p>` : ''}

<h2>Upcoming bookings</h2><div class="scroll"><table>
<tr><th>Date</th><th>Code</th><th>Type</th><th>Details</th><th>Client</th><th>Online</th><th>Cash</th><th>Status</th><th>Source</th></tr>
${upcoming.map((b) => `<tr><td>${esc(formatDate(b.date))}${b.end_date ? ' → ' + esc(formatDate(b.end_date)) : ''}</td><td>${esc(b.code)}</td>
<td>${b.kind === 'fishing' ? '🎣' : '🏖️'}</td>
<td>${b.kind === 'fishing' ? `${esc(b.boat_name)} · Capt. ${esc(b.captain_name)} · ${b.hours}h · ${b.guests} pax` : esc(b.delivery_address)}</td>
<td>${esc(b.customer_name)}<br><span class="muted">+${esc(b.customer_phone)}</span></td><td>$${b.paid_online}</td><td>$${b.balance_cash}</td>
<td><span class="tag">${esc(b.status)}</span></td><td>${esc(b.source || 'direct')}</td></tr>`).join('') || '<tr><td colspan="9" class="muted">No upcoming bookings</td></tr>'}
</table></div>

<h2>Bookings by source</h2><div class="scroll"><table><tr><th>Source</th><th>Bookings</th><th>Paid online</th></tr>
${sources.map((s) => `<tr><td>${esc(s.source)}</td><td>${s.n}</td><td>$${s.revenue}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No data yet</td></tr>'}
</table></div>

<h2>QR codes</h2>
<p class="muted">Print these for Airbnbs, villas, taxis and Instagram. Make one per place to track it: <code>${esc(config.publicUrl)}/qr/airbnb-casa-azul</code></p>
<div class="cards">${qrSources.map((s) => {
    const link = `${config.publicUrl}/qr/${s}`;
    return `<div class="card" style="text-align:center"><img alt="QR ${esc(s)}" width="150" height="150" src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}"><br><b style="font-size:15px">${esc(s)}</b><span class="muted">${esc(link)}</span></div>`;
  }).join('')}</div>

<h2>Captains</h2><div class="scroll"><table><tr><th>Name</th><th>WhatsApp</th><th>Boats</th></tr>
${captains.map((c) => `<tr><td>${esc(c.name)}</td><td>+${esc(c.phone)}</td><td>${esc(c.boats)}</td></tr>`).join('')}
</table></div>
</main></body></html>`;
}

export function devChatPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bot simulator</title><style>${STYLE}
  #log { background:var(--card); border:1px solid var(--line); border-radius:10px; height:60vh; overflow-y:auto; padding:12px }
  .m { max-width:85%; margin:6px 0; padding:8px 12px; border-radius:10px; white-space:pre-wrap; word-wrap:break-word }
  .in { background:#dcf8c6; color:#111; margin-left:auto } .out { background:var(--bg); border:1px solid var(--line) }
  .opts button { margin:4px 4px 0 0; padding:6px 10px; font-size:13px }
  form { display:flex; gap:8px; margin-top:10px } input { flex:1; font:inherit; padding:10px; border-radius:8px; border:1px solid var(--line); background:var(--card); color:var(--ink) }
  .who { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; align-items:center }
</style></head><body><main style="max-width:640px">
<h1>WhatsApp bot simulator</h1>
<div class="who"><label>Chatting as phone <input id="phone" value="15551234567" style="width:160px"></label>
<span class="muted">Use the captain's or owner's number to test their commands.</span></div>
<div id="log"></div>
<form id="f"><input id="t" placeholder="Type a message… (try: hi)" autocomplete="off"><button>Send</button></form>
<script>
let since = 0;
const log = document.getElementById('log');
const phone = () => document.getElementById('phone').value.replace(/\\D/g, '');
function bubble(cls, text, opts) {
  const d = document.createElement('div'); d.className = 'm ' + cls; d.textContent = text;
  d.innerHTML = d.innerHTML.replace(/(https?:\\/\\/[^\\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
  if (opts && opts.length) {
    const o = document.createElement('div'); o.className = 'opts';
    opts.forEach(op => { const b = document.createElement('button'); b.textContent = op.title; b.onclick = () => send(op.title, op.id); o.appendChild(b); });
    d.appendChild(o);
  }
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}
async function send(text, replyId) {
  bubble('in', text);
  await fetch('/dev/send', { method: 'POST', body: JSON.stringify({ from: phone(), text, replyId, name: 'Test Tourist' }) });
  poll();
}
async function poll() {
  const r = await (await fetch('/dev/outbox?since=' + since)).json();
  since = r.total;
  r.items.filter(i => i.to === phone()).forEach(i => {
    const m = i.message;
    bubble('out', m.text, m.buttons || (m.list && m.list.rows));
  });
}
document.getElementById('f').onsubmit = e => { e.preventDefault(); const t = document.getElementById('t'); if (t.value.trim()) send(t.value.trim()); t.value = ''; };
setInterval(poll, 1500); poll();
</script></main></body></html>`;
}
