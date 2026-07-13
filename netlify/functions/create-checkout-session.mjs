import Stripe from 'stripe';

const stripe = process.env.STRIPE_RESTRICTED_KEY
  ? new Stripe(process.env.STRIPE_RESTRICTED_KEY, { apiVersion: '2026-06-24.dahlia' })
  : null;

const json = (statusCode, body) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  if (!stripe) return json(500, { error: 'Stripe test mode is not configured yet.' });

  try {
    const { name, email, amountCents, tipCents = 0, tipMode = null } = JSON.parse(event.body || '{}');
    const base = Number(amountCents);
    const tip = Number(tipCents);

    if (typeof name !== 'string' || !name.trim() || name.length > 120) return json(400, { error: 'Please enter a valid name.' });
    if (typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return json(400, { error: 'Please enter a valid email address.' });
    if (!Number.isSafeInteger(base) || base < 100 || base > 1_000_000) return json(400, { error: 'Payment amount must be between $1.00 and $10,000.00.' });
    if (!Number.isSafeInteger(tip) || tip < 0 || tip > 1_000_000) return json(400, { error: 'Please enter a valid optional tip.' });
    if (base + tip > 1_000_000) return json(400, { error: 'The total payment cannot exceed $10,000.00.' });

    const requestHost = event.headers.host || '';
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(requestHost);
    const siteUrl = process.env.URL || (isLocal ? `http://${requestHost}` : 'https://www.tattoosbyanna.com');
    const lineItems = [{
      price_data: {
        currency: 'usd',
        unit_amount: base,
        product_data: { name: 'Tattoo payment' },
      },
      quantity: 1,
    }];

    if (tip > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          unit_amount: tip,
          product_data: { name: 'Optional tip' },
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email.trim().toLowerCase(),
      client_reference_id: email.trim().toLowerCase(),
      line_items: lineItems,
      metadata: {
        customer_name: name.trim(),
        customer_email: email.trim().toLowerCase(),
        payment_amount_cents: String(base),
        tip_amount_cents: String(tip),
        tip_mode: tipMode || 'none',
        source: 'tattoosbyanna_payment_page',
      },
      payment_intent_data: {
        description: `Tattoos by Anna payment — ${name.trim()}`,
        metadata: {
          customer_name: name.trim(),
          customer_email: email.trim().toLowerCase(),
          payment_amount_cents: String(base),
          tip_amount_cents: String(tip),
          source: 'tattoosbyanna_payment_page',
        },
      },
      success_url: `${siteUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/payment/?payment=cancelled`,
    });

    return json(200, { url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Session error', error);
    return json(500, { error: 'Unable to start payment. Please try again.' });
  }
};
