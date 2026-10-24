// Loads example captains, boats and rental gear. Edit freely, then run: npm run seed
// Running it again does not duplicate data (captains are matched by phone, items by name).
import { getDb } from '../src/db.js';

const db = getDb();

const captains = [
  {
    name: 'Juan Ruiz', phone: '5216241000001',
    boats: [
      { name: 'La Reina', length_ft: 31, max_guests: 6, price_4h: 450, price_6h: 600, price_8h: 750,
        description: 'Bertram 31 with A/C cabin and toilet. Rods, bait, licenses, water & sodas included.',
        meeting_point: 'Cabo San Lucas Marina, Dock M (next to Tesoro hotel)' },
    ],
  },
  {
    name: 'Miguel Ángel Cota', phone: '5216241000002',
    boats: [
      { name: 'Pescadora II', length_ft: 26, max_guests: 4, price_4h: 350, price_6h: 450, price_8h: null,
        description: 'Super panga, perfect for families. Gear, bait, licenses and cooler with ice included.',
        meeting_point: 'Cabo San Lucas Marina, Dock A' },
      { name: 'Blue Marlin', length_ft: 38, max_guests: 8, price_4h: 700, price_6h: 900, price_8h: 1150,
        description: 'Cabo 38 sportfisher with flybridge. Ideal for marlin & tuna. Lunch, drinks and gear included.',
        meeting_point: 'Cabo San Lucas Marina, Dock M' },
    ],
  },
];

const items = [
  { name: 'Beach umbrella', category: 'beach', price_per_day: 10, stock: 10 },
  { name: 'Beach chair', category: 'beach', price_per_day: 6, stock: 20 },
  { name: 'Cooler with ice', category: 'beach', price_per_day: 10, stock: 8 },
  { name: 'Snorkel set', category: 'beach', price_per_day: 8, stock: 10 },
  { name: 'Boogie board', category: 'beach', price_per_day: 8, stock: 6 },
  { name: 'Beach cart/wagon', category: 'beach', price_per_day: 12, stock: 4 },
  { name: 'Stroller', category: 'baby', price_per_day: 12, stock: 4 },
  { name: 'Car seat', category: 'baby', price_per_day: 10, stock: 4 },
  { name: 'Travel crib + sheets', category: 'baby', price_per_day: 12, stock: 4 },
  { name: 'High chair', category: 'baby', price_per_day: 8, stock: 4 },
];

for (const c of captains) {
  db.prepare('INSERT INTO captains (name, phone) VALUES (?, ?) ON CONFLICT(phone) DO UPDATE SET name = excluded.name').run(c.name, c.phone);
  const { id } = db.prepare('SELECT id FROM captains WHERE phone = ?').get(c.phone);
  for (const b of c.boats) {
    const existing = db.prepare('SELECT id FROM boats WHERE captain_id = ? AND name = ?').get(id, b.name);
    const vals = [b.length_ft, b.max_guests, b.description, b.meeting_point, b.price_4h, b.price_6h, b.price_8h];
    if (existing) {
      db.prepare(`UPDATE boats SET length_ft=?, max_guests=?, description=?, meeting_point=?, price_4h=?, price_6h=?, price_8h=? WHERE id=?`).run(...vals, existing.id);
    } else {
      db.prepare(`INSERT INTO boats (captain_id, name, length_ft, max_guests, description, meeting_point, price_4h, price_6h, price_8h)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, b.name, ...vals);
    }
  }
}

for (const i of items) {
  const existing = db.prepare('SELECT id FROM rental_items WHERE name = ?').get(i.name);
  if (existing) db.prepare('UPDATE rental_items SET category=?, price_per_day=?, stock=? WHERE id=?').run(i.category, i.price_per_day, i.stock, existing.id);
  else db.prepare('INSERT INTO rental_items (name, category, price_per_day, stock) VALUES (?, ?, ?, ?)').run(i.name, i.category, i.price_per_day, i.stock);
}

console.log(`Seeded ${captains.length} captains and ${items.length} rental items into the database.`);
