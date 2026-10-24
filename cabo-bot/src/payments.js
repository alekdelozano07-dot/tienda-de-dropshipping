import crypto from 'node:crypto';
import { config, devMode } from './config.js';

// Creates a Stripe Checkout Session and returns { url, ref }.
// In local test mode returns a link to the fake payment page instead.
export async function createCheckout(booking, description) {
  if (devMode.stripe) {
    return { url: `${config.publicUrl}/dev/pay/${booking.code}`, ref: `dev_${booking.code}` };
  }
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(config.holdMinutes, 30) * 60; // Stripe minimum is 30 min
  const form = new URLSearchParams({
    mode: 'payment',
    success_url: `${config.publicUrl}/paid?code=${booking.code}`,
    cancel_url: `${config.publicUrl}/cancelled?code=${booking.code}`,
    client_reference_id: booking.code,
    'metadata[booking_code]': booking.code,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(booking.paid_online * 100),
    'line_items[0][price_data][product_data][name]': description,
    expires_at: String(expiresAt),
  });
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.stripe.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `checkout_${booking.code}`,
    },
    body: form,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Stripe error: ${json.error?.message || res.status}`);
  return { url: json.url, ref: json.id };
}

// Verifies the Stripe-Signature header and returns the parsed event (or null).
export function parseStripeEvent(rawBody, signatureHeader) {
  const secret = config.stripe.webhookSecret;
  if (!secret || !signatureHeader) return null;
  const parts = Object.fromEntries(signatureHeader.split(',').map((p) => p.split('=')));
  const signed = `${parts.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
  const given = signatureHeader.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  const ok = given.some((sig) => sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)));
  if (!ok || Math.abs(Date.now() / 1000 - Number(parts.t)) > 300) return null;
  return JSON.parse(rawBody);
}
