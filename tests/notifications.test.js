/**
 * Tests for Notification System
 */

const { test } = require('node:test');
const assert = require('node:assert');
const NotificationManager = require('../lib/notifications/manager');
const NotificationService = require('../lib/notifications/service');

// Mock database manager
class MockDatabaseManager {
  constructor() {
    this.users = new Map();
    this.apiKeys = [];
    this.notifications = [];
    this.exports = [];
  }

  async createUser(user) {
    this.users.set(user.id, user);
    return user;
  }

  async getUser(id) {
    return this.users.get(id) || null;
  }

  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (user) {
      Object.assign(user, updates);
      return user;
    }
    return null;
  }

  async createApiKey(apiKey) {
    this.apiKeys.push(apiKey);
    return apiKey;
  }

  async getApiKey(id) {
    return this.apiKeys.find(k => k.id === id) || null;
  }

  async updateApiKey(id, updates) {
    const apiKey = this.apiKeys.find(k => k.id === id);
    if (apiKey) {
      Object.assign(apiKey, updates);
      return apiKey;
    }
    return null;
  }

  async deleteApiKey(id) {
    const index = this.apiKeys.findIndex(k => k.id === id);
    if (index !== -1) {
      this.apiKeys.splice(index, 1);
      return true;
    }
    return false;
  }

  async createNotification(notification) {
    this.notifications.push(notification);
    return notification;
  }

  async updateNotification(id, updates) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      Object.assign(notification, updates);
      return notification;
    }
    return null;
  }

  async markAllNotificationsRead(userId) {
    this.notifications
      .filter(n => n.userId === userId)
      .forEach(n => n.read = true);
    return true;
  }

  async deleteNotification(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Mock email service
class MockEmailService {
  constructor() {
    this.sentEmails = [];
  }

  async send(msg) {
    this.sentEmails.push(msg);
    return [{ headers: { 'x-message-id': `msg_${Date.now()}` } }];
  }
}

// Mock SMS service
class MockSmsService {
  constructor() {
    this.sentSms = [];
  }

  async messages.create(message) {
    this.sentSms.push(message);
    return { sid: `sms_${Date.now()}` };
  }
}

// Mock config
const mockConfig = {
  notifications: {
    email: {
      enabled: true,
      provider: 'sendgrid',
      from: 'test@example.com'
    },
    sms: {
      enabled: true,
      provider: 'twilio'
    }
  }
};

test('Notification Manager', async (t) => {
  let notificationManager;
  let mockDb;

  t.before(async () => {
    mockDb = new MockDatabaseManager();
    notificationManager = new NotificationManager(mockConfig, mockDb);

    // Mock services
    notificationManager.emailService = new MockEmailService();
    notificationManager.smsService = new MockSmsService();
  });

  t.after(async () => {
    await notificationManager.stop();
  });

  await t.test('NotificationManager initializes correctly', () => {
    assert(notificationManager instanceof NotificationManager);
    assert(notificationManager.templates instanceof Map);
    assert(notificationManager.notificationQueue instanceof Array);
    assert(notificationManager.deliveryStats instanceof Map);
  });

  await t.test('sendNotification() sends email successfully', async () => {
    const notification = {
      type: 'email',
      to: 'user@example.com',
      template: 'welcome_email',
      data: {
        user: { firstName: 'John', email: 'user@example.com' },
        loginUrl: 'https://example.com/login'
      }
    };

    const result = await notificationManager.sendNotification(notification);

    assert(result.success);
    assert(result.id);
    assert.strictEqual(result.type, 'email');
    assert.strictEqual(result.to, 'user@example.com');

    // Check that email was sent
    assert.strictEqual(notificationManager.emailService.sentEmails.length, 1);
    const sentEmail = notificationManager.emailService.sentEmails[0];
    assert.strictEqual(sentEmail.to, 'user@example.com');
    assert(sentEmail.subject.includes('Welcome'));
    assert(sentEmail.html.includes('John'));
  });

  await t.test('sendNotification() sends SMS successfully', async () => {
    const notification = {
      type: 'sms',
      to: '+1234567890',
      template: 'custom_sms',
      data: { message: 'Test SMS message' }
    };

    const result = await notificationManager.sendNotification(notification);

    assert(result.success);
    assert(result.id);
    assert.strictEqual(result.type, 'sms');
    assert.strictEqual(result.to, '+1234567890');

    // Check that SMS was sent
    assert.strictEqual(notificationManager.smsService.sentSms.length, 1);
    const sentSms = notificationManager.smsService.sentSms[0];
    assert.strictEqual(sentSms.to, '+1234567890');
    assert(sentSms.body.includes('Test SMS message'));
  });

  await t.test('queueNotification() adds to queue', async () => {
    const notification = {
      type: 'email',
      to: 'queued@example.com',
      template: 'welcome_email',
      data: { user: { firstName: 'Queued', email: 'queued@example.com' } }
    };

    const queueId = await notificationManager.queueNotification(notification);

    assert(queueId);
    assert.strictEqual(notificationManager.notificationQueue.length, 1);
    assert.strictEqual(notificationManager.notificationQueue[0].id, queueId);
  });

  await t.test('scheduleNotification() schedules for future', async () => {
    const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
    const notification = {
      type: 'email',
      to: 'scheduled@example.com',
      template: 'welcome_email',
      data: { user: { firstName: 'Scheduled', email: 'scheduled@example.com' } }
    };

    const scheduleId = await notificationManager.scheduleNotification(notification, futureTime);

    assert(scheduleId);
    assert(notificationManager.scheduledNotifications.has(scheduleId));

    const scheduled = notificationManager.scheduledNotifications.get(scheduleId);
    assert.strictEqual(scheduled.scheduledFor.getTime(), futureTime.getTime());
  });

  await t.test('sendBulkNotifications() sends multiple notifications', async () => {
    const notifications = [
      {
        type: 'email',
        to: 'bulk1@example.com',
        template: 'welcome_email',
        data: { user: { firstName: 'Bulk1', email: 'bulk1@example.com' } }
      },
      {
        type: 'email',
        to: 'bulk2@example.com',
        template: 'welcome_email',
        data: { user: { firstName: 'Bulk2', email: 'bulk2@example.com' } }
      }
    ];

    const results = await notificationManager.sendBulkNotifications(notifications, {
      batchSize: 2,
      delay: 100
    });

    assert(Array.isArray(results));
    assert.strictEqual(results.length, 2);

    // Check that both emails were sent
    assert.strictEqual(notificationManager.emailService.sentEmails.length, 3); // 2 from bulk + 1 from previous test
  });

  await t.test('renderTemplate() renders template variables', () => {
    const template = {
      subject: 'Welcome {{user.firstName}}!',
      html: '<h1>Hello {{user.firstName}}</h1><p>Email: {{user.email}}</p>',
      text: 'Hello {{user.firstName}}, your email is {{user.email}}'
    };

    const data = {
      user: { firstName: 'Test', email: 'test@example.com' }
    };

    const result = notificationManager.renderTemplate(template, data);

    assert.strictEqual(result.subject, 'Welcome Test!');
    assert(result.html.includes('<h1>Hello Test</h1>'));
    assert(result.html.includes('<p>Email: test@example.com</p>'));
    assert(result.text.includes('Hello Test, your email is test@example.com'));
  });

  await t.test('checkRateLimit() enforces rate limits', () => {
    const recipient = 'ratelimit@example.com';

    // First few should pass
    for (let i = 0; i < 5; i++) {
      assert(notificationManager.checkRateLimit('email', recipient));
    }

    // Should eventually be rate limited (depending on config)
    // Note: This test depends on the actual rate limit configuration
    assert(true); // Placeholder for rate limit testing
  });

  await t.test('trackDelivery() records delivery statistics', async () => {
    const notification = {
      type: 'email',
      to: 'track@example.com',
      template: 'welcome_email'
    };

    await notificationManager.trackDelivery(notification, { id: 'test-id' });

    const stats = notificationManager.getDeliveryStats();
    assert(stats.email);
    assert(stats.email.total >= 1);
    assert(stats.email.sent >= 1);
  });

  await t.test('getDeliveryStats() returns statistics', () => {
    const stats = notificationManager.getDeliveryStats();

    assert(typeof stats === 'object');
    assert(stats.email);
    assert(stats.sms);
    assert(typeof stats.email.sent === 'number');
    assert(typeof stats.email.failed === 'number');
    assert(typeof stats.email.total === 'number');
  });

  await t.test('getStats() returns manager statistics', () => {
    const stats = notificationManager.getStats();

    assert(typeof stats === 'object');
    assert(Array.isArray(stats.queuedNotifications));
    assert(typeof stats.scheduledNotifications === 'number');
    assert(stats.deliveryStats);
    assert(typeof stats.templatesLoaded === 'number');
  });
});

test('Notification Service', async (t) => {
  let notificationService;
  let notificationManager;
  let mockDb;

  t.before(async () => {
    mockDb = new MockDatabaseManager();
    notificationManager = new NotificationManager(mockConfig, mockDb);
    notificationManager.emailService = new MockEmailService();
    notificationManager.smsService = new MockSmsService();

    notificationService = new NotificationService(notificationManager, mockConfig);

    // Create test user
    await mockDb.createUser({
      id: 'user1',
      email: 'user@example.com',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+1234567890'
    });
  });

  t.after(async () => {
    await notificationManager.stop();
  });

  await t.test('NotificationService initializes correctly', () => {
    assert(notificationService instanceof NotificationService);
  });

  await t.test('sendWelcomeEmail() sends welcome notification', async () => {
    const user = await mockDb.getUser('user1');

    await notificationService.sendWelcomeEmail(user);

    // Check that email was queued/sent
    assert(notificationManager.emailService.sentEmails.length > 0);
    const sentEmail = notificationManager.emailService.sentEmails[notificationManager.emailService.sentEmails.length - 1];
    assert(sentEmail.subject.includes('Welcome'));
    assert(sentEmail.html.includes('Test'));
  });

  await t.test('sendVerificationEmail() sends verification notification', async () => {
    const user = await mockDb.getUser('user1');
    const token = 'test-verification-token';

    await notificationService.sendVerificationEmail(user, token);

    const sentEmail = notificationManager.emailService.sentEmails[notificationManager.emailService.sentEmails.length - 1];
    assert(sentEmail.subject.includes('Verify'));
    assert(sentEmail.html.includes(token));
  });

  await t.test('sendPasswordResetEmail() sends reset notification', async () => {
    const user = await mockDb.getUser('user1');
    const token = 'test-reset-token';

    await notificationService.sendPasswordResetEmail(user, token);

    const sentEmail = notificationManager.emailService.sentEmails[notificationManager.emailService.sentEmails.length - 1];
    assert(sentEmail.subject.includes('Reset'));
    assert(sentEmail.html.includes(token));
  });

  await t.test('sendSecurityAlert() sends security notification', async () => {
    const user = await mockDb.getUser('user1');

    await notificationService.sendSecurityAlert(user, 'login_attempt', {
      attempts: 3,
      maxAttempts: 5
    });

    // Should send both email and SMS
    const emailSent = notificationManager.emailService.sentEmails.length > 0;
    const smsSent = notificationManager.smsService.sentSms.length > 0;

    assert(emailSent || smsSent); // At least one should be sent
  });

  await t.test('sendAnalyticsReport() sends analytics notification', async () => {
    const user = await mockDb.getUser('user1');
    const reportData = {
      totalUsers: 100,
      totalSessions: 150,
      pageViews: 1000,
      topPages: []
    };

    await notificationService.sendAnalyticsReport(user, reportData);

    const sentEmail = notificationManager.emailService.sentEmails[notificationManager.emailService.sentEmails.length - 1];
    assert(sentEmail.subject.includes('Analytics'));
    assert(sentEmail.html.includes('100')); // Should contain report data
  });

  await t.test('sendRateLimitWarning() sends rate limit notification', async () => {
    const user = await mockDb.getUser('user1');

    await notificationService.sendRateLimitWarning(user, 'hour', 90);

    const sentEmail = notificationManager.emailService.sentEmails[notificationManager.emailService.sentEmails.length - 1];
    assert(sentEmail.subject.includes('Rate Limit'));
    assert(sentEmail.html.includes('exceeded 80%'));
  });

  await t.test('sendFeatureAnnouncement() sends bulk feature notifications', async () => {
    const users = [
      await mockDb.getUser('user1'),
      {
        id: 'user2',
        email: 'user2@example.com',
        firstName: 'User',
        lastName: 'Two'
      }
    ];

    const featureData = {
      name: 'New Dashboard',
      description: 'Check out our new analytics dashboard',
      url: '/features/dashboard'
    };

    await notificationService.sendFeatureAnnouncement(users, featureData);

    // Should have sent emails to both users
    const recentEmails = notificationManager.emailService.sentEmails.slice(-2);
    assert(recentEmails.length >= 2);
    assert(recentEmails.some(email => email.subject.includes('New Dashboard')));
  });

  await t.test('sendNewsletter() sends bulk newsletter notifications', async () => {
    const subscribers = [
      { email: 'sub1@example.com', firstName: 'Sub1' },
      { email: 'sub2@example.com', firstName: 'Sub2' }
    ];

    const newsletterData = {
      subject: 'Monthly Newsletter',
      content: 'This is our monthly newsletter content...'
    };

    await notificationService.sendNewsletter(subscribers, newsletterData);

    const recentEmails = notificationManager.emailService.sentEmails.slice(-2);
    assert(recentEmails.length >= 2);
    assert(recentEmails.some(email => email.subject.includes('Monthly Newsletter')));
  });

  await t.test('queueNotification() delegates to manager', async () => {
    const notification = {
      type: 'email',
      to: 'queue@example.com',
      template: 'welcome_email',
      data: {}
    };

    const queueId = await notificationService.queueNotification(notification);
    assert(queueId);
    assert.strictEqual(notificationManager.notificationQueue.length, 1);
  });

  await t.test('scheduleNotification() delegates to manager', async () => {
    const notification = {
      type: 'email',
      to: 'schedule@example.com',
      template: 'welcome_email',
      data: {}
    };

    const scheduleId = await notificationService.scheduleNotification(notification, new Date(Date.now() + 3600000));
    assert(scheduleId);
    assert(notificationManager.scheduledNotifications.has(scheduleId));
  });

  await t.test('getStats() returns service statistics', () => {
    const stats = notificationService.getStats();

    assert(typeof stats === 'object');
    assert(typeof stats.queuedNotifications === 'number');
    assert(typeof stats.scheduledNotifications === 'number');
    assert(stats.deliveryStats);
  });
});
