/**
 * Qui Browser - Plugin Interface
 *
 * Base class for all plugins
 */

class PluginInterface {
  constructor(context) {
    this.context = context;
    this.id = this.constructor.name.toLowerCase();
    this.version = '1.0.0';
    this.description = '';
    this.hooks = {};
  }

  /**
   * Load the plugin
   * Called when plugin is loaded
   */
  async load() {
    // Override in subclass
    console.log(`Loading plugin: ${this.id}`);
  }

  /**
   * Unload the plugin
   * Called when plugin is unloaded
   */
  async unload() {
    // Override in subclass
    console.log(`Unloading plugin: ${this.id}`);
  }

  /**
   * Get plugin metadata
   */
  getMetadata() {
    return {
      id: this.id,
      version: this.version,
      description: this.description,
      hooks: Object.keys(this.hooks)
    };
  }

  /**
   * Register a hook handler
   */
  registerHook(hookName, handler) {
    this.hooks[hookName] = handler;
  }

  /**
   * Unregister a hook handler
   */
  unregisterHook(hookName) {
    delete this.hooks[hookName];
  }

  /**
   * Get configuration value
   */
  getConfig(key, defaultValue) {
    return this.context.config?.[key] ?? defaultValue;
  }

  /**
   * Log a message
   */
  log(level, message, ...args) {
    const logger = this.context.logger || console;
    if (typeof logger[level] === 'function') {
      logger[level](`[${this.id}] ${message}`, ...args);
    } else {
      logger.log(`[${this.id}] ${level.toUpperCase()}: ${message}`, ...args);
    }
  }

  /**
   * Execute a hook
   */
  async executeHook(hookName, data) {
    return await this.context.hooks.executeHook(hookName, data);
  }

  /**
   * Access server instance
   */
  get server() {
    return this.context.server;
  }

  /**
   * Access plugin path
   */
  get path() {
    return this.context.path;
  }
}

module.exports = PluginInterface;
