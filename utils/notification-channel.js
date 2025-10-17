/**
 * Real-time Notification Channel
 * Consolidated real-time notification system
 * Priority: H022 from improvement backlog
 *
 * @module utils/notification-channel
 */

const EventEmitter = require('events');

class NotificationChannel extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      enableEmail: options.enableEmail || false,
      enableSlack: options.enableSlack || false,
      enableWebhook: options.enableWebhook || false,
      enableSMS: options.enableSMS || false,
      enablePushNotification: options.enablePushNotification || false,
      severityLevels: options.severityLevels || ['critical', 'error', 'warning', 'info'],
      rateLimiting: options.rateLimiting !== false,
      rateLimitWindow: options.rateLimitWindow || 60000, // 1 minute
      rateLimitMax: options.rateLimitMax || 10,
      ...options
    };

    // Channel handlers
    this.channels = {
      email: null,
      slack: null,
      webhook: null,
      sms: null,
      push: null
    };

    // Rate limiting
    this.notifications = new Map();

    // Initialize channels
    this.initializeChannels();
  }

  /**
   * Initialize notification channels
   */
  initializeChannels() {
    if (this.options.enableEmail) {
      this.channels.email = this.createEmailChannel();
    }

    if (this.options.enableSlack) {
      this.channels.slack = this.createSlackChannel();
    }

    if (this.options.enableWebhook) {
      this.channels.webhook = this.createWebhookChannel();
    }

    if (this.options.enableSMS) {
      this.channels.sms = this.createSMSChannel();
    }

    if (this.options.enablePushNotification) {
      this.channels.push = this.createPushChannel();
    }
  }

  /**
   * Send notification
   * @param {Object} notification - Notification data
   * @returns {Promise<Object>} Result
   */
  async send(notification) {
    const {
      severity = 'info',
      title,
      message,
      channels = null, // null = all channels
      metadata = {}
    } = notification;

    // Validate severity
    if (!this.options.severityLevels.includes(severity)) {
      throw new Error(`Invalid severity: ${severity}`);
    }

    // Rate limiting check
    if (this.options.rateLimiting) {
      if (!this.checkRateLimit(notification)) {
        console.warn('[NotificationChannel] Rate limit exceeded, notification dropped');
        return { success: false, reason: 'rate_limit_exceeded' };
      }
    }

    const enrichedNotification = {
      ...notification,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
      hostname: require('os').hostname(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Determine target channels
    const targetChannels = channels || Object.keys(this.channels).filter(ch => this.channels[ch]);

    const results = {};

    // Send to each channel
    for (const channelName of targetChannels) {
      const channel = this.channels[channelName];

      if (!channel) {
        results[channelName] = { success: false, reason: 'channel_not_configured' };
        continue;
      }

      try {
        const result = await channel.send(enrichedNotification);
        results[channelName] = { success: true, ...result };
      } catch (error) {
        console.error(`[NotificationChannel] ${channelName} error:`, error);
        results[channelName] = { success: false, error: error.message };
      }
    }

    // Record notification
    this.recordNotification(enrichedNotification);

    // Emit event
    this.emit('notification', enrichedNotification, results);

    return {
      success: Object.values(results).some(r => r.success),
      results,
      notification: enrichedNotification
    };
  }

  /**
   * Check rate limit
   * @param {Object} notification - Notification
   * @returns {boolean} Allowed
   */
  checkRateLimit(notification) {
    const key = `${notification.severity}::${notification.title}`;
    const now = Date.now();

    if (!this.notifications.has(key)) {
      this.notifications.set(key, []);
    }

    const timestamps = this.notifications.get(key);

    // Remove old timestamps
    const filtered = timestamps.filter(ts =>
      now - ts < this.options.rateLimitWindow
    );

    if (filtered.length >= this.options.rateLimitMax) {
      return false;
    }

    filtered.push(now);
    this.notifications.set(key, filtered);

    return true;
  }

  /**
   * Record notification
   * @param {Object} notification - Notification
   */
  recordNotification(notification) {
    // Implement persistent storage if needed
    this.emit('recorded', notification);
  }

  /**
   * Create email channel
   * @returns {Object} Email channel
   */
  createEmailChannel() {
    return {
      send: async (notification) => {
        const emailConfig = this.options.emailConfig || {};

        // Email implementation would go here
        // Using nodemailer or similar

        console.log('[Email] Sending:', notification.title);

        return {
          channelType: 'email',
          recipients: emailConfig.recipients || [],
          messageId: `email-${Date.now()}`
        };
      }
    };
  }

  /**
   * Create Slack channel
   * @returns {Object} Slack channel
   */
  createSlackChannel() {
    return {
      send: async (notification) => {
        const slackConfig = this.options.slackConfig || {};

        const color = {
          critical: 'danger',
          error: 'danger',
          warning: 'warning',
          info: 'good'
        }[notification.severity] || '#808080';

        const payload = {
          username: slackConfig.username || 'Qui Browser',
          icon_emoji: slackConfig.iconEmoji || ':robot_face:',
          attachments: [
            {
              color,
              title: notification.title,
              text: notification.message,
              fields: [
                {
                  title: 'Severity',
                  value: notification.severity.toUpperCase(),
                  short: true
                },
                {
                  title: 'Environment',
                  value: notification.environment,
                  short: true
                },
                {
                  title: 'Hostname',
                  value: notification.hostname,
                  short: true
                },
                {
                  title: 'Timestamp',
                  value: notification.datetime,
                  short: true
                }
              ],
              footer: 'Qui Browser Notification System',
              ts: Math.floor(notification.timestamp / 1000)
            }
          ]
        };

        if (slackConfig.webhookUrl) {
          // Send to Slack webhook
          // const response = await fetch(slackConfig.webhookUrl, {
          //   method: 'POST',
          //   headers: { 'Content-Type': 'application/json' },
          //   body: JSON.stringify(payload)
          // });
        }

        console.log('[Slack] Sending:', notification.title);

        return {
          channelType: 'slack',
          webhook: slackConfig.webhookUrl || 'not_configured',
          messageId: `slack-${Date.now()}`
        };
      }
    };
  }

  /**
   * Create webhook channel
   * @returns {Object} Webhook channel
   */
  createWebhookChannel() {
    return {
      send: async (notification) => {
        const webhookConfig = this.options.webhookConfig || {};

        const payload = {
          event: 'notification',
          severity: notification.severity,
          title: notification.title,
          message: notification.message,
          timestamp: notification.timestamp,
          datetime: notification.datetime,
          hostname: notification.hostname,
          environment: notification.environment,
          metadata: notification.metadata
        };

        if (webhookConfig.url) {
          // Send to webhook
          // const response = await fetch(webhookConfig.url, {
          //   method: 'POST',
          //   headers: {
          //     'Content-Type': 'application/json',
          //     'X-Webhook-Secret': webhookConfig.secret || ''
          //   },
          //   body: JSON.stringify(payload)
          // });
        }

        console.log('[Webhook] Sending:', notification.title);

        return {
          channelType: 'webhook',
          url: webhookConfig.url || 'not_configured',
          messageId: `webhook-${Date.now()}`
        };
      }
    };
  }

  /**
   * Create SMS channel
   * @returns {Object} SMS channel
   */
  createSMSChannel() {
    return {
      send: async (notification) => {
        const smsConfig = this.options.smsConfig || {};

        const message = `[${notification.severity.toUpperCase()}] ${notification.title}: ${notification.message}`;

        // SMS implementation would go here
        // Using Twilio or similar

        console.log('[SMS] Sending:', notification.title);

        return {
          channelType: 'sms',
          recipients: smsConfig.recipients || [],
          messageId: `sms-${Date.now()}`
        };
      }
    };
  }

  /**
   * Create push notification channel
   * @returns {Object} Push channel
   */
  createPushChannel() {
    return {
      send: async (notification) => {
        const pushConfig = this.options.pushConfig || {};

        const payload = {
          title: notification.title,
          body: notification.message,
          icon: pushConfig.icon || '/icon.png',
          badge: pushConfig.badge || '/badge.png',
          tag: notification.severity,
          data: {
            severity: notification.severity,
            timestamp: notification.timestamp,
            ...notification.metadata
          }
        };

        // Push notification implementation would go here
        // Using web-push or similar

        console.log('[Push] Sending:', notification.title);

        return {
          channelType: 'push',
          messageId: `push-${Date.now()}`
        };
      }
    };
  }

  /**
   * Send critical alert
   * @param {string} title - Alert title
   * @param {string} message - Alert message
   * @param {Object} metadata - Additional data
   */
  async critical(title, message, metadata = {}) {
    return this.send({
      severity: 'critical',
      title,
      message,
      metadata
    });
  }

  /**
   * Send error notification
   * @param {string} title - Error title
   * @param {string} message - Error message
   * @param {Object} metadata - Additional data
   */
  async error(title, message, metadata = {}) {
    return this.send({
      severity: 'error',
      title,
      message,
      metadata
    });
  }

  /**
   * Send warning notification
   * @param {string} title - Warning title
   * @param {string} message - Warning message
   * @param {Object} metadata - Additional data
   */
  async warning(title, message, metadata = {}) {
    return this.send({
      severity: 'warning',
      title,
      message,
      metadata
    });
  }

  /**
   * Send info notification
   * @param {string} title - Info title
   * @param {string} message - Info message
   * @param {Object} metadata - Additional data
   */
  async info(title, message, metadata = {}) {
    return this.send({
      severity: 'info',
      title,
      message,
      metadata
    });
  }

  /**
   * Get notification statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const stats = {
      totalChannels: Object.keys(this.channels).filter(k => this.channels[k]).length,
      enabledChannels: Object.keys(this.channels).filter(k => this.channels[k]).map(k => k),
      rateLimitEntries: this.notifications.size
    };

    return stats;
  }

  /**
   * Test notification channels
   * @returns {Promise<Object>} Test results
   */
  async test() {
    return this.send({
      severity: 'info',
      title: 'Notification System Test',
      message: 'This is a test notification from Qui Browser notification system.',
      metadata: { test: true }
    });
  }
}

module.exports = NotificationChannel;
