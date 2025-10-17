'use strict';

const path = require('path');
const DataManager = require('./data-manager');
const { randomUUID } = require('crypto');
const { ensureArray } = require('./validators');

class SubscriptionStore {
  constructor(options = {}) {
    const dataDir = options.dataDir || path.join(__dirname, '..', 'data');
    this.dataManager = options.dataManager || new DataManager({ dataDir });
    this.filename = options.filename || 'subscriptions.json';
  }

  async readAll() {
    const records = await this.dataManager.read(this.filename, []);
    return ensureArray(records);
  }

  async writeAll(records) {
    await this.dataManager.write(this.filename, records);
  }

  async getSubscription(customerId) {
    if (!customerId) {
      return null;
    }
    const records = await this.readAll();
    return records.find(record => record.customerId === customerId) || null;
  }

  async upsertSubscription(customerId, payload = {}) {
    if (!customerId) {
      throw new Error('customerId is required');
    }
    const records = await this.readAll();
    const index = records.findIndex(record => record.customerId === customerId);

    const normalized = {
      storeId: payload.storeId || randomUUID(),
      customerId,
      subscriptionId: payload.subscriptionId || null,
      status: payload.status || 'unknown',
      currentPeriodEnd: payload.currentPeriodEnd || null,
      planId: payload.planId || null,
      cancelAtPeriodEnd: Boolean(payload.cancelAtPeriodEnd),
      updatedAt: payload.updatedAt || Date.now()
    };

    if (index >= 0) {
      records[index] = { ...records[index], ...normalized };
    } else {
      records.push(normalized);
    }

    await this.writeAll(records);
    return normalized;
  }

  async removeSubscription(customerId) {
    if (!customerId) {
      return false;
    }
    const records = await this.readAll();
    const filtered = records.filter(record => record.customerId !== customerId);
    const changed = filtered.length !== records.length;
    if (changed) {
      await this.writeAll(filtered);
    }
    return changed;
  }

  async listSubscriptions() {
    return await this.readAll();
  }
}

module.exports = SubscriptionStore;
