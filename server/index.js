/**
 * Qui Browser VR — backend server entrypoint.
 *
 * Consolidates the previously-unwired server/stripe-billing.js router into an
 * actual, startable Express server. There used to be a second, separate
 * payment implementation at api/stripe-payment.js describing a different,
 * superseded pricing model (a "Chrome extension" license at $0.50/mo or
 * $1.50 lifetime) that doesn't match this product's real JPY-tiered VR
 * subscription plans (see PRICING_PLANS in ./stripe-billing.js) — that file
 * has been removed rather than kept as a second, contradictory source of
 * truth for pricing.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { router: billingRouter } = require('./stripe-billing');

const WEBHOOK_PATH = '/api/billing/webhook';

/**
 * True when STRIPE_SECRET_KEY looks like a real (non-empty, non-placeholder)
 * key. Checked at request time (not just at startup) so tests can toggle it
 * via process.env without re-requiring the module.
 */
function isStripeConfigured() {
  const key = process.env.STRIPE_SECRET_KEY;
  return !!key && !key.includes('your_') && !key.includes('YOUR_') && !key.includes('xxx');
}

function createApp() {
  const app = express();

  // CORS: restrict to configured origins; defaults to the Vite dev server.
  const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.use(cors({ origin: allowedOrigins, credentials: true }));

  // Stripe webhook signature verification needs the raw request body — it
  // must NOT be parsed as JSON before reaching stripe.webhooks.constructEvent()
  // (a parsed body is no longer the exact byte sequence the signature was
  // computed over). The billing router applies express.raw() itself, scoped
  // to just this one route; every other route gets normal JSON parsing here.
  app.use((req, res, next) => {
    if (req.originalUrl === WEBHOOK_PATH) {
      return next();
    }
    return express.json()(req, res, next);
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      stripeConfigured: isStripeConfigured(),
      uptime: process.uptime()
    });
  });

  // Decline billing routes clearly (503) instead of letting an unconfigured
  // Stripe client fail deep inside a handler with a confusing SDK error.
  app.use('/api/billing', (req, res, next) => {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Billing is not configured on this server' });
    }
    return next();
  }, billingRouter);

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // eslint-disable-next-line no-unused-vars -- Express requires 4 args to recognize an error handler
  app.use((err, req, res, next) => {
    console.error('[Server] Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

function start() {
  const app = createApp();
  const port = process.env.PORT || 3000;

  if (!isStripeConfigured()) {
    console.warn(
      '[Server] STRIPE_SECRET_KEY is not set (or looks like a placeholder). ' +
      'Billing routes will return 503 until it is configured — see .env.example.'
    );
  }

  return app.listen(port, () => {
    console.log(`[Server] Qui Browser VR backend listening on port ${port}`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start, isStripeConfigured, WEBHOOK_PATH };
