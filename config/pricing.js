'use strict';

const DEFAULT_PLAN_CODE = process.env.BILLING_DEFAULT_PLAN || 'pro-monthly';

const PLAN_PRESETS = Object.freeze({
  'pro-monthly': Object.freeze({
    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY || '',
    currency: 'usd',
    unitAmount: 3900,
    interval: 'month',
    trialDays: 14,
    seatsIncluded: 5,
    overageUnitAmount: 700,
    productName: 'Qui Browser Pro Monthly'
  }),
  'pro-yearly': Object.freeze({
    priceId: process.env.STRIPE_PRICE_PRO_YEARLY || '',
    currency: 'usd',
    unitAmount: 39900,
    interval: 'year',
    trialDays: 30,
    seatsIncluded: 10,
    overageUnitAmount: 600,
    productName: 'Qui Browser Pro Yearly'
  }),
  'enterprise-monthly': Object.freeze({
    priceId: process.env.STRIPE_PRICE_ENT_MONTHLY || '',
    currency: 'usd',
    unitAmount: 9900,
    interval: 'month',
    trialDays: 30,
    seatsIncluded: 25,
    overageUnitAmount: 1200,
    productName: 'Qui Browser Enterprise Monthly'
  }),
  'enterprise-yearly': Object.freeze({
    priceId: process.env.STRIPE_PRICE_ENT_YEARLY || '',
    currency: 'usd',
    unitAmount: 99900,
    interval: 'year',
    trialDays: 45,
    seatsIncluded: 50,
    overageUnitAmount: 950,
    productName: 'Qui Browser Enterprise Yearly'
  })
});

const LOCALE_ALIASES = Object.freeze({
  'en-us': 'en',
  'en-gb': 'en-gb',
  'en-au': 'en',
  'ja-jp': 'ja-jp',
  'es-es': 'es',
  'es-mx': 'es-mx',
  'es-la': 'es',
  'zh-cn': 'zh',
  'zh-tw': 'zh',
  'fr-fr': 'fr',
  'fr-ca': 'fr',
  'de-de': 'de-de',
  'it-it': 'it',
  'pt-br': 'pt-br',
  'pt-pt': 'pt',
  'ru-ru': 'ru',
  'ko-kr': 'ko',
  'ar-ae': 'ar',
  'ar-sa': 'ar',
  'hi-in': 'hi',
  'id-id': 'id'
});

const LOCALE_OVERRIDES = Object.freeze({
  default: Object.freeze({ plan: DEFAULT_PLAN_CODE, currency: null, unitAmount: null }),
  en: Object.freeze({ plan: 'pro-monthly', currency: null, unitAmount: null }),
  'en-gb': Object.freeze({
    plan: 'pro-monthly',
    currency: 'gbp',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_GB || 3200)
  }),
  'en-au': Object.freeze({
    plan: 'pro-monthly',
    currency: 'aud',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_AU || 5900)
  }),
  'ja-jp': Object.freeze({
    plan: process.env.BILLING_PLAN_JA || 'pro-monthly',
    currency: 'jpy',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_JA || 5800)
  }),
  es: Object.freeze({
    plan: 'pro-monthly',
    currency: 'eur',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_ES || 3600)
  }),
  'es-mx': Object.freeze({
    plan: 'pro-monthly',
    currency: 'mxn',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_MX || 72000)
  }),
  zh: Object.freeze({
    plan: 'pro-monthly',
    currency: 'hkd',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_ZH || 4800)
  }),
  fr: Object.freeze({
    plan: 'pro-monthly',
    currency: 'eur',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_FR || 3600)
  }),
  'de-de': Object.freeze({
    plan: process.env.BILLING_PLAN_DE || 'pro-monthly',
    currency: 'eur',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_DE || 3600)
  }),
  ko: Object.freeze({
    plan: 'pro-monthly',
    currency: 'krw',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_KR || 7200)
  }),
  ar: Object.freeze({
    plan: 'pro-monthly',
    currency: 'aed',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_AR || 2000)
  }),
  hi: Object.freeze({
    plan: 'pro-monthly',
    currency: 'inr',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_IN || 2900)
  }),
  id: Object.freeze({
    plan: 'pro-monthly',
    currency: 'idr',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_ID || 650000)
  }),
  ru: Object.freeze({
    plan: process.env.BILLING_PLAN_RU || 'pro-monthly',
    currency: 'rub',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_RU || 320000)
  }),
  'pt-br': Object.freeze({
    plan: 'pro-monthly',
    currency: 'brl',
    unitAmount: Number(process.env.BILLING_UNIT_AMOUNT_BR || 2200)
  })
});

function normalizeLocale(value) {
  if (!value || typeof value !== 'string') {
    return 'default';
  }
  const lowered = value.toLowerCase();
  if (LOCALE_OVERRIDES[lowered]) {
    return lowered;
  }
  if (LOCALE_ALIASES[lowered]) {
    return LOCALE_ALIASES[lowered];
  }
  const [language] = lowered.split(/[-_]/);
  if (LOCALE_OVERRIDES[language]) {
    return language;
  }
  if (LOCALE_ALIASES[language]) {
    return LOCALE_ALIASES[language];
  }
  return 'default';
}

function resolvePlan(planCode) {
  const code = typeof planCode === 'string' ? planCode.trim().toLowerCase() : '';
  if (code && PLAN_PRESETS[code]) {
    return PLAN_PRESETS[code];
  }
  if (PLAN_PRESETS[DEFAULT_PLAN_CODE]) {
    return PLAN_PRESETS[DEFAULT_PLAN_CODE];
  }
  return PLAN_PRESETS['pro-monthly'];
}

function resolvePricing(locale, explicitPlan) {
  const normalizedLocale = normalizeLocale(locale);
  const override = LOCALE_OVERRIDES[normalizedLocale] || LOCALE_OVERRIDES.default;
  const overrideRecord = /** @type {Record<string, unknown>} */ (override);
  const planConfig = resolvePlan(explicitPlan || overrideRecord.plan);
  const overrideCurrency =
    typeof overrideRecord.currency === 'string' && overrideRecord.currency.trim().length > 0
      ? overrideRecord.currency.trim().toLowerCase()
      : undefined;
  const overrideUnitAmount = Number.isFinite(overrideRecord.unitAmount) ? Number(overrideRecord.unitAmount) : undefined;

  const merged = {
    locale: normalizedLocale,
    planCode: explicitPlan || /** @type {string} */ (overrideRecord.plan) || DEFAULT_PLAN_CODE,
    currency: overrideCurrency || planConfig.currency,
    unitAmount: overrideUnitAmount !== undefined ? overrideUnitAmount : planConfig.unitAmount,
    interval: planConfig.interval,
    priceId: planConfig.priceId,
    productName: planConfig.productName,
    trialDays: planConfig.trialDays,
    seatsIncluded: planConfig.seatsIncluded,
    overageUnitAmount: planConfig.overageUnitAmount
  };

  if (process.env.BILLING_FORCE_TRIAL_DAYS) {
    const forced = Number(process.env.BILLING_FORCE_TRIAL_DAYS);
    if (Number.isFinite(forced) && forced >= 0) {
      merged.trialDays = forced;
    }
  }

  return merged;
}

function getSupportedLocales() {
  return Object.keys(LOCALE_OVERRIDES).sort();
}

function auditPricingConfig() {
  const missingPriceLocales = [];
  const summary = {};

  for (const [locale, override] of Object.entries(LOCALE_OVERRIDES)) {
    const overrideRecord = /** @type {Record<string, unknown>} */ (override);
    const planCode =
      typeof overrideRecord.plan === 'string' && overrideRecord.plan.trim()
        ? overrideRecord.plan.trim()
        : DEFAULT_PLAN_CODE;
    const plan = resolvePlan(planCode);
    const hasPriceId = typeof plan.priceId === 'string' && plan.priceId.trim().length > 0;
    if (!hasPriceId) {
      missingPriceLocales.push(locale);
    }
    const overrideCurrency =
      typeof overrideRecord.currency === 'string' && overrideRecord.currency.trim().length > 0
        ? overrideRecord.currency.trim().toLowerCase()
        : undefined;
    const overrideUnitAmount = Number.isFinite(overrideRecord.unitAmount)
      ? Number(overrideRecord.unitAmount)
      : undefined;

    summary[locale] = {
      planCode,
      currency: overrideCurrency || plan.currency,
      unitAmount: overrideUnitAmount !== undefined ? overrideUnitAmount : plan.unitAmount,
      interval: plan.interval,
      hasPriceId
    };
  }

  return {
    totalLocales: Object.keys(summary).length,
    defaultLocale: 'default',
    missingPriceLocales,
    summary
  };
}

module.exports = {
  PLAN_PRESETS,
  LOCALE_OVERRIDES,
  normalizeLocale,
  resolvePlan,
  resolvePricing,
  getSupportedLocales,
  auditPricingConfig
};
