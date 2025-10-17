/**
 * Qui Browser - GraphQL Server Integration
 *
 * Apollo Server integration with authentication and real-time subscriptions
 */

const { ApolloServer } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { PubSub } = require('graphql-subscriptions');
const { execute, subscribe } = require('graphql');
const { SubscriptionServer } = require('subscriptions-transport-ws');

const typeDefs = require('./schema');
const GraphQLResolvers = require('./resolvers');

class GraphQLServer {
  constructor(config, authManager, databaseManager, analyticsEngine, rateLimiter) {
    this.config = config;
    this.authManager = authManager;
    this.databaseManager = databaseManager;
    this.analyticsEngine = analyticsEngine;
    this.rateLimiter = rateLimiter;

    this.pubsub = new PubSub();
    this.resolvers = new GraphQLResolvers(
      authManager,
      databaseManager,
      analyticsEngine,
      rateLimiter
    );

    // Set up resolver dependencies
    this.resolvers.setDependencies(
      require('../data-export-import'),
      this.pubsub
    );

    this.apolloServer = null;
    this.subscriptionServer = null;
  }

  async initialize() {
    // Create executable schema
    const schema = makeExecutableSchema({
      typeDefs,
      resolvers: this.resolvers.getResolvers()
    });

    // Create Apollo Server
    this.apolloServer = new ApolloServer({
      schema,
      context: this.createContext.bind(this),
      plugins: [
        // Error handling plugin
        {
          requestDidStart: () => ({
            didEncounterErrors: async ({ errors, request }) => {
              // Log GraphQL errors
              console.error('GraphQL Errors:', errors.map(err => ({
                message: err.message,
                path: err.path,
                extensions: err.extensions
              })));

              // Track error analytics
              if (this.analyticsEngine && request.context?.user) {
                await this.analyticsEngine.trackEvent({
                  type: 'graphql_error',
                  userId: request.context.user.id,
                  data: {
                    errors: errors.map(err => err.message),
                    operation: request.operationName
                  }
                });
              }
            }
          })
        },

        // Analytics plugin
        {
          requestDidStart: ({ request, context }) => {
            const startTime = Date.now();

            return {
              willSendResponse: async ({ context }) => {
                const duration = Date.now() - startTime;

                // Track GraphQL operation analytics
                if (this.analyticsEngine && context.user) {
                  await this.analyticsEngine.trackEvent({
                    type: 'graphql_operation',
                    userId: context.user.id,
                    data: {
                      operation: request.operationName,
                      operationType: request.operation?.operation,
                      duration,
                      complexity: this.calculateComplexity(request)
                    }
                  });
                }
              }
            };
          }
        }
      ],
      introspection: this.config.environment === 'development',
      playground: this.config.environment === 'development',
      formatError: (error) => {
        // Don't expose internal errors in production
        if (this.config.environment === 'production' && !error.originalError) {
          return {
            message: 'Internal server error',
            extensions: { code: 'INTERNAL_ERROR' }
          };
        }

        return {
          message: error.message,
          locations: error.locations,
          path: error.path,
          extensions: error.extensions
        };
      }
    });

    await this.apolloServer.start();
    console.log('GraphQL server initialized');
  }

  /**
   * Create GraphQL context for each request
   */
  async createContext({ req, res, connection }) {
    // Handle HTTP requests
    if (req) {
      let user = null;
      let apiUser = null;
      let authType = null;

      try {
        // Try JWT authentication
        const token = this.extractToken(req);
        if (token) {
          const result = await this.authManager.verifyToken(token);
          user = result.user;
          authType = 'jwt';
        }

        // Try API key authentication
        const apiKey = this.extractApiKey(req);
        if (apiKey && !user) {
          const result = await this.authManager.verifyApiKey(apiKey);
          if (result) {
            apiUser = result.user;
            user = result.user; // For compatibility
            authType = 'api_key';
          }
        }
      } catch (error) {
        // Authentication failed, continue without user
        console.warn('GraphQL auth error:', error.message);
      }

      return {
        req,
        res,
        user,
        apiUser,
        authType,
        clientIP: this.authManager.getClientIP(req),
        pubsub: this.pubsub
      };
    }

    // Handle WebSocket connections
    if (connection) {
      return {
        ...connection.context,
        pubsub: this.pubsub
      };
    }

    return { pubsub: this.pubsub };
  }

  /**
   * Apply GraphQL middleware to Express app
   */
  applyMiddleware(app, path = '/graphql') {
    this.apolloServer.applyMiddleware({
      app,
      path,
      cors: {
        origin: this.config.cors?.origin || true,
        credentials: true
      }
    });

    console.log(`GraphQL endpoint: ${path}`);
    console.log(`GraphQL playground: ${path}${this.config.environment === 'development' ? '' : ' (disabled in production)'}`);
  }

  /**
   * Set up WebSocket subscriptions
   */
  setupSubscriptions(httpServer, subscriptionPath = '/graphql') {
    this.subscriptionServer = SubscriptionServer.create(
      {
        schema: this.apolloServer.schema,
        execute,
        subscribe,
        onConnect: this.onSubscriptionConnect.bind(this),
        onDisconnect: this.onSubscriptionDisconnect.bind(this),
        onOperation: this.onSubscriptionOperation.bind(this)
      },
      {
        server: httpServer,
        path: subscriptionPath
      }
    );

    console.log(`GraphQL subscriptions: ws://localhost:${this.config.port}${subscriptionPath}`);
  }

  /**
   * Handle WebSocket subscription connection
   */
  async onSubscriptionConnect(connectionParams, webSocket, context) {
    try {
      // Extract authentication from connection params
      const token = connectionParams.authorization?.replace('Bearer ', '');
      const apiKey = connectionParams['x-api-key'];

      let user = null;
      let authType = null;

      if (token) {
        const result = await this.authManager.verifyToken(token);
        user = result.user;
        authType = 'jwt';
      } else if (apiKey) {
        const result = await this.authManager.verifyApiKey(apiKey);
        if (result) {
          user = result.user;
          authType = 'api_key';
        }
      }

      return {
        user,
        authType,
        pubsub: this.pubsub
      };
    } catch (error) {
      console.warn('WebSocket subscription auth failed:', error.message);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Handle WebSocket subscription disconnection
   */
  onSubscriptionDisconnect(webSocket, context) {
    // Clean up subscription resources
    if (context.user) {
      console.log(`WebSocket subscription disconnected for user ${context.user.id}`);
    }
  }

  /**
   * Handle subscription operations
   */
  async onSubscriptionOperation(message, params, webSocket) {
    // Add any operation-level authentication or authorization here
    return params;
  }

  /**
   * Extract JWT token from request
   */
  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }

    return null;
  }

  /**
   * Extract API key from request
   */
  extractApiKey(req) {
    // Check X-API-Key header
    if (req.headers['x-api-key']) {
      return req.headers['x-api-key'];
    }

    // Check Authorization header (API Key format)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('ApiKey ')) {
      return authHeader.substring(7);
    }

    return null;
  }

  /**
   * Calculate query complexity (basic implementation)
   */
  calculateComplexity(request) {
    // Basic complexity calculation based on operation type and field count
    // In production, you'd use a more sophisticated library like graphql-query-complexity

    if (!request.operation) return 1;

    let complexity = 1;

    // Count fields recursively
    const countFields = (node) => {
      if (node.selectionSet) {
        node.selectionSet.selections.forEach(selection => {
          complexity++;
          if (selection.selectionSet) {
            countFields(selection);
          }
        });
      }
    };

    if (request.operation.selectionSet) {
      countFields(request.operation);
    }

    return Math.min(complexity, 1000); // Cap complexity
  }

  /**
   * Get GraphQL server info
   */
  getServerInfo() {
    return {
      endpoint: '/graphql',
      subscriptions: '/graphql',
      playground: this.config.environment === 'development' ? '/graphql' : null,
      schema: {
        queryTypes: Object.keys(this.resolvers.getResolvers().Query || {}),
        mutationTypes: Object.keys(this.resolvers.getResolvers().Mutation || {}),
        subscriptionTypes: Object.keys(this.resolvers.getResolvers().Subscription || {})
      }
    };
  }

  /**
   * Publish events to subscriptions
   */
  publish(eventType, payload) {
    this.pubsub.publish(eventType, { [eventType.toLowerCase()]: payload });
  }

  /**
   * Stop the GraphQL server
   */
  async stop() {
    if (this.apolloServer) {
      await this.apolloServer.stop();
    }

    if (this.subscriptionServer) {
      this.subscriptionServer.close();
    }

    if (this.pubsub) {
      this.pubsub.close();
    }

    console.log('GraphQL server stopped');
  }
}

module.exports = GraphQLServer;
