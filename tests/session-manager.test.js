/**
 * Session Manager Tests
 * Comprehensive test suite for session management
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  SessionManager,
  MemoryStorage,
  sessionMiddleware
} = require('../utils/session-manager');

describe('SessionManager', () => {
  let sessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager({
      sessionTimeout: 5000,
      maxSessions: 3
    });
  });

  after(() => {
    if (sessionManager) {
      sessionManager.stop();
    }
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const session = await sessionManager.createSession('user123', {
        role: 'admin'
      });

      assert.ok(session.sessionId);
      assert.ok(session.expiresAt);
      assert.ok(session.createdAt);
      assert.strictEqual(typeof session.sessionId, 'string');
      assert.strictEqual(session.sessionId.length, 64); // 32 bytes as hex
    });

    it('should include metadata in session', async () => {
      const metadata = { role: 'admin', department: 'IT' };
      const session = await sessionManager.createSession('user123', metadata);

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.deepStrictEqual(validated.metadata, metadata);
    });

    it('should enforce max sessions per user', async () => {
      const userId = 'user123';

      // Create max sessions + 1
      const sessions = [];
      for (let i = 0; i < 4; i++) {
        const session = await sessionManager.createSession(userId);
        sessions.push(session);
      }

      // First session should be removed
      const firstSession = await sessionManager.validateSession(sessions[0].sessionId);
      assert.strictEqual(firstSession, null);

      // Other sessions should exist
      const secondSession = await sessionManager.validateSession(sessions[1].sessionId);
      assert.ok(secondSession);
    });

    it('should generate unique session IDs', async () => {
      const session1 = await sessionManager.createSession('user1');
      const session2 = await sessionManager.createSession('user2');

      assert.notStrictEqual(session1.sessionId, session2.sessionId);
    });
  });

  describe('Session Validation', () => {
    it('should validate a valid session', async () => {
      const created = await sessionManager.createSession('user123');
      const validated = await sessionManager.validateSession(created.sessionId);

      assert.ok(validated);
      assert.strictEqual(validated.userId, 'user123');
      assert.strictEqual(validated.id, created.sessionId);
    });

    it('should reject invalid session ID', async () => {
      const validated = await sessionManager.validateSession('invalid-session-id');
      assert.strictEqual(validated, null);
    });

    it('should reject expired session', async () => {
      const manager = new SessionManager({ sessionTimeout: 100 });

      const session = await manager.createSession('user123');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      const validated = await manager.validateSession(session.sessionId);
      assert.strictEqual(validated, null);

      manager.stop();
    });

    it('should update last accessed time on validation', async () => {
      const session = await sessionManager.createSession('user123');

      await new Promise(resolve => setTimeout(resolve, 50));

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.ok(validated.lastAccessedAt > validated.createdAt);
    });

    it('should reject session with invalid signature', async () => {
      const session = await sessionManager.createSession('user123');

      // Tamper with session
      const storedSession = sessionManager.sessions.get(session.sessionId);
      storedSession.userId = 'hacker';

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(validated, null);
    });
  });

  describe('Session Refresh', () => {
    it('should refresh session expiration', async () => {
      const session = await sessionManager.createSession('user123');
      const originalExpiry = session.expiresAt;

      await new Promise(resolve => setTimeout(resolve, 100));

      const refreshed = await sessionManager.refreshSession(session.sessionId);
      assert.strictEqual(refreshed, true);

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.ok(validated.expiresAt > originalExpiry);
    });

    it('should return false for invalid session', async () => {
      const refreshed = await sessionManager.refreshSession('invalid-id');
      assert.strictEqual(refreshed, false);
    });

    it('should update signature after refresh', async () => {
      const session = await sessionManager.createSession('user123');
      const originalSignature = sessionManager.sessions.get(session.sessionId).signature;

      await sessionManager.refreshSession(session.sessionId);

      const newSignature = sessionManager.sessions.get(session.sessionId).signature;
      assert.notStrictEqual(newSignature, originalSignature);
    });
  });

  describe('Session Destruction', () => {
    it('should destroy session', async () => {
      const session = await sessionManager.createSession('user123');

      const destroyed = await sessionManager.destroySession(session.sessionId);
      assert.strictEqual(destroyed, true);

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(validated, null);
    });

    it('should return false for non-existent session', async () => {
      const destroyed = await sessionManager.destroySession('non-existent');
      assert.strictEqual(destroyed, false);
    });

    it('should destroy all user sessions', async () => {
      const userId = 'user123';
      const session1 = await sessionManager.createSession(userId);
      const session2 = await sessionManager.createSession(userId);
      const session3 = await sessionManager.createSession(userId);

      const count = await sessionManager.destroyUserSessions(userId);
      assert.strictEqual(count, 3);

      assert.strictEqual(await sessionManager.validateSession(session1.sessionId), null);
      assert.strictEqual(await sessionManager.validateSession(session2.sessionId), null);
      assert.strictEqual(await sessionManager.validateSession(session3.sessionId), null);
    });

    it('should remove session from user tracking', async () => {
      const userId = 'user123';
      const session = await sessionManager.createSession(userId);

      await sessionManager.destroySession(session.sessionId);

      const userSessions = sessionManager.getUserSessions(userId);
      assert.strictEqual(userSessions.length, 0);
    });
  });

  describe('Session Metadata', () => {
    it('should update session metadata', async () => {
      const session = await sessionManager.createSession('user123', { role: 'user' });

      const updated = await sessionManager.updateSessionMetadata(session.sessionId, {
        role: 'admin',
        permissions: ['read', 'write']
      });

      assert.strictEqual(updated, true);

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(validated.metadata.role, 'admin');
      assert.deepStrictEqual(validated.metadata.permissions, ['read', 'write']);
    });

    it('should merge metadata on update', async () => {
      const session = await sessionManager.createSession('user123', {
        role: 'user',
        department: 'IT'
      });

      await sessionManager.updateSessionMetadata(session.sessionId, { role: 'admin' });

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(validated.metadata.role, 'admin');
      assert.strictEqual(validated.metadata.department, 'IT');
    });

    it('should return false for invalid session', async () => {
      const updated = await sessionManager.updateSessionMetadata('invalid-id', {
        role: 'admin'
      });
      assert.strictEqual(updated, false);
    });
  });

  describe('User Sessions', () => {
    it('should get all sessions for user', async () => {
      const userId = 'user123';
      await sessionManager.createSession(userId, { device: 'laptop' });
      await sessionManager.createSession(userId, { device: 'mobile' });

      const sessions = sessionManager.getUserSessions(userId);
      assert.strictEqual(sessions.length, 2);
      assert.ok(sessions.every(s => s.userId === userId));
    });

    it('should return empty array for user with no sessions', () => {
      const sessions = sessionManager.getUserSessions('unknown-user');
      assert.strictEqual(sessions.length, 0);
    });

    it('should sort sessions by last accessed time', async () => {
      const userId = 'user123';
      const session1 = await sessionManager.createSession(userId);

      await new Promise(resolve => setTimeout(resolve, 50));

      const session2 = await sessionManager.createSession(userId);

      const sessions = sessionManager.getUserSessions(userId);
      assert.ok(sessions[0].lastAccessedAt >= sessions[1].lastAccessedAt);
    });
  });

  describe('Statistics', () => {
    it('should track session statistics', async () => {
      const session1 = await sessionManager.createSession('user1');
      await sessionManager.createSession('user2');

      await sessionManager.validateSession(session1.sessionId);
      await sessionManager.validateSession('invalid-id');

      await sessionManager.refreshSession(session1.sessionId);

      await sessionManager.destroySession(session1.sessionId);

      const stats = sessionManager.getStats();
      assert.strictEqual(stats.created, 2);
      assert.strictEqual(stats.destroyed, 1);
      assert.strictEqual(stats.validated, 2);
      assert.strictEqual(stats.refreshed, 1);
    });

    it('should track active sessions and users', async () => {
      await sessionManager.createSession('user1');
      await sessionManager.createSession('user2');
      await sessionManager.createSession('user2');

      const stats = sessionManager.getStats();
      assert.strictEqual(stats.activeSessions, 3);
      assert.strictEqual(stats.activeUsers, 2);
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired sessions', async () => {
      const manager = new SessionManager({ sessionTimeout: 100 });

      await manager.createSession('user1');
      await manager.createSession('user2');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      await manager.cleanup();

      const stats = manager.getStats();
      assert.strictEqual(stats.activeSessions, 0);

      manager.stop();
    });
  });

  describe('Storage Adapters', () => {
    it('should work with MemoryStorage', async () => {
      const storage = new MemoryStorage();
      const manager = new SessionManager({ storage });

      const session = await manager.createSession('user123');
      const stored = await storage.get(session.sessionId);

      assert.ok(stored);
      assert.strictEqual(stored.userId, 'user123');

      manager.stop();
    });

    it('should persist sessions to storage', async () => {
      const storage = new MemoryStorage();
      const manager = new SessionManager({ storage, persistSessions: true });

      const session = await manager.createSession('user123');
      const stored = await storage.get(session.sessionId);

      assert.ok(stored);
      assert.strictEqual(stored.id, session.sessionId);

      manager.stop();
    });

    it('should load sessions from storage', async () => {
      const storage = new MemoryStorage();
      const manager = new SessionManager({ storage, persistSessions: true });

      const session = await manager.createSession('user123');

      // Clear memory cache
      manager.sessions.clear();

      // Should load from storage
      const validated = await manager.validateSession(session.sessionId);
      assert.ok(validated);
      assert.strictEqual(validated.userId, 'user123');

      manager.stop();
    });
  });

  describe('Middleware', () => {
    it('should create session middleware', async () => {
      const middleware = sessionMiddleware(sessionManager);

      const session = await sessionManager.createSession('user123');

      const req = {
        headers: { 'x-session-id': session.sessionId }
      };

      const res = {};
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.ok(req.session);
      assert.strictEqual(req.session.userId, 'user123');
      assert.strictEqual(req.sessionId, session.sessionId);
    });

    it('should handle missing session', async () => {
      const middleware = sessionMiddleware(sessionManager);

      const req = { headers: {} };
      const res = {};
      let nextCalled = false;

      await middleware(req, res, () => {
        nextCalled = true;
      });

      assert.strictEqual(nextCalled, true);
      assert.strictEqual(req.session, undefined);
    });

    it('should auto-refresh session', async () => {
      const middleware = sessionMiddleware(sessionManager);

      const session = await sessionManager.createSession('user123');
      const originalExpiry = sessionManager.sessions.get(session.sessionId).expiresAt;

      await new Promise(resolve => setTimeout(resolve, 50));

      const req = {
        headers: { 'x-session-id': session.sessionId }
      };

      await middleware(req, {}, () => {});

      const validated = sessionManager.sessions.get(session.sessionId);
      assert.ok(validated.expiresAt > originalExpiry);
    });
  });

  describe('Security', () => {
    it('should use cryptographically secure session IDs', async () => {
      const session1 = await sessionManager.createSession('user1');
      const session2 = await sessionManager.createSession('user1');

      // Session IDs should be unpredictable
      assert.notStrictEqual(session1.sessionId, session2.sessionId);
      assert.strictEqual(session1.sessionId.length, 64);
      assert.ok(/^[0-9a-f]{64}$/.test(session1.sessionId));
    });

    it('should sign sessions with HMAC', async () => {
      const session = await sessionManager.createSession('user123');
      const storedSession = sessionManager.sessions.get(session.sessionId);

      assert.ok(storedSession.signature);
      assert.strictEqual(typeof storedSession.signature, 'string');
      assert.strictEqual(storedSession.signature.length, 64); // SHA-256 hex
    });

    it('should detect tampered sessions', async () => {
      const session = await sessionManager.createSession('user123');

      // Tamper with session data
      const storedSession = sessionManager.sessions.get(session.sessionId);
      storedSession.expiresAt = Date.now() + 1000000;

      const validated = await sessionManager.validateSession(session.sessionId);
      assert.strictEqual(validated, null);
    });

    it('should use unique secrets per instance', () => {
      const manager1 = new SessionManager();
      const manager2 = new SessionManager();

      assert.notStrictEqual(manager1.secret, manager2.secret);

      manager1.stop();
      manager2.stop();
    });
  });
});
