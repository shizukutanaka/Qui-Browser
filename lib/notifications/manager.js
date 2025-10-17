/**
 * Qui Browser - Notification Manager
 *
 * Comprehensive email/SMS notification system with templates, scheduling, and delivery tracking
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class NotificationManager {
  constructor(config, databaseManager) {
    this.config = config;
    this.databaseManager = databaseManager;

    // Email configuration
    this.emailConfig = config.notifications?.email || {};
    this.smtpConfig = this.emailConfig.smtp || {};

    // SMS configuration
    this.smsConfig = config.notifications?.sms || {};

    // Template configuration
    this.templates = new Map();
    this.templateDir = path.join(process.cwd(), 'templates', 'notifications');

    // Queue and scheduling
    this.notificationQueue = [];
    this.scheduledNotifications = new Map();
    this.processingInterval = null;
    this.scheduleInterval = null;

    // Delivery tracking
    this.deliveryStats = new Map();

    // Services
    this.emailService = null;
    this.smsService = null;

    // Rate limiting
    this.sendRates = new Map();
    this.rateLimits = {
      email: { perMinute: 100, perHour: 1000, perDay: 5000 },
      sms: { perMinute: 10, perHour: 100, perDay: 500 }
    };

    this.initialize();
  }

  async initialize() {
    // Load email service
    if (this.emailConfig.enabled) {
      await this.initializeEmailService();
    }

    // Load SMS service
    if (this.smsConfig.enabled) {
      await this.initializeSmsService();
    }

    // Load notification templates
    await this.loadTemplates();

    // Start processing queues
    this.startProcessing();

    // Initialize delivery statistics
    this.initializeDeliveryStats();

    console.log('Notification manager initialized');
  }

  async initializeEmailService() {
    try {
      if (this.emailConfig.provider === 'sendgrid') {
        // SendGrid integration
        const sendgridMail = require('@sendgrid/mail');
        sendgridMail.setApiKey(this.emailConfig.sendgridApiKey);
        this.emailService = sendgridMail;
      } else if (this.emailConfig.provider === 'ses') {
        // AWS SES integration
        const AWS = require('aws-sdk');
        AWS.config.update({
          accessKeyId: this.emailConfig.awsAccessKeyId,
          secretAccessKey: this.emailConfig.awsSecretAccessKey,
          region: this.emailConfig.awsRegion
        });
        this.emailService = new AWS.SES({ apiVersion: '2010-12-01' });
      } else if (this.emailConfig.provider === 'smtp') {
        // SMTP integration
        const nodemailer = require('nodemailer');
        this.emailService = nodemailer.createTransporter({
          host: this.smtpConfig.host,
          port: this.smtpConfig.port,
          secure: this.smtpConfig.secure,
          auth: {
            user: this.smtpConfig.user,
            pass: this.smtpConfig.pass
          }
        });
      }

      console.log(`Email service initialized: ${this.emailConfig.provider}`);
    } catch (error) {
      console.error('Failed to initialize email service:', error);
    }
  }

  async initializeSmsService() {
    try {
      if (this.smsConfig.provider === 'twilio') {
        // Twilio integration
        const twilio = require('twilio');
        this.smsService = twilio(this.smsConfig.accountSid, this.smsConfig.authToken);
      } else if (this.smsConfig.provider === 'sns') {
        // AWS SNS integration
        const AWS = require('aws-sdk');
        AWS.config.update({
          accessKeyId: this.smsConfig.awsAccessKeyId,
          secretAccessKey: this.smsConfig.awsSecretAccessKey,
          region: this.smsConfig.awsRegion
        });
        this.smsService = new AWS.SNS({ apiVersion: '2010-03-31' });
      }

      console.log(`SMS service initialized: ${this.smsConfig.provider}`);
    } catch (error) {
      console.error('Failed to initialize SMS service:', error);
    }
  }

  async loadTemplates() {
    try {
      const templateFiles = await fs.readdir(this.templateDir);

      for (const file of templateFiles) {
        if (file.endsWith('.json')) {
          const templateName = path.basename(file, '.json');
          const templatePath = path.join(this.templateDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf8');
          const template = JSON.parse(templateContent);

          this.templates.set(templateName, template);
        }
      }

      console.log(`Loaded ${this.templates.size} notification templates`);
    } catch (error) {
      console.warn('Failed to load notification templates:', error.message);
      // Load default templates
      this.loadDefaultTemplates();
    }
  }

  loadDefaultTemplates() {
    const defaultTemplates = {
      welcome_email: {
        subject: 'Welcome to Qui Browser!',
        html: '<h1>Welcome {{user.firstName}}!</h1><p>Thank you for joining Qui Browser.</p>',
        text: 'Welcome {{user.firstName}}! Thank you for joining Qui Browser.'
      },
      password_reset: {
        subject: 'Password Reset Request',
        html: '<p>Click here to reset your password: {{resetLink}}</p>',
        text: 'Reset your password: {{resetLink}}'
      },
      account_verification: {
        subject: 'Verify Your Account',
        html: '<p>Click here to verify your account: {{verificationLink}}</p>',
        text: 'Verify your account: {{verificationLink}}'
      },
      security_alert: {
        subject: 'Security Alert',
        html: '<p>{{message}}</p>',
        text: '{{message}}'
      },
      marketing_newsletter: {
        subject: '{{subject}}',
        html: '{{content}}',
        text: '{{content}}'
      }
    };

    Object.entries(defaultTemplates).forEach(([name, template]) => {
      this.templates.set(name, template);
    });
  }

  startProcessing() {
    // Process notification queue every 5 seconds
    this.processingInterval = setInterval(() => {
      this.processNotificationQueue();
    }, 5000);

    // Check scheduled notifications every minute
    this.scheduleInterval = setInterval(() => {
      this.processScheduledNotifications();
    }, 60000);
  }

  /**
   * Send a notification
   */
  async sendNotification(notification) {
    const {
      type, // 'email' or 'sms'
      to,
      template,
      data = {},
      options = {}
    } = notification;

    try {
      // Check rate limits
      if (!this.checkRateLimit(type, to)) {
        throw new Error(`Rate limit exceeded for ${type} to ${to}`);
      }

      // Get template
      const notificationTemplate = this.templates.get(template);
      if (!notificationTemplate) {
        throw new Error(`Template '${template}' not found`);
      }

      // Render template
      const rendered = this.renderTemplate(notificationTemplate, data);

      // Send notification
      let result;
      if (type === 'email') {
        result = await this.sendEmail(to, rendered, options);
      } else if (type === 'sms') {
        result = await this.sendSms(to, rendered, options);
      } else {
        throw new Error(`Unsupported notification type: ${type}`);
      }

      // Track delivery
      await this.trackDelivery(notification, result);

      return {
        success: true,
        id: result.id,
        type,
        to,
        sentAt: new Date()
      };

    } catch (error) {
      console.error(`Failed to send ${type} notification to ${to}:`, error);

      // Track failed delivery
      await this.trackDelivery(notification, null, error);

      throw error;
    }
  }

  /**
   * Queue a notification for sending
   */
  async queueNotification(notification) {
    const queuedNotification = {
      id: crypto.randomUUID(),
      ...notification,
      queuedAt: new Date(),
      status: 'queued'
    };

    this.notificationQueue.push(queuedNotification);

    // Save to database for persistence
    await this.saveQueuedNotification(queuedNotification);

    return queuedNotification.id;
  }

  /**
   * Schedule a notification for future sending
   */
  async scheduleNotification(notification, scheduleTime) {
    const scheduledNotification = {
      id: crypto.randomUUID(),
      ...notification,
      scheduledFor: scheduleTime,
      createdAt: new Date(),
      status: 'scheduled'
    };

    this.scheduledNotifications.set(scheduledNotification.id, scheduledNotification);

    // Save to database
    await this.saveScheduledNotification(scheduledNotification);

    return scheduledNotification.id;
  }

  /**
   * Send bulk notifications
   */
  async sendBulkNotifications(notifications, options = {}) {
    const { batchSize = 10, delay = 1000 } = options;

    const results = [];
    const batches = this.chunkArray(notifications, batchSize);

    for (const batch of batches) {
      const batchPromises = batch.map(notification => this.sendNotification(notification));

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);
      } catch (error) {
        console.error('Batch sending failed:', error);
      }

      // Delay between batches to respect rate limits
      if (batches.length > 1) {
        await this.delay(delay);
      }
    }

    return results;
  }

  /**
   * Process notification queue
   */
  async processNotificationQueue() {
    if (this.notificationQueue.length === 0) return;

    const batchSize = Math.min(this.notificationQueue.length, 5); // Process up to 5 at a time
    const batch = this.notificationQueue.splice(0, batchSize);

    for (const notification of batch) {
      try {
        notification.status = 'processing';
        await this.sendNotification(notification);
        notification.status = 'sent';

        // Remove from database
        await this.removeQueuedNotification(notification.id);

      } catch (error) {
        console.error(`Failed to process queued notification ${notification.id}:`, error);
        notification.status = 'failed';
        notification.error = error.message;

        // Update in database or move to dead letter queue
        await this.updateQueuedNotification(notification.id, { status: 'failed', error: error.message });
      }
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications() {
    const now = new Date();

    for (const [id, notification] of this.scheduledNotifications) {
      if (notification.scheduledFor <= now && notification.status === 'scheduled') {
        try {
          notification.status = 'processing';
          await this.sendNotification(notification);
          notification.status = 'sent';

          // Remove from scheduled
          this.scheduledNotifications.delete(id);
          await this.removeScheduledNotification(id);

        } catch (error) {
          console.error(`Failed to process scheduled notification ${id}:`, error);
          notification.status = 'failed';

          // Could implement retry logic here
        }
      }
    }
  }

  async sendEmail(to, rendered, options = {}) {
    const { subject, html, text } = rendered;

    if (this.emailConfig.provider === 'sendgrid') {
      const msg = {
        to,
        from: this.emailConfig.from || 'noreply@qui-browser.com',
        subject,
        html,
        text,
        ...options
      };

      const result = await this.emailService.send(msg);
      return { id: result[0]?.headers?.['x-message-id'] || crypto.randomUUID() };

    } else if (this.emailConfig.provider === 'ses') {
      const params = {
        Source: this.emailConfig.from || 'noreply@qui-browser.com',
        Destination: { ToAddresses: [to] },
        Message: {
          Subject: { Data: subject },
          Body: {
            Html: { Data: html },
            Text: { Data: text }
          }
        }
      };

      const result = await this.emailService.sendEmail(params).promise();
      return { id: result.MessageId };

    } else if (this.emailConfig.provider === 'smtp') {
      const mailOptions = {
        from: this.emailConfig.from || 'noreply@qui-browser.com',
        to,
        subject,
        html,
        text,
        ...options
      };

      const result = await this.emailService.sendMail(mailOptions);
      return { id: result.messageId };
    }

    throw new Error('No email service configured');
  }

  async sendSms(to, rendered, options = {}) {
    const { text } = rendered;

    if (this.smsConfig.provider === 'twilio') {
      const message = await this.smsService.messages.create({
        body: text,
        from: this.smsConfig.fromNumber,
        to,
        ...options
      });

      return { id: message.sid };

    } else if (this.smsConfig.provider === 'sns') {
      const params = {
        Message: text,
        PhoneNumber: to,
        ...options
      };

      const result = await this.smsService.publish(params).promise();
      return { id: result.MessageId };
    }

    throw new Error('No SMS service configured');
  }

  renderTemplate(template, data) {
    const renderString = (str, context) => {
      return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        return path.split('.').reduce((obj, key) => obj?.[key], context) || match;
      });
    };

    return {
      subject: template.subject ? renderString(template.subject, data) : null,
      html: template.html ? renderString(template.html, data) : null,
      text: template.text ? renderString(template.text, data) : null
    };
  }

  checkRateLimit(type, recipient) {
    const now = Date.now();
    const rates = this.sendRates.get(recipient) || {
      email: { minute: [], hour: [], day: [] },
      sms: { minute: [], hour: [], day: [] }
    };

    const rateData = rates[type];
    const limits = this.rateLimits[type];

    // Clean old entries
    rateData.minute = rateData.minute.filter(time => now - time < 60000);
    rateData.hour = rateData.hour.filter(time => now - time < 3600000);
    rateData.day = rateData.day.filter(time => now - time < 86400000);

    // Check limits
    if (rateData.minute.length >= limits.perMinute ||
        rateData.hour.length >= limits.perHour ||
        rateData.day.length >= limits.perDay) {
      return false;
    }

    // Add current send
    rateData.minute.push(now);
    rateData.hour.push(now);
    rateData.day.push(now);

    this.sendRates.set(recipient, rates);
    return true;
  }

  async trackDelivery(notification, result, error = null) {
    const deliveryRecord = {
      id: crypto.randomUUID(),
      notificationId: notification.id || crypto.randomUUID(),
      type: notification.type,
      recipient: notification.to,
      status: error ? 'failed' : 'sent',
      sentAt: new Date(),
      provider: this.getProviderName(notification.type),
      error: error ? error.message : null,
      metadata: result || {}
    };

    // Update delivery statistics
    this.updateDeliveryStats(notification.type, deliveryRecord.status);

    // Save to database
    await this.saveDeliveryRecord(deliveryRecord);
  }

  updateDeliveryStats(type, status) {
    const stats = this.deliveryStats.get(type) || {
      sent: 0,
      failed: 0,
      total: 0
    };

    stats[status === 'sent' ? 'sent' : 'failed']++;
    stats.total++;

    this.deliveryStats.set(type, stats);
  }

  getProviderName(type) {
    if (type === 'email') {
      return this.emailConfig.provider;
    } else if (type === 'sms') {
      return this.smsConfig.provider;
    }
    return 'unknown';
  }

  // Database operations (simplified - would use actual database)
  async saveQueuedNotification(notification) {
    // Save to database
    console.log('Saved queued notification:', notification.id);
  }

  async saveScheduledNotification(notification) {
    // Save to database
    console.log('Saved scheduled notification:', notification.id);
  }

  async removeQueuedNotification(id) {
    // Remove from database
    console.log('Removed queued notification:', id);
  }

  async removeScheduledNotification(id) {
    // Remove from database
    console.log('Removed scheduled notification:', id);
  }

  async updateQueuedNotification(id, updates) {
    // Update in database
    console.log('Updated queued notification:', id, updates);
  }

  async saveDeliveryRecord(record) {
    // Save to database
    console.log('Saved delivery record:', record.id);
  }

  initializeDeliveryStats() {
    this.deliveryStats.set('email', { sent: 0, failed: 0, total: 0 });
    this.deliveryStats.set('sms', { sent: 0, failed: 0, total: 0 });
  }

  getDeliveryStats(type = null) {
    if (type) {
      return this.deliveryStats.get(type) || { sent: 0, failed: 0, total: 0 };
    }

    const allStats = {};
    for (const [key, stats] of this.deliveryStats) {
      allStats[key] = stats;
    }
    return allStats;
  }

  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get notification manager statistics
   */
  getStats() {
    return {
      queuedNotifications: this.notificationQueue.length,
      scheduledNotifications: this.scheduledNotifications.size,
      deliveryStats: this.getDeliveryStats(),
      templatesLoaded: this.templates.size,
      emailService: this.emailConfig.provider,
      smsService: this.smsConfig.provider,
      rateLimits: this.rateLimits
    };
  }

  /**
   * Stop the notification manager
   */
  stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }

    console.log('Notification manager stopped');
  }
}

module.exports = NotificationManager;
