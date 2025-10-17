/**
 * Qui Browser - Plugin Manager
 *
 * Manages plugin loading, lifecycle, and integration
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class PluginManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.plugins = new Map();
    this.hooks = new Map();
    this.loadedPlugins = new Set();
    this.pluginConfigs = new Map();

    // Initialize hook system
    this.initializeHooks();
  }

  /**
   * Initialize the hook system
   */
  initializeHooks() {
    // Define available hooks
    const hooks = [
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

    hooks.forEach(hook => {
      this.hooks.set(hook, new Set());
    });
  }

  /**
   * Load plugins from directories
   */
  async loadPlugins() {
    const pluginDirs = [
      path.join(__dirname, '..', 'plugins'), // Built-in plugins
      path.join(process.cwd(), 'plugins'),   // User plugins
      ...(this.config.plugins?.paths || [])  // Custom paths
    ];

    for (const pluginDir of pluginDirs) {
      try {
        await this.loadPluginsFromDirectory(pluginDir);
      } catch (error) {
        console.warn(`Failed to load plugins from ${pluginDir}:`, error.message);
      }
    }

    console.log(`Loaded ${this.loadedPlugins.size} plugins`);
  }

  /**
   * Load plugins from a specific directory
   */
  async loadPluginsFromDirectory(pluginDir) {
    try {
      const entries = await fs.readdir(pluginDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadPlugin(path.join(pluginDir, entry.name));
        } else if (entry.name.endsWith('.js')) {
          await this.loadPlugin(path.join(pluginDir, entry.name));
        }
      }
    } catch (error) {
      // Directory doesn't exist, skip
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginPath) {
    try {
      let pluginModule;

      // Check if it's a directory with package.json
      const stat = await fs.stat(pluginPath);
      if (stat.isDirectory()) {
        const packagePath = path.join(pluginPath, 'package.json');
        const mainPath = path.join(pluginPath, 'index.js');

        try {
          const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
          const mainFile = packageJson.main || 'index.js';
          pluginModule = require(path.join(pluginPath, mainFile));
        } catch (error) {
          // No package.json, try index.js
          pluginModule = require(mainPath);
        }
      } else {
        pluginModule = require(pluginPath);
      }

      // Validate plugin structure
      if (!this.validatePlugin(pluginModule)) {
        console.warn(`Invalid plugin structure: ${pluginPath}`);
        return;
      }

      // Create plugin instance
      const pluginInstance = new pluginModule.Plugin(this.createPluginContext(pluginPath));

      // Load plugin
      await this.initializePlugin(pluginInstance, pluginPath);

    } catch (error) {
      console.error(`Failed to load plugin ${pluginPath}:`, error.message);
    }
  }

  /**
   * Validate plugin structure
   */
  validatePlugin(pluginModule) {
    return (
      pluginModule &&
      typeof pluginModule === 'object' &&
      typeof pluginModule.Plugin === 'function' &&
      pluginModule.Plugin.prototype &&
      typeof pluginModule.Plugin.prototype.load === 'function'
    );
  }

  /**
   * Create plugin context
   */
  createPluginContext(pluginPath) {
    return {
      config: this.getPluginConfig(pluginPath),
      hooks: this,
      server: null, // Will be set by server
      logger: console,
      path: pluginPath
    };
  }

  /**
   * Initialize plugin
   */
  async initializePlugin(pluginInstance, pluginPath) {
    try {
      // Load plugin
      await pluginInstance.load();

      // Register hooks
      if (pluginInstance.hooks) {
        for (const [hookName, handler] of Object.entries(pluginInstance.hooks)) {
          this.registerHook(hookName, handler, pluginInstance);
        }
      }

      // Store plugin
      const pluginId = pluginInstance.id || path.basename(pluginPath, '.js');
      this.plugins.set(pluginId, pluginInstance);
      this.loadedPlugins.add(pluginId);

      this.emit('plugin:loaded', { pluginId, instance: pluginInstance });

      console.log(`Plugin loaded: ${pluginId}`);

    } catch (error) {
      console.error(`Failed to initialize plugin ${pluginPath}:`, error.message);
    }
  }

  /**
   * Get plugin configuration
   */
  getPluginConfig(pluginPath) {
    const pluginName = path.basename(pluginPath, '.js');
    return this.config.plugins?.[pluginName] || {};
  }

  /**
   * Register a hook handler
   */
  registerHook(hookName, handler, pluginInstance) {
    if (!this.hooks.has(hookName)) {
      console.warn(`Unknown hook: ${hookName}`);
      return;
    }

    const hookSet = this.hooks.get(hookName);
    hookSet.add({ handler, plugin: pluginInstance });
  }

  /**
   * Execute hook handlers
   */
  async executeHook(hookName, data = {}) {
    const hookSet = this.hooks.get(hookName);
    if (!hookSet || hookSet.size === 0) {
      return data;
    }

    let result = data;

    for (const { handler, plugin } of hookSet) {
      try {
        result = await handler.call(plugin, result);
      } catch (error) {
        console.error(`Hook ${hookName} failed in plugin ${plugin.id}:`, error);
      }
    }

    return result;
  }

  /**
   * Get loaded plugin
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getLoadedPlugins() {
    return Array.from(this.plugins.keys());
  }

  /**
   * Unload plugin
   */
  async unloadPlugin(pluginId) {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    try {
      // Call unload hook
      if (typeof plugin.unload === 'function') {
        await plugin.unload();
      }

      // Remove from hooks
      for (const [hookName, hookSet] of this.hooks) {
        for (const hookEntry of hookSet) {
          if (hookEntry.plugin === plugin) {
            hookSet.delete(hookEntry);
          }
        }
      }

      // Remove plugin
      this.plugins.delete(pluginId);
      this.loadedPlugins.delete(pluginId);

      this.emit('plugin:unloaded', { pluginId, instance: plugin });

      console.log(`Plugin unloaded: ${pluginId}`);
      return true;

    } catch (error) {
      console.error(`Failed to unload plugin ${pluginId}:`, error);
      return false;
    }
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      totalPlugins: this.plugins.size,
      loadedPlugins: Array.from(this.loadedPlugins),
      hooks: Object.fromEntries(
        Array.from(this.hooks.entries()).map(([name, set]) => [name, set.size])
      )
    };
  }

  /**
   * Set server reference for plugins
   */
  setServer(server) {
    for (const plugin of this.plugins.values()) {
      if (plugin.context) {
        plugin.context.server = server;
      }
    }
  }

  /**
   * Cleanup all plugins
   */
  async cleanup() {
    const unloadPromises = Array.from(this.loadedPlugins).map(pluginId =>
      this.unloadPlugin(pluginId)
    );

    await Promise.allSettled(unloadPromises);
    this.plugins.clear();
    this.loadedPlugins.clear();
  }
}

module.exports = PluginManager;
