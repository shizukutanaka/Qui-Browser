/**
 * WebSocket Scalability Architecture
 *
 * Based on 2025 research: Planetary-scale WebSocket architecture
 *
 * Key Requirements (2025):
 * - Cloud-native paradigms
 * - Advanced autoscaling
 * - Distributed caching
 * - Kubernetes orchestration
 * - Event-driven autoscaling
 * - Robust observability
 *
 * Major Companies Using WebSockets (2025):
 * - Slack: Instant messaging for millions
 * - Netflix: Real-time streaming updates
 * - Uber: Live location tracking
 *
 * Critical Technical Challenges:
 * - Sticky sessions (session affinity) crucial
 * - Pub/Sub for multi-node broadcasting (Redis, Kafka, NATS)
 * - Load balancing with least-connected algorithm
 * - Kubernetes HPA for dynamic scaling
 *
 * Architecture Components:
 * - Redis Pub/Sub for message broadcasting
 * - Kafka as central message broker
 * - Nginx with least-connected balancing
 * - Kubernetes HPA for autoscaling
 *
 * @see https://www.videosdk.live/developer-hub/websocket/websocket-scale
 * @see https://ably.com/topic/websocket-architecture-best-practices
 * @see https://omkargade.medium.com/scalable-websocket-server-8ced3e0d772d
 */

const EventEmitter = require('events');

class WebSocketScalability extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Server identification
      serverId: options.serverId || `ws-${process.pid}`,

      // Connection limits
      maxConnections: options.maxConnections || 10000,
      maxConnectionsPerIP: options.maxConnectionsPerIP || 100,

      // Pub/Sub configuration
      pubsubType: options.pubsubType || 'redis', // redis, kafka, nats
      redisUrl: options.redisUrl || 'redis://localhost:6379',
      kafkaBrokers: options.kafkaBrokers || ['localhost:9092'],
      natsUrl: options.natsUrl || 'nats://localhost:4222',

      // Message broadcasting
      enableBroadcast: options.enableBroadcast !== false,
      broadcastChannel: options.broadcastChannel || 'websocket-messages',

      // Sticky sessions
      enableStickySession: options.enableStickySession !== false,
      sessionCookieName: options.sessionCookieName || 'ws-server-id',

      // Health check
      enableHealthCheck: options.enableHealthCheck !== false,
      healthCheckInterval: options.healthCheckInterval || 30000,

      // Autoscaling metrics
      targetCpuUtilization: options.targetCpuUtilization || 70,
      targetMemoryUtilization: options.targetMemoryUtilization || 80,
      targetConnectionsPerNode: options.targetConnectionsPerNode || 5000,

      // Observability
      enableMetrics: options.enableMetrics !== false,
      metricsInterval: options.metricsInterval || 10000,

      ...options
    };

    // Connection management
    this.connections = new Map(); // connectionId -> connection
    this.connectionsByIP = new Map(); // IP -> Set of connectionIds
    this.rooms = new Map(); // roomId -> Set of connectionIds

    // Pub/Sub client
    this.pubsubClient = null;

    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      peakConnections: 0,
      messagesReceived: 0,
      messagesSent: 0,
      messagesBroadcast: 0,
      bytesReceived: 0,
      bytesSent: 0,
      connectionsByIP: {},
      averageLatency: 0,
      errors: 0
    };

    // Health status
    this.healthy = true;
  }

  /**
   * Initialize scalability layer
   */
  async initialize() {
    try {
      // Initialize Pub/Sub
      await this.initializePubSub();

      // Start health check
      if (this.options.enableHealthCheck) {
        this.startHealthCheck();
      }

      // Start metrics collection
      if (this.options.enableMetrics) {
        this.startMetricsCollection();
      }

      this.emit('initialized', { serverId: this.options.serverId });

      return true;
    } catch (error) {
      this.emit('error', { error, phase: 'initialization' });
      throw error;
    }
  }

  /**
   * Initialize Pub/Sub system
   */
  async initializePubSub() {
    switch (this.options.pubsubType) {
      case 'redis':
        await this.initializeRedisPubSub();
        break;

      case 'kafka':
        await this.initializeKafkaPubSub();
        break;

      case 'nats':
        await this.initializeNATSPubSub();
        break;

      default:
        throw new Error(`Unsupported pub/sub type: ${this.options.pubsubType}`);
    }
  }

  /**
   * Initialize Redis Pub/Sub
   */
  async initializeRedisPubSub() {
    // In production: Use ioredis library
    // const Redis = require('ioredis');
    // this.pubsubClient = new Redis(this.options.redisUrl);

    this.pubsubClient = {
      type: 'redis',
      url: this.options.redisUrl,
      subscribe: async (channel, callback) => {
        this.emit('subscribed', { channel, type: 'redis' });
      },
      publish: async (channel, message) => {
        this.emit('published', { channel, type: 'redis', size: message.length });
      }
    };

    // Subscribe to broadcast channel
    if (this.options.enableBroadcast) {
      await this.pubsubClient.subscribe(
        this.options.broadcastChannel,
        (message) => this.handleBroadcastMessage(message)
      );
    }

    this.emit('pubsubInitialized', { type: 'redis' });
  }

  /**
   * Initialize Kafka Pub/Sub
   */
  async initializeKafkaPubSub() {
    // In production: Use kafkajs library
    // const { Kafka } = require('kafkajs');

    this.pubsubClient = {
      type: 'kafka',
      brokers: this.options.kafkaBrokers,
      subscribe: async (topic, callback) => {
        this.emit('subscribed', { topic, type: 'kafka' });
      },
      publish: async (topic, message) => {
        this.emit('published', { topic, type: 'kafka', size: message.length });
      }
    };

    this.emit('pubsubInitialized', { type: 'kafka' });
  }

  /**
   * Initialize NATS Pub/Sub
   */
  async initializeNATSPubSub() {
    // In production: Use nats.js library
    // const { connect } = require('nats');

    this.pubsubClient = {
      type: 'nats',
      url: this.options.natsUrl,
      subscribe: async (subject, callback) => {
        this.emit('subscribed', { subject, type: 'nats' });
      },
      publish: async (subject, message) => {
        this.emit('published', { subject, type: 'nats', size: message.length });
      }
    };

    this.emit('pubsubInitialized', { type: 'nats' });
  }

  /**
   * Register WebSocket connection
   */
  registerConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const clientIP = this.getClientIP(req);

    // Check connection limits
    if (!this.canAcceptConnection(clientIP)) {
      this.emit('connectionRejected', { reason: 'limit-exceeded', clientIP });
      ws.close(1008, 'Connection limit exceeded');
      return null;
    }

    // Create connection object
    const connection = {
      id: connectionId,
      ws,
      clientIP,
      serverId: this.options.serverId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      rooms: new Set(),
      metadata: {}
    };

    // Store connection
    this.connections.set(connectionId, connection);

    // Track by IP
    if (!this.connectionsByIP.has(clientIP)) {
      this.connectionsByIP.set(clientIP, new Set());
    }
    this.connectionsByIP.get(clientIP).add(connectionId);

    // Update statistics
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    this.stats.peakConnections = Math.max(
      this.stats.peakConnections,
      this.stats.activeConnections
    );

    // Setup event handlers
    this.setupConnectionHandlers(connection);

    this.emit('connectionRegistered', { connectionId, clientIP });

    return connection;
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers(connection) {
    const { ws } = connection;

    // Handle incoming messages
    ws.on('message', (data) => {
      this.handleMessage(connection, data);
    });

    // Handle connection close
    ws.on('close', () => {
      this.unregisterConnection(connection.id);
    });

    // Handle errors
    ws.on('error', (error) => {
      this.emit('connectionError', { connectionId: connection.id, error });
      this.stats.errors++;
    });
  }

  /**
   * Handle incoming message
   */
  handleMessage(connection, data) {
    connection.lastActivity = Date.now();
    this.stats.messagesReceived++;
    this.stats.bytesReceived += data.length;

    try {
      const message = JSON.parse(data);

      // Handle message types
      switch (message.type) {
        case 'join-room':
          this.joinRoom(connection.id, message.room);
          break;

        case 'leave-room':
          this.leaveRoom(connection.id, message.room);
          break;

        case 'broadcast':
          this.broadcast(message.room, message.data, connection.id);
          break;

        case 'ping':
          this.sendToConnection(connection.id, { type: 'pong' });
          break;

        default:
          this.emit('message', { connectionId: connection.id, message });
      }
    } catch (error) {
      this.emit('messageError', { connectionId: connection.id, error });
    }
  }

  /**
   * Join room
   */
  joinRoom(connectionId, roomId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Create room if doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }

    // Add connection to room
    this.rooms.get(roomId).add(connectionId);
    connection.rooms.add(roomId);

    this.emit('roomJoined', { connectionId, roomId });
  }

  /**
   * Leave room
   */
  leaveRoom(connectionId, roomId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from room
    const room = this.rooms.get(roomId);
    if (room) {
      room.delete(connectionId);

      // Delete empty rooms
      if (room.size === 0) {
        this.rooms.delete(roomId);
      }
    }

    connection.rooms.delete(roomId);

    this.emit('roomLeft', { connectionId, roomId });
  }

  /**
   * Broadcast message to room
   */
  async broadcast(roomId, data, excludeConnectionId = null) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const message = JSON.stringify(data);

    // Broadcast to local connections
    for (const connectionId of room) {
      if (connectionId === excludeConnectionId) continue;

      this.sendToConnection(connectionId, data);
    }

    // Broadcast to other servers via Pub/Sub
    if (this.options.enableBroadcast && this.pubsubClient) {
      await this.pubsubClient.publish(
        this.options.broadcastChannel,
        JSON.stringify({
          serverId: this.options.serverId,
          roomId,
          data,
          excludeConnectionId
        })
      );
    }

    this.stats.messagesBroadcast++;
  }

  /**
   * Handle broadcast message from Pub/Sub
   */
  handleBroadcastMessage(message) {
    try {
      const { serverId, roomId, data, excludeConnectionId } = JSON.parse(message);

      // Ignore messages from self
      if (serverId === this.options.serverId) return;

      // Broadcast to local connections in room
      const room = this.rooms.get(roomId);
      if (!room) return;

      for (const connectionId of room) {
        if (connectionId === excludeConnectionId) continue;

        this.sendToConnection(connectionId, data);
      }
    } catch (error) {
      this.emit('broadcastError', { error });
    }
  }

  /**
   * Send message to specific connection
   */
  sendToConnection(connectionId, data) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    try {
      const message = typeof data === 'string' ? data : JSON.stringify(data);

      connection.ws.send(message);

      this.stats.messagesSent++;
      this.stats.bytesSent += message.length;

    } catch (error) {
      this.emit('sendError', { connectionId, error });
    }
  }

  /**
   * Unregister connection
   */
  unregisterConnection(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Remove from rooms
    for (const roomId of connection.rooms) {
      this.leaveRoom(connectionId, roomId);
    }

    // Remove from IP tracking
    const ipConnections = this.connectionsByIP.get(connection.clientIP);
    if (ipConnections) {
      ipConnections.delete(connectionId);

      if (ipConnections.size === 0) {
        this.connectionsByIP.delete(connection.clientIP);
      }
    }

    // Remove connection
    this.connections.delete(connectionId);
    this.stats.activeConnections--;

    this.emit('connectionUnregistered', { connectionId });
  }

  /**
   * Check if can accept new connection
   */
  canAcceptConnection(clientIP) {
    // Check global limit
    if (this.stats.activeConnections >= this.options.maxConnections) {
      return false;
    }

    // Check per-IP limit
    const ipConnections = this.connectionsByIP.get(clientIP);
    if (ipConnections && ipConnections.size >= this.options.maxConnectionsPerIP) {
      return false;
    }

    return true;
  }

  /**
   * Get client IP
   */
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1';
  }

  /**
   * Generate connection ID
   */
  generateConnectionId() {
    return `${this.options.serverId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start health check
   */
  startHealthCheck() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * Perform health check
   */
  performHealthCheck() {
    // Check CPU and memory usage
    const cpuUsage = process.cpuUsage();
    const memUsage = process.memoryUsage();

    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Check if healthy
    const wasHealthy = this.healthy;

    this.healthy =
      cpuPercent < this.options.targetCpuUtilization &&
      memPercent < this.options.targetMemoryUtilization &&
      this.stats.activeConnections < this.options.maxConnections;

    // Emit health status change
    if (wasHealthy !== this.healthy) {
      this.emit('healthStatusChanged', {
        healthy: this.healthy,
        cpu: cpuPercent,
        memory: memPercent,
        connections: this.stats.activeConnections
      });
    }
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
    }, this.options.metricsInterval);
  }

  /**
   * Collect metrics
   */
  collectMetrics() {
    const metrics = {
      timestamp: Date.now(),
      serverId: this.options.serverId,
      ...this.getStatistics()
    };

    this.emit('metrics', metrics);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      rooms: this.rooms.size,
      connectionsByIPCount: this.connectionsByIP.size,
      healthy: this.healthy,
      utilizationPercent: this.options.maxConnections > 0
        ? (this.stats.activeConnections / this.options.maxConnections) * 100
        : 0
    };
  }

  /**
   * Close all connections and shutdown
   */
  async close() {
    // Close all connections
    for (const connection of this.connections.values()) {
      connection.ws.close(1001, 'Server shutting down');
    }

    this.connections.clear();
    this.connectionsByIP.clear();
    this.rooms.clear();

    this.emit('closed');
  }
}

module.exports = WebSocketScalability;
