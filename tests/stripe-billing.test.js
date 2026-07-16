/**
 * Unit tests for server/stripe-billing.js's fail-safe defaults.
 *
 * No database is wired up in this file (every db.* call is commented out
 * pending a real persistence layer), so three spots previously fabricated a
 * successful/paid response instead of an honest "unimplemented" or "free
 * tier" default:
 *   - GET  /subscription/:userId always returned a fake 'active premium_monthly'
 *   - POST /create-portal-session used a hardcoded fake customer id
 *   - checkFeatureAccess() middleware hardcoded planId = 'premium_monthly'
 *     for every request, which would grant every authenticated user paid
 *     features the moment real auth middleware sets req.user
 * These tests hit the router directly (no live Stripe calls needed for any
 * of the three, since each fails/defaults before reaching the Stripe SDK).
 */

const express = require('express');
const { router: billingRouter, checkFeatureAccess } = require('../server/stripe-billing.js');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRouter);
  return app;
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const { port } = server.address();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

describe('stripe-billing.js fail-safe defaults (no database wired up)', () => {
  test('GET /subscription/:userId defaults to free/inactive, not a fake active premium plan', async () => {
    await withServer(makeApp(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/billing/subscription/any-user`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.plan).toBe('free');
      expect(body.status).toBe('inactive');
      expect(body.features.multiplayer).toBe(false); // free tier has no paid features
    });
  });

  test('POST /create-portal-session rejects a missing customerId with 400', async () => {
    await withServer(makeApp(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u1', returnUrl: 'https://example.com/back' })
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/customerId/);
    });
  });

  test('POST /create-portal-session rejects a customerId not shaped like a Stripe customer id', async () => {
    await withServer(makeApp(), async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/billing/create-portal-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: 'not-a-real-id' })
      });
      expect(res.status).toBe(400);
    });
  });

  describe('checkFeatureAccess middleware', () => {
    function makeReqRes() {
      const req = { user: { id: 'u1' } };
      const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; }
      };
      return { req, res };
    }

    test('denies a paid-only feature (defaults to the free plan, not premium)', async () => {
      const { req, res } = makeReqRes();
      const next = jest.fn();
      await checkFeatureAccess('multiplayer')(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(403);
      expect(res.body.currentPlan).toBe('free');
      expect(res.body.upgradeRequired).toBe(true);
    });

    test('allows a free-tier feature to pass through', async () => {
      const { req, res } = makeReqRes();
      const next = jest.fn();
      await checkFeatureAccess('vrBrowsing')(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.statusCode).toBeNull();
    });
  });
});
