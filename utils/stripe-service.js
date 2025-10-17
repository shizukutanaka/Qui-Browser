'use strict';

const stripe = require('stripe');
const crypto = require('crypto');

function ensureHttpsUrl(name, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Stripe ${name} URL is required`);
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Stripe ${name} URL must be a valid absolute URL`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`Stripe ${name} URL must use HTTPS`);
  }
  return parsed.toString();
}

class StripeService {
  constructor(options = {}) {
    const {
      secretKey = process.env.STRIPE_SECRET_KEY,
      priceId = process.env.STRIPE_PRICE_ID,
      webhookSecret = process.env.STRIPE_WEBHOOK_SECRET,
      successUrl = process.env.STRIPE_SUCCESS_URL,
      cancelUrl = process.env.STRIPE_CANCEL_URL,
      metadataStore
    } = options;

    if (!secretKey) {
      throw new Error('Stripe secret key is required');
    }
    if (!priceId) {
      throw new Error('Stripe price id is required');
    }
    const validatedSuccessUrl = ensureHttpsUrl('success', successUrl);
    const validatedCancelUrl = ensureHttpsUrl('cancel', cancelUrl);

    this.webhookSecret = webhookSecret || '';
    this.priceId = priceId;
    this.successUrl = validatedSuccessUrl;
    this.cancelUrl = validatedCancelUrl;
    this.metadataStore = metadataStore || {
      async getSubscription(_customerId) {
        return null;
      },
      async upsertSubscription(_customerId, payload) {
        return payload;
      },
      async removeSubscription(_customerId) {
        return true;
      }
    };

    this.stripe = stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: false
    });
  }

  /**
   * Checkout Sessionを作成
   */
  async createCheckoutSession(payload = {}) {
    const {
      customerEmail,
      customerId,
      locale = 'auto',
      trialDays = 0,
      priceId: priceIdOverride,
      quantity = 1,
      metadata = {},
      successUrl,
      cancelUrl,
      allowPromotionCodes = false,
      automaticTax = false,
      mode = 'subscription'
    } = payload;

    const priceForLineItem = priceIdOverride || this.priceId;
    if (!priceForLineItem) {
      throw new Error('Stripe price id is required for checkout session');
    }

    const sessionPayload = {
      mode,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceForLineItem,
          quantity: Number.isInteger(quantity) && quantity > 0 ? quantity : 1
        }
      ],
      success_url: successUrl || this.successUrl,
      cancel_url: cancelUrl || this.cancelUrl,
      metadata: { ...metadata }
    };

    if (customerEmail) {
      sessionPayload.customer_email = customerEmail;
    }
    if (customerId) {
      sessionPayload.customer = customerId;
    }
    if (trialDays > 0) {
      sessionPayload.subscription_plan_data = {
        trial_period_days: trialDays
      };
    }
    if (locale) {
      sessionPayload.locale = locale;
    }
    if (allowPromotionCodes) {
      sessionPayload.allow_promotion_codes = true;
    }
    if (automaticTax) {
      sessionPayload.automatic_tax = { enabled: true };
    }

    const session = await this.stripe.checkout.sessions.create(sessionPayload);
    return session;
  }

  /**
   * Webhook署名検証
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.webhookSecret) {
      throw new Error('Stripe webhook secret is not configured');
    }
    if (!payload) {
      throw new Error('Webhook payload is required');
    }
    if (!signature) {
      throw new Error('Webhook signature header is required');
    }

    return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
  }

  /**
   * Webhookイベント処理
   */
  async handleWebhookEvent(event) {
    const { type, data } = event;
    const object = data?.object;

    switch (type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(object);
      case 'customer.subscription.updated':
      case 'customer.subscription.created':
        return this.handleSubscriptionUpdated(object);
      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(object);
      case 'invoice.payment_succeeded':
        return this.handleInvoiceSucceeded(object);
      default:
        return { ignored: true };
    }
  }

  async handleCheckoutCompleted(session) {
    if (!session) {
      throw new Error('Checkout session payload missing');
    }

    const customerId = session.customer || session.customer_customer;
    const subscriptionId = session.subscription;

    if (!customerId) {
      throw new Error('Checkout session missing customer');
    }
    if (!subscriptionId) {
      throw new Error('Checkout session missing subscription');
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    await this.metadataStore.upsertSubscription(customerId, {
      subscriptionId,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      planId: subscription.items?.data?.[0]?.price?.id || this.priceId,
      updatedAt: Date.now()
    });

    return {
      customerId,
      subscriptionId
    };
  }

  async handleSubscriptionUpdated(subscription) {
    if (!subscription) {
      throw new Error('Subscription payload missing');
    }

    const customerId = subscription.customer;
    if (!customerId) {
      throw new Error('Subscription missing customer');
    }

    await this.metadataStore.upsertSubscription(customerId, {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: subscription.current_period_end,
      planId: subscription.items?.data?.[0]?.price?.id || this.priceId,
      cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      updatedAt: Date.now()
    });

    return {
      customerId,
      subscriptionId: subscription.id,
      status: subscription.status
    };
  }

  async handleSubscriptionDeleted(subscription) {
    if (!subscription) {
      throw new Error('Subscription payload missing');
    }

    const customerId = subscription.customer;
    if (!customerId) {
      throw new Error('Subscription missing customer');
    }

    await this.metadataStore.removeSubscription(customerId);

    return {
      customerId,
      subscriptionId: subscription.id,
      status: 'canceled'
    };
  }

  async handleInvoiceSucceeded(invoice) {
    if (!invoice) {
      throw new Error('Invoice payload missing');
    }

    const customerId = invoice.customer;
    if (!customerId) {
      throw new Error('Invoice missing customer');
    }

    const subscriptionId = invoice.subscription;
    if (!subscriptionId) {
      throw new Error('Invoice missing subscription');
    }

    await this.metadataStore.upsertSubscription(customerId, {
      subscriptionId,
      status: 'active',
      currentPeriodEnd: invoice.lines?.data?.[0]?.period?.end || null,
      planId: invoice.lines?.data?.[0]?.plan?.id || this.priceId,
      updatedAt: Date.now()
    });

    return {
      customerId,
      subscriptionId,
      invoiceId: invoice.id
    };
  }

  async isSubscriptionActive(customerId) {
    if (!customerId) {
      return false;
    }
    const record = await this.metadataStore.getSubscription(customerId);
    if (!record) {
      return false;
    }
    if (record.status === 'active' || record.status === 'trialing') {
      return true;
    }
    if (record.status === 'past_due') {
      const now = Math.floor(Date.now() / 1000);
      return typeof record.currentPeriodEnd === 'number' && record.currentPeriodEnd > now;
    }
    return false;
  }

  /**
   * 安全なWebhook応答
   */
  buildWebhookResponse(body) {
    return JSON.stringify({ received: true, ...body });
  }

  /**
   * Webhookシークレットが無い場合のフォールバック
   */
  static simulateEventSignature(payload, secret) {
    const encoded = typeof payload === 'string' ? payload : JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(encoded, 'utf8').digest('hex');
  }
}

module.exports = StripeService;
