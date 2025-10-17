/**
 * API Handlers - RESTful API for bookmarks, history, and tabs
 * 軽量で高速なCRUD操作
 */

const { URL } = require('url');
const DataManager = require('./data-manager');
const ExtensionManager = require('../extensions/manager');
const { parseJsonBody } = require('./request-parsers');
const { isPlainObject, ensureArray, ensureObject } = require('./validators');

function isString(value) {
  return typeof value === 'string';
}

function sanitizeTitle(title, fallback) {
  if (!isString(title)) {
    return fallback;
  }
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 256) : fallback;
}

function isAllowedUrl(candidate) {
  if (!isString(candidate)) {
    return false;
  }
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeFolder(folder, fallback = 'default') {
  if (!isString(folder)) {
    return fallback;
  }
  const trimmed = folder.trim().slice(0, 64);
  return trimmed || fallback;
}

function clampNumber(value, { min, max, fallback }) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  if (typeof min === 'number' && num < min) {
    return min;
  }
  if (typeof max === 'number' && num > max) {
    return max;
  }
  return num;
}

function toSafeErrorMessage(error, fallback = 'Unexpected error') {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

class APIHandlers {
  constructor(options = {}) {
    this.dataManager = new DataManager(options.dataManager || {});
    this.extensionManager = options.extensionManager || new ExtensionManager(options.extensionManagerOptions || {});
  }

  /**
   * JSON レスポンスを送信
   */
  sendJSON(res, data, status = 200, headers = {}) {
    res.writeHead(status, {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    });
    res.end(JSON.stringify(data));
  }

  /**
   * エラーレスポンスを送信
   */
  sendError(res, message, status = 400, headers = {}) {
    const payload = isString(message) && message.trim().length > 0 ? message.trim() : 'Bad Request';
    this.sendJSON(res, { error: payload }, status, headers);
  }

  /**
   * リクエストボディを解析 (request-parsersを使用)
   */
  async parseBody(req) {
    return parseJsonBody(req, { limit: 1_048_576 });
  }

  /**
   * GET /api/bookmarks - 全書籤取得
   */
  async getBookmarks(req, res) {
    try {
      const bookmarks = ensureArray(await this.dataManager.read('bookmarks.json', []));
      this.sendJSON(res, { bookmarks, count: bookmarks.length });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to fetch bookmarks'), 500);
    }
  }

  /**
   * POST /api/bookmarks - 書籤追加
   */
  async addBookmark(req, res) {
    try {
      const body = await this.parseBody(req);
      const { url, title, folder } = body;

      if (!isAllowedUrl(url)) {
        return this.sendError(res, 'A valid http/https URL is required');
      }

      const bookmarks = ensureArray(await this.dataManager.read('bookmarks.json', []));
      const nextId = clampNumber(await this.dataManager.read('bookmark-next-id.json', 1), {
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        fallback: 1
      });

      const timestamp = Date.now();
      const newBookmark = {
        id: nextId,
        url,
        title: sanitizeTitle(title, url),
        folder: sanitizeFolder(folder),
        createdAt: timestamp,
        updatedAt: timestamp
      };

      bookmarks.push(newBookmark);

      await Promise.all([
        this.dataManager.write('bookmarks.json', bookmarks),
        this.dataManager.write('bookmark-next-id.json', nextId + 1)
      ]);

      this.sendJSON(res, { bookmark: newBookmark }, 201);
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to add bookmark'), 500);
    }
  }

  /**
   * DELETE /api/bookmarks/:id - 書籤削除
   */
  async deleteBookmark(req, res, id) {
    try {
      const bookmarkId = parseInt(id, 10);
      if (isNaN(bookmarkId)) {
        return this.sendError(res, 'Invalid bookmark ID');
      }

      const bookmarks = ensureArray(await this.dataManager.read('bookmarks.json', []));
      const index = bookmarks.findIndex(b => b.id === bookmarkId);

      if (index === -1) {
        return this.sendError(res, 'Bookmark not found', 404);
      }

      bookmarks.splice(index, 1);

      await this.dataManager.write('bookmarks.json', bookmarks);

      this.sendJSON(res, { success: true });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to delete bookmark'), 500);
    }
  }

  /**
   * GET /api/history - 履歴一覧取得
   */
  async getHistory(req, res, query = {}) {
    try {
      const history = ensureArray(await this.dataManager.read('history.json', []));
      const limit = clampNumber(query.limit, { min: 1, max: 500, fallback: 100 });
      const offset = clampNumber(query.offset, { min: 0, max: 10_000, fallback: 0 });

      const sliced = history.slice(offset, offset + limit);

      this.sendJSON(res, {
        history: sliced,
        total: history.length,
        limit,
        offset
      });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to fetch history'), 500);
    }
  }

  /**
   * POST /api/history - 履歴追加
   */
  async addHistory(req, res) {
    try {
      const body = await this.parseBody(req);
      const { url, title } = body;

      if (!isAllowedUrl(url)) {
        return this.sendError(res, 'A valid http/https URL is required');
      }

      const history = ensureArray(await this.dataManager.read('history.json', []));

      const newEntry = {
        url,
        title: sanitizeTitle(title, url),
        visitedAt: Date.now()
      };

      history.unshift(newEntry);

      if (history.length > 10_000) {
        history.length = 10_000;
      }

      await this.dataManager.write('history.json', history);

      this.sendJSON(res, { entry: newEntry }, 201);
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to add history'), 500);
    }
  }

  /**
   * DELETE /api/history - 履歴クリア
   */
  async clearHistory(req, res) {
    try {
      await this.dataManager.write('history.json', []);
      this.sendJSON(res, { success: true, message: 'History cleared' });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to clear history'), 500);
    }
  }

  /**
   * GET /api/tabs - タブ一覧取得
   */
  async getTabs(req, res) {
    try {
      const tabs = ensureArray(await this.dataManager.read('current-tabs.json', []));
      const activeTabId = await this.dataManager.read('active-tab-id.json', null);

      this.sendJSON(res, { tabs, activeTabId, count: tabs.length });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to fetch tabs'), 500);
    }
  }

  /**
   * POST /api/tabs - タブ追加
   */
  async addTab(req, res) {
    try {
      const body = await this.parseBody(req);
      const { url, title } = body;

      if (!isAllowedUrl(url)) {
        return this.sendError(res, 'A valid http/https URL is required');
      }

      const tabs = ensureArray(await this.dataManager.read('current-tabs.json', []));
      const nextId = clampNumber(await this.dataManager.read('next-tab-id.json', 1), {
        min: 1,
        max: Number.MAX_SAFE_INTEGER,
        fallback: 1
      });

      const newTab = {
        id: nextId,
        url,
        title: sanitizeTitle(title, url),
        createdAt: Date.now()
      };

      tabs.push(newTab);

      await Promise.all([
        this.dataManager.write('current-tabs.json', tabs),
        this.dataManager.write('next-tab-id.json', nextId + 1)
      ]);

      this.sendJSON(res, { tab: newTab }, 201);
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to add tab'), 500);
    }
  }

  /**
   * DELETE /api/tabs/:id - タブ削除
   */
  async deleteTab(req, res, id) {
    try {
      const tabId = parseInt(id, 10);
      if (isNaN(tabId)) {
        return this.sendError(res, 'Invalid tab ID');
      }

      const tabs = await this.dataManager.read('current-tabs.json', []);
      const index = tabs.findIndex(t => t.id === tabId);

      if (index === -1) {
        return this.sendError(res, 'Tab not found', 404);
      }

      tabs.splice(index, 1);
      await this.dataManager.write('current-tabs.json', tabs);

      this.sendJSON(res, { success: true, id: tabId });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to delete tab'), 500);
    }
  }

  /**
   * PUT /api/tabs/active - アクティブタブ設定
   */
  async setActiveTab(req, res) {
    try {
      const body = await this.parseBody(req);
      const { tabId } = body;

      if (!Number.isInteger(tabId) || tabId < 1) {
        return this.sendError(res, 'Invalid tab ID');
      }

      const tabs = ensureArray(await this.dataManager.read('current-tabs.json', []));
      if (!tabs.some(tab => tab.id === tabId)) {
        return this.sendError(res, 'Tab not found', 404);
      }

      await this.dataManager.write('active-tab-id.json', tabId);
      this.sendJSON(res, { success: true, activeTabId: tabId });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to set active tab'), 500);
    }
  }

  /**
   * GET /api/settings - 設定取得
   */
  async getSettings(req, res) {
    try {
      const settings = ensureObject(await this.dataManager.read('browser-settings.json', {}));
      this.sendJSON(res, { settings });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to fetch settings'), 500);
    }
  }

  /**
   * PUT /api/settings - 設定更新
   */
  async updateSettings(req, res) {
    try {
      const body = await this.parseBody(req);
      const { settings } = body;

      if (!isPlainObject(settings)) {
        return this.sendError(res, 'Invalid settings object');
      }

      const currentSettings = ensureObject(await this.dataManager.read('browser-settings.json', {}));
      const newSettings = { ...currentSettings, ...settings };

      await this.dataManager.write('browser-settings.json', newSettings);
      await this.dataManager.write('settings-last-modified.json', Date.now());

      this.sendJSON(res, { settings: newSettings, success: true });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to update settings'), 500);
    }
  }

  /**
   * GET /api/search - 履歴・書籤検索
   */
  async search(req, res, query = {}) {
    try {
      const q = (query.q || '').toLowerCase();
      const limit = clampNumber(query.limit, { min: 1, max: 100, fallback: 20 });

      if (!q || q.length < 2) {
        return this.sendError(res, 'Search query too short (min 2 chars)');
      }

      const history = ensureArray(await this.dataManager.read('history.json', []));
      const historyResults = history
        .filter(h => h.url.toLowerCase().includes(q) || h.title.toLowerCase().includes(q))
        .slice(0, limit);

      const bookmarks = ensureArray(await this.dataManager.read('bookmarks.json', []));
      const bookmarkResults = bookmarks
        .filter(b => b.url.toLowerCase().includes(q) || b.title.toLowerCase().includes(q))
        .slice(0, limit);

      this.sendJSON(res, {
        query: q,
        results: {
          history: historyResults,
          bookmarks: bookmarkResults
        },
        total: historyResults.length + bookmarkResults.length
      });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Search failed'), 500);
    }
  }

  /**
   * GET /api/sessions - セッション一覧取得
   */
  async getSessions(req, res) {
    try {
      const sessions = ensureArray(await this.dataManager.read('browser-sessions.json', []));
      this.sendJSON(res, { sessions, count: sessions.length });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to fetch sessions'), 500);
    }
  }

  /**
   * POST /api/sessions - セッション保存
   */
  async saveSession(req, res) {
    try {
      const body = await this.parseBody(req);
      const { name, tabs } = body;

      if (!isString(name) || name.trim().length === 0) {
        return this.sendError(res, 'Session name is required');
      }

      const sessions = ensureArray(await this.dataManager.read('browser-sessions.json', []));
      const sourceTabs = Array.isArray(tabs) ? tabs : ensureArray(await this.dataManager.read('current-tabs.json', []));

      const sanitizedTabs = sourceTabs
        .filter(tab => isPlainObject(tab) && isAllowedUrl(tab.url))
        .map(tab => ({
          id: Number.isInteger(tab.id) ? tab.id : Date.now(),
          url: tab.url,
          title: sanitizeTitle(tab.title, tab.url),
          createdAt: typeof tab.createdAt === 'number' ? tab.createdAt : Date.now()
        }));

      const newSession = {
        id: Date.now(),
        name: name.trim().slice(0, 128),
        tabs: sanitizedTabs,
        createdAt: Date.now(),
        tabCount: sanitizedTabs.length
      };

      sessions.push(newSession);
      await this.dataManager.write('browser-sessions.json', sessions);

      this.sendJSON(res, { session: newSession }, 201);
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to save session'), 500);
    }
  }

  /**
   * PUT /api/sessions/:id/restore - セッション復元
   */
  async restoreSession(req, res, id) {
    try {
      const sessionId = parseInt(id, 10);
      if (isNaN(sessionId)) {
        return this.sendError(res, 'Invalid session ID');
      }

      const sessions = ensureArray(await this.dataManager.read('browser-sessions.json', []));
      const session = sessions.find(s => s.id === sessionId);

      if (!session) {
        return this.sendError(res, 'Session not found', 404);
      }

      const restoredTabs = ensureArray(session.tabs).filter(tab => isPlainObject(tab) && isAllowedUrl(tab.url));
      await this.dataManager.write('current-tabs.json', restoredTabs);

      this.sendJSON(res, {
        success: true,
        session,
        restoredTabs: restoredTabs.length
      });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to restore session'), 500);
    }
  }

  /**
   * DELETE /api/sessions/:id - セッション削除
   */
  async deleteSession(req, res, id) {
    try {
      const sessionId = parseInt(id, 10);
      if (isNaN(sessionId)) {
        return this.sendError(res, 'Invalid session ID');
      }

      const sessions = ensureArray(await this.dataManager.read('browser-sessions.json', []));
      const index = sessions.findIndex(s => s.id === sessionId);

      if (index === -1) {
        return this.sendError(res, 'Session not found', 404);
      }

      sessions.splice(index, 1);
      await this.dataManager.write('browser-sessions.json', sessions);

      this.sendJSON(res, { success: true, id: sessionId });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to delete session'), 500);
    }
  }

  /**
   * GET /api/extensions - 拡張一覧取得
   */
  async getExtensions(req, res) {
    try {
      const extensions = await this.extensionManager.listExtensions();
      this.sendJSON(res, { extensions, count: extensions.length });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to fetch extensions'), 500);
    }
  }

  /**
   * POST /api/extensions - 拡張インストール
   */
  async installExtension(req, res) {
    try {
      const body = await this.parseBody(req);
      const { id, name, description, manifest, homepageUrl, enabled, version } = body;

      if (!isString(id) || id.trim().length === 0) {
        return this.sendError(res, 'Extension id is required');
      }

      const safePayload = {
        id: id.trim().slice(0, 128),
        name: isString(name) ? name.trim().slice(0, 128) : undefined,
        description: isString(description) ? description.trim().slice(0, 512) : undefined,
        homepageUrl: isString(homepageUrl) ? homepageUrl.trim().slice(0, 256) : undefined,
        enabled: typeof enabled === 'boolean' ? enabled : true,
        version: isString(version) ? version.trim().slice(0, 32) : undefined,
        manifest: ensureObject(manifest)
      };

      const installed = await this.extensionManager.installExtension(safePayload);
      this.sendJSON(res, { extension: installed }, 201);
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to install extension'), 500);
    }
  }

  /**
   * PUT /api/extensions/:id - 拡張更新
   */
  async updateExtension(req, res, id) {
    try {
      if (!isString(id) || id.trim().length === 0) {
        return this.sendError(res, 'Invalid extension id');
      }

      const body = await this.parseBody(req);
      const updates = {};

      if (isString(body.name)) {
        updates.name = body.name.trim().slice(0, 128);
      }
      if (isString(body.description)) {
        updates.description = body.description.trim().slice(0, 512);
      }
      if (isString(body.homepageUrl)) {
        updates.homepageUrl = body.homepageUrl.trim().slice(0, 256);
      }
      if (typeof body.enabled === 'boolean') {
        updates.enabled = body.enabled;
      }
      if (isPlainObject(body.manifest)) {
        updates.manifest = body.manifest;
      }
      if (isString(body.version)) {
        updates.version = body.version.trim().slice(0, 32);
      }

      const updated = await this.extensionManager.updateExtension(id.trim(), updates);
      this.sendJSON(res, { extension: updated });
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to update extension'), 500);
    }
  }

  /**
   * DELETE /api/extensions/:id - 拡張削除
   */
  async deleteExtension(req, res, id) {
    try {
      if (!isString(id) || id.trim().length === 0) {
        return this.sendError(res, 'Invalid extension id');
      }

      await this.extensionManager.removeExtension(id.trim());
      res.writeHead(204, {
        'Content-Length': 0
      });
      res.end();
    } catch (error) {
      this.sendError(res, toSafeErrorMessage(error, 'Failed to delete extension'), 500);
    }
  }
}

module.exports = APIHandlers;
