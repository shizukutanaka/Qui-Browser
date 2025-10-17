/**
 * Tests for Authentication System
 */

const { test } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const AuthenticationManager = require('../lib/auth/manager');
const AuthMiddleware = require('../lib/auth/middleware');

// Mock database manager
class MockDatabaseManager {
  constructor() {
    this.users = new Map();
    this.apiKeys = new Map();
    this.userCounter = 1;
  }

  async createUser(user) {
    user.id = `user_${this.userCounter++}`;
    this.users.set(user.email, user);
    this.users.set(user.id, user);
    if (user.username) {
      this.users.set(user.username, user);
    }
    return user;
  }

  async getUser(idOrEmail) {
    return this.users.get(idOrEmail);
  }

  async getUserByEmail(email) {
    return this.users.get(email);
  }

  async getUserByUsername(username) {
    return this.users.get(username);
  }

  async updateUser(id, updates) {
    const user = this.users.get(id);
    if (user) {
      Object.assign(user, updates);
      return user;
    }
    return null;
  }

  async deleteUser(id) {
    const user = this.users.get(id);
    if (user) {
      this.users.delete(user.email);
      this.users.delete(id);
      if (user.username) {
        this.users.delete(user.username);
      }
      return true;
    }
    return false;
  }

  async createApiKey(apiKey) {
    this.apiKeys.set(apiKey.key, apiKey);
    return apiKey;
  }

  async getApiKeyByKey(key) {
    return this.apiKeys.get(key);
  }

  async updateApiKey(id, updates) {
    // Find and update API key
    for (const [key, apiKey] of this.apiKeys) {
      if (apiKey.id === id) {
        Object.assign(apiKey, updates);
        return apiKey;
      }
    }
    return null;
  }
}

// Mock configuration
const mockConfig = {
  auth: {
    jwtSecret: 'test-secret-key',
    jwtExpiresIn: '1h',
    refreshTokenExpiresIn: '7d',
    bcryptRounds: 8, // Lower for tests
    minPasswordLength: 6,
    maxLoginAttempts: 3,
    lockoutDuration: 300000 // 5 minutes
  }
};

test('Authentication Manager', async (t) => {
  let authManager;
  let mockDb;

  t.before(async () => {
    mockDb = new MockDatabaseManager();
    authManager = new AuthenticationManager(mockConfig, mockDb);
    await authManager.initialize();
  });

  t.after(async () => {
    await authManager.cleanup();
  });

  await t.test('AuthenticationManager initializes correctly', () => {
    assert(authManager instanceof AuthenticationManager);
    assert.strictEqual(typeof authManager.config, 'object');
    assert.strictEqual(typeof authManager.jwtSecret, 'string');
    assert(authManager.sessions instanceof Map);
    assert(authManager.quotas instanceof Map);
  });

  await t.test('register() creates new user', async () => {
    const userData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User'
    };

    const user = await authManager.register(userData);

    assert(user);
    assert.strictEqual(user.email, 'test@example.com');
    assert.strictEqual(user.username, 'testuser');
    assert.strictEqual(user.firstName, 'Test');
    assert.strictEqual(user.lastName, 'User');
    assert.strictEqual(user.role, 'user');
    assert.strictEqual(user.isVerified, false);
    assert(user.verificationToken);
    assert(user.createdAt instanceof Date);
  });

  await t.test('register() validates input', async () => {
    // Invalid email
    await assert.rejects(
      () => authManager.register({ email: 'invalid', password: 'password123' }),
      /Valid email is required/
    );

    // Weak password
    await assert.rejects(
      () => authManager.register({ email: 'test2@example.com', password: '123' }),
      /Password must be at least/
    );

    // Duplicate email
    await assert.rejects(
      () => authManager.register({
        email: 'test@example.com',
        password: 'password123'
      }),
      /User already exists/
    );
  });

  await t.test('login() authenticates user', async () => {
    // First verify the user
    await authManager.verifyEmail('test-token'); // Mock verification

    // Update user to be verified
    await mockDb.updateUser('user_1', { isVerified: true });

    const result = await authManager.login({
      email: 'test@example.com',
      password: 'password123'
    });

    assert(result);
    assert(result.user);
    assert(result.tokens);
    assert(result.session);
    assert(result.tokens.accessToken);
    assert(result.tokens.refreshToken);
    assert.strictEqual(typeof result.tokens.expiresIn, 'number');
  });

  await t.test('login() handles invalid credentials', async () => {
    await assert.rejects(
      () => authManager.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      }),
      /Invalid credentials/
    );
  });

  await t.test('verifyToken() validates JWT', async () => {
    const result = await authManager.login({
      email: 'test@example.com',
      password: 'password123'
    });

    const tokenResult = await authManager.verifyToken(result.tokens.accessToken);

    assert(tokenResult);
    assert(tokenResult.user);
    assert.strictEqual(tokenResult.user.email, 'test@example.com');
  });

  await t.test('refreshToken() generates new tokens', async () => {
    const loginResult = await authManager.login({
      email: 'test@example.com',
      password: 'password123'
    });

    const refreshResult = await authManager.refreshToken(loginResult.tokens.refreshToken);

    assert(refreshResult);
    assert(refreshResult.accessToken);
    assert(refreshResult.refreshToken);
    assert.notStrictEqual(refreshResult.accessToken, loginResult.tokens.accessToken);
  });

  await t.test('createApiKey() generates API key', async () => {
    const result = await authManager.createApiKey('user_1', {
      name: 'Test API Key',
      permissions: ['read', 'write']
    });

    assert(result);
    assert(result.id);
    assert(result.key);
    assert(result.name, 'Test API Key');
    assert(result.permissions.includes('read'));
    assert(result.permissions.includes('write'));
  });

  await t.test('verifyApiKey() validates API key', async () => {
    const createResult = await authManager.createApiKey('user_1', {
      name: 'Test API Key 2'
    });

    const verifyResult = await authManager.verifyApiKey(createResult.key);

    assert(verifyResult);
    assert(verifyResult.user);
    assert(verifyResult.permissions);
    assert.strictEqual(verifyResult.keyData.name, 'Test API Key 2');
  });

  await t.test('updateProfile() modifies user data', async () => {
    const result = await authManager.updateProfile('user_1', {
      firstName: 'Updated',
      preferences: { theme: 'dark' }
    });

    assert(result);
    assert.strictEqual(result.firstName, 'Updated');
    assert.strictEqual(result.preferences.theme, 'dark');
  });

  await t.test('changePassword() updates password', async () => {
    const result = await authManager.changePassword('user_1', 'password123', 'newpassword456');

    assert(result);
    assert(result.success);

    // Verify new password works
    const loginResult = await authManager.login({
      email: 'test@example.com',
      password: 'newpassword456'
    });

    assert(loginResult);
  });

  await t.test('logout() invalidates sessions', async () => {
    // Login to create session
    const loginResult = await authManager.login({
      email: 'test@example.com',
      password: 'newpassword456'
    });

    assert.strictEqual(authManager.sessions.size, 1);

    // Logout
    await authManager.logout('user_1');

    assert.strictEqual(authManager.sessions.size, 0);
  });

  await t.test('deleteAccount() removes user', async () => {
    const result = await authManager.deleteAccount('user_1', 'newpassword456');

    assert(result);
    assert(result.success);

    // Verify user is deleted
    const user = await mockDb.getUser('user_1');
    assert.strictEqual(user, undefined);
  });

  await t.test('checkPermission() validates permissions', async () => {
    // Create a test user
    const testUser = await authManager.register({
      email: 'admin@example.com',
      password: 'password123',
      firstName: 'Admin',
      lastName: 'User'
    });

    // Verify user
    await mockDb.updateUser(testUser.id, { isVerified: true, role: 'admin' });

    // Test admin permissions
    const hasAdminPermission = await authManager.checkPermission(testUser.id, 'write:users');
    assert(hasAdminPermission);

    // Test regular user permissions
    await mockDb.updateUser(testUser.id, { role: 'user' });
    const hasUserPermission = await authManager.checkPermission(testUser.id, 'read:own_profile');
    assert(hasUserPermission);

    const hasAdminPermission2 = await authManager.checkPermission(testUser.id, 'write:users');
    assert(!hasAdminPermission2);
  });

  await t.test('setQuota() and checkQuota() manage quotas', async () => {
    const userId = 'user_quota_test';

    await authManager.setQuota(userId, {
      limit: 1000,
      period: 'monthly',
      resetTime: Date.now() + (30 * 24 * 60 * 60 * 1000)
    });

    const quota = authManager.checkQuota(userId);
    assert(quota);
    assert.strictEqual(quota.limit, 1000);
    assert.strictEqual(quota.used, 0);
    assert.strictEqual(quota.remaining, 1000);
  });

  await t.test('cleanup() clears resources', async () => {
    await authManager.cleanup();

    assert.strictEqual(authManager.sessions.size, 0);
    assert.strictEqual(authManager.authAttempts.size, 0);
  });
});

test('Authentication Middleware', async (t) => {
  let authManager;
  let authMiddleware;
  let mockDb;

  t.before(async () => {
    mockDb = new MockDatabaseManager();
    authManager = new AuthenticationManager(mockConfig, mockDb);
    await authManager.initialize();
    authMiddleware = new AuthMiddleware(authManager);
  });

  t.after(async () => {
    await authManager.cleanup();
  });

  await t.test('extractToken() gets token from various sources', () => {
    // Authorization header
    const req1 = {
      headers: {
        authorization: 'Bearer test-token'
      }
    };
    assert.strictEqual(authMiddleware.extractToken(req1), 'test-token');

    // Query parameter
    const req2 = {
      query: { token: 'query-token' }
    };
    assert.strictEqual(authMiddleware.extractToken(req2), 'query-token');

    // Cookie
    const req3 = {
      cookies: { token: 'cookie-token' }
    };
    assert.strictEqual(authMiddleware.extractToken(req3), 'cookie-token');

    // No token
    const req4 = {};
    assert.strictEqual(authMiddleware.extractToken(req4), null);
  });

  await t.test('extractApiKey() gets API key from various sources', () => {
    // X-API-Key header
    const req1 = {
      headers: { 'x-api-key': 'test-api-key' }
    };
    assert.strictEqual(authMiddleware.extractApiKey(req1), 'test-api-key');

    // Authorization header
    const req2 = {
      headers: {
        authorization: 'ApiKey api-key-header'
      }
    };
    assert.strictEqual(authMiddleware.extractApiKey(req2), 'api-key-header');

    // Query parameter
    const req3 = {
      query: { api_key: 'query-api-key' }
    };
    assert.strictEqual(authMiddleware.extractApiKey(req3), 'query-api-key');

    // No API key
    const req4 = {};
    assert.strictEqual(authMiddleware.extractApiKey(req4), null);
  });

  await t.test('getClientIP() extracts IP address', () => {
    // X-Forwarded-For
    const req1 = {
      headers: { 'x-forwarded-for': '192.168.1.100' }
    };
    assert.strictEqual(authMiddleware.getClientIP(req1), '192.168.1.100');

    // X-Real-IP
    const req2 = {
      headers: { 'x-real-ip': '10.0.0.1' }
    };
    assert.strictEqual(authMiddleware.getClientIP(req2), '10.0.0.1');

    // Connection remote address
    const req3 = {
      connection: { remoteAddress: '127.0.0.1' }
    };
    assert.strictEqual(authMiddleware.getClientIP(req3), '127.0.0.1');
  });

  await t.test('unauthorized() returns 401 response', () => {
    let statusCode;
    let responseBody;

    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            responseBody = body;
          }
        };
      }
    };

    authMiddleware.unauthorized(mockRes, 'Test message');

    assert.strictEqual(statusCode, 401);
    assert(responseBody.error, 'Test message');
  });

  await t.test('forbidden() returns 403 response', () => {
    let statusCode;
    let responseBody;

    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            responseBody = body;
          }
        };
      }
    };

    authMiddleware.forbidden(mockRes, 'Access denied');

    assert.strictEqual(statusCode, 403);
    assert(responseBody.error, 'Access denied');
  });

  await t.test('rateLimit() middleware works', async () => {
    let statusCode;
    let headers = {};

    const mockReq = {
      __clientIP: '127.0.0.1',
      url: '/api/test',
      method: 'GET'
    };

    const mockRes = {
      setHeader: (key, value) => {
        headers[key] = value;
      },
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => {
            // Rate limit response
          }
        };
      }
    };

    const middleware = authMiddleware.rateLimit();
    await middleware(mockReq, mockRes, () => {});

    // Should have rate limit headers
    assert(headers['X-RateLimit-Limit']);
    assert(headers['X-RateLimit-Remaining']);
    assert(headers['X-RateLimit-Reset']);
  });

  await t.test('authenticate() middleware validates JWT', async () => {
    // Create a test user and token
    const user = await authManager.register({
      email: 'middleware@example.com',
      password: 'password123'
    });
    await mockDb.updateUser(user.id, { isVerified: true });

    const loginResult = await authManager.login({
      email: 'middleware@example.com',
      password: 'password123'
    });

    const mockReq = {
      headers: {
        authorization: `Bearer ${loginResult.tokens.accessToken}`
      }
    };

    let calledNext = false;
    const next = () => { calledNext = true; };

    const middleware = authMiddleware.authenticate();
    await middleware(mockReq, {}, next);

    assert(calledNext);
    assert(mockReq.user);
    assert.strictEqual(mockReq.user.email, 'middleware@example.com');
  });

  await t.test('authorize() middleware checks permissions', async () => {
    // Create admin user
    const user = await authManager.register({
      email: 'admin-middleware@example.com',
      password: 'password123'
    });
    await mockDb.updateUser(user.id, { isVerified: true, role: 'admin' });

    const loginResult = await authManager.login({
      email: 'admin-middleware@example.com',
      password: 'password123'
    });

    const mockReq = {
      user: { id: user.id, role: 'admin' }
    };

    let calledNext = false;
    const next = () => { calledNext = true; };

    const middleware = authMiddleware.authorize('write:users');
    await middleware(mockReq, {}, next);

    assert(calledNext);
  });

  await t.test('requireRole() middleware validates roles', async () => {
    const mockReq = {
      user: { role: 'admin' }
    };

    let calledNext = false;
    const next = () => { calledNext = true; };

    const middleware = authMiddleware.requireRole('admin');
    await middleware(mockReq, {}, next);

    assert(calledNext);
  });

  await t.test('requireRole() rejects insufficient roles', async () => {
    const mockReq = {
      user: { role: 'user' }
    };

    let statusCode;
    const mockRes = {
      status: (code) => {
        statusCode = code;
        return {
          json: () => {}
        };
      }
    };

    const middleware = authMiddleware.requireRole('admin');
    await middleware(mockReq, mockRes, () => {});

    assert.strictEqual(statusCode, 403);
  });
});
