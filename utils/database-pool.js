/**
 * Database Connection Pooling
 *
 * Implements efficient database connection management (Improvements #172-173)
 * - Connection pooling with reuse
 * - Health checks
 * - Automatic reconnection
 * - Query timeout management
 * - Connection statistics
 */

const EventEmitter = require('events');

/**
 * Pool configuration
 */
const DEFAULT_POOL_CONFIG = {
  min: 2, // Minimum connections
  max: 10, // Maximum connections
  acquireTimeout: 30000, // 30 seconds
  idleTimeout: 60000, // 1 minute
  connectionTimeout: 10000, // 10 seconds
  queryTimeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000,
  healthCheckInterval: 30000, // 30 seconds
  healthCheckQuery: 'SELECT 1',
  validateOnBorrow: true,
  testWhileIdle: true
};

/**
 * Connection states
 */
const ConnectionState = {
  IDLE: 'idle',
  ACTIVE: 'active',
  VALIDATING: 'validating',
  CLOSED: 'closed',
  ERROR: 'error'
};

/**
 * Pool connection wrapper
 */
class PoolConnection {
  constructor(rawConnection, id) {
    this.rawConnection = rawConnection;
    this.id = id;
    this.state = ConnectionState.IDLE;
    this.createdAt = Date.now();
    this.lastUsedAt = Date.now();
    this.queryCount = 0;
    this.errorCount = 0;
  }

  /**
   * Check if connection is idle
   */
  isIdle() {
    return this.state === ConnectionState.IDLE;
  }

  /**
   * Check if connection is expired
   */
  isExpired(idleTimeout) {
    if (this.state !== ConnectionState.IDLE) {
      return false;
    }

    return Date.now() - this.lastUsedAt > idleTimeout;
  }

  /**
   * Mark connection as active
   */
  acquire() {
    this.state = ConnectionState.ACTIVE;
    this.lastUsedAt = Date.now();
  }

  /**
   * Mark connection as idle
   */
  release() {
    this.state = ConnectionState.IDLE;
    this.lastUsedAt = Date.now();
  }

  /**
   * Close connection
   */
  async close() {
    if (this.state === ConnectionState.CLOSED) {
      return;
    }

    this.state = ConnectionState.CLOSED;

    if (this.rawConnection && typeof this.rawConnection.close === 'function') {
      await this.rawConnection.close();
    } else if (this.rawConnection && typeof this.rawConnection.end === 'function') {
      await this.rawConnection.end();
    }
  }

  /**
   * Get connection age
   */
  getAge() {
    return Date.now() - this.createdAt;
  }

  /**
   * Get idle time
   */
  getIdleTime() {
    return Date.now() - this.lastUsedAt;
  }
}

/**
 * Database Connection Pool
 */
class DatabasePool extends EventEmitter {
  constructor(config = {}, connectionFactory) {
    super();
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
    this.connectionFactory = connectionFactory;
    this.connections = [];
    this.waitQueue = [];
    this.nextConnectionId = 1;
    this.stats = this.initializeStats();
    this.healthCheckInterval = null;
    this.closed = false;

    // Initialize minimum connections
    this.initialize();
  }

  /**
   * Initialize statistics
   */
  initializeStats() {
    return {
      created: 0,
      acquired: 0,
      released: 0,
      timedOut: 0,
      errors: 0,
      queries: 0,
      totalWaitTime: 0
    };
  }

  /**
   * Initialize pool
   */
  async initialize() {
    // Create minimum connections
    for (let i = 0; i < this.config.min; i++) {
      try {
        await this.createConnection();
      } catch (error) {
        console.error('Failed to create initial connection:', error);
      }
    }

    // Start health checks
    this.startHealthChecks();

    this.emit('initialized', { size: this.connections.length });
  }

  /**
   * Create new connection
   */
  async createConnection() {
    if (this.closed) {
      throw new Error('Pool is closed');
    }

    if (this.connections.length >= this.config.max) {
      throw new Error('Maximum pool size reached');
    }

    const id = this.nextConnectionId++;
    const rawConnection = await this.connectionFactory();

    const connection = new PoolConnection(rawConnection, id);
    this.connections.push(connection);
    this.stats.created++;

    this.emit('connectionCreated', { id });

    return connection;
  }

  /**
   * Acquire connection from pool
   *
   * @param {number} timeout - Acquire timeout (ms)
   * @returns {Promise<Object>} Connection
   */
  async acquire(timeout = this.config.acquireTimeout) {
    if (this.closed) {
      throw new Error('Pool is closed');
    }

    const startTime = Date.now();

    // Try to get idle connection
    let connection = this.findIdleConnection();

    // Create new connection if needed
    if (!connection && this.connections.length < this.config.max) {
      try {
        connection = await this.createConnection();
      } catch (error) {
        this.stats.errors++;
        throw error;
      }
    }

    // Wait for connection if none available
    if (!connection) {
      connection = await this.waitForConnection(timeout);
    }

    // Validate connection if configured
    if (this.config.validateOnBorrow) {
      const isValid = await this.validateConnection(connection);
      if (!isValid) {
        await this.removeConnection(connection);
        return this.acquire(timeout - (Date.now() - startTime));
      }
    }

    // Mark as active
    connection.acquire();
    this.stats.acquired++;
    this.stats.totalWaitTime += Date.now() - startTime;

    this.emit('connectionAcquired', { id: connection.id });

    return connection.rawConnection;
  }

  /**
   * Release connection back to pool
   *
   * @param {Object} rawConnection - Raw connection
   */
  async release(rawConnection) {
    const connection = this.connections.find((c) => c.rawConnection === rawConnection);

    if (!connection) {
      console.warn('Attempted to release unknown connection');
      return;
    }

    connection.release();
    this.stats.released++;

    this.emit('connectionReleased', { id: connection.id });

    // Process wait queue
    this.processWaitQueue();
  }

  /**
   * Find idle connection
   *
   * @returns {PoolConnection|null} Idle connection
   */
  findIdleConnection() {
    return this.connections.find((conn) => conn.isIdle() && conn.state === ConnectionState.IDLE);
  }

  /**
   * Wait for available connection
   *
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<PoolConnection>} Connection
   */
  waitForConnection(timeout) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.waitQueue.findIndex((item) => item.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        this.stats.timedOut++;
        reject(new Error('Connection acquire timeout'));
      }, timeout);

      this.waitQueue.push({
        resolve: (connection) => {
          clearTimeout(timeoutId);
          resolve(connection);
        },
        reject
      });
    });
  }

  /**
   * Process wait queue
   */
  processWaitQueue() {
    while (this.waitQueue.length > 0) {
      const connection = this.findIdleConnection();
      if (!connection) {
        break;
      }

      const waiter = this.waitQueue.shift();
      waiter.resolve(connection);
    }
  }

  /**
   * Validate connection
   *
   * @param {PoolConnection} connection - Connection to validate
   * @returns {Promise<boolean>} Validation result
   */
  async validateConnection(connection) {
    if (connection.state === ConnectionState.ERROR || connection.state === ConnectionState.CLOSED) {
      return false;
    }

    try {
      connection.state = ConnectionState.VALIDATING;

      // Execute health check query
      if (typeof connection.rawConnection.query === 'function') {
        await connection.rawConnection.query(this.config.healthCheckQuery);
      } else if (typeof connection.rawConnection.execute === 'function') {
        await connection.rawConnection.execute(this.config.healthCheckQuery);
      }

      connection.state = ConnectionState.IDLE;
      return true;
    } catch (error) {
      connection.state = ConnectionState.ERROR;
      connection.errorCount++;
      return false;
    }
  }

  /**
   * Remove connection from pool
   *
   * @param {PoolConnection} connection - Connection to remove
   */
  async removeConnection(connection) {
    const index = this.connections.indexOf(connection);
    if (index !== -1) {
      this.connections.splice(index, 1);
    }

    await connection.close();
    this.emit('connectionRemoved', { id: connection.id });
  }

  /**
   * Execute query with automatic connection management
   *
   * @param {string} query - SQL query
   * @param {Array} params - Query parameters
   * @returns {Promise<any>} Query result
   */
  async query(query, params = []) {
    const connection = await this.acquire();

    try {
      let result;
      if (typeof connection.query === 'function') {
        result = await connection.query(query, params);
      } else if (typeof connection.execute === 'function') {
        result = await connection.execute(query, params);
      } else {
        throw new Error('Connection does not support query or execute method');
      }

      this.stats.queries++;
      return result;
    } finally {
      await this.release(connection);
    }
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    if (this.healthCheckInterval) {
      return;
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, this.config.healthCheckInterval);

    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform health check on all connections
   */
  async performHealthCheck() {
    const checks = this.connections.map(async (connection) => {
      if (this.config.testWhileIdle && connection.isIdle()) {
        const isValid = await this.validateConnection(connection);
        if (!isValid) {
          await this.removeConnection(connection);

          // Replace with new connection if below minimum
          if (this.connections.length < this.config.min) {
            try {
              await this.createConnection();
            } catch (error) {
              console.error('Failed to create replacement connection:', error);
            }
          }
        }
      }

      // Remove expired connections
      if (connection.isExpired(this.config.idleTimeout) && this.connections.length > this.config.min) {
        await this.removeConnection(connection);
      }
    });

    await Promise.all(checks);
  }

  /**
   * Close all connections and shut down pool
   */
  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    this.stopHealthChecks();

    // Reject all waiting requests
    for (const waiter of this.waitQueue) {
      waiter.reject(new Error('Pool is closing'));
    }
    this.waitQueue = [];

    // Close all connections
    await Promise.all(this.connections.map((conn) => conn.close()));
    this.connections = [];

    this.emit('closed');
  }

  /**
   * Get pool statistics
   *
   * @returns {Object} Statistics
   */
  getStatistics() {
    const activeConnections = this.connections.filter((c) => c.state === ConnectionState.ACTIVE).length;
    const idleConnections = this.connections.filter((c) => c.state === ConnectionState.IDLE).length;
    const avgWaitTime = this.stats.acquired > 0 ? this.stats.totalWaitTime / this.stats.acquired : 0;

    return {
      ...this.stats,
      totalConnections: this.connections.length,
      activeConnections,
      idleConnections,
      waitingRequests: this.waitQueue.length,
      averageWaitTimeMs: Math.round(avgWaitTime),
      poolUtilization: ((activeConnections / this.config.max) * 100).toFixed(2) + '%'
    };
  }

  /**
   * Get pool status
   *
   * @returns {Object} Status
   */
  getStatus() {
    return {
      closed: this.closed,
      size: this.connections.length,
      min: this.config.min,
      max: this.config.max,
      active: this.connections.filter((c) => c.state === ConnectionState.ACTIVE).length,
      idle: this.connections.filter((c) => c.state === ConnectionState.IDLE).length,
      waiting: this.waitQueue.length
    };
  }
}

/**
 * Create database pool
 *
 * @param {Object} config - Pool configuration
 * @param {Function} connectionFactory - Function that creates connections
 * @returns {DatabasePool} Pool instance
 */
function createDatabasePool(config, connectionFactory) {
  return new DatabasePool(config, connectionFactory);
}

module.exports = {
  DatabasePool,
  PoolConnection,
  ConnectionState,
  createDatabasePool,
  DEFAULT_POOL_CONFIG
};
