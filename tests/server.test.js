/**
 * Integration tests for the backend server (server/index.js).
 *
 * server/stripe-billing.js was previously completely unwired — nothing
 * called it, nothing started it. These tests exercise the real, startable
 * Express app end-to-end over a real (ephemeral-port) HTTP connection using
 * Node's built-in fetch, rather than adding a new test-only dependency
 * (supertest) for what a handful of plain requests already covers.
 */

const ORIGINAL_ENV = { ...process.env };

function freshServerModule({ stripeKey, webhookSecret = 'whsec_test_fake_secret' } = {}) {
  jest.resetModules();
  if (stripeKey === undefined) {
    delete process.env.STRIPE_SECRET_KEY;
  } else {
    process.env.STRIPE_SECRET_KEY = stripeKey;
  }
  process.env.STRIPE_WEBHOOK_SECRET = webhookSecret;
  // eslint-disable-next-line global-require -- intentional dynamic re-require per test
  return require('../server/index.js');
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    return await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('server/index.js', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  describe('isStripeConfigured', () => {
    test('false when STRIPE_SECRET_KEY is unset', () => {
      const { isStripeConfigured } = freshServerModule({ stripeKey: undefined });
      expect(isStripeConfigured()).toBe(false);
    });

    test('false when STRIPE_SECRET_KEY is empty', () => {
      const { isStripeConfigured } = freshServerModule({ stripeKey: '' });
      expect(isStripeConfigured()).toBe(false);
    });

    test('false for a placeholder-looking key', () => {
      const { isStripeConfigured } = freshServerModule({ stripeKey: 'sk_test_YOUR_STRIPE_SECRET_KEY' });
      expect(isStripeConfigured()).toBe(false);
    });

    test('true for a real-looking key', () => {
      const { isStripeConfigured } = freshServerModule({ stripeKey: 'sk_test_abc123realkey' });
      expect(isStripeConfigured()).toBe(true);
    });
  });

  describe('GET /health', () => {
    test('returns ok status and reflects stripeConfigured=false when unset', async () => {
      const { createApp } = freshServerModule({ stripeKey: undefined });
      await withServer(createApp(), async (baseUrl) => {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(body.stripeConfigured).toBe(false);
        expect(typeof body.uptime).toBe('number');
      });
    });

    test('reflects stripeConfigured=true when a real-looking key is set', async () => {
      const { createApp } = freshServerModule({ stripeKey: 'sk_test_abc123realkey' });
      await withServer(createApp(), async (baseUrl) => {
        const res = await fetch(`${baseUrl}/health`);
        const body = await res.json();
        expect(body.stripeConfigured).toBe(true);
      });
    });
  });

  describe('billing routes without Stripe configured', () => {
    test('POST /api/billing/create-checkout-session returns 503, not a raw Stripe SDK error', async () => {
      const { createApp } = freshServerModule({ stripeKey: undefined });
      await withServer(createApp(), async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/billing/create-checkout-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId: 'premium_monthly', userId: 'u1' })
        });
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toMatch(/not configured/i);
      });
    });

    test('GET /api/billing/subscription/:userId returns 503', async () => {
      const { createApp } = freshServerModule({ stripeKey: undefined });
      await withServer(createApp(), async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/billing/subscription/u1`);
        expect(res.status).toBe(503);
      });
    });
  });

  describe('webhook raw-body handling', () => {
    // The global JSON-parsing middleware must skip this exact path so
    // stripe.webhooks.constructEvent() still receives the raw byte buffer it
    // needs to verify the signature. A syntactically well-formed (but
    // wrong-secret) signature header is used so constructEvent gets past
    // header parsing and actually inspects the body's type/bytes — that is
    // the step that fails differently depending on whether req.body arrived
    // as a raw Buffer (correct) or an already-parsed object (regression: a
    // bug reintroducing global express.json() ahead of this route).
    test('rejects with 400 because req.body is a raw Buffer, not a parsed object', async () => {
      const { createApp } = freshServerModule({ stripeKey: 'sk_test_abc123realkey' });
      await withServer(createApp(), async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/billing/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=deadbeef`
          },
          body: JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } })
        });
        expect(res.status).toBe(400);
        const text = await res.text();
        // "raw request body" (Buffer path) is the expected failure — a wrong
        // signature. "parsed JavaScript object" would mean req.body was
        // double-parsed upstream, which is the exact regression this guards.
        expect(text).toMatch(/raw request body/);
        expect(text).not.toMatch(/parsed JavaScript object/);
      });
    });
  });

  describe('unknown routes', () => {
    test('GET /nonexistent returns 404', async () => {
      const { createApp } = freshServerModule({ stripeKey: undefined });
      await withServer(createApp(), async (baseUrl) => {
        const res = await fetch(`${baseUrl}/nonexistent`);
        expect(res.status).toBe(404);
      });
    });
  });
});
