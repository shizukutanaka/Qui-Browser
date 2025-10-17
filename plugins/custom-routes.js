/**
 * Custom Routes Plugin
 *
 * Demonstrates adding custom API routes via plugins
 */

const PluginInterface = require('../lib/plugins/interface');

class CustomRoutesPlugin extends PluginInterface {
  constructor(context) {
    super(context);
    this.id = 'custom-routes';
    this.version = '1.0.0';
    this.description = 'Adds custom API routes and endpoints';

    this.customData = new Map();
    this.requestCount = 0;

    // Register hooks
    this.registerHooks();
  }

  registerHooks() {
    // Hook into API routing
    this.registerHook('api:route', this.handleCustomRoute.bind(this));

    // Hook into requests for metrics
    this.registerHook('request:post', this.trackRequests.bind(this));
  }

  async load() {
    this.log('info', 'Custom routes plugin loaded');

    // Initialize custom data
    this.customData.set('status', 'active');
    this.customData.set('version', this.version);
    this.customData.set('startTime', new Date());

    // Load configuration
    const enableMetrics = this.getConfig('enableMetrics', true);
    const customRoutes = this.getConfig('routes', []);

    this.log('info', `Metrics enabled: ${enableMetrics}`);
    this.log('info', `Custom routes: ${customRoutes.length}`);
  }

  async handleCustomRoute(data) {
    const { req, res, pathname, query } = data;

    // Handle custom routes
    if (pathname === '/api/custom/status') {
      return this.handleStatus(req, res);
    }

    if (pathname === '/api/custom/metrics') {
      return this.handleMetrics(req, res);
    }

    if (pathname === '/api/custom/data') {
      return this.handleData(req, res, query);
    }

    if (pathname.startsWith('/api/custom/echo/')) {
      const message = pathname.split('/api/custom/echo/')[1];
      return this.handleEcho(req, res, decodeURIComponent(message));
    }

    // Not a custom route, continue with normal processing
    return data;
  }

  async trackRequests(data) {
    this.requestCount++;
    return data;
  }

  async handleStatus(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }

    const status = {
      plugin: this.id,
      version: this.version,
      status: this.customData.get('status'),
      uptime: Date.now() - this.customData.get('startTime').getTime(),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
    return true;
  }

  async handleMetrics(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }

    const metrics = {
      plugin: this.id,
      requestsProcessed: this.requestCount,
      customDataEntries: this.customData.size,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(metrics));
    return true;
  }

  async handleData(req, res, query) {
    if (req.method === 'GET') {
      // Get all custom data
      const data = Object.fromEntries(this.customData);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return true;
    }

    if (req.method === 'POST') {
      // Set custom data
      try {
        const body = await this.parseRequestBody(req);
        for (const [key, value] of Object.entries(body)) {
          this.customData.set(key, value);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, updated: Object.keys(body) }));
        return true;
      } catch (error) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
        return true;
      }
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return true;
  }

  async handleEcho(req, res, message) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return true;
    }

    const response = {
      plugin: this.id,
      echo: message,
      length: message.length,
      timestamp: new Date().toISOString()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return true;
  }

  async parseRequestBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';

      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1024 * 1024) { // 1MB limit
          reject(new Error('Request body too large'));
        }
      });

      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', reject);
    });
  }

  /**
   * Get plugin API documentation
   */
  getAPIDocumentation() {
    return {
      '/api/custom/status': {
        get: {
          summary: 'Get plugin status',
          responses: {
            200: {
              description: 'Plugin status information'
            }
          }
        }
      },
      '/api/custom/metrics': {
        get: {
          summary: 'Get plugin metrics',
          responses: {
            200: {
              description: 'Plugin metrics data'
            }
          }
        }
      },
      '/api/custom/data': {
        get: {
          summary: 'Get custom data',
          responses: {
            200: {
              description: 'Custom data stored by plugin'
            }
          }
        },
        post: {
          summary: 'Set custom data',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  description: 'Key-value pairs to store'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Data stored successfully'
            }
          }
        }
      },
      '/api/custom/echo/{message}': {
        get: {
          summary: 'Echo a message',
          parameters: [
            {
              name: 'message',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Message to echo back'
            }
          ],
          responses: {
            200: {
              description: 'Echoed message'
            }
          }
        }
      }
    };
  }
}

module.exports = {
  Plugin: CustomRoutesPlugin
};
