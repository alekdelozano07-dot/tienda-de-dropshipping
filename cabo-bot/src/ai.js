import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { config } from './config.js';
import { getDb } from './db.js';
import { faqText } from './faq.js';

// The bot calls Claude only when its keyword rules don't understand a customer's message.
// Claude never books, prices or confirms anything itself: it tells the bot what the customer meant
// (a value for the current step, a different activity, a question, or a request for a person).

const SCHEMA = {
  type: 'object',
  properties: {
    action: { type: 'string', enum: ['value', 'switch', 'answer', 'human', 'unknown'] },
    reply: { type: 'string' },
    flow: { type: 'string', enum: ['fishing', 'rental', 'massage', 'none'] },
    date: { type: 'string' },
    number: { type: 'integer' },
    hours: { type: 'integer' },
    minutes: { type: 'integer' },
    option_id: { type: 'string' },
  },
  required: ['action', 'reply', 'flow', 'date', 'number', 'hours', 'minutes', 'option_id'],
  additionalProperties: false,
};

// Models that accept the server-side refusal fallback.
const FALLBACK_MODELS = ['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5'];

let client;
let testInterpreter = null;

// Tests plug in a fake so they never call the API.
export function setInterpreter(fn) {
  testInterpreter = fn;
}

export const aiEnabled = () => !!testInterpreter || !!config.ai.apiKey;

// ctx: { today, customer_language, step, step_expects, options, recent_conversation, last_message }
// Returns the parsed SCHEMA object, or null when the AI is off or fails (the bot then answers as before).
export async function interpret(ctx) {
  if (testInterpreter) return testInterpreter(ctx);
  if (!config.ai.apiKey) return null;
  client ??= new Anthropic({ apiKey: config.ai.apiKey, timeout: 20_000, maxRetries: 1 });
  const params = {
    model: config.ai.model,
    max_tokens: 4000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: [{ type: 'text', text: systemPrompt(), cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: JSON.stringify(ctx) }],
  };
  try {
    const response = FALLBACK_MODELS.includes(config.ai.model)
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params);
    if (response.stop_reason !== 'end_turn') return null;
    const text = response.content.find((b) => b.type === 'text')?.text;
    return text ? JSON.parse(text) : null;
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.error('AI: ANTHROPIC_API_KEY is invalid');
    else if (e instanceof Anthropic.RateLimitError) console.error('AI: rate limited');
    else if (e instanceof Anthropic.APIError) console.error(`AI: API error ${e.status}: ${e.message}`);
    else console.error('AI: failed', e.message);
    return null;
  }
}

function knowledge() {
  try {
    return readFileSync(config.ai.knowledgePath, 'utf8');
  } catch {
    return '(no extra business information yet)';
  }
}

// What the booking system sells, straight from the database, so answers use real names and prices.
function catalog() {
  const db = getDb();
  const boats = db.prepare(`
    SELECT b.*, c.name AS captain_name FROM boats b JOIN captains c ON c.id = b.captain_id
    WHERE b.active = 1 AND c.active = 1 ORDER BY b.price_4h
  `).all();
  const items = db.prepare('SELECT * FROM rental_items WHERE active = 1 ORDER BY category, name').all();
  const price = (h, p) => (p ? `${h}h $${p}` : null);
  return [
    'Fishing boats (price for the whole boat, USD; trips leave 7:00 AM for 4h/6h, 6:00 AM for 8h):',
    ...boats.map((b) => `- ${b.name} (${b.length_ft || '?'} ft, up to ${b.max_guests} people, Capt. ${b.captain_name}): `
      + `${[price(4, b.price_4h), price(6, b.price_6h), price(8, b.price_8h)].filter(Boolean).join(', ')}. `
      + `${b.description || ''} Meeting point: ${b.meeting_point || 'to be confirmed'}.`),
    `Fishing payment: ${config.depositPercent}% deposit online by card, the rest in cash to the captain on the day.`,
    '',
    `Paddleboard & kayak rentals (USD per day, delivered to the villa; delivery & pickup $${config.rentalDeliveryFee} per rental, paid online in full):`,
    ...items.map((i) => `- ${i.name}${i.name_es ? ` / ${i.name_es}` : ''}: $${i.price_per_day}/day`),
    '',
    `In-villa massage (USD per person): 60 min $${config.massagePrice60}, 90 min $${config.massagePrice90}. `
      + 'Part is paid online by card and the rest in cash to the therapist. Time slots: 9 AM, 12 PM, 3 PM, 6 PM.',
    '',
    'Bookings are taken from tomorrow up to 180 days ahead. Same-day requests go to a person.',
  ].join('\n');
}

function systemPrompt() {
  return `You read WhatsApp messages for the booking bot of ${config.businessName}, a concierge in Los Cabos, Mexico, that books fishing charters, paddleboard & kayak rentals and in-villa massages.

The bot runs a fixed step-by-step booking flow with buttons. You are only called when its simple rules did not understand the customer's last message. Work out what the customer meant and return JSON:

- action "value": the message gives what the current step asks for. Fill date (YYYY-MM-DD; resolve "tomorrow", "next Friday", etc. from "today"), number (people, days or quantity, whatever the step asks), hours (4, 6 or 8), minutes (60 or 90), or option_id (one of the ids in "options").
- action "switch": the customer wants to book an activity (flow "fishing", "rental" or "massage") other than the current step's, or names one from the menu. Also fill any details they gave: date, number (fishing: people; rental: days; massage: people), hours, minutes.
- action "answer": a question you can answer using ONLY the business information below. Write the answer in "reply": short (at most 3 sentences), friendly, WhatsApp style, in the customer's language ("es" = Spanish, "en" = English). Never invent prices, availability, policies or promises that are not written below, and never say a booking is confirmed; the bot handles bookings.
- action "human": the customer asks for a person, complains, has a problem with a booking, or asks something the information below does not cover.
- action "unknown": anything else (a greeting, small talk, something you can't make sense of).

Leave unused fields empty: "" for text, 0 for numbers, "none" for flow.

# Business information (written by the owner)

${knowledge()}

# Frequently asked questions (answer with these)

${faqText()}

# Catalog (from the booking system)

${catalog()}`;
}
