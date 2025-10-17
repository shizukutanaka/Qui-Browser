/**
 * Qui Browser - Notification Service
 *
 * High-level notification service for sending various types of notifications
 */

const NotificationManager = require('./manager');

class NotificationService {
  constructor(notificationManager, config) {
    this.notificationManager = notificationManager;
    this.config = config;
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(user) {
    const data = {
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      },
      loginUrl: `${this.config.baseUrl}/login`,
      supportEmail: this.config.supportEmail || 'support@qui-browser.com'
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'welcome_email',
      data
    });
  }

  /**
   * Send account verification email
   */
  async sendVerificationEmail(user, verificationToken) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      verificationLink: `${this.config.baseUrl}/verify-email?token=${verificationToken}`,
      expiresIn: '24 hours'
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'account_verification',
      data
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(user, resetToken) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      resetLink: `${this.config.baseUrl}/reset-password?token=${resetToken}`,
      expiresIn: '1 hour'
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'password_reset',
      data
    });
  }

  /**
   * Send security alert notification
   */
  async sendSecurityAlert(user, alertType, details) {
    const alertMessages = {
      login_attempt: 'A new login was detected from an unrecognized device.',
      password_changed: 'Your password was recently changed.',
      api_key_created: 'A new API key was created for your account.',
      suspicious_activity: 'We detected suspicious activity on your account.'
    };

    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      message: alertMessages[alertType] || 'Security alert for your account.',
      details: details,
      timestamp: new Date().toISOString(),
      securityUrl: `${this.config.baseUrl}/security`
    };

    // Send both email and SMS for security alerts
    await Promise.all([
      this.notificationManager.sendNotification({
        type: 'email',
        to: user.email,
        template: 'security_alert',
        data
      }),
      // Only send SMS if user has phone number and SMS is enabled
      user.phoneNumber && this.notificationManager.smsService ?
        this.notificationManager.sendNotification({
          type: 'sms',
          to: user.phoneNumber,
          template: 'security_alert_sms',
          data: { message: `Security alert: ${alertMessages[alertType] || 'Alert'}` }
        }) : Promise.resolve()
    ]);
  }

  /**
   * Send analytics report
   */
  async sendAnalyticsReport(user, reportData) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      reportData,
      reportUrl: `${this.config.baseUrl}/analytics`,
      generatedAt: new Date().toISOString()
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'analytics_report',
      data
    });
  }

  /**
   * Send rate limit warning
   */
  async sendRateLimitWarning(user, limitType, currentUsage) {
    const warnings = {
      minute: 'You have exceeded 80% of your per-minute API limit.',
      hour: 'You have exceeded 80% of your per-hour API limit.',
      day: 'You have exceeded 80% of your daily API limit.'
    };

    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      warning: warnings[limitType] || 'API rate limit warning.',
      currentUsage,
      upgradeUrl: `${this.config.baseUrl}/billing`
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'rate_limit_warning',
      data
    });
  }

  /**
   * Send quota exceeded notification
   */
  async sendQuotaExceeded(user, quotaType) {
    const quotaMessages = {
      api_calls: 'You have reached your monthly API call limit.',
      storage: 'You have reached your storage limit.',
      bandwidth: 'You have reached your bandwidth limit.'
    };

    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      message: quotaMessages[quotaType] || 'Quota exceeded.',
      upgradeUrl: `${this.config.baseUrl}/billing`
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'quota_exceeded',
      data
    });
  }

  /**
   * Send feature announcement
   */
  async sendFeatureAnnouncement(users, featureData) {
    const data = {
      featureName: featureData.name,
      featureDescription: featureData.description,
      learnMoreUrl: featureData.url,
      dashboardUrl: `${this.config.baseUrl}/dashboard`
    };

    const notifications = users.map(user => ({
      type: 'email',
      to: user.email,
      template: 'feature_announcement',
      data: {
        user: {
          firstName: user.firstName,
          email: user.email
        },
        ...data
      }
    }));

    await this.notificationManager.sendBulkNotifications(notifications, {
      batchSize: 50,
      delay: 2000 // 2 second delay between batches
    });
  }

  /**
   * Send marketing newsletter
   */
  async sendNewsletter(subscribers, newsletterData) {
    const data = {
      subject: newsletterData.subject,
      content: newsletterData.content,
      unsubscribeUrl: `${this.config.baseUrl}/unsubscribe`,
      preferencesUrl: `${this.config.baseUrl}/preferences`
    };

    const notifications = subscribers.map(subscriber => ({
      type: 'email',
      to: subscriber.email,
      template: 'marketing_newsletter',
      data: {
        user: {
          firstName: subscriber.firstName || 'there',
          email: subscriber.email
        },
        ...data
      }
    }));

    await this.notificationManager.sendBulkNotifications(notifications, {
      batchSize: 100,
      delay: 5000 // 5 second delay between batches
    });
  }

  /**
   * Send system maintenance notification
   */
  async sendMaintenanceNotification(users, maintenanceData) {
    const data = {
      maintenanceStart: maintenanceData.startTime,
      maintenanceEnd: maintenanceData.endTime,
      expectedDowntime: maintenanceData.expectedDowntime,
      message: maintenanceData.message,
      statusUrl: `${this.config.baseUrl}/status`
    };

    const notifications = users.map(user => ({
      type: 'email',
      to: user.email,
      template: 'maintenance_notification',
      data: {
        user: {
          firstName: user.firstName,
          email: user.email
        },
        ...data
      }
    }));

    // Schedule notifications to be sent 1 hour before maintenance
    const scheduledTime = new Date(maintenanceData.startTime);
    scheduledTime.setHours(scheduledTime.getHours() - 1);

    for (const notification of notifications) {
      await this.notificationManager.scheduleNotification(notification, scheduledTime);
    }
  }

  /**
   * Send payment reminder
   */
  async sendPaymentReminder(user, billingData) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      amount: billingData.amount,
      dueDate: billingData.dueDate,
      planName: billingData.planName,
      paymentUrl: `${this.config.baseUrl}/billing/pay`,
      invoiceUrl: `${this.config.baseUrl}/billing/invoice/${billingData.invoiceId}`
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'payment_reminder',
      data
    });
  }

  /**
   * Send account suspension warning
   */
  async sendSuspensionWarning(user, reason) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      reason,
      appealUrl: `${this.config.baseUrl}/support/appeal`,
      contactEmail: this.config.supportEmail
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'account_suspension_warning',
      data
    });
  }

  /**
   * Send feedback request
   */
  async sendFeedbackRequest(user, context) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      context,
      feedbackUrl: `${this.config.baseUrl}/feedback?token=${this.generateFeedbackToken(user)}`,
      surveyUrl: `${this.config.baseUrl}/survey`
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'feedback_request',
      data
    });
  }

  /**
   * Send re-engagement email
   */
  async sendReEngagementEmail(user, inactivityDays) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      inactivityDays,
      loginUrl: `${this.config.baseUrl}/login`,
      featuresUrl: `${this.config.baseUrl}/features`
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: 'reengagement_campaign',
      data
    });
  }

  /**
   * Send A/B test email
   */
  async sendABTestEmail(user, testVariant, testData) {
    const data = {
      user: {
        firstName: user.firstName,
        email: user.email
      },
      ...testData
    };

    await this.notificationManager.sendNotification({
      type: 'email',
      to: user.email,
      template: testVariant,
      data,
      options: {
        'X-AB-Test': testVariant,
        'X-AB-Test-ID': testData.testId
      }
    });
  }

  /**
   * Queue notification for later processing
   */
  async queueNotification(notification) {
    return await this.notificationManager.queueNotification(notification);
  }

  /**
   * Schedule notification for future delivery
   */
  async scheduleNotification(notification, scheduleTime) {
    return await this.notificationManager.scheduleNotification(notification, scheduleTime);
  }

  /**
   * Send SMS notification
   */
  async sendSms(to, message, options = {}) {
    await this.notificationManager.sendNotification({
      type: 'sms',
      to,
      template: 'custom_sms',
      data: { message },
      options
    });
  }

  /**
   * Send push notification (placeholder for future PWA push notifications)
   */
  async sendPushNotification(user, data) {
    // Placeholder for PWA push notifications
    // Would integrate with service worker and push API
    console.log(`Push notification to user ${user.id}:`, data);
  }

  /**
   * Send webhook notification
   */
  async sendWebhookNotification(webhookUrl, eventData) {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Source': 'qui-browser',
          'X-Webhook-Event': eventData.event
        },
        body: JSON.stringify(eventData)
      });

      if (!response.ok) {
        throw new Error(`Webhook delivery failed: ${response.status}`);
      }

      // Track webhook delivery
      await this.notificationManager.trackDelivery(
        { type: 'webhook', to: webhookUrl },
        { id: crypto.randomUUID() }
      );

    } catch (error) {
      console.error('Webhook delivery failed:', error);
      await this.notificationManager.trackDelivery(
        { type: 'webhook', to: webhookUrl },
        null,
        error
      );
    }
  }

  /**
   * Get notification service statistics
   */
  getStats() {
    return this.notificationManager.getStats();
  }

  // Utility methods
  generateFeedbackToken(user) {
    // Generate a secure token for feedback links
    return crypto.createHash('sha256')
      .update(`${user.id}-${user.email}-${Date.now()}`)
      .digest('hex')
      .substring(0, 32);
  }
}

module.exports = NotificationService;
