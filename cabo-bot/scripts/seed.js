// Loads example captains, boats and rental gear. Edit freely, then run: npm run seed
// Each captain gets messages in `lang` ('es' or 'en'). Descriptions and item names have an English and a Spanish version.
// Running it again does not duplicate data (captains are matched by phone, items by name).
// best_for: what the bot recommends a boat for — any of fishing, family, relaxed (comma separated).
// tag: the label shown next to it — popular, value, premium or family (or leave it out).
import { getDb } from '../src/db.js';

const db = getDb();

const captains = [
  {
    name: 'Juan Ruiz', phone: '5216241000001', lang: 'es',
    boats: [
      { name: 'La Reina', length_ft: 31, max_guests: 6, price_4h: 450, price_6h: 600, price_8h: 750, best_for: 'family,relaxed', tag: 'popular',
        description: 'Bertram 31 with A/C cabin and toilet. Rods, bait, licenses, water & sodas included.',
        description_es: 'Bertram 31 con cabina con A/C y baño. Incluye cañas, carnada, permisos, agua y refrescos.',
        meeting_point: 'Cabo San Lucas Marina, Dock M (next to Tesoro hotel)' },
    ],
  },
  {
    name: 'Miguel Ángel Cota', phone: '5216241000002', lang: 'es',
    boats: [
      { name: 'Pescadora II', length_ft: 26, max_guests: 4, price_4h: 350, price_6h: 450, price_8h: null, best_for: 'family', tag: 'value',
        description: 'Super panga, perfect for families. Gear, bait, licenses and cooler with ice included.',
        description_es: 'Súper panga, ideal para familias. Incluye equipo, carnada, permisos y hielera con hielo.',
        meeting_point: 'Cabo San Lucas Marina, Dock A' },
      { name: 'Blue Marlin', length_ft: 38, max_guests: 8, price_4h: 700, price_6h: 900, price_8h: 1150, best_for: 'fishing', tag: 'premium',
        description: 'Cabo 38 sportfisher with flybridge. Ideal for marlin & tuna. Lunch, drinks and gear included.',
        description_es: 'Cabo 38 de pesca deportiva con flybridge. Ideal para marlín y atún. Incluye comida, bebidas y equipo.',
        meeting_point: 'Cabo San Lucas Marina, Dock M' },
    ],
  },
];

const items = [
  { name: 'Stand-up paddleboard', name_es: 'Paddleboard (tabla de remo)', category: 'water', price_per_day: 45, stock: 4 },
  { name: 'Single kayak', name_es: 'Kayak individual', category: 'water', price_per_day: 40, stock: 3 },
  { name: 'Double kayak', name_es: 'Kayak doble', category: 'water', price_per_day: 55, stock: 2 },
  { name: 'Life jacket', name_es: 'Chaleco salvavidas', category: 'water', price_per_day: 5, stock: 10 },
];

for (const c of captains) {
  db.prepare('INSERT INTO captains (name, phone, lang) VALUES (?, ?, ?) ON CONFLICT(phone) DO UPDATE SET name = excluded.name, lang = excluded.lang')
    .run(c.name, c.phone, c.lang || 'es');
  const { id } = db.prepare('SELECT id FROM captains WHERE phone = ?').get(c.phone);
  for (const b of c.boats) {
    const existing = db.prepare('SELECT id FROM boats WHERE captain_id = ? AND name = ?').get(id, b.name);
    const vals = [b.length_ft, b.max_guests, b.description, b.description_es || null, b.meeting_point, b.price_4h, b.price_6h, b.price_8h,
      b.best_for || null, b.tag || null];
    if (existing) {
      db.prepare(`UPDATE boats SET length_ft=?, max_guests=?, description=?, description_es=?, meeting_point=?, price_4h=?, price_6h=?, price_8h=?,
                  best_for=?, tag=? WHERE id=?`).run(...vals, existing.id);
    } else {
      db.prepare(`INSERT INTO boats (captain_id, name, length_ft, max_guests, description, description_es, meeting_point, price_4h, price_6h, price_8h,
                  best_for, tag) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, b.name, ...vals);
    }
  }
}

for (const i of items) {
  const existing = db.prepare('SELECT id FROM rental_items WHERE name = ?').get(i.name);
  if (existing) {
    db.prepare('UPDATE rental_items SET name_es=?, category=?, price_per_day=?, stock=? WHERE id=?')
      .run(i.name_es || null, i.category, i.price_per_day, i.stock, existing.id);
  } else {
    db.prepare('INSERT INTO rental_items (name, name_es, category, price_per_day, stock) VALUES (?, ?, ?, ?, ?)')
      .run(i.name, i.name_es || null, i.category, i.price_per_day, i.stock);
  }
}

// Items you removed from the list above stop being offered (past bookings keep them).
const keep = items.map((i) => i.name);
db.prepare(`UPDATE rental_items SET active = 0 WHERE name NOT IN (${keep.map(() => '?').join(', ')})`).run(...keep);

console.log(`Seeded ${captains.length} captains and ${items.length} rental items into the database.`);
