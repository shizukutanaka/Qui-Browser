/**
 * Connection Pool Manager
 * Production-grade connection pooling for database and external services
 *
 * @module utils/connection-pool
 */

/**
 * Connection Pool
 * Manages reusable connections with health checking and lifecycle management
 *
 * @class ConnectionPool
 * @description Provides connection pooling with:
 * - Connection reuse
 * - Health checking
 * - Automatic reconnection
 * - Connection lifecycle management
 * - Resource limits
 */
class ConnectionPool {
  /**
   * Create a connection pool
   * @param {Object} options - Configuration options
   * @param {Function} options.create - Function to create new connection
   * @param {Function} options.destroy - Function to destroy connection
   * @param {Function} [options.validate] - Function to validate connection
   * @param {number} [options.min=2] - Minimum connections
   * @param {number} [options.max=10] - Maximum connections
   * @param {number} [options.acquireTimeout=30000] - Acquire timeout (ms)
   * @param {number} [options.idleTimeout=30000] - Idle timeout (ms)
   * @param {number} [options.maxUses=0] - Max uses per connection (0=unlimited)
   */
  constructor(options) {
    if (!options.create || !options.destroy) {
      throw new Error('create and destroy functions are required');
    }

    this.create = options.create;
    this.destroy = options.destroy;
    this.validate = options.validate || (() => Promise.resolve(true));

    this.min = options.min || 2;
    this.max = options.max || 10;
    this.acquireTimeout = options.acquireTimeout || 30000;
    this.idleTimeout = options.idleTimeout || 30000;
    this.maxUses = options.maxUses || 0;

    this.available = [];
    this.pending = [];
    this.inUse = new Map();
    this.creating = 0;

    this.stats = {
      created: 0,
      destroyed: 0,
      acquired: 0,
      released: 0,
      timeouts: 0,
      errors: 0
    };

    this.closed = false;
    this.startIdleCheck();
  }

  /**
   * Acquire connection from pool
   * @returns {Promise<Object>} - Connection object
   */
  async acquire() {
    if (this.closed) {
      throw new Error('Pool is closed');
    }

    this.stats.acquired++;

    // Try to get available connection
    while (this.available.length > 0) {
      const conn = this.available.shift();

      // Validate connection
      try {
        const isValid = await this.validate(conn.connection);
        if (isValid) {
          conn.uses++;
          conn.lastUsed = Date.now();
          this.inUse.set(conn.id, conn);
          return conn.connection;
        }

        // Invalid connection, destroy it
        await this.destroyConnection(conn);
      } catch (error) {
        await this.destroyConnection(conn);
      }
    }

    // Create new connection if below max
    const totalConnections = this.available.length + this.inUse.size + this.creating;
    if (totalConnections < this.max) {
      return this.createConnection();
    }

    // Wait for available connection
    return this.waitForConnection();
  }

  /**
   * Release connection back to pool
   * @param {Object} connection - Connection to release
   */
  async release(connection) {
    this.stats.released++;

    let conn = null;

    // Find connection in inUse map
    for (const [id, c] of this.inUse.entries()) {
      if (c.connection === connection) {
        conn = c;
        this.inUse.delete(id);
        break;
      }
    }

    if (!conn) {
      console.warn('Attempting to release unknown connection');
      return;
    }

    // Check if connection should be destroyed
    if (
      this.closed ||
      (this.maxUses > 0 && conn.uses >= this.maxUses) ||
      this.available.length + this.inUse.size > this.max
    ) {
      await this.destroyConnection(conn);
      return;
    }

    // Return to available pool
    conn.lastUsed = Date.now();
    this.available.push(conn);

    // Notify waiting requests
    if (this.pending.length > 0) {
      const resolve = this.pending.shift();
      resolve();
    }
  }

  /**
   * Create new connection
   * @private
   * @returns {Promise<Object>} - New connection
   */
  async createConnection() {
    this.creating++;

    try {
      const connection = await this.create();
      const conn = {
        id: Date.now() + Math.random(),
        connection,
        created: Date.now(),
        lastUsed: Date.now(),
        uses: 1
      };

      this.stats.created++;
      this.inUse.set(conn.id, conn);
      this.creating--;

      return connection;
    } catch (error) {
      this.creating--;
      this.stats.errors++;
      throw error;
    }
  }

  /**
   * Wait for available connection
   * @private
   * @returns {Promise<Object>} - Connection
   */
  waitForConnection() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.pending.indexOf(resolve);
        if (index !== -1) {
          this.pending.splice(index, 1);
        }

        this.stats.timeouts++;
        reject(new Error('Connection acquire timeout'));
      }, this.acquireTimeout);

      const wrappedResolve = async () => {
        clearTimeout(timeoutId);
        try {
          const connection = await this.acquire();
          resolve(connection);
        } catch (error) {
          reject(error);
        }
      };

      this.pending.push(wrappedResolve);
    });
  }

  /**
   * Destroy connection
   * @private
   * @param {Object} conn - Connection wrapper
   */
  async destroyConnection(conn) {
    try {
      await this.destroy(conn.connection);
      this.stats.destroyed++;
    } catch (error) {
      console.error('Error destroying connection:', error);
      this.stats.errors++;
    }
  }

  /**
   * Start idle connection check
   * @private
   */
  startIdleCheck() {
    this.idleCheckInterval = setInterval(() => {
      this.checkIdleConnections();
    }, this.idleTimeout / 2);
  }

  /**
   * Check and remove idle connections
   * @private
   */
  async checkIdleConnections() {
    if (this.closed) {
      return;
    }

    const now = Date.now();
    const minConnections = Math.min(this.min, this.max);

    // Keep minimum connections
    while (this.available.length > minConnections) {
      const conn = this.available[0];

      if (now - conn.lastUsed > this.idleTimeout) {
        this.available.shift();
        await this.destroyConnection(conn);
      } else {
        break;
      }
    }

    // Ensure minimum connections
    while (
      this.available.length + this.inUse.size + this.creating < minConnections
    ) {
      try {
        const conn = {
          id: Date.now() + Math.random(),
          connection: await this.create(),
          created: Date.now(),
          lastUsed: Date.now(),
          uses: 0
        };

        this.stats.created++;
        this.available.push(conn);
      } catch (error) {
        console.error('Error creating minimum connection:', error);
        this.stats.errors++;
        break;
      }
    }
  }

  /**
   * Execute function with pooled connection
   * @param {Function} fn - Async function to execute
   * @returns {Promise<*>} - Function result
   */
  async execute(fn) {
    const connection = await this.acquire();

    try {
      return await fn(connection);
    } finally {
      await this.release(connection);
    }
  }

  /**
   * Close pool and destroy all connections
   * @returns {Promise<void>}
   */
  async close() {
    if (this.closed) {
      return;
    }

    this.closed = true;

    // Stop idle check
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
    }

    // Reject pending requests
    for (const resolve of this.pending) {
      resolve(Promise.reject(new Error('Pool is closing')));
    }
    this.pending = [];

    // Destroy all connections
    const destroyPromises = [];

    for (const conn of this.available) {
      destroyPromises.push(this.destroyConnection(conn));
    }

    for (const conn of this.inUse.values()) {
      destroyPromises.push(this.destroyConnection(conn));
    }

    await Promise.all(destroyPromises);

    this.available = [];
    this.inUse.clear();
  }

  /**
   * Get pool statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ...this.stats,
      available: this.available.length,
      inUse: this.inUse.size,
      pending: this.pending.length,
      creating: this.creating,
      total: this.available.length + this.inUse.size + this.creating
    };
  }

  /**
   * Check if pool is healthy
   * @returns {boolean} - True if healthy
   */
  isHealthy() {
    return (
      !this.closed &&
      this.available.length + this.inUse.size >= this.min &&
      this.stats.errors < 10
    );
  }
}

/**
 * Resource Pool Manager
 * Manages multiple connection pools
 *
 * @class ResourcePoolManager
 */
class ResourcePoolManager {
  constructor() {
    this.pools = new Map();
  }

  /**
   * Create or get connection pool
   * @param {string} name - Pool name
   * @param {Object} options - Pool options
   * @returns {ConnectionPool} - Connection pool
   */
  createPool(name, options) {
    if (this.pools.has(name)) {
      return this.pools.get(name);
    }

    const pool = new ConnectionPool(options);
    this.pools.set(name, pool);
    return pool;
  }

  /**
   * Get connection pool
   * @param {string} name - Pool name
   * @returns {ConnectionPool|null} - Connection pool
   */
  getPool(name) {
    return this.pools.get(name) || null;
  }

  /**
   * Close specific pool
   * @param {string} name - Pool name
   * @returns {Promise<void>}
   */
  async closePool(name) {
    const pool = this.pools.get(name);
    if (pool) {
      await pool.close();
      this.pools.delete(name);
    }
  }

  /**
   * Close all pools
   * @returns {Promise<void>}
   */
  async closeAll() {
    const closePromises = [];

    for (const pool of this.pools.values()) {
      closePromises.push(pool.close());
    }

    await Promise.all(closePromises);
    this.pools.clear();
  }

  /**
   * Get all pool statistics
   * @returns {Object} - Statistics by pool name
   */
  getAllStats() {
    const stats = {};

    for (const [name, pool] of this.pools.entries()) {
      stats[name] = pool.getStats();
    }

    return stats;
  }

  /**
   * Check if all pools are healthy
   * @returns {boolean} - True if all healthy
   */
  areAllHealthy() {
    for (const pool of this.pools.values()) {
      if (!pool.isHealthy()) {
        return false;
      }
    }
    return true;
  }
}

module.exports = {
  ConnectionPool,
  ResourcePoolManager
};
