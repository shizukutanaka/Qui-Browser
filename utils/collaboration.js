const EventEmitter = require('events');
const crypto = require('crypto');

/**
 * Participant
 */
class Participant {
  constructor(id, data = {}) {
    this.id = id;
    this.name = data.name || 'Anonymous';
    this.color = data.color || this.generateColor();
    this.cursor = data.cursor || null;
    this.selection = data.selection || null;
    this.online = true;
    this.lastSeen = Date.now();
    this.metadata = data.metadata || {};
  }

  /**
   * Generate random color
   */
  generateColor() {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
      '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  /**
   * Update cursor position
   */
  updateCursor(x, y) {
    this.cursor = { x, y, timestamp: Date.now() };
    this.lastSeen = Date.now();
  }

  /**
   * Update selection
   */
  updateSelection(start, end) {
    this.selection = { start, end, timestamp: Date.now() };
    this.lastSeen = Date.now();
  }

  /**
   * Mark as offline
   */
  setOffline() {
    this.online = false;
  }

  /**
   * Mark as online
   */
  setOnline() {
    this.online = true;
    this.lastSeen = Date.now();
  }
}

/**
 * Operation (for Operational Transformation)
 */
class Operation {
  constructor(type, data = {}) {
    this.id = crypto.randomUUID();
    this.type = type; // 'insert', 'delete', 'retain'
    this.position = data.position || 0;
    this.content = data.content || '';
    this.length = data.length || (data.content ? data.content.length : 0);
    this.userId = data.userId;
    this.timestamp = Date.now();
    this.version = data.version || 0;
  }

  /**
   * Transform against another operation
   */
  transform(other, priority = 'left') {
    if (this.type === 'insert' && other.type === 'insert') {
      if (this.position < other.position || (this.position === other.position && priority === 'left')) {
        return new Operation(this.type, {
          position: this.position,
          content: this.content,
          userId: this.userId,
          version: this.version + 1
        });
      } else {
        return new Operation(this.type, {
          position: this.position + other.length,
          content: this.content,
          userId: this.userId,
          version: this.version + 1
        });
      }
    }

    if (this.type === 'insert' && other.type === 'delete') {
      if (this.position <= other.position) {
        return new Operation(this.type, {
          position: this.position,
          content: this.content,
          userId: this.userId,
          version: this.version + 1
        });
      } else if (this.position > other.position + other.length) {
        return new Operation(this.type, {
          position: this.position - other.length,
          content: this.content,
          userId: this.userId,
          version: this.version + 1
        });
      } else {
        return new Operation(this.type, {
          position: other.position,
          content: this.content,
          userId: this.userId,
          version: this.version + 1
        });
      }
    }

    if (this.type === 'delete' && other.type === 'insert') {
      if (this.position < other.position) {
        return new Operation(this.type, {
          position: this.position,
          length: this.length,
          userId: this.userId,
          version: this.version + 1
        });
      } else {
        return new Operation(this.type, {
          position: this.position + other.length,
          length: this.length,
          userId: this.userId,
          version: this.version + 1
        });
      }
    }

    if (this.type === 'delete' && other.type === 'delete') {
      if (this.position + this.length <= other.position) {
        return new Operation(this.type, {
          position: this.position,
          length: this.length,
          userId: this.userId,
          version: this.version + 1
        });
      } else if (this.position >= other.position + other.length) {
        return new Operation(this.type, {
          position: this.position - other.length,
          length: this.length,
          userId: this.userId,
          version: this.version + 1
        });
      } else {
        // Overlapping deletes
        const newLength = Math.max(0, this.length - other.length);
        return new Operation(this.type, {
          position: Math.min(this.position, other.position),
          length: newLength,
          userId: this.userId,
          version: this.version + 1
        });
      }
    }

    return this;
  }

  /**
   * Apply operation to content
   */
  apply(content) {
    if (this.type === 'insert') {
      return content.slice(0, this.position) + this.content + content.slice(this.position);
    }

    if (this.type === 'delete') {
      return content.slice(0, this.position) + content.slice(this.position + this.length);
    }

    return content;
  }
}

/**
 * Document (for collaborative editing)
 */
class CollaborativeDocument extends EventEmitter {
  constructor(id, initialContent = '') {
    super();

    this.id = id;
    this.content = initialContent;
    this.version = 0;
    this.operations = [];
    this.participants = new Map();
  }

  /**
   * Apply operation
   */
  applyOperation(operation) {
    this.content = operation.apply(this.content);
    this.version++;
    this.operations.push(operation);

    this.emit('operation-applied', {
      operation,
      version: this.version,
      content: this.content
    });

    return this.version;
  }

  /**
   * Get content
   */
  getContent() {
    return this.content;
  }

  /**
   * Get version
   */
  getVersion() {
    return this.version;
  }

  /**
   * Get operations since version
   */
  getOperationsSince(version) {
    return this.operations.filter((op) => op.version > version);
  }

  /**
   * Add participant
   */
  addParticipant(participant) {
    this.participants.set(participant.id, participant);
    this.emit('participant-joined', participant);
  }

  /**
   * Remove participant
   */
  removeParticipant(participantId) {
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.setOffline();
      this.emit('participant-left', participant);
      return true;
    }
    return false;
  }

  /**
   * Update participant cursor
   */
  updateCursor(participantId, x, y) {
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.updateCursor(x, y);
      this.emit('cursor-updated', {
        participantId,
        cursor: participant.cursor
      });
    }
  }

  /**
   * Get all participants
   */
  getParticipants() {
    return Array.from(this.participants.values());
  }

  /**
   * Get online participants
   */
  getOnlineParticipants() {
    return this.getParticipants().filter((p) => p.online);
  }
}

/**
 * Presence Manager
 */
class PresenceManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      heartbeatInterval: 5000,
      timeout: 15000,
      ...options
    };

    this.participants = new Map();
    this.heartbeatTimer = null;
  }

  /**
   * Start heartbeat
   */
  startHeartbeat() {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      this.checkTimeouts();
      this.emit('heartbeat');
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Add participant
   */
  addParticipant(participant) {
    this.participants.set(participant.id, participant);
    participant.setOnline();

    this.emit('participant-joined', participant);

    return participant;
  }

  /**
   * Remove participant
   */
  removeParticipant(participantId) {
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.setOffline();
      this.emit('participant-left', participant);
      this.participants.delete(participantId);
      return true;
    }
    return false;
  }

  /**
   * Update participant activity
   */
  updateActivity(participantId) {
    const participant = this.participants.get(participantId);
    if (participant) {
      participant.lastSeen = Date.now();
      participant.setOnline();
    }
  }

  /**
   * Check for timeouts
   */
  checkTimeouts() {
    const now = Date.now();

    for (const [id, participant] of this.participants) {
      if (now - participant.lastSeen > this.config.timeout && participant.online) {
        participant.setOffline();
        this.emit('participant-timeout', participant);
      }
    }
  }

  /**
   * Get all participants
   */
  getParticipants() {
    return Array.from(this.participants.values());
  }

  /**
   * Get online participants
   */
  getOnlineParticipants() {
    return this.getParticipants().filter((p) => p.online);
  }

  /**
   * Get participant count
   */
  getParticipantCount() {
    return this.participants.size;
  }

  /**
   * Get online count
   */
  getOnlineCount() {
    return this.getOnlineParticipants().length;
  }

  /**
   * Destroy manager
   */
  destroy() {
    this.stopHeartbeat();
    this.participants.clear();
    this.removeAllListeners();
  }
}

/**
 * Collaboration Manager
 */
class CollaborationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      enablePresence: true,
      enableOperationalTransform: true,
      maxOperationHistory: 1000,
      ...options
    };

    this.documents = new Map();
    this.presenceManager = this.config.enablePresence ? new PresenceManager() : null;

    if (this.presenceManager) {
      this.setupPresenceForwarding();
    }
  }

  /**
   * Setup presence event forwarding
   */
  setupPresenceForwarding() {
    this.presenceManager.on('participant-joined', (p) => this.emit('presence:joined', p));
    this.presenceManager.on('participant-left', (p) => this.emit('presence:left', p));
    this.presenceManager.on('participant-timeout', (p) => this.emit('presence:timeout', p));
  }

  /**
   * Create document
   */
  createDocument(id, initialContent = '') {
    const doc = new CollaborativeDocument(id, initialContent);
    this.documents.set(id, doc);

    // Forward events
    doc.on('operation-applied', (data) => {
      this.emit('document:operation', { documentId: id, ...data });
    });

    doc.on('participant-joined', (p) => {
      this.emit('document:participant-joined', { documentId: id, participant: p });
    });

    this.emit('document-created', id);

    return doc;
  }

  /**
   * Get document
   */
  getDocument(id) {
    return this.documents.get(id);
  }

  /**
   * Remove document
   */
  removeDocument(id) {
    const doc = this.documents.get(id);
    if (doc) {
      doc.removeAllListeners();
      this.documents.delete(id);
      this.emit('document-removed', id);
      return true;
    }
    return false;
  }

  /**
   * Create operation
   */
  createOperation(type, data) {
    return new Operation(type, data);
  }

  /**
   * Create participant
   */
  createParticipant(id, data) {
    return new Participant(id, data);
  }

  /**
   * Join document
   */
  joinDocument(documentId, participant) {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    doc.addParticipant(participant);

    if (this.presenceManager) {
      this.presenceManager.addParticipant(participant);
    }

    return doc;
  }

  /**
   * Leave document
   */
  leaveDocument(documentId, participantId) {
    const doc = this.documents.get(documentId);
    if (doc) {
      doc.removeParticipant(participantId);
    }

    if (this.presenceManager) {
      this.presenceManager.removeParticipant(participantId);
    }
  }

  /**
   * Apply operation to document
   */
  applyOperation(documentId, operation) {
    const doc = this.documents.get(documentId);
    if (!doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    return doc.applyOperation(operation);
  }

  /**
   * Get all documents
   */
  getAllDocuments() {
    return Array.from(this.documents.keys());
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      documents: this.documents.size,
      totalParticipants: this.presenceManager ? this.presenceManager.getParticipantCount() : 0,
      onlineParticipants: this.presenceManager ? this.presenceManager.getOnlineCount() : 0
    };
  }

  /**
   * Destroy manager
   */
  destroy() {
    for (const doc of this.documents.values()) {
      doc.removeAllListeners();
    }

    this.documents.clear();

    if (this.presenceManager) {
      this.presenceManager.destroy();
    }

    this.removeAllListeners();
  }
}

module.exports = {
  Participant,
  Operation,
  CollaborativeDocument,
  PresenceManager,
  CollaborationManager
};
