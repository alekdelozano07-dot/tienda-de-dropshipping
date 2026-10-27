import { getDb } from './db.js';
import { config } from './config.js';
import { norm } from './words.js';

// Answers to common questions, in English and Spanish. The bot uses them when it doesn't understand a message
// (no AI needed), and the AI reads them too when it is on. Edit freely: "match" lists the words that give the
// question away (lowercase, no accents); the entry that matches the most of them wins.
// ⚠️ The cancellation, port closure, tipping and keep-the-fish answers are proposals: confirm them with the captains.

const fishingFrom = () => getDb().prepare(`
  SELECT MIN(b.price_4h) AS p FROM boats b JOIN captains c ON c.id = b.captain_id WHERE b.active = 1 AND c.active = 1
`).get().p;
const rentalFrom = () => getDb().prepare('SELECT MIN(price_per_day) AS p FROM rental_items WHERE active = 1').get().p;

export const FAQ = [
  {
    q: 'Prices',
    match: [/\b(price|prices|pricing|cost|costs|how much|rates?|precios?|costos?|cuanto (cuesta|sale|es|cobran)|tarifas?)\b/],
    en: () => `Fishing trips start at $${fishingFrom()} for the whole boat (4 hours), in-villa massages at $${config.massagePrice60} per person (60 min), and paddleboards & kayaks at $${rentalFrom()} per day. Pick an option to see every price and what's available.`,
    es: () => `Los viajes de pesca empiezan en $${fishingFrom()} USD por el barco completo (4 horas), los masajes en tu villa en $${config.massagePrice60} USD por persona (60 min) y los paddleboards y kayaks en $${rentalFrom()} USD por día. Elige una opción para ver todos los precios y lo disponible.`,
  },
  {
    q: 'How to pay',
    match: [/\b(card|cards|credit|debit|cash|pay|paying|payment|paypal|visa|mastercard|amex|tarjetas?|credito|debito|efectivo|pago|pagar|pagos)\b/],
    en: 'You pay securely by card on a Stripe payment page we send you here (we never ask for your card on WhatsApp). For fishing and massages you pay a deposit online and the rest in cash on the day; paddleboard and kayak rentals are paid in full online.',
    es: 'Pagas seguro con tarjeta en una página de pago de Stripe que te mandamos aquí (nunca te pedimos la tarjeta por WhatsApp). En pesca y masajes pagas un anticipo en línea y el resto en efectivo el día del servicio; las rentas de paddleboard y kayak se pagan completas en línea.',
  },
  {
    q: 'Weather / port closed',
    match: [/\b(rain\w*|weather|storms?|stormy|wind\w*|lluev\w*|lluvia|clima|tormentas?|viento|mal tiempo)\b/, /port (is )?(clos\w*|shut)|puerto (esta )?cerr\w*|cierra\w* (el )?puerto/],
    en: "The Port Captain decides if boats can go out. If the port closes for bad weather, we move your trip to another date or refund everything you paid online. Light rain usually doesn't cancel a trip; the captain will tell you if it isn't safe to go.",
    es: 'La Capitanía de Puerto decide si los barcos pueden salir. Si cierra el puerto por mal clima, cambiamos tu viaje a otra fecha o te regresamos todo lo que pagaste en línea. La lluvia ligera normalmente no cancela el viaje; el capitán te avisa si no es seguro salir.',
  },
  {
    q: 'Cancel / refund',
    match: [/\b(cancel\w*|refund\w*|reembols\w*|devolu\w*|money back|regres\w* (mi|el) dinero|devuelven)\b/],
    en: 'Yes: cancel at least 48 hours before and you get back everything you paid online. With less than 48 hours the deposit is not refunded. To cancel, type *human* and someone from our team will help you.',
    es: 'Sí: si cancelas con al menos 48 horas de anticipación te regresamos todo lo que pagaste en línea. Con menos de 48 horas el anticipo no se regresa. Para cancelar escribe *humano* y alguien del equipo te ayuda.',
  },
  {
    q: 'Change the date',
    match: [/\b(change|move|switch) (the |my )?(date|day)|reschedul\w*|cambiar (la |mi )?(fecha|dia)|reprogram\w*|mover (la )?fecha/],
    en: 'Yes, at least 48 hours before and if a boat is free that day. Type *human* and we will move it for you.',
    es: 'Sí, con al menos 48 horas de anticipación y si hay barco disponible ese día. Escribe *humano* y te la cambiamos.',
  },
  {
    q: 'Kids',
    match: [/\b(kids?|child|children|toddlers?|my son|my daughter|ninos?|ninas?|hijos?|hijas?|menores)\b/],
    en: 'Yes, kids are welcome with an adult and count as a person on the boat. There are life jackets on board; for very small children let us know beforehand so we can confirm the size.',
    es: 'Sí, los niños pueden ir acompañados de un adulto y cuentan como persona en el barco. Hay chalecos salvavidas a bordo; para niños muy pequeños avísanos antes para confirmar la talla.',
  },
  {
    q: 'Keep / cook the fish',
    match: [/\b(keep|cook|eat|take home)\b.*\bfish|\bfish\b.*\b(keep|cook|eat)|catch and release|quedar\w* (con )?(el |los )?(pescado|pez|peces)|cocin\w*|liberan/],
    en: 'Marlin and sailfish are caught and released (the rule and custom in Cabo). Dorado, tuna and other fish you can usually keep, within fishing limits. Several restaurants at the marina will cook the fish you bring.',
    es: 'Los marlines y peces vela se pescan y se liberan (es la regla y la costumbre en Cabo). Los dorados, atunes y otros peces normalmente te los puedes quedar, dentro de los límites de pesca. Varios restaurantes de la marina cocinan el pescado que llevas.',
  },
  {
    q: 'Fishing license',
    match: [/\b(licen[cs]es?|permits?|licencias?|permisos?)\b/],
    en: "Each boat's description says what's included. If it includes licenses or permits, you don't need to arrange anything.",
    es: 'Cada barco dice en su descripción qué incluye. Si incluye permisos o licencias, no tienes que tramitar nada.',
  },
  {
    q: 'Tips',
    match: [/\b(tips?|tipping|gratuity|gratuities|propinas?)\b/],
    en: 'Tips are not included. Tipping the captain and crew is optional and in cash; 10% to 20% of the trip price is customary.',
    es: 'La propina no está incluida. Es opcional y en efectivo para el capitán y su tripulación; se acostumbra entre 10% y 20% del precio del viaje.',
  },
  {
    q: "What's included in a rental",
    match: [/(rent\w*|kayak|paddle\w*|tabla|sup)\b.*(includ\w*|incluye|come with)|(includ\w*|incluye|come with).*(rent\w*|kayak|paddle\w*|tabla|\bsup\b)/],
    en: 'The paddleboard or kayak with its paddle, delivered to your villa. Life jackets are in the gear list.',
    es: 'La tabla o el kayak con su remo, entregados en tu villa. Los chalecos están en la lista de equipo.',
  },
  {
    q: "What's included",
    match: [/\b(includ\w*|incluye\w*|incluid[oa]s?|come with|lunch|food|drinks?|beers?|snacks?|water|bebidas?|comida|cervezas?|agua|botanas?)\b/],
    en: 'It depends on the boat: each one lists what it includes (rods, bait, drinks, food…) in the boat list when you book.',
    es: 'Depende del barco: cada uno dice qué incluye (cañas, carnada, bebidas, comida…) en la lista de barcos al reservar.',
  },
  {
    q: 'What to bring',
    match: [/\b(bring|wear|pack|take with|llevar|traer|ponerme|ropa)\b/],
    en: "Sunscreen, a hat, sunglasses, a light jacket for the morning, snacks if your boat doesn't include food, and the cash for the captain.",
    es: 'Bloqueador solar, gorra, lentes de sol, una chamarra ligera para la mañana, algo de comer si el barco no incluye comida, y el efectivo para el capitán.',
  },
  {
    q: 'Bathroom on board',
    match: [/\b(bathroom|toilet|restroom|washroom|bano|sanitario)\b/],
    en: 'Larger boats usually have a bathroom; pangas (small boats) do not. Check each boat\'s description.',
    es: 'Los barcos grandes normalmente tienen baño; las pangas (lanchas chicas) no. Revisa la descripción de cada barco.',
  },
  {
    q: 'Seasickness',
    match: [/\b(seasick\w*|sea sick|motion sick\w*|dramamine|nause\w*|mare\w*|pastillas?)\b/],
    en: "It can happen. Take a seasickness pill (like Dramamine) the night before and another one hour before leaving, have a light breakfast and skip alcohol the night before. Pills aren't handed out on board; any pharmacy has them.",
    es: 'Puede pasar. Toma una pastilla para el mareo (como Dramamina) la noche anterior y otra 1 hora antes de salir, desayuna ligero y no tomes alcohol la noche anterior. Las pastillas no se dan a bordo; las venden en cualquier farmacia.',
  },
  {
    q: 'Departure times',
    match: [/\b(what time|when do (we|you)|depart\w*|leave|come back|get back|a que hora|horarios?|salen|salida)\b/],
    en: '4- and 6-hour trips leave at 7:00 AM and 8-hour trips at 6:00 AM. You come back when your hours are up.',
    es: 'Los viajes de 4 y 6 horas salen a las 7:00 a.m. y los de 8 horas a las 6:00 a.m. Regresan cuando se cumplen las horas del viaje.',
  },
  {
    q: 'Meeting point',
    match: [/\b(meeting point|where (do|should) we (meet|go)|marina|dock|pier|punto de encuentro|donde nos vemos|muelle)\b/],
    en: "Each boat's meeting point is in its description and in your confirmation. Please be there 15 minutes early.",
    es: 'Cada barco tiene su punto de encuentro en su descripción y en tu confirmación. Llega 15 minutos antes.',
  },
  {
    q: 'Massage type',
    match: [/(massage|masaje).*(type|kind|deep|prenat)|(type|kind|tipo|tipos).*(massage|masaje)|deep tissue|tejido profundo|prenatal|pregnan\w*|embaraz\w*/],
    en: 'A full-body relaxing massage, 60 or 90 minutes. For something special (deep tissue, prenatal…), type *human* and we will check.',
    es: 'Masaje de relajación de cuerpo completo, de 60 o 90 minutos. Si buscas algo especial (tejido profundo, para embarazadas…), escribe *humano* para confirmar.',
  },
  {
    q: 'Couples massage',
    match: [/couples? massage|massage for (two|2|us)|both of us|masaje (en|de|para) pareja|para los dos|ambos|juntos/],
    en: 'For now there is one therapist, so it is one person at a time. A couple can book two time slots the same day, or type *human* and we will arrange it.',
    es: 'Por ahora hay una terapeuta, así que es una persona a la vez. Una pareja puede reservar dos horarios el mismo día, o escribe *humano* y lo organizamos.',
  },
  {
    q: 'Massage: what to have ready',
    match: [/what do (i|we) need|need to (prepare|have ready)|que (necesito|tengo que) (tener|preparar)|necesito preparar/],
    en: 'Just a quiet space in the villa (a bedroom or the terrace). The therapist brings the table, sheets, towels and oils.',
    es: 'Solo un espacio tranquilo en la villa (una recámara o la terraza). La terapeuta lleva la mesa, sábanas, toallas y aceites.',
  },
  {
    q: 'Where to paddle',
    match: [/\bwhere\b.*\b(paddle|kayak|sup|row)|donde.*(remar|paddle|kayak)|best (beach|spot|place|bay)|mejor (playa|lugar|bahia)/],
    en: "In the calm bays of the Sea of Cortez, like Médano Beach, Santa María or Chileno. Don't paddle on the Pacific side (like Divorce Beach): big waves and strong currents. Mornings are best, with calmer water and fewer boats.",
    es: 'En las bahías tranquilas del Mar de Cortés, como Playa Médano, Santa María o Chileno. No remes del lado del Pacífico (como Playa del Divorcio): hay olas y corrientes fuertes. Lo mejor es en la mañana, con el mar más tranquilo y menos lanchas.',
  },
  {
    q: 'Experience needed',
    match: [/\b(experience|beginners?|first time|never (done|tried|paddled)|experiencia|principiantes?|primera vez|nunca he)\b/],
    en: 'No experience needed: paddleboards and kayaks are easy for beginners on calm water. If it is your first time, start close to the shore.',
    es: 'No necesitas experiencia: el paddleboard y el kayak son fáciles para principiantes en agua tranquila. Si es tu primera vez, empieza cerca de la orilla.',
  },
  {
    q: 'Life jackets',
    match: [/\b(life ?jackets?|life ?vests?|chalecos?)\b/],
    en: 'Life jackets for paddleboards and kayaks are rented separately in the gear list. We recommend always wearing one, especially kids. Boats have life jackets on board.',
    es: 'Para paddleboard y kayak el chaleco se renta aparte en la lista de equipo. Recomendamos usarlo siempre, sobre todo con niños. Los barcos traen chalecos a bordo.',
  },
  {
    q: 'Rental delivery',
    match: [/\b(deliver\w*|drop ?off|pick ?up|entrega\w*|recog\w*)\b/],
    en: 'The day before, we message you to agree on a delivery time at your villa. Pickup is on the last day of the rental.',
    es: 'Un día antes te escribimos para acordar la hora de entrega en tu villa. La recolección es el último día de la renta.',
  },
  {
    q: 'Extend a rental',
    match: [/\b(extend|longer|more days|extra days?|mas dias|extender|alargar)\b/],
    en: 'Sure: type *human* before your rental ends and we will extend it if the gear is available.',
    es: 'Claro: escribe *humano* antes de que termine tu renta y la extendemos si hay equipo disponible.',
  },
];

const answerOf = (entry, lang) => {
  const a = lang === 'es' ? entry.es : entry.en;
  return typeof a === 'function' ? a() : a;
};

// The answer to the question in `text`, in the customer's language, or null if it doesn't look like one of these.
export function faqAnswer(text, lang = 'en') {
  const t = norm(text);
  let best = null;
  let bestScore = 0;
  for (const entry of FAQ) {
    const score = entry.match.filter((re) => re.test(t)).length;
    if (score > bestScore) { best = entry; bestScore = score; }
  }
  return best ? answerOf(best, lang) : null;
}

// The same answers as plain text, for the AI's instructions.
export const faqText = () => FAQ.map((f) => `- ${f.q}: ${answerOf(f, 'en')}`).join('\n');
