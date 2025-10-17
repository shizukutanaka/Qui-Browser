/**
 * Tests for GraphQL API
 */

const { test } = require('node:test');
const assert = require('node:assert');
const GraphQLServer = require('../lib/graphql/server');
const GraphQLResolvers = require('../lib/graphql/resolvers');

// Mock dependencies
class MockAuthManager {
  constructor() {
    this.users = new Map();
  }

  async verifyToken(token) {
    return {
      user: { id: 'user1', email: 'test@example.com', role: 'user' },
      tokenData: { userId: 'user1' }
    };
  }

  async verifyApiKey(key) {
    return {
      user: { id: 'user1', email: 'test@example.com', role: 'user' },
      permissions: ['read', 'write']
    };
  }

  getClientIP(req) {
    return '127.0.0.1';
  }
}

class MockDatabaseManager {
  constructor() {
    this.bookmarks = [];
    this.history = [];
    this.users = new Map();
    this.sessions = [];
    this.notifications = [];
    this.apiKeys = [];
    this.exports = [];
  }

  async getUser(id) {
    return this.users.get(id) || null;
  }

  async getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async getUserByUsername(username) {
    for (const user of this.users.values()) {
      if (user.username === username) return user;
    }
    return null;
  }

  async createUser(user) {
    this.users.set(user.id, user);
    return user;
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
    return this.users.delete(id);
  }

  async listBookmarks(filters = {}, options = {}) {
    let bookmarks = this.bookmarks;

    if (filters.userId) {
      bookmarks = bookmarks.filter(b => b.userId === filters.userId);
    }

    if (filters.folder) {
      bookmarks = bookmarks.filter(b => b.folder === filters.folder);
    }

    if (filters.tags && filters.tags.length > 0) {
      bookmarks = bookmarks.filter(b =>
        filters.tags.some(tag => b.tags.includes(tag))
      );
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      bookmarks = bookmarks.filter(b =>
        b.title.toLowerCase().includes(search) ||
        b.url.toLowerCase().includes(search)
      );
    }

    // Apply pagination
    const { limit = 50, offset = 0 } = options;
    return bookmarks.slice(offset, offset + limit);
  }

  async getBookmark(id) {
    return this.bookmarks.find(b => b.id === id) || null;
  }

  async createBookmark(bookmark) {
    this.bookmarks.push(bookmark);
    return bookmark;
  }

  async updateBookmark(id, updates) {
    const bookmark = this.bookmarks.find(b => b.id === id);
    if (bookmark) {
      Object.assign(bookmark, updates);
      return bookmark;
    }
    return null;
  }

  async deleteBookmark(id) {
    const index = this.bookmarks.findIndex(b => b.id === id);
    if (index !== -1) {
      this.bookmarks.splice(index, 1);
      return true;
    }
    return false;
  }

  async listHistory(filters = {}, options = {}) {
    let history = this.history;

    if (filters.userId) {
      history = history.filter(h => h.userId === filters.userId);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      history = history.filter(h => h.lastVisit >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      history = history.filter(h => h.lastVisit <= endDate);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      history = history.filter(h =>
        h.title.toLowerCase().includes(search) ||
        h.url.toLowerCase().includes(search)
      );
    }

    const { limit = 100, offset = 0 } = options;
    return history.slice(offset, offset + limit);
  }

  async getHistoryEntry(id) {
    return this.history.find(h => h.id === id) || null;
  }

  async listSessions(filters = {}, options = {}) {
    let sessions = this.sessions;

    if (filters.userId) {
      sessions = sessions.filter(s => s.userId === filters.userId);
    }

    if (filters.status) {
      sessions = sessions.filter(s => s.status === filters.status);
    }

    const { limit = 20, offset = 0 } = options;
    return sessions.slice(offset, offset + limit);
  }

  async getSession(id) {
    return this.sessions.find(s => s.id === id) || null;
  }

  async createSession(session) {
    this.sessions.push(session);
    return session;
  }

  async updateSession(id, updates) {
    const session = this.sessions.find(s => s.id === id);
    if (session) {
      Object.assign(session, updates);
      return session;
    }
    return null;
  }

  async deleteSession(id) {
    const index = this.sessions.findIndex(s => s.id === id);
    if (index !== -1) {
      this.sessions.splice(index, 1);
      return true;
    }
    return false;
  }

  async listUsers(options = {}) {
    const users = Array.from(this.users.values());
    const { limit = 50, offset = 0 } = options;
    return users.slice(offset, offset + limit);
  }

  async createApiKey(apiKey) {
    this.apiKeys.push(apiKey);
    return apiKey;
  }

  async getApiKey(id) {
    return this.apiKeys.find(k => k.id === id) || null;
  }

  async getApiKeyByKey(key) {
    return this.apiKeys.find(k => k.key === key) || null;
  }

  async updateApiKey(id, updates) {
    const apiKey = this.apiKeys.find(k => k.id === id);
    if (apiKey) {
      Object.assign(apiKey, updates);
      return apiKey;
    }
    return null;
  }

  async deleteApiKey(id) {
    const index = this.apiKeys.findIndex(k => k.id === id);
    if (index !== -1) {
      this.apiKeys.splice(index, 1);
      return true;
    }
    return false;
  }

  async listNotifications(filters = {}, options = {}) {
    let notifications = this.notifications;

    if (filters.userId) {
      notifications = notifications.filter(n => n.userId === filters.userId);
    }

    if (filters.read !== undefined) {
      notifications = notifications.filter(n => n.read === filters.read);
    }

    const { limit = 50, offset = 0 } = options;
    return notifications.slice(offset, offset + limit);
  }

  async getNotification(id) {
    return this.notifications.find(n => n.id === id) || null;
  }

  async updateNotification(id, updates) {
    const notification = this.notifications.find(n => n.id === id);
    if (notification) {
      Object.assign(notification, updates);
      return notification;
    }
    return null;
  }

  async markAllNotificationsRead(userId) {
    this.notifications
      .filter(n => n.userId === userId)
      .forEach(n => n.read = true);
    return true;
  }

  async createNotification(notification) {
    this.notifications.push(notification);
    return notification;
  }

  async deleteNotification(id) {
    const index = this.notifications.findIndex(n => n.id === id);
    if (index !== -1) {
      this.notifications.splice(index, 1);
      return true;
    }
    return false;
  }

  async listExports(userId) {
    return this.exports.filter(e => e.userId === userId);
  }

  async getExport(id) {
    return this.exports.find(e => e.id === id) || null;
  }
}

class MockAnalyticsEngine {
  constructor() {
    this.events = [];
  }

  async trackEvent(event) {
    event.id = `event_${Date.now()}_${Math.random()}`;
    event.timestamp = new Date();
    this.events.push(event);
    return { id: event.id };
  }

  getAnalytics(options = {}) {
    return this.events.filter(event => {
      if (options.userId && event.userId !== options.userId) return false;
      if (options.eventType && event.type !== options.eventType) return false;
      return true;
    }).slice(0, options.limit || 100);
  }

  getAnalyticsSummary() {
    const summary = {
      totalEvents: this.events.length,
      totalUsers: new Set(this.events.map(e => e.userId).filter(Boolean)).size,
      totalSessions: new Set(this.events.map(e => e.sessionId).filter(Boolean)).size,
      pageViews: this.events.filter(e => e.type === 'page_view').length,
      apiCalls: this.events.filter(e => e.type === 'api_call').length,
      errors: this.events.filter(e => e.type === 'error').length,
      conversions: this.events.filter(e => e.type === 'conversion').length
    };

    // Calculate averages
    const responseTimes = this.events
      .filter(e => e.responseTime)
      .map(e => e.responseTime);

    summary.avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length
      : 0;

    return summary;
  }
}

class MockRateLimiter {
  constructor() {
    this.quotas = new Map();
  }

  async checkLimit(identifier) {
    return {
      allowed: true,
      remaining: 100,
      resetTime: new Date(Date.now() + 3600000),
      limit: 1000
    };
  }

  getQuotaUsage(identifier) {
    return {
      limit: 1000,
      used: 100,
      remaining: 900,
      resetTime: new Date(Date.now() + 86400000),
      period: 'monthly'
    };
  }
}

// Mock configuration
const mockConfig = {
  environment: 'test',
  graphql: {
    enabled: true,
    endpoint: '/graphql',
    subscriptions: '/graphql',
    playground: true
  }
};

test('GraphQL Resolvers', async (t) => {
  let resolvers;
  let mockDb;
  let mockAuth;
  let mockAnalytics;
  let mockRateLimiter;

  t.before(async () => {
    mockDb = new MockDatabaseManager();
    mockAuth = new MockAuthManager();
    mockAnalytics = new MockAnalyticsEngine();
    mockRateLimiter = new MockRateLimiter();

    // Create a test user
    await mockDb.createUser({
      id: 'user1',
      email: 'test@example.com',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      isVerified: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    resolvers = new GraphQLResolvers(mockAuth, mockDb, mockAnalytics, mockRateLimiter);
  });

  await t.test('GraphQLResolvers initializes correctly', () => {
    assert(resolvers instanceof GraphQLResolvers);
    assert(typeof resolvers.getResolvers === 'function');
  });

  await t.test('Query.me requires authentication', async () => {
    const resolver = resolvers.getResolvers().Query.me;
    const context = { user: { id: 'user1', email: 'test@example.com' } };

    const result = await resolver(null, {}, context);
    assert(result);
    assert.strictEqual(result.id, 'user1');
    assert.strictEqual(result.email, 'test@example.com');
  });

  await t.test('Query.bookmarks filters by user', async () => {
    // Add test bookmarks
    await mockDb.createBookmark({
      id: 'bookmark1',
      userId: 'user1',
      url: 'https://example.com',
      title: 'Example',
      tags: ['test'],
      createdAt: new Date()
    });

    await mockDb.createBookmark({
      id: 'bookmark2',
      userId: 'user2', // Different user
      url: 'https://test.com',
      title: 'Test',
      tags: ['demo'],
      createdAt: new Date()
    });

    const resolver = resolvers.getResolvers().Query.bookmarks;
    const context = { user: { id: 'user1' } };

    const result = await resolver(null, {}, context);
    assert(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].id, 'bookmark1');
  });

  await t.test('Mutation.createBookmark creates bookmark', async () => {
    const resolver = resolvers.getResolvers().Mutation.createBookmark;
    const context = { user: { id: 'user1' } };
    const input = {
      url: 'https://new-example.com',
      title: 'New Example',
      tags: ['new']
    };

    const result = await resolver(null, { input }, context);
    assert(result);
    assert(result.url, 'https://new-example.com');
    assert(result.title, 'New Example');
    assert(result.userId, 'user1');

    // Verify bookmark was created
    const bookmark = await mockDb.getBookmark(result.id);
    assert(bookmark);
    assert.strictEqual(bookmark.url, 'https://new-example.com');
  });

  await t.test('Mutation.updateBookmark updates existing bookmark', async () => {
    const resolver = resolvers.getResolvers().Mutation.updateBookmark;
    const context = { user: { id: 'user1' } };

    const result = await resolver(null, {
      id: 'bookmark1',
      input: { title: 'Updated Example' }
    }, context);

    assert(result);
    assert.strictEqual(result.title, 'Updated Example');

    // Verify bookmark was updated
    const bookmark = await mockDb.getBookmark('bookmark1');
    assert.strictEqual(bookmark.title, 'Updated Example');
  });

  await t.test('Mutation.deleteBookmark removes bookmark', async () => {
    const resolver = resolvers.getResolvers().Mutation.deleteBookmark;
    const context = { user: { id: 'user1' } };

    const result = await resolver(null, { id: 'bookmark1' }, context);
    assert(result);

    // Verify bookmark was deleted
    const bookmark = await mockDb.getBookmark('bookmark1');
    assert.strictEqual(bookmark, null);
  });

  await t.test('Query.analytics returns filtered events', async () => {
    // Add test analytics events
    await mockAnalytics.trackEvent({
      type: 'page_view',
      userId: 'user1',
      url: '/test'
    });

    await mockAnalytics.trackEvent({
      type: 'api_call',
      userId: 'user1',
      endpoint: '/api/test'
    });

    await mockAnalytics.trackEvent({
      type: 'page_view',
      userId: 'user2',
      url: '/other'
    });

    const resolver = resolvers.getResolvers().Query.analytics;
    const context = { user: { id: 'user1' } };

    const result = await resolver(null, { query: { eventType: 'page_view' } }, context);
    assert(Array.isArray(result));
    assert(result.every(event => event.type === 'page_view'));
    assert(result.every(event => event.userId === 'user1'));
  });

  await t.test('Query.analyticsSummary returns aggregated data', async () => {
    const resolver = resolvers.getResolvers().Query.analyticsSummary;
    const context = { user: { id: 'user1' } };

    const result = await resolver(null, {}, context);
    assert(result);
    assert(typeof result.totalEvents === 'number');
    assert(typeof result.totalUsers === 'number');
    assert(typeof result.pageViews === 'number');
    assert(typeof result.apiCalls === 'number');
  });

  await t.test('User.bookmarks resolver works', async () => {
    // Add more bookmarks for testing
    await mockDb.createBookmark({
      id: 'bookmark3',
      userId: 'user1',
      url: 'https://bookmark3.com',
      title: 'Bookmark 3',
      createdAt: new Date()
    });

    await mockDb.createBookmark({
      id: 'bookmark4',
      userId: 'user1',
      url: 'https://bookmark4.com',
      title: 'Bookmark 4',
      createdAt: new Date()
    });

    const userResolver = resolvers.getResolvers().User.bookmarks;
    const user = { id: 'user1' };

    const result = await userResolver(user, { limit: 2, offset: 1 });
    assert(Array.isArray(result));
    assert.strictEqual(result.length, 1); // Only one bookmark should be left after deletions
  });

  await t.test('requireAuth throws error without user', async () => {
    const resolver = resolvers.requireAuth(() => 'success');
    const context = {};

    try {
      await resolver(null, {}, context);
      assert.fail('Should have thrown authentication error');
    } catch (error) {
      assert(error.message.includes('Authentication required'));
    }
  });

  await t.test('requireRole checks user roles', async () => {
    const resolver = resolvers.requireRole('admin', () => 'success');

    // Test with admin user
    const adminContext = { user: { id: 'admin1', role: 'admin' } };
    const adminResult = await resolver(null, {}, adminContext);
    assert.strictEqual(adminResult, 'success');

    // Test with regular user
    const userContext = { user: { id: 'user1', role: 'user' } };
    try {
      await resolver(null, {}, userContext);
      assert.fail('Should have thrown forbidden error');
    } catch (error) {
      assert(error.message.includes('Insufficient role permissions'));
    }
  });

  await t.test('resolvers handle errors gracefully', async () => {
    const resolver = resolvers.getResolvers().Query.bookmark;
    const context = { user: { id: 'user1' } };

    try {
      await resolver(null, { id: 'non-existent' }, context);
      assert.fail('Should have thrown error for non-existent bookmark');
    } catch (error) {
      assert(error.message.includes('Bookmark not found'));
    }
  });
});

test('GraphQL Server Integration', async (t) => {
  let graphqlServer;
  let mockAuth;
  let mockDb;
  let mockAnalytics;
  let mockRateLimiter;

  t.before(async () => {
    mockAuth = new MockAuthManager();
    mockDb = new MockDatabaseManager();
    mockAnalytics = new MockAnalyticsEngine();
    mockRateLimiter = new MockRateLimiter();

    graphqlServer = new GraphQLServer(
      mockConfig,
      mockAuth,
      mockDb,
      mockAnalytics,
      mockRateLimiter
    );
  });

  t.after(async () => {
    if (graphqlServer) {
      await graphqlServer.stop();
    }
  });

  await t.test('GraphQLServer initializes correctly', () => {
    assert(graphqlServer instanceof GraphQLServer);
    assert(graphqlServer.config === mockConfig);
    assert(graphqlServer.authManager === mockAuth);
  });

  await t.test('getServerInfo returns server information', () => {
    const info = graphqlServer.getServerInfo();

    assert(info.endpoint === '/graphql');
    assert(info.subscriptions === '/graphql');
    assert(typeof info.schema === 'object');
    assert(Array.isArray(info.schema.queryTypes));
    assert(Array.isArray(info.schema.mutationTypes));
  });

  await t.test('extractToken gets token from request', () => {
    const mockReq = {
      headers: {
        authorization: 'Bearer test-token-123'
      }
    };

    const token = graphqlServer.extractToken(mockReq);
    assert.strictEqual(token, 'test-token-123');
  });

  await t.test('extractApiKey gets API key from request', () => {
    const mockReq = {
      headers: {
        'x-api-key': 'test-api-key-456'
      }
    };

    const apiKey = graphqlServer.extractApiKey(mockReq);
    assert.strictEqual(apiKey, 'test-api-key-456');
  });

  await t.test('calculateComplexity estimates query complexity', () => {
    // Mock request with nested selections
    const mockRequest = {
      operation: {
        selectionSet: {
          selections: [
            { selectionSet: { selections: [{}] } },
            { selectionSet: { selections: [{}, {}] } }
          ]
        }
      }
    };

    const complexity = graphqlServer.calculateComplexity(mockRequest);
    assert(typeof complexity === 'number');
    assert(complexity > 0);
  });

  await t.test('publish sends events to subscriptions', () => {
    const eventType = 'TEST_EVENT';
    const payload = { test: 'data' };

    // Mock pubsub
    let publishedEvent = null;
    let publishedPayload = null;

    graphqlServer.pubsub = {
      publish: (event, data) => {
        publishedEvent = event;
        publishedPayload = data;
      }
    };

    graphqlServer.publish(eventType, payload);

    assert.strictEqual(publishedEvent, eventType);
    assert(publishedPayload);
    assert.strictEqual(publishedPayload[eventType.toLowerCase()], payload);
  });
});
