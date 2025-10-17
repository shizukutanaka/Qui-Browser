/**
 * Graceful Shutdown Handler
 * Production-grade shutdown with connection draining
 *
 * @module utils/graceful-shutdown
 */

/**
 * Graceful Shutdown Manager
 * Handles clean server shutdown with connection draining and resource cleanup
 *
 * @class GracefulShutdown
 * @description Provides graceful shutdown capabilities:
 * - Connection draining
 * - Resource cleanup
 * - Timeout handling
 * - State persistence
 * - Signal handling
 */
class GracefulShutdown {
  /**
   * Create a graceful shutdown manager
   * @param {Object} options - Configuration options
   * @param {number} [options.timeout=30000] - Shutdown timeout (ms)
   * @param {number} [options.drainTimeout=10000] - Connection drain timeout (ms)
   * @param {Array<string>} [options.signals] - Signals to handle
   * @param {Function} [options.onShutdownStart] - Callback when shutdown starts
   * @param {Function} [options.onShutdownComplete] - Callback when shutdown completes
   * @param {Function} [options.logger] - Logger function
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.drainTimeout = options.drainTimeout || 10000;
    this.signals = options.signals || ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    this.onShutdownStart = options.onShutdownStart || (() => {});
    this.onShutdownComplete = options.onShutdownComplete || (() => {});
    this.logger = options.logger || console.log;

    this.servers = [];
    this.cleanupTasks = [];
    this.connections = new Set();
    this.isShuttingDown = false;
    this.shutdownStartTime = null;

    this.setupSignalHandlers();
  }

  /**
   * Setup signal handlers
   * @private
   */
  setupSignalHandlers() {
    for (const signal of this.signals) {
      process.on(signal, () => {
        this.logger(`Received ${signal}, starting graceful shutdown...`);
        this.shutdown(signal);
      });
    }

    // Handle uncaught exceptions
    process.on('uncaughtException', error => {
      this.logger('Uncaught exception:', error);
      this.shutdown('uncaughtException', 1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger('Unhandled rejection:', reason);
      this.shutdown('unhandledRejection', 1);
    });
  }

  /**
   * Register HTTP server for graceful shutdown
   * @param {Object} server - HTTP server instance
   */
  registerServer(server) {
    this.servers.push(server);

    // Track connections
    server.on('connection', connection => {
      this.connections.add(connection);

      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });

    // Track requests
    server.on('request', (req, res) => {
      // Mark new connections as not reusable during shutdown
      if (this.isShuttingDown) {
        res.setHeader('Connection', 'close');
      }

      // Clean up connection on response finish
      res.on('finish', () => {
        if (this.isShuttingDown && req.socket) {
          req.socket.destroy();
        }
      });
    });
  }

  /**
   * Register cleanup task
   * @param {string} name - Task name
   * @param {Function} task - Async cleanup function
   * @param {number} [priority=0] - Priority (higher = earlier)
   */
  registerCleanupTask(name, task, priority = 0) {
    this.cleanupTasks.push({
      name,
      task,
      priority
    });

    // Sort by priority (descending)
    this.cleanupTasks.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Start graceful shutdown
   * @param {string} [reason='unknown'] - Shutdown reason
   * @param {number} [exitCode=0] - Exit code
   */
  async shutdown(reason = 'unknown', exitCode = 0) {
    // Prevent multiple shutdown attempts
    if (this.isShuttingDown) {
      this.logger('Shutdown already in progress...');
      return;
    }

    this.isShuttingDown = true;
    this.shutdownStartTime = Date.now();

    this.logger(`Starting graceful shutdown (reason: ${reason})...`);
    this.onShutdownStart(reason);

    // Set overall shutdown timeout
    const shutdownTimer = setTimeout(() => {
      this.logger('Shutdown timeout exceeded, forcing exit');
      process.exit(exitCode);
    }, this.timeout);

    try {
      // Step 1: Stop accepting new connections
      await this.stopAcceptingConnections();

      // Step 2: Drain existing connections
      await this.drainConnections();

      // Step 3: Close servers
      await this.closeServers();

      // Step 4: Execute cleanup tasks
      await this.executeCleanupTasks();

      // Step 5: Final cleanup
      clearTimeout(shutdownTimer);

      const duration = Date.now() - this.shutdownStartTime;
      this.logger(`Graceful shutdown completed in ${duration}ms`);
      this.onShutdownComplete(reason, exitCode);

      process.exit(exitCode);
    } catch (error) {
      clearTimeout(shutdownTimer);
      this.logger('Error during shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Stop accepting new connections
   * @private
   */
  async stopAcceptingConnections() {
    this.logger('Stopping new connections...');

    for (const server of this.servers) {
      if (server.listening) {
        server.close();
      }
    }
  }

  /**
   * Drain existing connections
   * @private
   */
  async drainConnections() {
    const connectionCount = this.connections.size;

    if (connectionCount === 0) {
      this.logger('No active connections to drain');
      return;
    }

    this.logger(`Draining ${connectionCount} active connections...`);

    const drainStartTime = Date.now();
    const drainDeadline = drainStartTime + this.drainTimeout;

    // Wait for connections to close naturally
    while (this.connections.size > 0 && Date.now() < drainDeadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Force close remaining connections
    if (this.connections.size > 0) {
      this.logger(`Force closing ${this.connections.size} remaining connections`);
      for (const connection of this.connections) {
        try {
          connection.destroy();
        } catch (error) {
          // Ignore errors when destroying connections
        }
      }
    }

    const drainDuration = Date.now() - drainStartTime;
    this.logger(`Connection draining completed in ${drainDuration}ms`);
  }

  /**
   * Close all registered servers
   * @private
   */
  async closeServers() {
    this.logger('Closing servers...');

    const closePromises = this.servers.map(
      server =>
        new Promise((resolve, reject) => {
          if (!server.listening) {
            resolve();
            return;
          }

          server.close(error => {
            if (error) {
              this.logger('Error closing server:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        })
    );

    await Promise.all(closePromises);
    this.logger('All servers closed');
  }

  /**
   * Execute cleanup tasks
   * @private
   */
  async executeCleanupTasks() {
    if (this.cleanupTasks.length === 0) {
      this.logger('No cleanup tasks to execute');
      return;
    }

    this.logger(`Executing ${this.cleanupTasks.length} cleanup tasks...`);

    for (const { name, task } of this.cleanupTasks) {
      try {
        this.logger(`Running cleanup task: ${name}`);
        await task();
        this.logger(`Cleanup task completed: ${name}`);
      } catch (error) {
        this.logger(`Cleanup task failed: ${name}`, error);
      }
    }

    this.logger('All cleanup tasks completed');
  }

  /**
   * Check if shutdown is in progress
   * @returns {boolean} - True if shutting down
   */
  isShutdownInProgress() {
    return this.isShuttingDown;
  }

  /**
   * Get shutdown status
   * @returns {Object} - Status information
   */
  getStatus() {
    return {
      isShuttingDown: this.isShuttingDown,
      activeConnections: this.connections.size,
      registeredServers: this.servers.length,
      cleanupTasks: this.cleanupTasks.length,
      shutdownStartTime: this.shutdownStartTime,
      elapsedTime: this.shutdownStartTime ? Date.now() - this.shutdownStartTime : 0
    };
  }
}

/**
 * Create and configure graceful shutdown for Express-like server
 * @param {Object} server - HTTP server
 * @param {Object} options - Configuration options
 * @returns {GracefulShutdown} - Shutdown manager instance
 */
function createGracefulShutdown(server, options = {}) {
  const shutdown = new GracefulShutdown(options);
  shutdown.registerServer(server);
  return shutdown;
}

/**
 * Simple graceful shutdown helper
 * @param {Object} server - HTTP server
 * @param {Object} options - Configuration options
 */
function enableGracefulShutdown(server, options = {}) {
  const shutdown = createGracefulShutdown(server, options);

  // Add common cleanup tasks
  if (options.cleanupDatabase) {
    shutdown.registerCleanupTask('database', options.cleanupDatabase, 100);
  }

  if (options.cleanupCache) {
    shutdown.registerCleanupTask('cache', options.cleanupCache, 90);
  }

  if (options.cleanupWorkers) {
    shutdown.registerCleanupTask('workers', options.cleanupWorkers, 80);
  }

  return shutdown;
}

module.exports = {
  GracefulShutdown,
  createGracefulShutdown,
  enableGracefulShutdown
};
