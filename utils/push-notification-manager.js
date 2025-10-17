/**
 * Push Notification Manager
 *
 * Web Push API を活用した高度なプッシュ通知システム。
 * VAPID認証、パーソナライゼーション、A/Bテスト、スケジューリング機能を提供。
 *
 * 特徴:
 * - VAPID認証による安全な通知配信
 * - ユーザーセグメンテーション
 * - 通知スケジューリング
 * - A/Bテスト機能
 * - 配信統計とエンゲージメント追跡
 * - バッチ送信最適化
 * - リトライロジック
 *
 * @module utils/push-notification-manager
 */

const crypto = require('crypto');

/**
 * プッシュ通知マネージャークラス
 */
class PushNotificationManager {
  /**
   * コンストラクタ
   * @param {Object} options - 設定オプション
   */
  constructor(options = {}) {
    this.vapidKeys = options.vapidKeys || this.generateVAPIDKeys();
    this.applicationServerKey = options.applicationServerKey || this.vapidKeys.publicKey;

    // サブスクリプション管理
    this.subscriptions = new Map();

    // 通知キュー
    this.notificationQueue = [];
    this.isProcessingQueue = false;

    // スケジュール管理
    this.scheduledNotifications = new Map();

    // A/Bテスト
    this.abTests = new Map();

    // ユーザーセグメント
    this.segments = new Map();

    // 統計情報
    this.stats = {
      totalSent: 0,
      successful: 0,
      failed: 0,
      clicked: 0,
      dismissed: 0,
      bySegment: {},
      byType: {}
    };

    // 設定
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.batchSize = options.batchSize || 100;
    this.queueProcessInterval = options.queueProcessInterval || 1000;

    // キュー処理開始
    this.startQueueProcessing();
  }

  /**
   * VAPIDキーを生成
   * @returns {Object} 公開鍵と秘密鍵
   */
  generateVAPIDKeys() {
    // 実際の実装では web-push パッケージを使用推奨
    // ここでは簡易的な実装
    const publicKey = crypto.randomBytes(65).toString('base64url');
    const privateKey = crypto.randomBytes(32).toString('base64url');

    return {
      publicKey: publicKey,
      privateKey: privateKey
    };
  }

  /**
   * サブスクリプションを登録
   * @param {string} userId - ユーザーID
   * @param {Object} subscription - Push API サブスクリプション
   * @param {Object} metadata - メタデータ
   * @returns {boolean} 成功ならtrue
   */
  registerSubscription(userId, subscription, metadata = {}) {
    try {
      const subscriptionData = {
        userId: userId,
        subscription: subscription,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        metadata: {
          ...metadata,
          userAgent: metadata.userAgent || 'Unknown',
          platform: metadata.platform || 'Unknown'
        }
      };

      this.subscriptions.set(userId, subscriptionData);

      console.log(`[PushNotification] Subscription registered for user: ${userId}`);
      return true;
    } catch (error) {
      console.error('[PushNotification] Failed to register subscription:', error);
      return false;
    }
  }

  /**
   * サブスクリプションを解除
   * @param {string} userId - ユーザーID
   * @returns {boolean} 成功ならtrue
   */
  unregisterSubscription(userId) {
    const deleted = this.subscriptions.delete(userId);

    if (deleted) {
      console.log(`[PushNotification] Subscription unregistered for user: ${userId}`);
    }

    return deleted;
  }

  /**
   * 通知を送信
   * @param {string|Array<string>} userIds - ユーザーID（単一または配列）
   * @param {Object} notification - 通知内容
   * @param {Object} options - 送信オプション
   * @returns {Promise<Object>} 送信結果
   */
  async sendNotification(userIds, notification, options = {}) {
    const users = Array.isArray(userIds) ? userIds : [userIds];

    const results = {
      total: users.length,
      successful: 0,
      failed: 0,
      errors: []
    };

    for (const userId of users) {
      try {
        await this.sendToUser(userId, notification, options);
        results.successful++;
        this.stats.successful++;
      } catch (error) {
        results.failed++;
        this.stats.failed++;
        results.errors.push({
          userId: userId,
          error: error.message
        });
      }
    }

    this.stats.totalSent += users.length;

    // 統計更新
    this.updateStats(notification, results);

    return results;
  }

  /**
   * 単一ユーザーに通知を送信
   * @param {string} userId - ユーザーID
   * @param {Object} notification - 通知内容
   * @param {Object} options - 送信オプション
   * @returns {Promise<void>}
   */
  async sendToUser(userId, notification, options = {}) {
    const subscriptionData = this.subscriptions.get(userId);

    if (!subscriptionData) {
      throw new Error(`No subscription found for user: ${userId}`);
    }

    // 通知ペイロードの構築
    const payload = {
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/assets/images/icon-192.png',
      badge: notification.badge || '/assets/images/badge-72.png',
      tag: notification.tag || 'default',
      data: notification.data || {},
      actions: notification.actions || [],
      silent: notification.silent || false,
      requireInteraction: notification.requireInteraction || false,
      vibrate: notification.vibrate || [200, 100, 200],
      timestamp: Date.now()
    };

    // Web Push APIを使用して送信
    // 実際の実装では web-push パッケージを使用推奨
    await this.sendPushMessage(subscriptionData.subscription, payload, options);

    // 最終使用時刻を更新
    subscriptionData.lastUsed = Date.now();
  }

  /**
   * Push メッセージを送信（低レベル）
   * @param {Object} subscription - サブスクリプション
   * @param {Object} payload - ペイロード
   * @param {Object} options - オプション
   * @returns {Promise<void>}
   */
  async sendPushMessage(subscription, payload, options = {}) {
    // 実際の実装では web-push パッケージの sendNotification を使用
    // ここでは簡易的なシミュレーション
    const payloadString = JSON.stringify(payload);

    console.log(`[PushNotification] Sending to endpoint: ${subscription.endpoint}`);
    console.log(`[PushNotification] Payload:`, payload);

    // リトライロジック
    let retries = 0;
    while (retries < this.maxRetries) {
      try {
        // 実際の送信処理（web-push.sendNotification）
        // await webpush.sendNotification(subscription, payloadString, {
        //   vapidDetails: {
        //     subject: 'mailto:noreply@quibrowser.com',
        //     publicKey: this.vapidKeys.publicKey,
        //     privateKey: this.vapidKeys.privateKey
        //   }
        // });

        // シミュレーション: 90%の確率で成功
        if (Math.random() > 0.1) {
          return; // 成功
        } else {
          throw new Error('Simulated network error');
        }
      } catch (error) {
        retries++;
        if (retries >= this.maxRetries) {
          throw error;
        }

        // 指数バックオフ
        await this.delay(this.retryDelay * Math.pow(2, retries - 1));
      }
    }
  }

  /**
   * セグメントに通知を送信
   * @param {string} segmentName - セグメント名
   * @param {Object} notification - 通知内容
   * @param {Object} options - 送信オプション
   * @returns {Promise<Object>} 送信結果
   */
  async sendToSegment(segmentName, notification, options = {}) {
    const segment = this.segments.get(segmentName);

    if (!segment) {
      throw new Error(`Segment not found: ${segmentName}`);
    }

    const userIds = segment.userIds;
    console.log(`[PushNotification] Sending to segment "${segmentName}": ${userIds.length} users`);

    return await this.sendNotification(userIds, notification, options);
  }

  /**
   * 通知をスケジュール
   * @param {string|Array<string>} userIds - ユーザーID
   * @param {Object} notification - 通知内容
   * @param {number|Date} scheduledTime - スケジュール時刻
   * @param {Object} options - オプション
   * @returns {string} スケジュールID
   */
  scheduleNotification(userIds, notification, scheduledTime, options = {}) {
    const scheduleId = crypto.randomBytes(16).toString('hex');
    const timestamp = scheduledTime instanceof Date
      ? scheduledTime.getTime()
      : scheduledTime;

    const scheduledNotification = {
      id: scheduleId,
      userIds: userIds,
      notification: notification,
      scheduledTime: timestamp,
      options: options,
      status: 'scheduled',
      createdAt: Date.now()
    };

    this.scheduledNotifications.set(scheduleId, scheduledNotification);

    // タイマーを設定
    const delay = timestamp - Date.now();
    if (delay > 0) {
      setTimeout(async () => {
        await this.executeScheduledNotification(scheduleId);
      }, delay);
    } else {
      console.warn('[PushNotification] Scheduled time is in the past, executing immediately');
      this.executeScheduledNotification(scheduleId);
    }

    console.log(`[PushNotification] Notification scheduled: ${scheduleId} at ${new Date(timestamp)}`);

    return scheduleId;
  }

  /**
   * スケジュールされた通知を実行
   * @param {string} scheduleId - スケジュールID
   * @returns {Promise<void>}
   */
  async executeScheduledNotification(scheduleId) {
    const scheduled = this.scheduledNotifications.get(scheduleId);

    if (!scheduled || scheduled.status !== 'scheduled') {
      return;
    }

    scheduled.status = 'executing';

    try {
      const result = await this.sendNotification(
        scheduled.userIds,
        scheduled.notification,
        scheduled.options
      );

      scheduled.status = 'completed';
      scheduled.result = result;
      scheduled.completedAt = Date.now();

      console.log(`[PushNotification] Scheduled notification executed: ${scheduleId}`, result);
    } catch (error) {
      scheduled.status = 'failed';
      scheduled.error = error.message;
      console.error(`[PushNotification] Scheduled notification failed: ${scheduleId}`, error);
    }
  }

  /**
   * スケジュールをキャンセル
   * @param {string} scheduleId - スケジュールID
   * @returns {boolean} 成功ならtrue
   */
  cancelScheduledNotification(scheduleId) {
    const scheduled = this.scheduledNotifications.get(scheduleId);

    if (!scheduled || scheduled.status !== 'scheduled') {
      return false;
    }

    scheduled.status = 'cancelled';
    console.log(`[PushNotification] Scheduled notification cancelled: ${scheduleId}`);

    return true;
  }

  /**
   * A/Bテストを作成
   * @param {string} testName - テスト名
   * @param {Array<Object>} variants - バリアント配列
   * @returns {string} テストID
   */
  createABTest(testName, variants) {
    const testId = crypto.randomBytes(16).toString('hex');

    const abTest = {
      id: testId,
      name: testName,
      variants: variants.map((variant, index) => ({
        id: `variant_${index}`,
        name: variant.name || `Variant ${index + 1}`,
        notification: variant.notification,
        weight: variant.weight || 1.0 / variants.length,
        stats: {
          sent: 0,
          clicked: 0,
          dismissed: 0,
          clickRate: 0
        }
      })),
      status: 'active',
      createdAt: Date.now()
    };

    this.abTests.set(testId, abTest);

    console.log(`[PushNotification] A/B test created: ${testName} (${testId})`);

    return testId;
  }

  /**
   * A/Bテストで通知を送信
   * @param {string} testId - テストID
   * @param {string|Array<string>} userIds - ユーザーID
   * @param {Object} options - オプション
   * @returns {Promise<Object>} 送信結果
   */
  async sendABTestNotification(testId, userIds, options = {}) {
    const abTest = this.abTests.get(testId);

    if (!abTest || abTest.status !== 'active') {
      throw new Error(`A/B test not found or inactive: ${testId}`);
    }

    const users = Array.isArray(userIds) ? userIds : [userIds];
    const results = {
      total: users.length,
      byVariant: {}
    };

    for (const userId of users) {
      // 重み付けでバリアントを選択
      const variant = this.selectVariant(abTest.variants);

      try {
        await this.sendToUser(userId, variant.notification, options);
        variant.stats.sent++;

        if (!results.byVariant[variant.id]) {
          results.byVariant[variant.id] = { sent: 0, failed: 0 };
        }
        results.byVariant[variant.id].sent++;
      } catch (error) {
        if (!results.byVariant[variant.id]) {
          results.byVariant[variant.id] = { sent: 0, failed: 0 };
        }
        results.byVariant[variant.id].failed++;
      }
    }

    return results;
  }

  /**
   * バリアントを選択（重み付け）
   * @param {Array<Object>} variants - バリアント配列
   * @returns {Object} 選択されたバリアント
   */
  selectVariant(variants) {
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    let random = Math.random() * totalWeight;

    for (const variant of variants) {
      random -= variant.weight;
      if (random <= 0) {
        return variant;
      }
    }

    return variants[0];
  }

  /**
   * ユーザーセグメントを作成
   * @param {string} segmentName - セグメント名
   * @param {Array<string>} userIds - ユーザーID配列
   * @param {Object} criteria - セグメント条件
   * @returns {boolean} 成功ならtrue
   */
  createSegment(segmentName, userIds, criteria = {}) {
    this.segments.set(segmentName, {
      name: segmentName,
      userIds: userIds,
      criteria: criteria,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    console.log(`[PushNotification] Segment created: ${segmentName} (${userIds.length} users)`);

    return true;
  }

  /**
   * セグメントにユーザーを追加
   * @param {string} segmentName - セグメント名
   * @param {string|Array<string>} userIds - ユーザーID
   * @returns {boolean} 成功ならtrue
   */
  addToSegment(segmentName, userIds) {
    const segment = this.segments.get(segmentName);

    if (!segment) {
      return false;
    }

    const users = Array.isArray(userIds) ? userIds : [userIds];
    segment.userIds.push(...users);
    segment.updatedAt = Date.now();

    return true;
  }

  /**
   * 統計情報を更新
   * @param {Object} notification - 通知内容
   * @param {Object} results - 送信結果
   */
  updateStats(notification, results) {
    const type = notification.type || 'general';

    if (!this.stats.byType[type]) {
      this.stats.byType[type] = {
        sent: 0,
        successful: 0,
        failed: 0
      };
    }

    this.stats.byType[type].sent += results.total;
    this.stats.byType[type].successful += results.successful;
    this.stats.byType[type].failed += results.failed;
  }

  /**
   * 通知クリックを記録
   * @param {string} userId - ユーザーID
   * @param {string} notificationId - 通知ID
   */
  recordClick(userId, notificationId) {
    this.stats.clicked++;
    console.log(`[PushNotification] Click recorded: ${userId}, ${notificationId}`);
  }

  /**
   * 通知却下を記録
   * @param {string} userId - ユーザーID
   * @param {string} notificationId - 通知ID
   */
  recordDismissal(userId, notificationId) {
    this.stats.dismissed++;
    console.log(`[PushNotification] Dismissal recorded: ${userId}, ${notificationId}`);
  }

  /**
   * 統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    const clickRate = this.stats.totalSent > 0
      ? ((this.stats.clicked / this.stats.totalSent) * 100).toFixed(2) + '%'
      : '0%';

    const successRate = this.stats.totalSent > 0
      ? ((this.stats.successful / this.stats.totalSent) * 100).toFixed(2) + '%'
      : '0%';

    return {
      ...this.stats,
      clickRate: clickRate,
      successRate: successRate,
      totalSubscriptions: this.subscriptions.size,
      totalSegments: this.segments.size,
      activeABTests: Array.from(this.abTests.values()).filter(t => t.status === 'active').length,
      scheduledNotifications: Array.from(this.scheduledNotifications.values())
        .filter(n => n.status === 'scheduled').length
    };
  }

  /**
   * キュー処理を開始
   */
  startQueueProcessing() {
    this.queueInterval = setInterval(async () => {
      if (this.isProcessingQueue || this.notificationQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;

      try {
        const batch = this.notificationQueue.splice(0, this.batchSize);

        for (const item of batch) {
          try {
            await this.sendNotification(item.userIds, item.notification, item.options);
          } catch (error) {
            console.error('[PushNotification] Queue processing error:', error);
          }
        }
      } finally {
        this.isProcessingQueue = false;
      }
    }, this.queueProcessInterval);

    if (this.queueInterval.unref) {
      this.queueInterval.unref();
    }
  }

  /**
   * 遅延ヘルパー
   * @param {number} ms - 遅延時間（ミリ秒）
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * インスタンスを破棄
   */
  destroy() {
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
    }

    this.subscriptions.clear();
    this.segments.clear();
    this.abTests.clear();
    this.scheduledNotifications.clear();
    this.notificationQueue = [];
  }
}

module.exports = PushNotificationManager;
