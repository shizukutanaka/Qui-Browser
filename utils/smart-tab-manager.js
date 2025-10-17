const DataManager = require('./data-manager');

/**
 * SmartTabManager
 *
 * タブの自動管理と最適化を行うマネージャー
 * - 自動タブグループ化
 * - 非アクティブタブの自動休止
 * - メモリ使用量の自動最適化
 * - 重複タブの検出と統合
 * - スマートなタブ復元
 */
class SmartTabManager {
  constructor(options = {}) {
    this.dataManager = new DataManager(options);
    this.tabsFile = 'current-tabs.json';
    this.sessionsFile = 'browser-sessions.json';
    this.settingsFile = 'browser-settings.json';

    // デフォルト設定
    this.defaultSettings = {
      maxTabsPerWindow: options.maxTabsPerWindow || 20,
      autoSuspendThreshold: options.autoSuspendThreshold || 30 * 60 * 1000, // 30分
      memoryPressureThreshold: options.memoryPressureThreshold || 0.8, // 80%
      autoGroupEnabled: options.autoGroupEnabled || true,
      suspendEnabled: options.suspendEnabled || true
    };

    this.tabGroups = new Map();
    this.suspendedTabs = new Map();
  }

  /**
   * 新しいタブを追加し、スマート管理を実行
   */
  async addTab(tabData) {
    const { id, url, title } = tabData;

    // 現在のタブを取得
    let tabs = await this.dataManager.read(this.tabsFile, []);

    // 重複チェック
    const duplicateTab = await this.findDuplicateTab(tabs, url);
    if (duplicateTab) {
      // 重複タブがある場合は切り替えを推奨
      return {
        action: 'switch_to_existing',
        existingTabId: duplicateTab.id,
        message: '同じURLのタブが既に開いています'
      };
    }

    // タブ数の制限チェック
    if (tabs.length >= this.defaultSettings.maxTabsPerWindow) {
      await this.optimizeTabs(tabs);
      tabs = await this.dataManager.read(this.tabsFile, []); // 再読み込み
    }

    // 新しいタブを追加
    const newTab = {
      id,
      url,
      title: title || url,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      groupId: null,
      isSuspended: false,
      memoryUsage: 0,
      priority: this.calculateTabPriority(tabData)
    };

    tabs.push(newTab);
    await this.dataManager.write(this.tabsFile, tabs);

    // 自動グループ化を実行
    if (this.defaultSettings.autoGroupEnabled) {
      await this.autoGroupTabs();
    }

    return {
      action: 'tab_added',
      tabId: id,
      totalTabs: tabs.length
    };
  }

  /**
   * 重複タブを検出
   */
  async findDuplicateTab(tabs, url) {
    const normalizedUrl = this.normalizeUrl(url);

    for (const tab of tabs) {
      if (!tab.isSuspended && this.normalizeUrl(tab.url) === normalizedUrl) {
        return tab;
      }
    }

    return null;
  }

  /**
   * URLを正規化して比較
   */
  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // クエリパラメータとハッシュを除去
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch (e) {
      return url.toLowerCase();
    }
  }

  /**
   * タブの優先度を計算
   */
  calculateTabPriority(tabData) {
    const { url, title } = tabData;
    let priority = 1; // デフォルト優先度

    // URLベースの優先度付け
    if (url.includes('important') || url.includes('urgent')) priority += 2;
    if (url.includes('dashboard') || url.includes('admin')) priority += 1;
    if (url.includes('social') || url.includes('entertainment')) priority -= 1;

    // タイトルベースの優先度付け
    const titleLower = (title || '').toLowerCase();
    if (titleLower.includes('important') || titleLower.includes('urgent')) priority += 2;
    if (titleLower.includes('work') || titleLower.includes('project')) priority += 1;
    if (titleLower.includes('news') || titleLower.includes('social')) priority -= 1;

    return Math.max(1, Math.min(5, priority)); // 1-5の範囲に制限
  }

  /**
   * タブの自動グループ化
   */
  async autoGroupTabs() {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    const groups = new Map();

    // ドメインごとにグループ化
    for (const tab of tabs) {
      if (tab.isSuspended) continue;

      try {
        const domain = new URL(tab.url).hostname;
        if (!groups.has(domain)) {
          groups.set(domain, []);
        }
        groups.get(domain).push(tab);
      } catch (e) {
        // 無効なURLはスキップ
      }
    }

    // グループIDを割り当て
    let groupId = 1;
    for (const [domain, groupTabs] of groups) {
      if (groupTabs.length >= 2) { // 2つ以上のタブでグループ化
        for (const tab of groupTabs) {
          tab.groupId = `group_${groupId}`;
        }
        this.tabGroups.set(`group_${groupId}`, {
          id: `group_${groupId}`,
          domain,
          tabCount: groupTabs.length,
          createdAt: Date.now()
        });
        groupId++;
      }
    }

    await this.dataManager.write(this.tabsFile, tabs);
  }

  /**
   * タブの最適化（休止・削除）
   */
  async optimizeTabs(tabs) {
    const settings = await this.getSettings();

    // メモリ使用量チェック
    const memoryUsage = process.memoryUsage();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;

    if (memoryPressure > settings.memoryPressureThreshold) {
      await this.suspendLowPriorityTabs();
    }

    // 非アクティブタブの休止
    const now = Date.now();
    const suspendThreshold = now - settings.autoSuspendThreshold;

    for (const tab of tabs) {
      if (!tab.isSuspended && tab.lastAccessed < suspendThreshold && tab.priority <= 2) {
        await this.suspendTab(tab.id);
      }
    }

    // タブ数の制限を超えている場合は古いタブを削除
    if (tabs.length > settings.maxTabsPerWindow) {
      const sortedTabs = tabs
        .filter(tab => !tab.isSuspended)
        .sort((a, b) => (a.lastAccessed * a.priority) - (b.lastAccessed * b.priority));

      const toRemove = sortedTabs.slice(0, tabs.length - settings.maxTabsPerWindow + 1);
      const remainingTabs = tabs.filter(tab => !toRemove.includes(tab));

      await this.dataManager.write(this.tabsFile, remainingTabs);
    }
  }

  /**
   * 低優先度タブを休止
   */
  async suspendLowPriorityTabs() {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    const lowPriorityTabs = tabs
      .filter(tab => !tab.isSuspended && tab.priority <= 2)
      .sort((a, b) => a.priority - b.priority);

    for (const tab of lowPriorityTabs.slice(0, 5)) { // 最大5タブを休止
      await this.suspendTab(tab.id);
    }
  }

  /**
   * 特定のタブを休止
   */
  async suspendTab(tabId) {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    const tab = tabs.find(t => t.id === tabId);

    if (tab && !tab.isSuspended) {
      tab.isSuspended = true;
      tab.suspendedAt = Date.now();

      // 休止状態を保存
      this.suspendedTabs.set(tabId, {
        ...tab,
        suspendedState: {
          scrollPosition: 0,
          formData: {},
          lastActiveTime: tab.lastAccessed
        }
      });

      await this.dataManager.write(this.tabsFile, tabs);
      return true;
    }

    return false;
  }

  /**
   * 休止タブを復元
   */
  async restoreTab(tabId) {
    const suspendedTab = this.suspendedTabs.get(tabId);
    if (!suspendedTab) {
      return false;
    }

    const tabs = await this.dataManager.read(this.tabsFile, []);
    const tab = tabs.find(t => t.id === tabId);

    if (tab && tab.isSuspended) {
      tab.isSuspended = false;
      tab.lastAccessed = Date.now();
      delete tab.suspendedAt;

      this.suspendedTabs.delete(tabId);
      await this.dataManager.write(this.tabsFile, tabs);
      return true;
    }

    return false;
  }

  /**
   * タブ統計を取得
   */
  async getTabStats() {
    const tabs = await this.dataManager.read(this.tabsFile, []);

    const stats = {
      totalTabs: tabs.length,
      activeTabs: tabs.filter(t => !t.isSuspended).length,
      suspendedTabs: tabs.filter(t => t.isSuspended).length,
      groupedTabs: tabs.filter(t => t.groupId).length,
      groups: this.tabGroups.size,
      memoryUsage: 0,
      averageTabAge: 0
    };

    // メモリ使用量の推定
    stats.memoryUsage = tabs.reduce((total, tab) => total + (tab.memoryUsage || 0), 0);

    // 平均タブ年齢
    const now = Date.now();
    const ages = tabs.map(tab => now - tab.createdAt);
    stats.averageTabAge = ages.reduce((sum, age) => sum + age, 0) / ages.length;

    return stats;
  }

  /**
   * タブグループを取得
   */
  getTabGroups() {
    return Array.from(this.tabGroups.values());
  }

  /**
   * グループ内のタブを取得
   */
  async getTabsInGroup(groupId) {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    return tabs.filter(tab => tab.groupId === groupId);
  }

  /**
   * タブを閉じる
   */
  async closeTab(tabId) {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    const filteredTabs = tabs.filter(tab => tab.id !== tabId);

    if (filteredTabs.length < tabs.length) {
      this.suspendedTabs.delete(tabId);
      await this.dataManager.write(this.tabsFile, filteredTabs);
      return true;
    }

    return false;
  }

  /**
   * 複数のタブを閉じる
   */
  async closeTabs(tabIds) {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    const filteredTabs = tabs.filter(tab => !tabIds.includes(tab.id));

    const closedCount = tabs.length - filteredTabs.length;

    if (closedCount > 0) {
      for (const tabId of tabIds) {
        this.suspendedTabs.delete(tabId);
      }
      await this.dataManager.write(this.tabsFile, filteredTabs);
    }

    return closedCount;
  }

  /**
   * 古い休止タブを自動削除
   */
  async cleanupSuspendedTabs(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7日
    const now = Date.now();
    const cutoffTime = now - maxAge;

    const tabs = await this.dataManager.read(this.tabsFile, []);
    const activeTabs = tabs.filter(tab =>
      !tab.isSuspended || !tab.suspendedAt || tab.suspendedAt > cutoffTime
    );

    const removedCount = tabs.length - activeTabs.length;

    if (removedCount > 0) {
      // 削除されたタブの休止状態もクリア
      for (const tab of tabs) {
        if (tab.isSuspended && tab.suspendedAt && tab.suspendedAt <= cutoffTime) {
          this.suspendedTabs.delete(tab.id);
        }
      }

      await this.dataManager.write(this.tabsFile, activeTabs);
    }

    return removedCount;
  }

  /**
   * スマートタブマネージャーの設定を取得
   */
  async getSettings() {
    const settings = await this.dataManager.read(this.settingsFile, {});
    return {
      maxTabsPerWindow: settings.maxTabsPerWindow ?? this.defaultSettings.maxTabsPerWindow,
      autoSuspendThreshold: settings.autoSuspendThreshold ?? this.defaultSettings.autoSuspendThreshold,
      memoryPressureThreshold: settings.memoryPressureThreshold ?? this.defaultSettings.memoryPressureThreshold,
      autoGroupEnabled: settings.autoGroupEnabled ?? this.defaultSettings.autoGroupEnabled,
      suspendEnabled: settings.suspendEnabled ?? this.defaultSettings.suspendEnabled
    };
  }

  /**
   * スマートタブマネージャーの設定を更新
   */
  async updateSettings(newSettings) {
    const currentSettings = await this.dataManager.read(this.settingsFile, {});
    const updatedSettings = { ...currentSettings, ...newSettings };
    await this.dataManager.write(this.settingsFile, updatedSettings);

    // 設定を反映
    Object.assign(this.defaultSettings, updatedSettings);
  }

  /**
   * セッションを保存
   */
  async saveSession(sessionName) {
    const tabs = await this.dataManager.read(this.tabsFile, []);
    const sessions = await this.dataManager.read(this.sessionsFile, []);

    const session = {
      id: Date.now().toString(),
      name: sessionName,
      tabs: tabs.map(tab => ({
        url: tab.url,
        title: tab.title,
        groupId: tab.groupId
      })),
      createdAt: Date.now()
    };

    sessions.push(session);
    await this.dataManager.write(this.sessionsFile, sessions);

    return session;
  }

  /**
   * セッションを復元
   */
  async restoreSession(sessionId) {
    const sessions = await this.dataManager.read(this.sessionsFile, []);

    const session = sessions.find(s => s.id === sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // 現在のタブをクリア
    await this.dataManager.write(this.tabsFile, []);

    // セッションのタブを復元
    for (const tabData of session.tabs) {
      await this.addTab({
        id: await this.getNextTabId(),
        url: tabData.url,
        title: tabData.title
      });
    }

    return session.tabs.length;
  }

  /**
   * 次のタブIDを取得
   */
  async getNextTabId() {
    const nextId = await this.dataManager.read('next-tab-id.json', 1);
    await this.dataManager.write('next-tab-id.json', nextId + 1);
    return nextId;
  }
}

module.exports = SmartTabManager;
