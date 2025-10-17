'use strict';

const LEVEL_RANK = {
  info: 0,
  warning: 1,
  error: 2
};

const DEFAULT_RETRY_LIMIT = 3;
const DEFAULT_RETRY_BACKOFF = 500; // ms
const MAX_RETRY_BACKOFF = 10000; // ms

/**
 * @param {number} attempt
 * @param {number} base
 */
function calculateBackoff(attempt, base) {
  const delay = Math.min(MAX_RETRY_BACKOFF, Math.floor(base * Math.pow(2, attempt)));
  const jitter = Math.floor(delay * 0.1 * Math.random());
  return delay + jitter;
}

function normalizeWebhookList(webhooks) {
  if (!Array.isArray(webhooks)) {
    return [];
  }
  const normalized = [];
  for (const entry of webhooks) {
    if (typeof entry !== 'string') {
      continue;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const url = new URL(trimmed);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        console.warn(`[notification] Skipping webhook with unsupported protocol: ${trimmed}`);
        continue;
      }
      normalized.push(url.toString());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[notification] Skipping invalid webhook URL (${trimmed}): ${message}`);
    }
  }
  return normalized;
}

class NotificationDispatcher {
  /**
   * @param {object} [config] - Configuration
   * @param {boolean} [config.enabled] - Enable notifications
   * @param {string[]} [config.webhooks] - Webhook URLs
   * @param {string} [config.minLevel] - Minimum log level
   * @param {number} [config.timeoutMs] - Request timeout
   * @param {number} [config.batchWindowMs] - Batch window
   * @param {number} [config.retryLimit] - Retry limit
   * @param {number} [config.retryBackoffMs] - Retry backoff
   */
  constructor(config = {}) {
    this.enabled = Boolean(config.enabled);
    this.webhooks = normalizeWebhookList(config.webhooks);
    this.minLevel = this.normalizeLevel(config.minLevel);
    this.timeoutMs = Number.isFinite(config.timeoutMs) ? config.timeoutMs : 5000;
    this.batchWindowMs = Number.isFinite(config.batchWindowMs) ? config.batchWindowMs : 0;
    const retryLimitCandidate =
      typeof config.retryLimit === 'number' && Number.isInteger(config.retryLimit) ? config.retryLimit : undefined;
    this.retryLimit = retryLimitCandidate !== undefined ? Math.max(0, retryLimitCandidate) : DEFAULT_RETRY_LIMIT;
    const retryBackoffCandidate =
      typeof config.retryBackoffMs === 'number' && Number.isFinite(config.retryBackoffMs)
        ? config.retryBackoffMs
        : undefined;
    this.retryBackoffMs =
      retryBackoffCandidate !== undefined ? Math.max(100, retryBackoffCandidate) : DEFAULT_RETRY_BACKOFF;

    /** @type {Array<{ level: string, type: string, title: string, timestamp: string, data: any }>} */
    this.pendingQueue = [];
    this.flushTimer = null;
    this.dispatchedCount = 0;
    this.failedCount = 0;
    this.lastDispatchAt = null;
  }

  normalizeLevel(level) {
    const candidate = typeof level === 'string' ? level.trim().toLowerCase() : '';
    if (candidate in LEVEL_RANK) {
      return candidate;
    }
    return 'error';
  }

  isEnabled() {
    return this.enabled && this.webhooks.length > 0;
  }

  levelAllowed(level) {
    const levelRank = LEVEL_RANK[level] ?? LEVEL_RANK.error;
    const minRank = LEVEL_RANK[this.minLevel] ?? LEVEL_RANK.error;
    return levelRank >= minRank;
  }

  /**
   * @param {{ level?: string, type?: string, title?: string, data?: any }} event
   */
  async dispatch(event) {
    if (!this.isEnabled()) {
      return;
    }
    const level = this.normalizeLevel(event?.level || 'info');
    if (!this.levelAllowed(level)) {
      return;
    }

    const payload = {
      level,
      type: typeof event?.type === 'string' ? event.type : 'event',
      title: typeof event?.title === 'string' ? event.title : '',
      timestamp: new Date().toISOString(),
      data: event?.data ?? {}
    };
    if (this.batchWindowMs > 0) {
      this.enqueue(payload);
      return;
    }
    await this.sendToAllWebhooks([payload]);
  }

  enqueue(payload) {
    this.pendingQueue.push(payload);
    if (this.flushTimer) {
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      const batch = this.pendingQueue.splice(0, this.pendingQueue.length);
      if (batch.length === 0) {
        return;
      }
      void this.sendToAllWebhooks(batch);
    }, this.batchWindowMs);
    if (typeof this.flushTimer.unref === 'function') {
      this.flushTimer.unref();
    }
  }

  async sendToAllWebhooks(events) {
    if (events.length === 0) {
      return;
    }
    const payload =
      events.length === 1
        ? events[0]
        : {
            level: this.normalizeLevel(
              events.reduce((highest, current) => {
                return LEVEL_RANK[current.level] > LEVEL_RANK[highest] ? current.level : highest;
              }, events[0].level)
            ),
            type: 'batch',
            title:
              events
                .map(entry => entry.title)
                .filter(Boolean)
                .join(' | ') || 'Batched notifications',
            timestamp: new Date().toISOString(),
            data: {
              entries: events
            }
          };

    const results = await Promise.allSettled(this.webhooks.map(url => this.postWithRetry(url, payload)));
    const failures = results.filter(result => result.status === 'rejected').length;
    this.dispatchedCount += this.webhooks.length - failures;
    this.failedCount += failures;
    this.lastDispatchAt = Date.now();
  }

  async postWithRetry(targetUrl, payload) {
    let attempt = 0;
    let lastError;
    while (attempt <= this.retryLimit) {
      try {
        await this.postWebhook(targetUrl, payload);
        return;
      } catch (error) {
        lastError = error;
        if (attempt === this.retryLimit) {
          break;
        }
        const backoff = calculateBackoff(attempt, this.retryBackoffMs);
        await new Promise(resolve => setTimeout(resolve, backoff));
      }
      attempt += 1;
    }
    throw lastError || new Error('Unknown notification dispatch error');
  }

  async postWebhook(targetUrl, payload) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[notification] Failed to send webhook to ${targetUrl}: ${message}`);
      throw error;
    }
  }
}

module.exports = NotificationDispatcher;
