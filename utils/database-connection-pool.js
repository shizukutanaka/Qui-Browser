/**
 * Database Connection Pool Manager
 *
 * Based on 2025 research: Connection pooling is critical for performance
 *
 * Key Benefits (2025 research):
 * - PostgreSQL handshake: 20-30ms per connection
 * - Reduces overhead and improves performance
 * - Reuses pre-established connections
 * - Prevents connection leaks
 * - Supports both PostgreSQL and MongoDB
 *
 * PostgreSQL Best Practices:
 * - Use connection pool for long-running applications
 * - Always release clients after use
 * - Default pool size: 10-20 for 100 concurrent requests
 * - Handshake time: 20-30ms (saved with pooling)
 *
 * MongoDB Best Practices:
 * - MaxPoolSize default: 100 (adjustable)
 * - MinPoolSize: 0 (closes idle connections)
 * - Open MongoClient once and reuse
 * - Pool size: 10-20 for 100 concurrent requests
 * - Idle connection closure (v6.18.0+)
 *
 * @see https://node-postgres.com/features/pooling
 * @see https://www.mongodb.com/docs/drivers/node/current/connect/connection-options/connection-pools/
 * @see https://medium.com/@vikramgyawali57/connection-pooling-in-node-js-maximizing-database-performance-c1e5e06dcaed
 */

const EventEmitter = require('events');

class DatabaseConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Database type
      type: options.type || 'postgresql', // postgresql, mongodb, mysql

      // Connection settings
      host: options.host || 'localhost',
      port: options.port || (options.type === 'mongodb' ? 27017 : 5432),
      database: options.database || 'qui_browser',
      user: options.user || 'postgres',
      password: options.password || '',

      // Pool configuration
      poolSize: options.poolSize || 20,
      minPoolSize: options.minPoolSize || 2,
      maxPoolSize: options.maxPoolSize || 100,

      // Connection timeouts
      connectionTimeout: options.connectionTimeout || 30000, // 30 seconds
      idleTimeout: options.idleTimeout || 30000, // 30 seconds
      maxIdleTime: options.maxIdleTime || 30000, // 30 seconds

      // Queue settings
      maxQueue: options.maxQueue || 1000,
      queueTimeout: options.queueTimeout || 5000, // 5 seconds

      // Health check
      enableHealthCheck: options.enableHealthCheck !== false,
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds

      // Connection retry
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,

      // Logging
      enableLogging: options.enableLogging || false,

      ...options
    };

    // Connection pool
    this.pool = null;
    this.connections = new Map(); // connection ID -> connection object
    this.availableConnections = [];
    this.queue = [];

    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalWaitTime: 0,
      avgWaitTime: 0,
      connectionErrors: 0,
      queryErrors: 0,
      poolExhausted: 0
    };

    // Health check interval
    this.healthCheckTimer = null;
  }

  /**
   * Initialize connection pool
   */
  async initialize() {
    try {
      switch (this.options.type) {
        case 'postgresql':
          await this.initializePostgreSQL();
          break;

        case 'mongodb':
          await this.initializeMongoDB();
          break;

        case 'mysql':
          await this.initializeMySQL();
          break;

        default:
          throw new Error(`Unsupported database type: ${this.options.type}`);
      }

      // Start health check
      if (this.options.enableHealthCheck) {
        this.startHealthCheck();
      }

      this.emit('initialized', {
        type: this.options.type,
        poolSize: this.options.poolSize
      });

      return true;
    } catch (error) {
      this.emit('error', { error, phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  async initializePostgreSQL() {
    // In production: Use pg library
    // const { Pool } = require('pg');

    // Simulated pool configuration
    this.pool = {
      type: 'postgresql',
      config: {
        host: this.options.host,
        port: this.options.port,
        database: this.options.database,
        user: this.options.user,
        password: this.options.password,
        max: this.options.maxPoolSize, // Maximum pool size
        min: this.options.minPoolSize, // Minimum pool size
        idleTimeoutMillis: this.options.idleTimeout,
        connectionTimeoutMillis: this.options.connectionTimeout,
        maxUses: 7500 // Connection lifetime (prevent memory leaks)
      }
    };

    // Create initial connections (min pool size)
    for (let i = 0; i < this.options.minPoolSize; i++) {
      await this.createConnection();
    }

    this.emit('poolCreated', {
      type: 'postgresql',
      minSize: this.options.minPoolSize,
      maxSize: this.options.maxPoolSize
    });
  }

  /**
   * Initialize MongoDB connection pool
   */
  async initializeMongoDB() {
    // In production: Use mongodb library
    // const { MongoClient } = require('mongodb');

    // Simulated pool configuration
    this.pool = {
      type: 'mongodb',
      config: {
        host: this.options.host,
        port: this.options.port,
        database: this.options.database,
        maxPoolSize: this.options.maxPoolSize, // Default: 100
        minPoolSize: this.options.minPoolSize, // Default: 0
        maxIdleTimeMS: this.options.maxIdleTime,
        waitQueueTimeoutMS: this.options.queueTimeout,
        serverSelectionTimeoutMS: this.options.connectionTimeout
      }
    };

    // MongoDB connection URL
    const url = `mongodb://${this.options.host}:${this.options.port}/${this.options.database}`;

    // Create initial connections
    for (let i = 0; i < this.options.minPoolSize; i++) {
      await this.createConnection();
    }

    this.emit('poolCreated', {
      type: 'mongodb',
      minSize: this.options.minPoolSize,
      maxSize: this.options.maxPoolSize
    });
  }

  /**
   * Initialize MySQL connection pool
   */
  async initializeMySQL() {
    // In production: Use mysql2 library
    // const mysql = require('mysql2/promise');

    this.pool = {
      type: 'mysql',
      config: {
        host: this.options.host,
        port: this.options.port,
        database: this.options.database,
        user: this.options.user,
        password: this.options.password,
        connectionLimit: this.options.maxPoolSize,
        queueLimit: this.options.maxQueue,
        waitForConnections: true,
        idleTimeout: this.options.idleTimeout
      }
    };

    // Create initial connections
    for (let i = 0; i < this.options.minPoolSize; i++) {
      await this.createConnection();
    }

    this.emit('poolCreated', {
      type: 'mysql',
      minSize: this.options.minPoolSize,
      maxSize: this.options.maxPoolSize
    });
  }

  /**
   * Create new connection
   */
  async createConnection() {
    const connectionId = this.generateConnectionId();

    // Simulate connection creation (20-30ms for PostgreSQL)
    const startTime = Date.now();
    await this.simulateHandshake();
    const handshakeTime = Date.now() - startTime;

    const connection = {
      id: connectionId,
      type: this.pool.type,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      useCount: 0,
      inUse: false,
      handshakeTime,
      // Simulated connection object
      _connection: { id: connectionId, connected: true }
    };

    this.connections.set(connectionId, connection);
    this.availableConnections.push(connection);
    this.stats.totalConnections++;
    this.stats.idleConnections++;

    this.emit('connectionCreated', {
      connectionId,
      type: this.pool.type,
      handshakeTime
    });

    return connection;
  }

  /**
   * Acquire connection from pool
   */
  async acquire() {
    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.waitingRequests++;

    try {
      // Check if connection available
      if (this.availableConnections.length > 0) {
        const connection = this.availableConnections.shift();
        connection.inUse = true;
        connection.lastUsed = Date.now();
        connection.useCount++;

        this.stats.activeConnections++;
        this.stats.idleConnections--;
        this.stats.waitingRequests--;

        const waitTime = Date.now() - startTime;
        this.stats.totalWaitTime += waitTime;
        this.stats.avgWaitTime = this.stats.totalWaitTime / this.stats.totalRequests;

        this.emit('connectionAcquired', {
          connectionId: connection.id,
          waitTime,
          poolSize: this.connections.size
        });

        return connection;
      }

      // Check if can create new connection
      if (this.connections.size < this.options.maxPoolSize) {
        const connection = await this.createConnection();
        connection.inUse = true;
        connection.useCount++;

        // Remove from available (just added)
        const index = this.availableConnections.indexOf(connection);
        if (index > -1) {
          this.availableConnections.splice(index, 1);
        }

        this.stats.activeConnections++;
        this.stats.idleConnections--;
        this.stats.waitingRequests--;

        const waitTime = Date.now() - startTime;
        this.stats.totalWaitTime += waitTime;
        this.stats.avgWaitTime = this.stats.totalWaitTime / this.stats.totalRequests;

        return connection;
      }

      // Pool exhausted - wait for available connection
      this.stats.poolExhausted++;

      return await this.waitForConnection(startTime);

    } catch (error) {
      this.stats.failedRequests++;
      this.stats.waitingRequests--;
      this.emit('acquireError', { error });
      throw error;
    }
  }

  /**
   * Wait for available connection
   */
  async waitForConnection(startTime) {
    return new Promise((resolve, reject) => {
      // Add to queue
      const queueItem = {
        resolve,
        reject,
        startTime,
        timeout: setTimeout(() => {
          // Remove from queue
          const index = this.queue.indexOf(queueItem);
          if (index > -1) {
            this.queue.splice(index, 1);
          }

          this.stats.waitingRequests--;
          reject(new Error('Queue timeout exceeded'));
        }, this.options.queueTimeout)
      };

      this.queue.push(queueItem);

      // Check queue limit
      if (this.queue.length > this.options.maxQueue) {
        this.queue.shift(); // Remove oldest
        this.emit('queueOverflow', {
          queueSize: this.queue.length,
          maxQueue: this.options.maxQueue
        });
      }
    });
  }

  /**
   * Release connection back to pool
   */
  async release(connection) {
    if (!connection || !connection.id) {
      this.emit('releaseError', { error: 'Invalid connection' });
      return;
    }

    try {
      connection.inUse = false;
      connection.lastUsed = Date.now();

      this.stats.activeConnections--;
      this.stats.idleConnections++;
      this.stats.successfulRequests++;

      // Check if connection should be closed (max uses exceeded)
      if (connection.useCount >= (this.pool.config.maxUses || 7500)) {
        await this.closeConnection(connection);
        return;
      }

      // Process queue first
      if (this.queue.length > 0) {
        const queueItem = this.queue.shift();
        clearTimeout(queueItem.timeout);

        connection.inUse = true;
        connection.useCount++;

        this.stats.activeConnections++;
        this.stats.idleConnections--;
        this.stats.waitingRequests--;

        const waitTime = Date.now() - queueItem.startTime;
        this.stats.totalWaitTime += waitTime;
        this.stats.avgWaitTime = this.stats.totalWaitTime / this.stats.totalRequests;

        queueItem.resolve(connection);
        return;
      }

      // Return to available pool
      this.availableConnections.push(connection);

      this.emit('connectionReleased', {
        connectionId: connection.id,
        useCount: connection.useCount
      });

      // Check if should close idle connections
      await this.closeIdleConnections();

    } catch (error) {
      this.emit('releaseError', { error, connectionId: connection.id });
    }
  }

  /**
   * Execute query with automatic connection management
   */
  async query(sql, params = []) {
    const connection = await this.acquire();

    try {
      // Execute query (simulated)
      const result = await this.executeQuery(connection, sql, params);

      return result;

    } catch (error) {
      this.stats.queryErrors++;
      this.emit('queryError', { error, sql });
      throw error;

    } finally {
      // Always release connection
      await this.release(connection);
    }
  }

  /**
   * Execute query on connection
   */
  async executeQuery(connection, sql, params) {
    // In production: Use actual database driver
    // PostgreSQL: client.query(sql, params)
    // MongoDB: db.collection(name).find(query)
    // MySQL: connection.execute(sql, params)

    // Simulate query execution
    await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

    return {
      rows: [],
      rowCount: 0,
      command: sql.split(' ')[0].toUpperCase(),
      duration: Math.random() * 50
    };
  }

  /**
   * Close idle connections
   */
  async closeIdleConnections() {
    const now = Date.now();
    const idleThreshold = this.options.idleTimeout;

    for (const connection of this.availableConnections) {
      // Check if idle too long and above min pool size
      if (now - connection.lastUsed > idleThreshold &&
          this.connections.size > this.options.minPoolSize) {
        await this.closeConnection(connection);
      }
    }
  }

  /**
   * Close specific connection
   */
  async closeConnection(connection) {
    // Remove from available connections
    const index = this.availableConnections.indexOf(connection);
    if (index > -1) {
      this.availableConnections.splice(index, 1);
    }

    // Remove from connections map
    this.connections.delete(connection.id);

    this.stats.totalConnections--;
    if (connection.inUse) {
      this.stats.activeConnections--;
    } else {
      this.stats.idleConnections--;
    }

    this.emit('connectionClosed', {
      connectionId: connection.id,
      useCount: connection.useCount,
      lifetime: Date.now() - connection.createdAt
    });
  }

  /**
   * Health check for connections
   */
  async healthCheck() {
    const unhealthyConnections = [];

    for (const connection of this.connections.values()) {
      // Check if connection still alive
      try {
        await this.pingConnection(connection);
      } catch (error) {
        unhealthyConnections.push(connection);
      }
    }

    // Close unhealthy connections
    for (const connection of unhealthyConnections) {
      await this.closeConnection(connection);
      this.stats.connectionErrors++;
    }

    if (unhealthyConnections.length > 0) {
      this.emit('unhealthyConnections', {
        count: unhealthyConnections.length,
        total: this.connections.size
      });
    }

    // Ensure minimum pool size
    while (this.connections.size < this.options.minPoolSize) {
      await this.createConnection();
    }
  }

  /**
   * Ping connection to check if alive
   */
  async pingConnection(connection) {
    // In production: Execute simple query
    // PostgreSQL: SELECT 1
    // MongoDB: db.admin().ping()
    // MySQL: SELECT 1

    return true;
  }

  /**
   * Start health check interval
   */
  startHealthCheck() {
    this.healthCheckTimer = setInterval(async () => {
      await this.healthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * Simulate database handshake (20-30ms for PostgreSQL)
   */
  async simulateHandshake() {
    const delay = 20 + Math.random() * 10; // 20-30ms
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Generate connection ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get pool statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      poolSize: this.connections.size,
      availableConnections: this.availableConnections.length,
      queueSize: this.queue.length,
      utilizationRate: this.stats.activeConnections / this.connections.size,
      avgConnectionLifetime: this.calculateAvgConnectionLifetime(),
      avgConnectionUseCount: this.calculateAvgConnectionUseCount()
    };
  }

  /**
   * Calculate average connection lifetime
   */
  calculateAvgConnectionLifetime() {
    if (this.connections.size === 0) return 0;

    const now = Date.now();
    let totalLifetime = 0;

    for (const connection of this.connections.values()) {
      totalLifetime += now - connection.createdAt;
    }

    return totalLifetime / this.connections.size;
  }

  /**
   * Calculate average connection use count
   */
  calculateAvgConnectionUseCount() {
    if (this.connections.size === 0) return 0;

    let totalUseCount = 0;

    for (const connection of this.connections.values()) {
      totalUseCount += connection.useCount;
    }

    return totalUseCount / this.connections.size;
  }

  /**
   * Close all connections and shutdown pool
   */
  async close() {
    // Clear health check timer
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // Reject all queued requests
    for (const queueItem of this.queue) {
      clearTimeout(queueItem.timeout);
      queueItem.reject(new Error('Pool is closing'));
    }

    this.queue = [];

    // Close all connections
    const connectionIds = Array.from(this.connections.keys());

    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      await this.closeConnection(connection);
    }

    this.emit('closed', {
      totalRequests: this.stats.totalRequests,
      successfulRequests: this.stats.successfulRequests,
      failedRequests: this.stats.failedRequests
    });
  }
}

module.exports = DatabaseConnectionPool;
