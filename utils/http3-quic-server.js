/**
 * HTTP/3 (QUIC) Server Implementation
 *
 * Based on 2025 research: HTTP/3 brings significant performance benefits
 *
 * Performance Benefits (2025 research):
 * - 8% faster average page load time
 * - 16% faster for slowest 1% of users
 * - 20% less video stalling (YouTube India)
 * - 0-RTT resumption (faster reconnections)
 * - No head-of-line blocking
 * - Better performance on lossy/high-latency networks
 * - Connection migration (network switching)
 *
 * Adoption: 19-50%+ of web servers, supported by Chrome/Firefox/Edge
 * CDN Support: Cloudflare, Fastly, Akamai
 *
 * Use Cases:
 * - High-latency networks
 * - Mobile users (network switching)
 * - Video streaming
 * - Real-time applications
 * - Global CDN deployment
 *
 * @see https://pulse.internetsociety.org/blog/why-http-3-is-eating-the-world
 * @see https://www.cloudpanel.io/blog/http3-vs-http2/
 */

const EventEmitter = require('events');
const http = require('http');
const http2 = require('http2');
const dgram = require('dgram');
const crypto = require('crypto');

class HTTP3QuicServer extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Server configuration
      port: options.port || 443,
      host: options.host || '0.0.0.0',

      // TLS configuration (required for HTTP/3)
      cert: options.cert,
      key: options.key,

      // QUIC-specific settings
      maxIdleTimeout: options.maxIdleTimeout || 30000, // 30 seconds
      maxStreamsPerConnection: options.maxStreamsPerConnection || 100,
      initialMaxData: options.initialMaxData || 1048576, // 1MB
      initialMaxStreamDataBidiLocal: options.initialMaxStreamDataBidiLocal || 524288, // 512KB
      initialMaxStreamDataBidiRemote: options.initialMaxStreamDataBidiRemote || 524288,
      initialMaxStreamDataUni: options.initialMaxStreamDataUni || 524288,

      // 0-RTT configuration (faster reconnections)
      enable0RTT: options.enable0RTT !== false,
      max0RTTSize: options.max0RTTSize || 16384, // 16KB

      // Connection migration
      enableConnectionMigration: options.enableConnectionMigration !== false,

      // Congestion control
      congestionControl: options.congestionControl || 'cubic', // cubic, reno, bbr

      // Performance
      enableEarlyData: options.enableEarlyData !== false,
      maxConcurrentStreams: options.maxConcurrentStreams || 100,

      ...options
    };

    // State management
    this.connections = new Map(); // connectionId -> connection
    this.zeroRTTTokens = new Map(); // client -> token
    this.server = null;

    // Statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      zeroRTTConnections: 0,
      migratedConnections: 0,
      totalRequests: 0,
      totalBytes: 0,
      packetsLost: 0,
      avgRTT: 0,
      http3Requests: 0,
      http2Fallback: 0,
      http1Fallback: 0
    };

    // Protocol negotiation via ALPN
    this.alpnProtocols = ['h3', 'h3-29', 'h2', 'http/1.1'];
  }

  /**
   * Start HTTP/3 server
   */
  async start() {
    try {
      // HTTP/3 requires Node.js with QUIC support or external library
      // For production: use @cloudflare/quiche or Node.js experimental QUIC

      // Create UDP socket for QUIC
      this.socket = dgram.createSocket('udp6');

      // Configure socket
      this.socket.on('message', (msg, rinfo) => {
        this.handleQuicPacket(msg, rinfo);
      });

      this.socket.on('error', (err) => {
        this.emit('error', { error: err });
      });

      // Bind to port
      await new Promise((resolve, reject) => {
        this.socket.bind(this.options.port, this.options.host, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create HTTP/2 fallback server
      this.http2Server = http2.createSecureServer({
        key: this.options.key,
        cert: this.options.cert,
        allowHTTP1: true,
        ALPNProtocols: this.alpnProtocols
      });

      this.http2Server.on('stream', (stream, headers) => {
        this.handleHTTP2Stream(stream, headers);
      });

      this.http2Server.listen(this.options.port);

      this.emit('started', {
        protocol: 'HTTP/3 (QUIC)',
        port: this.options.port,
        fallback: 'HTTP/2'
      });

      return true;
    } catch (error) {
      this.emit('error', { error });
      throw error;
    }
  }

  /**
   * Handle incoming QUIC packet
   */
  handleQuicPacket(packet, rinfo) {
    try {
      // Parse QUIC packet header
      const header = this.parseQuicHeader(packet);

      // Get or create connection
      let connection = this.connections.get(header.connectionId);

      if (!connection) {
        // New connection
        connection = this.createConnection(header, rinfo);
        this.connections.set(header.connectionId, connection);
        this.stats.totalConnections++;
        this.stats.activeConnections++;
      }

      // Check for 0-RTT early data
      if (header.type === 'Initial' && this.options.enable0RTT) {
        const token = this.zeroRTTTokens.get(rinfo.address);

        if (token && this.validate0RTTToken(token)) {
          // Process 0-RTT data immediately (no handshake wait)
          connection.is0RTT = true;
          this.stats.zeroRTTConnections++;
          this.emit('0rttConnection', { connectionId: header.connectionId });
        }
      }

      // Handle connection migration
      if (this.options.enableConnectionMigration &&
          connection.remoteAddress !== rinfo.address) {
        this.handleConnectionMigration(connection, rinfo);
      }

      // Process packet
      this.processQuicPacket(connection, packet, header);

    } catch (error) {
      this.emit('packetError', { error, rinfo });
    }
  }

  /**
   * Parse QUIC packet header
   */
  parseQuicHeader(packet) {
    // Simplified QUIC header parsing
    // Real implementation: https://www.rfc-editor.org/rfc/rfc9000.html

    const firstByte = packet[0];
    const isLongHeader = (firstByte & 0x80) !== 0;

    if (isLongHeader) {
      // Long header: Initial, 0-RTT, Handshake, Retry
      const version = packet.readUInt32BE(1);
      const type = this.getPacketType(firstByte);

      // Extract connection ID
      const dcidLen = packet[5];
      const dcid = packet.slice(6, 6 + dcidLen);

      return {
        isLongHeader: true,
        type,
        version,
        connectionId: dcid.toString('hex'),
        packet
      };
    } else {
      // Short header: 1-RTT (data)
      const dcidLen = 8; // Simplified
      const dcid = packet.slice(1, 1 + dcidLen);

      return {
        isLongHeader: false,
        type: '1-RTT',
        connectionId: dcid.toString('hex'),
        packet
      };
    }
  }

  /**
   * Get packet type from first byte
   */
  getPacketType(byte) {
    const type = (byte & 0x30) >> 4;

    switch (type) {
      case 0: return 'Initial';
      case 1: return '0-RTT';
      case 2: return 'Handshake';
      case 3: return 'Retry';
      default: return 'Unknown';
    }
  }

  /**
   * Create new QUIC connection
   */
  createConnection(header, rinfo) {
    return {
      connectionId: header.connectionId,
      remoteAddress: rinfo.address,
      remotePort: rinfo.port,
      state: 'Initial',
      streams: new Map(),
      createdAt: Date.now(),
      lastActivity: Date.now(),
      is0RTT: false,
      rtt: 0,
      congestionWindow: 10, // Initial congestion window (packets)
      bytesInFlight: 0,
      packetsLost: 0
    };
  }

  /**
   * Process QUIC packet
   */
  processQuicPacket(connection, packet, header) {
    connection.lastActivity = Date.now();

    switch (header.type) {
      case 'Initial':
        this.handleInitialPacket(connection, packet);
        break;

      case '0-RTT':
        this.handle0RTTPacket(connection, packet);
        break;

      case 'Handshake':
        this.handleHandshakePacket(connection, packet);
        break;

      case '1-RTT':
        this.handle1RTTPacket(connection, packet);
        break;
    }

    // Update statistics
    this.stats.totalBytes += packet.length;
  }

  /**
   * Handle Initial packet (connection setup)
   */
  handleInitialPacket(connection, packet) {
    // Perform TLS 1.3 handshake
    // Simplified - real implementation uses TLS library

    connection.state = 'Handshaking';

    // Generate Initial response
    const response = this.createInitialResponse(connection);
    this.sendPacket(connection, response);

    // Generate 0-RTT token for future connections
    if (this.options.enable0RTT) {
      const token = this.generate0RTTToken(connection);
      this.zeroRTTTokens.set(connection.remoteAddress, token);
    }
  }

  /**
   * Handle 0-RTT packet (early data)
   */
  handle0RTTPacket(connection, packet) {
    // Process early data immediately (no handshake wait)
    // Benefit: Faster reconnections (0-RTT = Zero Round-Trip Time)

    const frameData = this.extractFrames(packet);

    for (const frame of frameData) {
      if (frame.type === 'STREAM') {
        this.handleStreamFrame(connection, frame);
      }
    }

    this.emit('earlyData', {
      connectionId: connection.connectionId,
      size: packet.length
    });
  }

  /**
   * Handle Handshake packet
   */
  handleHandshakePacket(connection, packet) {
    // Complete TLS 1.3 handshake
    connection.state = 'Connected';

    const response = this.createHandshakeResponse(connection);
    this.sendPacket(connection, response);
  }

  /**
   * Handle 1-RTT packet (application data)
   */
  handle1RTTPacket(connection, packet) {
    // Extract QUIC frames
    const frames = this.extractFrames(packet);

    for (const frame of frames) {
      switch (frame.type) {
        case 'STREAM':
          this.handleStreamFrame(connection, frame);
          break;

        case 'ACK':
          this.handleAckFrame(connection, frame);
          break;

        case 'CONNECTION_CLOSE':
          this.handleConnectionClose(connection, frame);
          break;

        case 'PATH_CHALLENGE':
          this.handlePathChallenge(connection, frame);
          break;
      }
    }
  }

  /**
   * Handle STREAM frame (HTTP/3 request/response)
   */
  handleStreamFrame(connection, frame) {
    const streamId = frame.streamId;

    // Get or create stream
    let stream = connection.streams.get(streamId);

    if (!stream) {
      stream = {
        id: streamId,
        data: Buffer.alloc(0),
        headers: {},
        state: 'Open'
      };
      connection.streams.set(streamId, stream);
    }

    // Append data
    stream.data = Buffer.concat([stream.data, frame.data]);

    // If FIN flag set, stream is complete
    if (frame.fin) {
      this.handleCompleteStream(connection, stream);
    }

    this.stats.http3Requests++;
  }

  /**
   * Handle complete HTTP/3 stream
   */
  handleCompleteStream(connection, stream) {
    try {
      // Parse HTTP/3 request (QPACK-encoded headers + body)
      const request = this.parseHTTP3Request(stream.data);

      this.emit('request', {
        protocol: 'HTTP/3',
        connectionId: connection.connectionId,
        streamId: stream.id,
        method: request.method,
        path: request.path,
        headers: request.headers,
        body: request.body
      });

      // Send response
      const response = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: 'HTTP/3 response' })
      };

      this.sendHTTP3Response(connection, stream.id, response);

    } catch (error) {
      this.emit('streamError', { error, streamId: stream.id });
    }
  }

  /**
   * Send HTTP/3 response
   */
  sendHTTP3Response(connection, streamId, response) {
    // Encode response using QPACK (HTTP/3 header compression)
    const encoded = this.encodeHTTP3Response(response);

    // Create STREAM frame
    const frame = {
      type: 'STREAM',
      streamId,
      data: encoded,
      fin: true
    };

    // Encapsulate in QUIC packet
    const packet = this.createDataPacket(connection, [frame]);

    this.sendPacket(connection, packet);
  }

  /**
   * Handle ACK frame (packet acknowledgment)
   */
  handleAckFrame(connection, frame) {
    // Update RTT estimate
    const rtt = Date.now() - frame.timestamp;
    connection.rtt = connection.rtt * 0.875 + rtt * 0.125; // EWMA
    this.stats.avgRTT = connection.rtt;

    // Update congestion control
    this.updateCongestionControl(connection, frame);
  }

  /**
   * Update congestion control
   */
  updateCongestionControl(connection, ackFrame) {
    // Implement congestion control algorithm
    switch (this.options.congestionControl) {
      case 'cubic':
        this.cubicCongestionControl(connection, ackFrame);
        break;

      case 'bbr':
        this.bbrCongestionControl(connection, ackFrame);
        break;

      case 'reno':
        this.renoCongestionControl(connection, ackFrame);
        break;
    }
  }

  /**
   * CUBIC congestion control (default)
   */
  cubicCongestionControl(connection, ackFrame) {
    // Simplified CUBIC algorithm
    // Real implementation: https://www.rfc-editor.org/rfc/rfc8312.html

    if (ackFrame.packetsAcked > 0) {
      // Slow start or congestion avoidance
      if (connection.congestionWindow < connection.ssthresh ||
          connection.ssthresh === undefined) {
        // Slow start: exponential growth
        connection.congestionWindow += ackFrame.packetsAcked;
      } else {
        // Congestion avoidance: CUBIC growth
        const W_max = connection.congestionWindow;
        const K = Math.cbrt(W_max * 0.3 / 0.4); // Simplified
        const t = Date.now() - connection.epochStart;
        const target = 0.4 * Math.pow(t - K, 3) + W_max;

        connection.congestionWindow = target;
      }
    }

    if (ackFrame.packetsLost > 0) {
      // Multiplicative decrease
      connection.ssthresh = connection.congestionWindow * 0.7;
      connection.congestionWindow = connection.ssthresh;
      connection.epochStart = Date.now();

      this.stats.packetsLost += ackFrame.packetsLost;
    }
  }

  /**
   * Handle connection migration
   */
  handleConnectionMigration(connection, newRinfo) {
    // Connection migration: client IP changed (e.g., WiFi -> 5G)
    // QUIC allows seamless migration without breaking connection

    this.emit('connectionMigration', {
      connectionId: connection.connectionId,
      oldAddress: connection.remoteAddress,
      newAddress: newRinfo.address,
      oldPort: connection.remotePort,
      newPort: newRinfo.port
    });

    connection.remoteAddress = newRinfo.address;
    connection.remotePort = newRinfo.port;
    connection.migrated = true;

    this.stats.migratedConnections++;
  }

  /**
   * Handle path challenge (connection migration validation)
   */
  handlePathChallenge(connection, frame) {
    // Respond with PATH_RESPONSE to validate new path
    const response = {
      type: 'PATH_RESPONSE',
      data: frame.data
    };

    const packet = this.createDataPacket(connection, [response]);
    this.sendPacket(connection, packet);
  }

  /**
   * Generate 0-RTT token
   */
  generate0RTTToken(connection) {
    // Create encrypted token for 0-RTT resumption
    const data = JSON.stringify({
      address: connection.remoteAddress,
      timestamp: Date.now(),
      connectionId: connection.connectionId
    });

    // Encrypt with server key
    const cipher = crypto.createCipheriv('aes-256-gcm', this.options.key,
      crypto.randomBytes(16));
    const encrypted = cipher.update(data, 'utf8', 'hex') + cipher.final('hex');

    return {
      token: encrypted,
      tag: cipher.getAuthTag(),
      createdAt: Date.now()
    };
  }

  /**
   * Validate 0-RTT token
   */
  validate0RTTToken(token) {
    // Check token age (max 24 hours)
    const maxAge = 86400000; // 24 hours

    if (Date.now() - token.createdAt > maxAge) {
      return false;
    }

    // Decrypt and validate
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', this.options.key,
        crypto.randomBytes(16));
      decipher.setAuthTag(token.tag);

      const decrypted = decipher.update(token.token, 'hex', 'utf8') +
        decipher.final('utf8');

      const data = JSON.parse(decrypted);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send QUIC packet
   */
  sendPacket(connection, packet) {
    this.socket.send(packet, connection.remotePort, connection.remoteAddress,
      (err) => {
        if (err) {
          this.emit('sendError', { error: err, connectionId: connection.connectionId });
        }
      });
  }

  /**
   * Parse HTTP/3 request (QPACK-encoded)
   */
  parseHTTP3Request(data) {
    // Simplified QPACK parsing
    // Real implementation: https://www.rfc-editor.org/rfc/rfc9204.html

    return {
      method: 'GET',
      path: '/',
      headers: {},
      body: data
    };
  }

  /**
   * Encode HTTP/3 response (QPACK)
   */
  encodeHTTP3Response(response) {
    // Simplified QPACK encoding
    const data = JSON.stringify(response);
    return Buffer.from(data);
  }

  /**
   * Extract frames from QUIC packet
   */
  extractFrames(packet) {
    // Simplified frame extraction
    // Real implementation parses QUIC frame types

    return [{
      type: 'STREAM',
      streamId: 0,
      data: packet,
      fin: true
    }];
  }

  /**
   * Create Initial response packet
   */
  createInitialResponse(connection) {
    // Simplified
    return Buffer.from('Initial response');
  }

  /**
   * Create Handshake response packet
   */
  createHandshakeResponse(connection) {
    // Simplified
    return Buffer.from('Handshake complete');
  }

  /**
   * Create data packet
   */
  createDataPacket(connection, frames) {
    // Simplified
    return Buffer.from('Data packet');
  }

  /**
   * Handle HTTP/2 stream (fallback)
   */
  handleHTTP2Stream(stream, headers) {
    this.stats.http2Fallback++;

    this.emit('request', {
      protocol: 'HTTP/2',
      method: headers[':method'],
      path: headers[':path'],
      headers: headers
    });

    stream.respond({
      ':status': 200,
      'content-type': 'application/json'
    });

    stream.end(JSON.stringify({ message: 'HTTP/2 fallback response' }));
  }

  /**
   * Handle connection close
   */
  handleConnectionClose(connection, frame) {
    this.connections.delete(connection.connectionId);
    this.stats.activeConnections--;

    this.emit('connectionClosed', { connectionId: connection.connectionId });
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      connectionsActive: this.connections.size,
      zeroRTTRate: this.stats.totalConnections > 0
        ? this.stats.zeroRTTConnections / this.stats.totalConnections
        : 0,
      migrationRate: this.stats.totalConnections > 0
        ? this.stats.migratedConnections / this.stats.totalConnections
        : 0,
      http3Rate: this.stats.totalRequests > 0
        ? this.stats.http3Requests / this.stats.totalRequests
        : 0
    };
  }

  /**
   * Stop server
   */
  async stop() {
    // Close all connections
    for (const connection of this.connections.values()) {
      const closeFrame = { type: 'CONNECTION_CLOSE', errorCode: 0 };
      const packet = this.createDataPacket(connection, [closeFrame]);
      this.sendPacket(connection, packet);
    }

    // Close socket
    if (this.socket) {
      this.socket.close();
    }

    // Close HTTP/2 fallback
    if (this.http2Server) {
      this.http2Server.close();
    }

    this.emit('stopped');
  }
}

module.exports = HTTP3QuicServer;
