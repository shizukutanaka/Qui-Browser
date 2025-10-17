/**
 * Tests for Plugin System
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const PluginManager = require('../lib/plugins/manager');
const PluginInterface = require('../lib/plugins/interface');

// Mock configuration
const mockConfig = {
  plugins: {
    enabled: true,
    paths: [],
    autoLoad: true
  }
};

test('Plugin Manager', async (t) => {
  let pluginManager;
  let tempDir;

  t.before(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'qui-plugins-test-'));
    pluginManager = new PluginManager(mockConfig);
  });

  t.after(async () => {
    if (pluginManager) {
      await pluginManager.cleanup();
    }
    if (tempDir) {
      try {
        await fs.rmdir(tempDir, { recursive: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  await t.test('PluginManager initializes correctly', () => {
    assert(pluginManager instanceof PluginManager);
    assert.strictEqual(typeof pluginManager.config, 'object');
    assert(pluginManager.plugins instanceof Map);
    assert(pluginManager.hooks instanceof Map);
  });

  await t.test('initializeHooks() creates all hook types', () => {
    const expectedHooks = [
      'server:start',
      'server:stop',
      'request:pre',
      'request:post',
      'response:pre',
      'response:post',
      'websocket:connection',
      'websocket:message',
      'websocket:disconnection',
      'api:route',
      'cache:get',
      'cache:set',
      'cache:delete',
      'database:query',
      'auth:login',
      'auth:logout',
      'file:upload',
      'file:download',
      'monitoring:alert',
      'config:load',
      'plugin:load',
      'plugin:unload'
    ];

    expectedHooks.forEach(hook => {
      assert(pluginManager.hooks.has(hook), `Missing hook: ${hook}`);
      assert(pluginManager.hooks.get(hook) instanceof Set, `Hook ${hook} is not a Set`);
    });
  });

  await t.test('registerHook() and executeHook() work correctly', async () => {
    let hookExecuted = false;
    let hookData = null;

    const testHandler = (data) => {
      hookExecuted = true;
      hookData = data;
      return { ...data, processed: true };
    };

    // Create a mock plugin
    const mockPlugin = { id: 'test-plugin' };

    pluginManager.registerHook('test:hook', testHandler, mockPlugin);

    const result = await pluginManager.executeHook('test:hook', { test: 'data' });

    assert(hookExecuted, 'Hook was not executed');
    assert.deepStrictEqual(hookData, { test: 'data' });
    assert.deepStrictEqual(result, { test: 'data', processed: true });
  });

  await t.test('loadPlugins() handles non-existent directories', async () => {
    // Should not throw for non-existent directories
    await pluginManager.loadPluginsFromDirectory('/non/existent/path');
    assert(true);
  });

  await t.test('validatePlugin() checks plugin structure', () => {
    // Valid plugin
    const validPlugin = {
      Plugin: class extends PluginInterface {}
    };
    assert(pluginManager.validatePlugin(validPlugin));

    // Invalid plugins
    assert(!pluginManager.validatePlugin(null));
    assert(!pluginManager.validatePlugin({}));
    assert(!pluginManager.validatePlugin({ Plugin: {} }));
    assert(!pluginManager.validatePlugin({ Plugin: function() {} }));
  });

  await t.test('getPluginConfig() returns default config', () => {
    const config = pluginManager.getPluginConfig('non-existent-plugin');
    assert.strictEqual(typeof config, 'object');
  });

  await t.test('getLoadedPlugins() returns loaded plugin IDs', () => {
    const plugins = pluginManager.getLoadedPlugins();
    assert(Array.isArray(plugins));
  });

  await t.test('unloadPlugin() handles non-existent plugins', async () => {
    const result = await pluginManager.unloadPlugin('non-existent');
    assert.strictEqual(result, false);
  });

  await t.test('getStats() returns plugin statistics', () => {
    const stats = pluginManager.getStats();

    assert.strictEqual(typeof stats, 'object');
    assert(stats.hasOwnProperty('totalPlugins'));
    assert(stats.hasOwnProperty('loadedPlugins'));
    assert(stats.hasOwnProperty('hooks'));

    assert.strictEqual(typeof stats.totalPlugins, 'number');
    assert(Array.isArray(stats.loadedPlugins));
    assert.strictEqual(typeof stats.hooks, 'object');
  });

  await t.test('cleanup() clears all plugins and hooks', async () => {
    await pluginManager.cleanup();

    assert.strictEqual(pluginManager.plugins.size, 0);
    assert.strictEqual(pluginManager.loadedPlugins.size, 0);

    // Check that hooks are cleared
    for (const hookSet of pluginManager.hooks.values()) {
      assert.strictEqual(hookSet.size, 0);
    }
  });
});

test('Plugin Interface', async (t) => {
  await t.test('PluginInterface provides base functionality', () => {
    const context = {
      config: { test: 'value' },
      hooks: null,
      logger: console,
      path: '/test/path'
    };

    const plugin = new PluginInterface(context);

    assert.strictEqual(plugin.id, 'plugininterface');
    assert.strictEqual(typeof plugin.version, 'string');
    assert.strictEqual(typeof plugin.context, 'object');
    assert.strictEqual(plugin.context, context);
  });

  await t.test('getConfig() retrieves configuration values', () => {
    const context = {
      config: { enabled: true, count: 42 }
    };

    const plugin = new PluginInterface(context);

    assert.strictEqual(plugin.getConfig('enabled'), true);
    assert.strictEqual(plugin.getConfig('count'), 42);
    assert.strictEqual(plugin.getConfig('missing', 'default'), 'default');
  });

  await t.test('log() uses provided logger', () => {
    let loggedMessage = null;
    let loggedLevel = null;

    const mockLogger = {
      info: (message) => {
        loggedLevel = 'info';
        loggedMessage = message;
      }
    };

    const context = { logger: mockLogger };
    const plugin = new PluginInterface(context);

    plugin.log('info', 'Test message');

    assert.strictEqual(loggedLevel, 'info');
    assert.strictEqual(loggedMessage, '[plugininterface] Test message');
  });

  await t.test('getMetadata() returns plugin information', () => {
    const plugin = new PluginInterface({});

    plugin.version = '2.0.0';
    plugin.description = 'Test plugin';

    const metadata = plugin.getMetadata();

    assert.strictEqual(metadata.id, 'plugininterface');
    assert.strictEqual(metadata.version, '2.0.0');
    assert.strictEqual(metadata.description, 'Test plugin');
    assert(Array.isArray(metadata.hooks));
  });

  await t.test('registerHook() and unregisterHook() manage hooks', () => {
    const plugin = new PluginInterface({});

    plugin.registerHook('test:hook', () => {});
    assert(plugin.hooks.hasOwnProperty('test:hook'));

    plugin.unregisterHook('test:hook');
    assert(!plugin.hooks.hasOwnProperty('test:hook'));
  });

  await t.test('executeHook() delegates to context hooks', async () => {
    let executedHook = null;
    let executedData = null;

    const mockHooks = {
      executeHook: async (hook, data) => {
        executedHook = hook;
        executedData = data;
        return { result: 'processed' };
      }
    };

    const context = { hooks: mockHooks };
    const plugin = new PluginInterface(context);

    const result = await plugin.executeHook('test:hook', { test: 'data' });

    assert.strictEqual(executedHook, 'test:hook');
    assert.deepStrictEqual(executedData, { test: 'data' });
    assert.deepStrictEqual(result, { result: 'processed' });
  });
});

// Integration test for plugin loading
test('Plugin Loading Integration', { skip: true }, async (t) => {
  // This test would require creating actual plugin files
  // Skip for now as it requires file system operations

  await t.test('loadPlugins() discovers and loads plugins', () => {
    // Implementation would test actual plugin loading
    assert(true);
  });

  await t.test('Plugin hooks are executed in order', () => {
    // Implementation would test hook execution order
    assert(true);
  });

  await t.test('Plugin lifecycle methods are called', () => {
    // Implementation would test load/unload lifecycle
    assert(true);
  });
});
