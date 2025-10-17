/**
 * Tests for Database Integration
 */

const { test } = require('node:test');
const assert = require('node:assert');
const DatabaseManager = require('../lib/database/manager');

// Mock database configuration
const mockConfig = {
  database: {
    enabled: false, // Disabled for testing without actual DB
    type: 'sqlite',
    host: 'localhost',
    port: 5432,
    name: 'test_db',
    user: 'test_user',
    password: 'test_pass',
    maxConnections: 5
  }
};

test('Database Manager', async (t) => {
  let dbManager;

  t.beforeEach(() => {
    dbManager = new DatabaseManager(mockConfig);
  });

  await t.test('DatabaseManager initializes correctly', () => {
    assert(dbManager instanceof DatabaseManager);
    assert.strictEqual(typeof dbManager.config, 'object');
    assert.strictEqual(dbManager.isConnected, false);
  });

  await t.test('initialize() handles disabled database', async () => {
    await dbManager.initialize();
    assert.strictEqual(dbManager.isConnected, false);
    assert.strictEqual(dbManager.adapter, null);
  });

  await t.test('isDatabaseConnected() returns false when disabled', () => {
    assert.strictEqual(dbManager.isDatabaseConnected(), false);
  });

  await t.test('getAdapter() throws when no adapter', () => {
    assert.throws(() => dbManager.getAdapter(), /Database not connected/);
  });

  await t.test('getStats() returns correct stats for disabled DB', () => {
    const stats = dbManager.getStats();
    assert.strictEqual(typeof stats, 'object');
    assert.strictEqual(stats.enabled, false);
    assert.strictEqual(stats.type, 'sqlite');
    assert.strictEqual(stats.connected, false);
    assert.strictEqual(stats.adapter, null);
  });

  await t.test('Database operations return defaults when disabled', async () => {
    // Test bookmark operations
    const bookmarks = await dbManager.getBookmarks('user1');
    assert(Array.isArray(bookmarks));
    assert.strictEqual(bookmarks.length, 0);

    const deleted = await dbManager.deleteBookmark('user1', 'bookmark1');
    assert.strictEqual(deleted, false);

    // Test history operations
    const history = await dbManager.getHistory('user1');
    assert(Array.isArray(history));
    assert.strictEqual(history.length, 0);

    const cleared = await dbManager.clearHistory('user1');
    assert.strictEqual(cleared, 0);

    // Test session operations
    const sessions = await dbManager.getSessions('user1');
    assert(Array.isArray(sessions));
    assert.strictEqual(sessions.length, 0);

    const deletedSession = await dbManager.deleteSession('user1', 'session1');
    assert.strictEqual(deletedSession, false);

    // Test settings operations
    const settings = await dbManager.getSettings('user1');
    assert.strictEqual(typeof settings, 'object');

    // Test file operations
    const files = await dbManager.listUserFiles('user1');
    assert(Array.isArray(files));
    assert.strictEqual(files.length, 0);

    const deletedFile = await dbManager.deleteFileInfo('file1');
    assert.strictEqual(deletedFile, false);

    // Test user operations
    const deletedUser = await dbManager.deleteUser('user1');
    assert.strictEqual(deletedUser, false);

    // Test analytics operations
    const analytics = await dbManager.getAnalyticsData('user1');
    assert(Array.isArray(analytics));
    assert.strictEqual(analytics.length, 0);
  });

  await t.test('Database operations throw when database required but disabled', async () => {
    await assert.rejects(
      () => dbManager.addBookmark('user1', { id: 'bm1', url: 'http://example.com' }),
      /Database not available/
    );

    await assert.rejects(
      () => dbManager.addHistoryEntry('user1', { id: 'h1', url: 'http://example.com' }),
      /Database not available/
    );

    await assert.rejects(
      () => dbManager.saveSession('user1', { id: 's1', name: 'test' }),
      /Database not available/
    );

    await assert.rejects(
      () => dbManager.updateSettings('user1', {}),
      /Database not available/
    );

    await assert.rejects(
      () => dbManager.saveFileInfo({ id: 'f1', userId: 'user1' }),
      /Database not available/
    );

    await assert.rejects(
      () => dbManager.createUser({ id: 'user1' }),
      /Database not available/
    );

    await assert.rejects(
      () => dbManager.updateUser('user1', {}),
      /Database not available/
    );
  });

  await t.test('close() works when no connection', async () => {
    await dbManager.close(); // Should not throw
    assert(true);
  });
});

test('Database Interface', async (t) => {
  const DatabaseInterface = require('../lib/database/interface');

  await t.test('DatabaseInterface has all required methods', () => {
    const methods = [
      'connect', 'disconnect', 'isConnected', 'createTables',
      'getBookmarks', 'addBookmark', 'updateBookmark', 'deleteBookmark',
      'getHistory', 'addHistoryEntry', 'clearHistory',
      'getSessions', 'saveSession', 'restoreSession', 'deleteSession',
      'getSettings', 'updateSettings',
      'saveFileInfo', 'getFileInfo', 'deleteFileInfo', 'listUserFiles',
      'createUser', 'getUser', 'updateUser', 'deleteUser',
      'saveAnalyticsEvent', 'getAnalyticsData'
    ];

    methods.forEach(method => {
      assert.strictEqual(typeof DatabaseInterface.prototype[method], 'function');
    });
  });

  await t.test('DatabaseInterface methods throw NotImplementedError', async () => {
    const db = new DatabaseInterface();

    const asyncMethods = [
      'connect', 'disconnect', 'createTables',
      'getBookmarks', 'addBookmark', 'updateBookmark', 'deleteBookmark',
      'getHistory', 'addHistoryEntry', 'clearHistory',
      'getSessions', 'saveSession', 'restoreSession', 'deleteSession',
      'getSettings', 'updateSettings',
      'saveFileInfo', 'getFileInfo', 'deleteFileInfo', 'listUserFiles',
      'createUser', 'getUser', 'updateUser', 'deleteUser',
      'saveAnalyticsEvent', 'getAnalyticsData'
    ];

    for (const method of asyncMethods) {
      await assert.rejects(() => db[method](), /must be implemented by subclass/);
    }

    const syncMethods = ['isConnected'];
    for (const method of syncMethods) {
      assert.throws(() => db[method](), /must be implemented by subclass/);
    }
  });
});

// PostgreSQL Adapter tests (mocked)
test('PostgreSQL Adapter Interface', async (t) => {
  const PostgreSQLAdapter = require('../lib/database/postgresql');

  await t.test('PostgreSQLAdapter can be instantiated', () => {
    const config = { ...mockConfig.database, enabled: true };
    const adapter = new PostgreSQLAdapter(config);

    assert(adapter instanceof PostgreSQLAdapter);
    assert.strictEqual(adapter.config, config);
    assert.strictEqual(adapter.isInitialized, false);
  });

  await t.test('PostgreSQLAdapter has required methods', () => {
    const config = { ...mockConfig.database, enabled: true };
    const adapter = new PostgreSQLAdapter(config);

    const methods = [
      'connect', 'disconnect', 'isConnected', 'createTables',
      'getBookmarks', 'addBookmark', 'updateBookmark', 'deleteBookmark',
      'getHistory', 'addHistoryEntry', 'clearHistory',
      'getSessions', 'saveSession', 'restoreSession', 'deleteSession',
      'getSettings', 'updateSettings',
      'saveFileInfo', 'getFileInfo', 'deleteFileInfo', 'listUserFiles',
      'createUser', 'getUser', 'updateUser', 'deleteUser',
      'saveAnalyticsEvent', 'getAnalyticsData'
    ];

    methods.forEach(method => {
      assert.strictEqual(typeof adapter[method], 'function');
    });
  });
});

// MongoDB Adapter tests (mocked)
test('MongoDB Adapter Interface', async (t) => {
  const MongoDBAdapter = require('../lib/database/mongodb');

  await t.test('MongoDBAdapter can be instantiated', () => {
    const config = { ...mockConfig.database, enabled: true };
    const adapter = new MongoDBAdapter(config);

    assert(adapter instanceof MongoDBAdapter);
    assert.strictEqual(adapter.config, config);
    assert.strictEqual(adapter.isInitialized, false);
  });

  await t.test('MongoDBAdapter has required methods', () => {
    const config = { ...mockConfig.database, enabled: true };
    const adapter = new MongoDBAdapter(config);

    const methods = [
      'connect', 'disconnect', 'isConnected', 'createTables',
      'getBookmarks', 'addBookmark', 'updateBookmark', 'deleteBookmark',
      'getHistory', 'addHistoryEntry', 'clearHistory',
      'getSessions', 'saveSession', 'restoreSession', 'deleteSession',
      'getSettings', 'updateSettings',
      'saveFileInfo', 'getFileInfo', 'deleteFileInfo', 'listUserFiles',
      'createUser', 'getUser', 'updateUser', 'deleteUser',
      'saveAnalyticsEvent', 'getAnalyticsData'
    ];

    methods.forEach(method => {
      assert.strictEqual(typeof adapter[method], 'function');
    });
  });
});
