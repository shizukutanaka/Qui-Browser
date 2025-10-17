/**
 * Qui Browser - GraphQL Resolvers
 *
 * GraphQL resolver implementations for all queries and mutations
 */

const {
  AuthenticationError,
  ForbiddenError,
  UserInputError,
  ValidationError
} = require('apollo-server-core');

class GraphQLResolvers {
  constructor(authManager, databaseManager, analyticsEngine, rateLimiter) {
    this.auth = authManager;
    this.db = databaseManager;
    this.analytics = analyticsEngine;
    this.rateLimiter = rateLimiter;
  }

  getResolvers() {
    return {
      Query: {
        // User queries
        me: this.requireAuth((_, __, { user }) => user),

        user: this.requireAuth(async (_, { id }, { user }) => {
          // Only allow users to query themselves or admins to query anyone
          if (user.id !== id && user.role !== 'ADMIN') {
            throw new ForbiddenError('Access denied');
          }
          return await this.db.getUser(id);
        }),

        users: this.requireRole('ADMIN', async (_, { limit = 50, offset = 0, sort }) => {
          const users = await this.db.listUsers({ limit, offset, sort });
          return users.map(user => this.sanitizeUser(user));
        }),

        // Bookmark queries
        bookmark: this.requireAuth(async (_, { id }, { user }) => {
          const bookmark = await this.db.getBookmark(id);
          if (!bookmark || bookmark.userId !== user.id) {
            throw new ForbiddenError('Bookmark not found');
          }
          return bookmark;
        }),

        bookmarks: this.requireAuth(async (_, args, { user }) => {
          const { folder, tags, search, limit = 50, offset = 0, sort } = args;
          const filters = { userId: user.id };

          if (folder) filters.folder = folder;
          if (tags && tags.length > 0) filters.tags = { $in: tags };
          if (search) filters.$or = [
            { title: { $regex: search, $options: 'i' } },
            { url: { $regex: search, $options: 'i' } },
            { description: { $regex: search, $options: 'i' } }
          ];

          return await this.db.listBookmarks(filters, { limit, offset, sort });
        }),

        // History queries
        historyEntry: this.requireAuth(async (_, { id }, { user }) => {
          const entry = await this.db.getHistoryEntry(id);
          if (!entry || entry.userId !== user.id) {
            throw new ForbiddenError('History entry not found');
          }
          return entry;
        }),

        history: this.requireAuth(async (_, args, { user }) => {
          const { startDate, endDate, search, limit = 100, offset = 0, sort } = args;
          const filters = { userId: user.id };

          if (startDate || endDate) {
            filters.lastVisit = {};
            if (startDate) filters.lastVisit.$gte = new Date(startDate);
            if (endDate) filters.lastVisit.$lte = new Date(endDate);
          }

          if (search) filters.$or = [
            { title: { $regex: search, $options: 'i' } },
            { url: { $regex: search, $options: 'i' } }
          ];

          return await this.db.listHistory(filters, { limit, offset, sort });
        }),

        // Session queries
        session: this.requireAuth(async (_, { id }, { user }) => {
          const session = await this.db.getSession(id);
          if (!session || session.userId !== user.id) {
            throw new ForbiddenError('Session not found');
          }
          return session;
        }),

        sessions: this.requireAuth(async (_, args, { user }) => {
          const { status, limit = 20, offset = 0, sort } = args;
          const filters = { userId: user.id };

          if (status) filters.status = status;

          return await this.db.listSessions(filters, { limit, offset, sort });
        }),

        // Analytics queries
        analytics: this.requireAuth(async (_, { query }, { user }) => {
          // Only allow users to see their own analytics or admins to see all
          const filters = user.role === 'ADMIN' ? {} : { userId: user.id };

          if (query) {
            if (query.startDate) filters.timestamp = { $gte: new Date(query.startDate) };
            if (query.endDate) filters.timestamp = { ...filters.timestamp, $lte: new Date(query.endDate) };
            if (query.eventType) filters.type = query.eventType;
            if (query.userId && user.role === 'ADMIN') filters.userId = query.userId;
          }

          return await this.analytics.getAnalytics({
            ...filters,
            limit: query?.limit || 100,
            offset: query?.offset || 0
          });
        }),

        analyticsSummary: this.requireAuth(async (_, { startDate, endDate }, { user }) => {
          const filters = user.role === 'ADMIN' ? {} : { userId: user.id };

          if (startDate) filters.timestamp = { $gte: new Date(startDate) };
          if (endDate) filters.timestamp = { ...filters.timestamp, $lte: new Date(endDate) };

          return await this.analytics.getAnalyticsSummary(filters);
        }),

        // Export queries
        exports: this.requireAuth(async (_, __, { user }) => {
          return await this.db.listExports(user.id);
        }),

        export: this.requireAuth(async (_, { id }, { user }) => {
          const export_ = await this.db.getExport(id);
          if (!export_ || export_.userId !== user.id) {
            throw new ForbiddenError('Export not found');
          }
          return export_;
        }),

        // Notification queries
        notifications: this.requireAuth(async (_, { read, limit = 50, offset = 0 }, { user }) => {
          const filters = { userId: user.id };
          if (read !== undefined) filters.read = read;

          return await this.db.listNotifications(filters, { limit, offset });
        }),

        notification: this.requireAuth(async (_, { id }, { user }) => {
          const notification = await this.db.getNotification(id);
          if (!notification || notification.userId !== user.id) {
            throw new ForbiddenError('Notification not found');
          }
          return notification;
        }),

        // System queries
        health: async () => {
          return {
            status: 'healthy',
            version: '1.1.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            services: {
              database: 'healthy', // Would check actual DB health
              cache: 'healthy',    // Would check cache health
              websocket: 'healthy', // Would check WebSocket health
              analytics: 'healthy' // Would check analytics health
            }
          };
        },

        rateLimit: this.requireAuth(async (_, __, { user, clientIP }) => {
          const result = await this.rateLimiter.checkLimit(clientIP, user?.id);
          return {
            limit: result.limit,
            remaining: result.remaining,
            resetTime: result.resetTime,
            retryAfter: result.retryAfter || 0
          };
        })
      },

      Mutation: {
        // Authentication mutations
        register: async (_, { input }) => {
          try {
            const user = await this.auth.register(input);
            const tokens = await this.auth.generateTokens(user);
            const session = await this.auth.createSession(user);

            return { user, tokens, session };
          } catch (error) {
            throw new UserInputError(error.message);
          }
        },

        login: async (_, { email, password, rememberMe }) => {
          try {
            const result = await this.auth.login({ email, password, rememberMe });
            return result;
          } catch (error) {
            throw new AuthenticationError(error.message);
          }
        },

        logout: this.requireAuth(async (_, __, { user }) => {
          await this.auth.logout(user.id);
          return true;
        }),

        refreshToken: async (_, __, { refreshToken }) => {
          try {
            return await this.auth.refreshToken(refreshToken);
          } catch (error) {
            throw new AuthenticationError('Invalid refresh token');
          }
        },

        verifyEmail: async (_, { token }) => {
          try {
            await this.auth.verifyEmail(token);
            return true;
          } catch (error) {
            throw new ValidationError('Invalid verification token');
          }
        },

        forgotPassword: async (_, { email }) => {
          await this.auth.requestPasswordReset(email);
          return true;
        },

        resetPassword: async (_, { token, newPassword }) => {
          try {
            await this.auth.resetPassword(token, newPassword);
            return true;
          } catch (error) {
            throw new ValidationError(error.message);
          }
        },

        // User mutations
        updateProfile: this.requireAuth(async (_, { input }, { user }) => {
          const updatedUser = await this.auth.updateProfile(user.id, input);
          return updatedUser;
        }),

        changePassword: this.requireAuth(async (_, { input }, { user }) => {
          await this.auth.changePassword(user.id, input.currentPassword, input.newPassword);
          return true;
        }),

        deleteAccount: this.requireAuth(async (_, { password }, { user }) => {
          await this.auth.deleteAccount(user.id, password);
          return true;
        }),

        // API Key mutations
        createApiKey: this.requireAuth(async (_, { input }, { user }) => {
          return await this.auth.createApiKey(user.id, input);
        }),

        deleteApiKey: this.requireAuth(async (_, { id }, { user }) => {
          const apiKey = await this.db.getApiKey(id);
          if (!apiKey || apiKey.userId !== user.id) {
            throw new ForbiddenError('API key not found');
          }

          await this.db.deleteApiKey(id);
          return true;
        }),

        // Bookmark mutations
        createBookmark: this.requireAuth(async (_, { input }, { user }) => {
          const bookmark = {
            id: this.generateId(),
            userId: user.id,
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
            clickCount: 0
          };

          await this.db.createBookmark(bookmark);

          // Track analytics
          await this.analytics.trackEvent({
            type: 'bookmark_created',
            userId: user.id,
            data: { bookmarkId: bookmark.id }
          });

          return bookmark;
        }),

        updateBookmark: this.requireAuth(async (_, { id, input }, { user }) => {
          const bookmark = await this.db.getBookmark(id);
          if (!bookmark || bookmark.userId !== user.id) {
            throw new ForbiddenError('Bookmark not found');
          }

          const updatedBookmark = {
            ...bookmark,
            ...input,
            updatedAt: new Date()
          };

          await this.db.updateBookmark(id, updatedBookmark);
          return updatedBookmark;
        }),

        deleteBookmark: this.requireAuth(async (_, { id }, { user }) => {
          const bookmark = await this.db.getBookmark(id);
          if (!bookmark || bookmark.userId !== user.id) {
            throw new ForbiddenError('Bookmark not found');
          }

          await this.db.deleteBookmark(id);

          // Track analytics
          await this.analytics.trackEvent({
            type: 'bookmark_deleted',
            userId: user.id,
            data: { bookmarkId: id }
          });

          return true;
        }),

        // Session mutations
        createSession: this.requireAuth(async (_, { input }, { user }) => {
          const session = {
            id: this.generateId(),
            userId: user.id,
            ...input,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastActivity: new Date(),
            status: 'ACTIVE'
          };

          await this.db.createSession(session);
          return session;
        }),

        updateSession: this.requireAuth(async (_, { id, input }, { user }) => {
          const session = await this.db.getSession(id);
          if (!session || session.userId !== user.id) {
            throw new ForbiddenError('Session not found');
          }

          const updatedSession = {
            ...session,
            ...input,
            updatedAt: new Date()
          };

          await this.db.updateSession(id, updatedSession);
          return updatedSession;
        }),

        deleteSession: this.requireAuth(async (_, { id }, { user }) => {
          const session = await this.db.getSession(id);
          if (!session || session.userId !== user.id) {
            throw new ForbiddenError('Session not found');
          }

          await this.db.deleteSession(id);
          return true;
        }),

        // Export mutations
        exportData: this.requireAuth(async (_, { input }, { user }) => {
          const result = await this.dataExportImport.exportData(user.id, input);

          // Track analytics
          await this.analytics.trackEvent({
            type: 'export_completed',
            userId: user.id,
            data: {
              exportId: result.exportId,
              format: input.format,
              recordCount: Object.values(result.recordCounts).reduce((sum, count) => sum + count, 0)
            }
          });

          return result;
        }),

        deleteExport: this.requireAuth(async (_, { id }, { user }) => {
          const export_ = await this.db.getExport(id);
          if (!export_ || export_.userId !== user.id) {
            throw new ForbiddenError('Export not found');
          }

          await this.dataExportImport.deleteExport(id);
          return true;
        }),

        // Notification mutations
        createNotification: this.requireRole('ADMIN', async (_, { input }) => {
          const notification = {
            id: this.generateId(),
            ...input,
            read: false,
            createdAt: new Date()
          };

          await this.db.createNotification(notification);
          return notification;
        }),

        markNotificationRead: this.requireAuth(async (_, { id }, { user }) => {
          const notification = await this.db.getNotification(id);
          if (!notification || notification.userId !== user.id) {
            throw new ForbiddenError('Notification not found');
          }

          await this.db.updateNotification(id, { read: true });
          return true;
        }),

        markAllNotificationsRead: this.requireAuth(async (_, __, { user }) => {
          await this.db.markAllNotificationsRead(user.id);
          return true;
        }),

        deleteNotification: this.requireAuth(async (_, { id }, { user }) => {
          const notification = await this.db.getNotification(id);
          if (!notification || notification.userId !== user.id) {
            throw new ForbiddenError('Notification not found');
          }

          await this.db.deleteNotification(id);
          return true;
        }),

        // Analytics mutations
        trackEvent: this.requireAuth(async (_, { type, data }, { user }) => {
          await this.analytics.trackEvent({
            type,
            userId: user.id,
            data: data ? JSON.parse(data) : null
          });
          return true;
        })
      },

      Subscription: {
        userUpdated: {
          subscribe: this.withFilter(
            () => this.pubsub.asyncIterator('USER_UPDATED'),
            (payload, variables) => payload.userUpdated.id === variables.userId
          )
        },

        bookmarkCreated: {
          subscribe: this.requireAuthSubscription((_, __, { user }) =>
            this.pubsub.asyncIterator('BOOKMARK_CREATED')
              .filter(payload => payload.bookmarkCreated.userId === user.id)
          )
        },

        analyticsEvent: {
          subscribe: this.requireAuthSubscription((_, __, { user }) =>
            this.pubsub.asyncIterator('ANALYTICS_EVENT')
              .filter(payload => payload.analyticsEvent.userId === user.id)
          )
        }
      },

      // Field resolvers
      User: {
        bookmarks: async (user, { limit = 50, offset = 0 }) => {
          return await this.db.listBookmarks({ userId: user.id }, { limit, offset });
        },

        history: async (user, { limit = 50, offset = 0 }) => {
          return await this.db.listHistory({ userId: user.id }, { limit, offset });
        },

        sessions: async (user, { limit = 20, offset = 0 }) => {
          return await this.db.listSessions({ userId: user.id }, { limit, offset });
        },

        analytics: async (user, { startDate, endDate }) => {
          return await this.analytics.getUserAnalytics(user.id, { startDate, endDate });
        },

        apiKeys: async (user) => {
          return await this.db.listApiKeys(user.id);
        },

        quota: async (user) => {
          return await this.rateLimiter.getQuotaUsage(user.id);
        }
      },

      Bookmark: {
        user: async (bookmark) => {
          return await this.db.getUser(bookmark.userId);
        }
      },

      HistoryEntry: {
        user: async (entry) => {
          return await this.db.getUser(entry.userId);
        }
      },

      Session: {
        user: async (session) => {
          return await this.db.getUser(session.userId);
        }
      },

      AnalyticsEvent: {
        data: (event) => {
          return event.data ? JSON.stringify(event.data) : null;
        }
      }
    };
  }

  // Middleware helpers
  requireAuth(resolver) {
    return async (parent, args, context, info) => {
      if (!context.user) {
        throw new AuthenticationError('Authentication required');
      }
      return resolver(parent, args, context, info);
    };
  }

  requireRole(role, resolver) {
    return this.requireAuth(async (parent, args, context, info) => {
      if (context.user.role !== role && context.user.role !== 'ADMIN') {
        throw new ForbiddenError(`Role '${role}' required`);
      }
      return resolver(parent, args, context, info);
    });
  }

  requireAuthSubscription(subscribe) {
    return (parent, args, context, info) => {
      if (!context.user) {
        throw new AuthenticationError('Authentication required');
      }
      return subscribe(parent, args, context, info);
    };
  }

  withFilter(subscribe, filter) {
    return (parent, args, context, info) => {
      const iterator = subscribe(parent, args, context, info);
      return {
        [Symbol.asyncIterator]: () => ({
          next: async () => {
            const { value, done } = await iterator.next();
            if (done) return { value, done };

            if (filter(value, args, context, info)) {
              return { value, done };
            }

            // Continue to next value if filtered out
            return this.next();
          }
        })
      };
    };
  }

  // Utility methods
  sanitizeUser(user) {
    const { passwordHash, verificationToken, resetToken, ...sanitized } = user;
    return sanitized;
  }

  generateId() {
    return `gql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Dependencies to be injected
  setDependencies(dataExportImport, pubsub) {
    this.dataExportImport = dataExportImport;
    this.pubsub = pubsub;
  }
}

module.exports = GraphQLResolvers;
