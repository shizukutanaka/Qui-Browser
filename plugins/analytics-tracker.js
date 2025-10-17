/**
 * Example Plugin - Analytics Tracker
 *
 * Demonstrates the Qui Browser plugin system
 * Tracks user analytics and provides insights
 */

const PluginInterface = require('../lib/plugins/interface');

class AnalyticsTrackerPlugin extends PluginInterface {
  constructor(context) {
    super(context);
    this.id = 'analytics-tracker';
    this.version = '1.0.0';
    this.description = 'Tracks user analytics and provides insights';

    // Plugin state
    this.analytics = new Map();
    this.sessionCount = 0;
    this.pageViews = 0;
    this.uniqueUsers = new Set();

    // Register hooks
    this.registerHooks();
  }

  registerHooks() {
    // Hook into request processing
    this.registerHook('request:post', this.onRequest.bind(this));

    // Hook into WebSocket events
    this.registerHook('websocket:connection', this.onWebSocketConnection.bind(this));
    this.registerHook('websocket:disconnection', this.onWebSocketDisconnection.bind(this));

    // Hook into file operations
    this.registerHook('file:upload', this.onFileUpload.bind(this));
    this.registerHook('file:download', this.onFileDownload.bind(this));

    // Hook into server lifecycle
    this.registerHook('server:start', this.onServerStart.bind(this));
    this.registerHook('server:stop', this.onServerStop.bind(this));
  }

  async load() {
    this.log('info', 'Analytics tracker plugin loaded');

    // Initialize analytics storage
    this.analytics.set('sessions', { total: 0, active: 0 });
    this.analytics.set('pageViews', 0);
    this.analytics.set('uniqueUsers', 0);
    this.analytics.set('fileOperations', { uploads: 0, downloads: 0 });
    this.analytics.set('apiCalls', new Map());

    // Load configuration
    const enableRealtime = this.getConfig('realtime', true);
    const retentionDays = this.getConfig('retentionDays', 30);

    this.log('info', `Realtime analytics: ${enableRealtime}`);
    this.log('info', `Data retention: ${retentionDays} days`);
  }

  async unload() {
    this.log('info', 'Analytics tracker plugin unloaded');

    // Save final analytics data
    await this.saveAnalytics();
  }

  async onServerStart(data) {
    this.log('info', 'Server started, beginning analytics tracking');
    return data;
  }

  async onServerStop(data) {
    this.log('info', 'Server stopping, finalizing analytics');
    await this.saveAnalytics();
    return data;
  }

  async onRequest(data) {
    // Track request analytics
    this.pageViews++;
    this.uniqueUsers.add(data.clientIP);

    // Track API calls
    if (data.url?.startsWith('/api/')) {
      const endpoint = data.url.split('/api/')[1]?.split('/')[0] || 'unknown';
      const apiCalls = this.analytics.get('apiCalls');
      apiCalls.set(endpoint, (apiCalls.get(endpoint) || 0) + 1);
    }

    // Update analytics
    this.analytics.set('pageViews', this.pageViews);
    this.analytics.set('uniqueUsers', this.uniqueUsers.size);

    return data;
  }

  async onWebSocketConnection(data) {
    const sessions = this.analytics.get('sessions');
    sessions.active++;
    sessions.total++;
    this.analytics.set('sessions', sessions);

    this.log('info', `WebSocket connection: ${data.clientId}`);
    return data;
  }

  async onWebSocketDisconnection(data) {
    const sessions = this.analytics.get('sessions');
    sessions.active = Math.max(0, sessions.active - 1);
    this.analytics.set('sessions', sessions);

    this.log('info', `WebSocket disconnection: ${data.clientId}`);
    return data;
  }

  async onFileUpload(data) {
    const fileOps = this.analytics.get('fileOperations');
    fileOps.uploads++;
    this.analytics.set('fileOperations', fileOps);

    this.log('info', `File uploaded: ${data.filename} (${data.size} bytes)`);
    return data;
  }

  async onFileDownload(data) {
    const fileOps = this.analytics.get('fileOperations');
    fileOps.downloads++;
    this.analytics.set('fileOperations', fileOps);

    this.log('info', `File downloaded: ${data.filename}`);
    return data;
  }

  async saveAnalytics() {
    try {
      // In a real implementation, this would save to database
      this.log('info', 'Analytics data saved');
    } catch (error) {
      this.log('error', 'Failed to save analytics:', error);
    }
  }

  /**
   * Get current analytics data
   */
  getAnalytics() {
    return {
      timestamp: new Date().toISOString(),
      sessions: this.analytics.get('sessions'),
      pageViews: this.analytics.get('pageViews'),
      uniqueUsers: this.analytics.get('uniqueUsers'),
      fileOperations: this.analytics.get('fileOperations'),
      apiCalls: Object.fromEntries(this.analytics.get('apiCalls'))
    };
  }

  /**
   * Get plugin API endpoints
   */
  getAPIEndpoints() {
    return {
      '/api/analytics': {
        method: 'GET',
        handler: (req, res) => {
          const data = this.getAnalytics();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        }
      }
    };
  }
}

module.exports = {
  Plugin: AnalyticsTrackerPlugin
};
