'use strict';

const path = require('path');
const DataManager = require('./data-manager');
const { ensureObject } = require('./validators');

class PricingStore {
  constructor(options = {}) {
    const dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.dataManager = options.dataManager || new DataManager({ dataDir });
    this.filename = options.filename || 'pricing.json';
  }

  async readAll() {
    const stored = await this.dataManager.read(this.filename, {});
    return ensureObject(stored);
  }

  async writeAll(records) {
    await this.dataManager.write(this.filename, ensureObject(records));
  }

  async get(locale) {
    if (!locale || typeof locale !== 'string') {
      return null;
    }
    const records = await this.readAll();
    return records[locale] || null;
  }

  async set(locale, record) {
    if (!locale || typeof locale !== 'string') {
      throw new Error('Locale is required');
    }
    const normalized = locale.toLowerCase();
    const payload = {
      locale: normalized,
      priceId: record.priceId,
      currency: record.currency,
      unitAmount: record.unitAmount,
      recurring: record.recurring || null,
      updatedAt: Date.now()
    };
    const records = await this.readAll();
    records[normalized] = payload;
    await this.writeAll(records);
    return payload;
  }

  async delete(locale) {
    if (!locale || typeof locale !== 'string') {
      throw new Error('Locale is required');
    }
    const normalized = locale.toLowerCase();
    const records = await this.readAll();
    if (records[normalized]) {
      delete records[normalized];
      await this.writeAll(records);
      return true;
    }
    return false;
  }

  async list() {
    return this.readAll();
  }
}

module.exports = PricingStore;
