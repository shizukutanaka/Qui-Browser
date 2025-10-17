/**
 * Qui Browser - WebSocket Manager
 *
 * Real-time communication and event broadcasting
 */

const WebSocket = require('ws');
const crypto = require('crypto');

class WebSocketManager {
  constructor(config, server) {
    this.config = config;
    this.server = server;
    this.wss = null;
    this.clients = new Map(); // clientId -> WebSocket connection
    this.rooms = new Map(); // roomName -> Set of clientIds
    this.heartbeatInterval = null;
    this.isInitialized = false;
  }

  /**
   * Initialize WebSocket server
   */
  initialize() {
    if (this.isInitialized) return;

    // Create WebSocket server
    this.wss = new WebSocket.Server({
      server: this.server,
      path: '/ws',
      perMessageDeflate: true,
      maxPayload: this.config.websocket?.maxPayload || 1024 * 1024 // 1MB
    });

    // Set up event handlers
    this.setupEventHandlers();

    // Start heartbeat
    this.startHeartbeat();

    this.isInitialized = true;
    console.log('WebSocket server initialized');
  }

  /**
   * Set up WebSocket event handlers
   */
  setupEventHandlers() {
    this.wss.on('connection', (ws, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      console.error('WebSocket server error:', error);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, request) {
    const clientId = this.generateClientId();
    const clientInfo = {
      id: clientId,
      ws,
      ip: this.getClientIP(request),
      userAgent: request.headers['user-agent'],
      connectedAt: new Date(),
      lastHeartbeat: Date.now(),
      rooms: new Set(),
      metadata: {}
    };

    // Store client
    this.clients.set(clientId, clientInfo);

    // Set up client event handlers
    this.setupClientHandlers(ws, clientId);

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'welcome',
      clientId,
      timestamp: new Date().toISOString()
    });

    console.log(`WebSocket client connected: ${clientId} from ${clientInfo.ip}`);

    // Emit connection event
    this.emit('connection', { clientId, clientInfo });
  }

  /**
   * Set up handlers for individual client
   */
  setupClientHandlers(ws, clientId) {
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', (code, reason) => {
      this.handleDisconnection(clientId, code, reason);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket client ${clientId} error:`, error);
      this.handleDisconnection(clientId, 1006, 'Client error');
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastHeartbeat = Date.now();
      }
    });
  }

  /**
   * Handle incoming message from client
   */
  async handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());

      // Add client context
      message.clientId = clientId;
      message.timestamp = new Date().toISOString();

      // Handle different message types
      await this.handleMessageType(clientId, message);

      // Emit message event
      this.emit('message', { clientId, message });

    } catch (error) {
      console.error(`WebSocket message parsing error for client ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        error: 'Invalid message format',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Handle different message types
   */
  async handleMessageType(clientId, message) {
    const { type, data } = message;

    switch (type) {
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', timestamp: new Date().toISOString() });
        break;

      case 'join_room':
        if (data.room) {
          this.joinRoom(clientId, data.room);
          this.sendToClient(clientId, {
            type: 'room_joined',
            room: data.room,
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'leave_room':
        if (data.room) {
          this.leaveRoom(clientId, data.room);
          this.sendToClient(clientId, {
            type: 'room_left',
            room: data.room,
            timestamp: new Date().toISOString()
          });
        }
        break;

      case 'broadcast':
        if (data.room) {
          this.broadcastToRoom(data.room, {
            type: 'broadcast',
            from: clientId,
            data: data.message,
            timestamp: new Date().toISOString()
          }, [clientId]); // Exclude sender
        } else {
          this.broadcast({
            type: 'broadcast',
            from: clientId,
            data: data.message,
            timestamp: new Date().toISOString()
          }, [clientId]); // Exclude sender
        }
        break;

      case 'tab_update':
        // Handle tab updates for collaborative browsing
        this.handleTabUpdate(clientId, data);
        break;

      case 'cursor_position':
        // Handle cursor position for collaborative editing
        this.handleCursorPosition(clientId, data);
        break;

      case 'notification_ack':
        // Handle notification acknowledgments
        this.handleNotificationAck(clientId, data);
        break;

      default:
        // Emit custom message event for extensibility
        this.emit('custom_message', { clientId, message });
        break;
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId, code, reason) {
    const client = this.clients.get(clientId);
    if (!client) return;

    console.log(`WebSocket client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);

    // Remove from all rooms
    for (const room of client.rooms) {
      this.leaveRoom(clientId, room);
    }

    // Remove client
    this.clients.delete(clientId);

    // Emit disconnection event
    this.emit('disconnection', { clientId, code, reason, clientInfo: client });
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      client.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message, excludeClientIds = []) {
    const excludeSet = new Set(excludeClientIds);

    for (const [clientId, client] of this.clients) {
      if (!excludeSet.has(clientId)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Send message to all clients in a room
   */
  broadcastToRoom(roomName, message, excludeClientIds = []) {
    const roomClients = this.rooms.get(roomName);
    if (!roomClients) return;

    const excludeSet = new Set(excludeClientIds);

    for (const clientId of roomClients) {
      if (!excludeSet.has(clientId)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  /**
   * Join a room
   */
  joinRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Initialize room if it doesn't exist
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }

    const room = this.rooms.get(roomName);
    room.add(clientId);
    client.rooms.add(roomName);

    this.emit('room_join', { clientId, roomName });
    return true;
  }

  /**
   * Leave a room
   */
  leaveRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    const room = this.rooms.get(roomName);
    if (room) {
      room.delete(clientId);
      client.rooms.delete(roomName);

      // Clean up empty rooms
      if (room.size === 0) {
        this.rooms.delete(roomName);
      }
    }

    this.emit('room_leave', { clientId, roomName });
    return true;
  }

  /**
   * Get clients in a room
   */
  getRoomClients(roomName) {
    const room = this.rooms.get(roomName);
    return room ? Array.from(room) : [];
  }

  /**
   * Handle tab updates for collaborative browsing
   */
  handleTabUpdate(clientId, data) {
    // Broadcast tab updates to room
    if (data.room) {
      this.broadcastToRoom(data.room, {
        type: 'tab_update',
        from: clientId,
        tabId: data.tabId,
        url: data.url,
        title: data.title,
        timestamp: new Date().toISOString()
      }, [clientId]);
    }
  }

  /**
   * Handle cursor position for collaborative editing
   */
  handleCursorPosition(clientId, data) {
    if (data.room) {
      this.broadcastToRoom(data.room, {
        type: 'cursor_position',
        from: clientId,
        position: data.position,
        timestamp: new Date().toISOString()
      }, [clientId]);
    }
  }

  /**
   * Handle notification acknowledgments
   */
  handleNotificationAck(clientId, data) {
    // Handle notification acknowledgment
    this.emit('notification_ack', { clientId, notificationId: data.notificationId });
  }

  /**
   * Send notification to client
   */
  sendNotification(clientId, notification) {
    return this.sendToClient(clientId, {
      type: 'notification',
      notification,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast notification to all clients
   */
  broadcastNotification(notification, excludeClientIds = []) {
    this.broadcast({
      type: 'notification',
      notification,
      timestamp: new Date().toISOString()
    }, excludeClientIds);
  }

  /**
   * Send notification to room
   */
  sendNotificationToRoom(roomName, notification, excludeClientIds = []) {
    this.broadcastToRoom(roomName, {
      type: 'notification',
      notification,
      timestamp: new Date().toISOString()
    }, excludeClientIds);
  }

  /**
   * Get client statistics
   */
  getStats() {
    const now = Date.now();
    const totalClients = this.clients.size;
    const rooms = this.rooms.size;

    // Calculate active clients (responded to heartbeat recently)
    const activeClients = Array.from(this.clients.values())
      .filter(client => now - client.lastHeartbeat < 30000) // 30 seconds
      .length;

    return {
      totalClients,
      activeClients,
      rooms,
      roomsList: Array.from(this.rooms.keys()),
      uptime: now - (this.startTime || now)
    };
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `ws_${crypto.randomBytes(8).toString('hex')}`;
  }

  /**
   * Get client IP address
   */
  getClientIP(request) {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return request.connection?.remoteAddress ||
           request.socket?.remoteAddress ||
           'unknown';
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      // Send ping to all clients
      for (const [clientId, client] of this.clients) {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.ping();
          } catch (error) {
            console.error(`Failed to ping client ${clientId}:`, error);
          }
        }
      }

      // Check for dead connections
      const now = Date.now();
      const deadClients = [];

      for (const [clientId, client] of this.clients) {
        // Remove clients that haven't responded to heartbeat for 60 seconds
        if (now - client.lastHeartbeat > 60000) {
          deadClients.push(clientId);
        }
      }

      // Clean up dead clients
      for (const clientId of deadClients) {
        console.log(`Removing dead WebSocket client: ${clientId}`);
        this.handleDisconnection(clientId, 1006, 'Heartbeat timeout');
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop WebSocket server
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      try {
        client.ws.close(1001, 'Server shutdown');
      } catch (error) {
        // Ignore errors when closing
      }
    }

    this.clients.clear();
    this.rooms.clear();
    this.isInitialized = false;

    console.log('WebSocket server stopped');
  }
}

// Add EventEmitter functionality
const EventEmitter = require('events');
Object.setPrototypeOf(WebSocketManager.prototype, EventEmitter.prototype);

module.exports = WebSocketManager;
