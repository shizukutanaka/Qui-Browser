const DataManager = require('./data-manager');

/**
 * AutoHistoryCleaner
 *
 * ブラウザ履歴の自動整理と最適化を行うマネージャー
 * - 古い履歴の自動削除
 * - 重複履歴の統合
 * - プライバシー保護のための自動整理
 * - ストレージ使用量の最適化
 */
class AutoHistoryCleaner {
  constructor(options = {}) {
    this.dataManager = new DataManager(options);
    this.historyFile = 'history.json';
    this.settingsFile = 'browser-settings.json';

    // デフォルト設定
    this.defaultSettings = {
      maxHistoryAge: options.maxHistoryAge || 90 * 24 * 60 * 60 * 1000, // 90日
      maxHistoryEntries: options.maxHistoryEntries || 10000,
      cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 24時間
      privacyMode: options.privacyMode || false,
      excludeDomains: options.excludeDomains || []
    };

    this.lastCleanup = 0;
  }

  /**
   * 履歴の自動整理を実行
   */
  async performAutoCleanup() {
    const now = Date.now();

    // 前回の整理から十分な時間が経過しているかチェック
    if (now - this.lastCleanup < this.defaultSettings.cleanupInterval) {
      return { cleaned: false, reason: 'interval_not_reached' };
    }

    const settings = await this.getSettings();
    let history = await this.dataManager.read(this.historyFile, []);

    const initialCount = history.length;
    let cleanedCount = 0;

    // 1. 古い履歴の削除
    const ageFiltered = await this.removeOldEntries(history, settings.maxHistoryAge);
    cleanedCount += (history.length - ageFiltered.length);
    history = ageFiltered;

    // 2. エントリ数の制限
    const countFiltered = await this.limitHistoryEntries(history, settings.maxHistoryEntries);
    cleanedCount += (history.length - countFiltered.length);
    history = countFiltered;

    // 3. 重複エントリの統合
    const deduplicated = await this.deduplicateHistory(history);
    cleanedCount += (history.length - deduplicated.length);
    history = deduplicated;

    // 4. プライバシーモードの場合の追加整理
    if (settings.privacyMode) {
      const privacyFiltered = await this.applyPrivacyFilters(history);
      cleanedCount += (history.length - privacyFiltered.length);
      history = privacyFiltered;
    }

    // 整理された履歴を保存
    await this.dataManager.write(this.historyFile, history);
    this.lastCleanup = now;

    return {
      cleaned: true,
      initialCount,
      finalCount: history.length,
      cleanedCount,
      timestamp: now
    };
  }

  /**
   * 古い履歴エントリを削除
   */
  async removeOldEntries(history, maxAge) {
    const cutoffTime = Date.now() - maxAge;
    return history.filter(entry => entry.visitedAt > cutoffTime);
  }

  /**
   * 履歴エントリ数を制限
   */
  async limitHistoryEntries(history, maxEntries) {
    if (history.length <= maxEntries) {
      return history;
    }

    // 最新のエントリを優先的に保持
    return history
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, maxEntries);
  }

  /**
   * 重複履歴エントリの統合
   */
  async deduplicateHistory(history) {
    const seen = new Map();
    const deduplicated = [];

    // 訪問時刻でソート（最新が先頭）
    const sorted = history.sort((a, b) => b.visitedAt - a.visitedAt);

    for (const entry of sorted) {
      const key = entry.url.toLowerCase();

      if (!seen.has(key)) {
        // 最新の訪問情報を使用
        seen.set(key, {
          url: entry.url,
          title: entry.title,
          visitedAt: entry.visitedAt,
          visitCount: 1,
          firstVisited: entry.visitedAt,
          lastVisited: entry.visitedAt
        });
      } else {
        // 既存エントリの更新
        const existing = seen.get(key);
        existing.visitCount += 1;
        existing.firstVisited = Math.min(existing.firstVisited, entry.visitedAt);
        existing.lastVisited = Math.max(existing.lastVisited, entry.visitedAt);

        // より良いタイトルがあれば更新
        if (entry.title && (!existing.title || entry.title.length > existing.title.length)) {
          existing.title = entry.title;
        }
      }
    }

    // Mapから配列に変換し、訪問回数でソート
    return Array.from(seen.values())
      .sort((a, b) => b.visitCount - a.visitCount);
  }

  /**
   * プライバシーフィルターを適用
   */
  async applyPrivacyFilters(history) {
    const settings = await this.getSettings();
    const excludeDomains = settings.excludeDomains || [];

    return history.filter(entry => {
      const url = entry.url.toLowerCase();

      // 除外ドメインのチェック
      for (const domain of excludeDomains) {
        if (url.includes(domain.toLowerCase())) {
          return false;
        }
      }

      // 機密情報が含まれる可能性のあるURLを除外
      if (url.includes('login') || url.includes('signin') || url.includes('auth')) {
        return false;
      }

      // パスワードリセットや確認ページを除外
      if (url.includes('reset') || url.includes('confirm') || url.includes('verify')) {
        return false;
      }

      return true;
    });
  }

  /**
   * 履歴統計を取得
   */
  async getHistoryStats() {
    const history = await this.dataManager.read(this.historyFile, []);

    const stats = {
      totalEntries: history.length,
      oldestEntry: null,
      newestEntry: null,
      averageVisitsPerDay: 0,
      topDomains: [],
      storageSize: 0
    };

    if (history.length === 0) {
      return stats;
    }

    // 基本統計
    const timestamps = history.map(h => h.visitedAt).sort();
    stats.oldestEntry = new Date(timestamps[0]);
    stats.newestEntry = new Date(timestamps[timestamps.length - 1]);

    // 日別訪問数を計算
    const daysDiff = Math.max(1, (timestamps[timestamps.length - 1] - timestamps[0]) / (24 * 60 * 60 * 1000));
    stats.averageVisitsPerDay = history.length / daysDiff;

    // トップドメインを計算
    const domainCount = {};
    for (const entry of history) {
      try {
        const url = new URL(entry.url);
        const domain = url.hostname;
        domainCount[domain] = (domainCount[domain] || 0) + 1;
      } catch (e) {
        // 無効なURLはスキップ
      }
    }

    stats.topDomains = Object.entries(domainCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([domain, count]) => ({ domain, count }));

    // ストレージサイズを計算（JSON文字列の長さ）
    stats.storageSize = JSON.stringify(history).length;

    return stats;
  }

  /**
   * 特定のドメインの履歴を削除
   */
  async deleteDomainHistory(domain) {
    const history = await this.dataManager.read(this.historyFile, []);
    const filtered = history.filter(entry => {
      try {
        const url = new URL(entry.url);
        return url.hostname !== domain;
      } catch (e) {
        return true; // 無効なURLは保持
      }
    });

    await this.dataManager.write(this.historyFile, filtered);
    return history.length - filtered.length;
  }

  /**
   * 特定期間の履歴を削除
   */
  async deleteHistoryByDateRange(startDate, endDate) {
    const history = await this.dataManager.read(this.historyFile, []);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const filtered = history.filter(entry =>
      entry.visitedAt < startTime || entry.visitedAt > endTime
    );

    await this.dataManager.write(this.historyFile, filtered);
    return history.length - filtered.length;
  }

  /**
   * 履歴クリーナーの設定を取得
   */
  async getSettings() {
    const settings = await this.dataManager.read(this.settingsFile, {});
    return {
      maxHistoryAge: settings.maxHistoryAge ?? this.defaultSettings.maxHistoryAge,
      maxHistoryEntries: settings.maxHistoryEntries ?? this.defaultSettings.maxHistoryEntries,
      cleanupInterval: settings.cleanupInterval ?? this.defaultSettings.cleanupInterval,
      privacyMode: settings.privacyMode ?? this.defaultSettings.privacyMode,
      excludeDomains: settings.excludeDomains ?? this.defaultSettings.excludeDomains
    };
  }

  /**
   * 履歴クリーナーの設定を更新
   */
  async updateSettings(newSettings) {
    const currentSettings = await this.dataManager.read(this.settingsFile, {});
    const updatedSettings = { ...currentSettings, ...newSettings };
    await this.dataManager.write(this.settingsFile, updatedSettings);

    // 設定を反映
    Object.assign(this.defaultSettings, updatedSettings);
  }

  /**
   * 次回の自動整理時刻を取得
   */
  getNextCleanupTime() {
    return new Date(this.lastCleanup + this.defaultSettings.cleanupInterval);
  }

  /**
   * 手動整理を実行
   */
  async manualCleanup(options = {}) {
    const originalSettings = { ...this.defaultSettings };

    // 一時的に設定を上書き
    if (options.maxHistoryAge !== undefined) {
      this.defaultSettings.maxHistoryAge = options.maxHistoryAge;
    }
    if (options.maxHistoryEntries !== undefined) {
      this.defaultSettings.maxHistoryEntries = options.maxHistoryEntries;
    }

    const result = await this.performAutoCleanup();

    // 設定を元に戻す
    Object.assign(this.defaultSettings, originalSettings);

    return result;
  }
}

module.exports = AutoHistoryCleaner;
