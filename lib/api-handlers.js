/**
 * Qui Browser - API Handlers Module
 *
 * Centralized API route handling
 */

const TranslationManager = require('../utils/translation-manager');
const FileUploadManager = require('../utils/file-upload-manager');
const { parseJsonBody } = require('../utils/request-parsers');
const DataExportImport = require('./data-export-import');

class APIHandlers {
  constructor(config) {
    this.config = config;
    this.translationManager = null;
    this.fileUploadManager = null;
    this.dataExportImport = null;
    this.apiHandlers = {}; // Will be loaded from separate file
  }

  /**
   * Initialize API handlers
   */
  initialize() {
    // Initialize translation manager
    if (this.config.i18n.enabled) {
      this.translationManager = new TranslationManager();
    }

    // Initialize file upload manager
    if (this.config.fileUpload.enabled) {
      this.fileUploadManager = new FileUploadManager({
        uploadDir: this.config.fileUpload.uploadDir,
        maxFileSize: this.config.fileUpload.maxFileSize,
        allowedTypes: this.config.fileUpload.allowedTypes
      });
    }

    // Initialize data export/import
    this.dataExportImport = new DataExportImport(this.config, null); // Database manager will be set later

    // Load API handlers
    try {
      this.apiHandlers = require('../utils/api-handlers');
    } catch (error) {
      console.warn('API handlers not available:', error.message);
    }
  }

  /**
   * Handle API routes
   */
  async handleAPIRoutes(req, res, pathname, query) {
    // Bookmarks API
    if (pathname === '/api/bookmarks') {
      return this.handleBookmarks(req, res);
    }

    if (pathname.startsWith('/api/bookmarks/')) {
      const id = pathname.split('/')[3];
      return this.handleBookmarkById(req, res, id);
    }

    // History API
    if (pathname === '/api/history') {
      return this.handleHistory(req, res, query);
    }

    // Tabs API
    if (pathname === '/api/tabs') {
      return this.handleTabs(req, res);
    }

    if (pathname.startsWith('/api/tabs/')) {
      const id = pathname.split('/')[3];
      return this.handleTabById(req, res, id);
    }

    // Authentication API
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      return this.handleRegister(req, res);
    }

    if (pathname === '/api/auth/login' && req.method === 'POST') {
      return this.handleLogin(req, res);
    }

    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      return this.handleLogout(req, res);
    }

    if (pathname === '/api/auth/refresh' && req.method === 'POST') {
      return this.handleRefreshToken(req, res);
    }

    if (pathname === '/api/auth/verify-email' && req.method === 'POST') {
      return this.handleVerifyEmail(req, res);
    }

    if (pathname === '/api/auth/forgot-password' && req.method === 'POST') {
      return this.handleForgotPassword(req, res);
    }

    if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
      return this.handleResetPassword(req, res);
    }

    if (pathname === '/api/auth/me' && req.method === 'GET') {
      return this.handleGetProfile(req, res);
    }

    if (pathname === '/api/auth/me' && req.method === 'PUT') {
      return this.handleUpdateProfile(req, res);
    }

    if (pathname === '/api/auth/change-password' && req.method === 'POST') {
      return this.handleChangePassword(req, res);
    }

    if (pathname === '/api/auth/delete-account' && req.method === 'DELETE') {
      return this.handleDeleteAccount(req, res);
    }

    // OAuth API
    if (pathname.startsWith('/api/auth/oauth/') && req.method === 'GET') {
      const provider = pathname.split('/api/auth/oauth/')[1];
      return this.handleOAuthInitiate(req, res, provider);
    }

    if (pathname.startsWith('/api/auth/oauth/callback/') && req.method === 'GET') {
      const provider = pathname.split('/api/auth/oauth/callback/')[1];
      return this.handleOAuthCallback(req, res, provider);
    }

    // API Key management
    if (pathname === '/api/auth/api-keys' && req.method === 'GET') {
      return this.handleListApiKeys(req, res);
    }

    if (pathname === '/api/auth/api-keys' && req.method === 'POST') {
      return this.handleCreateApiKey(req, res);
    }

    if (pathname.startsWith('/api/auth/api-keys/') && req.method === 'DELETE') {
      const keyId = pathname.split('/api/auth/api-keys/')[1];
      return this.handleDeleteApiKey(req, res, keyId);
    }

    // Search API
    if (pathname === '/api/search') {
      return this.handleSearch(req, res, query);
    }

    // Sessions API
    if (pathname === '/api/sessions') {
      return this.handleSessions(req, res);
    }

    if (pathname.startsWith('/api/sessions/')) {
      const parts = pathname.split('/');
      const id = parts[3];
      const action = parts[4];
      return this.handleSessionById(req, res, id, action);
    }

    // File upload API
    if (pathname === '/api/upload' && req.method === 'POST') {
      return this.handleFileUpload(req, res);
    }

    if (pathname.startsWith('/api/files/') && req.method === 'GET') {
      const filename = pathname.split('/api/files/')[1];
      return this.handleFileDownload(req, res, filename);
    }

    if (pathname === '/api/files' && req.method === 'GET') {
      return this.handleFileList(req, res);
    }

    if (pathname.startsWith('/api/files/') && req.method === 'DELETE') {
      const filename = pathname.split('/api/files/')[1];
      await this.handleFileDelete(req, res, filename);
      return true;
    }

    // Data export/import API
    if (pathname === '/api/export' && req.method === 'POST') {
      return this.handleDataExport(req, res);
    }

    if (pathname === '/api/import' && req.method === 'POST') {
      return this.handleDataImport(req, res);
    }

    if (pathname === '/api/exports' && req.method === 'GET') {
      return this.handleListExports(req, res);
    }

    if (pathname.startsWith('/api/exports/') && req.method === 'DELETE') {
      const exportId = pathname.split('/api/exports/')[1];
      return this.handleDeleteExport(req, res, exportId);
    }

    // Rate limiting management API (admin only)
    if (pathname === '/api/admin/rate-limits' && req.method === 'GET') {
      return this.handleGetRateLimits(req, res);
    }

    if (pathname === '/api/admin/rate-limits' && req.method === 'POST') {
      return this.handleSetRateLimit(req, res);
    }

    if (pathname.startsWith('/api/admin/rate-limits/') && req.method === 'DELETE') {
      const identifier = pathname.split('/api/admin/rate-limits/')[1];
      return this.handleDeleteRateLimit(req, res, identifier);
    }

    if (pathname === '/api/admin/quotas' && req.method === 'POST') {
      return this.handleSetQuota(req, res);
    }

    if (pathname.startsWith('/api/admin/quotas/') && req.method === 'GET') {
      const identifier = pathname.split('/api/admin/quotas/')[1];
      return this.handleGetQuota(req, res, identifier);
    }

    return false;
  }

  /**
   * Handle bookmarks API
   */
  async handleBookmarks(req, res) {
    if (!this.apiHandlers.getBookmarks) {
      return this.sendJsonError(res, 501, 'Bookmarks API not implemented');
    }

    try {
      if (req.method === 'GET') {
        await this.apiHandlers.getBookmarks(req, res);
      } else if (req.method === 'POST') {
        await this.apiHandlers.addBookmark(req, res);
      } else {
        return this.sendMethodNotAllowed(res, ['GET', 'POST']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle bookmark by ID
   */
  async handleBookmarkById(req, res, id) {
    if (!this.apiHandlers.deleteBookmark) {
      return this.sendJsonError(res, 501, 'Bookmark operations not implemented');
    }

    try {
      if (req.method === 'DELETE') {
        await this.apiHandlers.deleteBookmark(req, res, id);
      } else {
        return this.sendMethodNotAllowed(res, ['DELETE']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle history API
   */
  async handleHistory(req, res, query) {
    if (!this.apiHandlers.getHistory) {
      return this.sendJsonError(res, 501, 'History API not implemented');
    }

    try {
      if (req.method === 'GET') {
        await this.apiHandlers.getHistory(req, res, query);
      } else if (req.method === 'DELETE') {
        await this.apiHandlers.clearHistory(req, res);
      } else {
        return this.sendMethodNotAllowed(res, ['GET', 'DELETE']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle tabs API
   */
  async handleTabs(req, res) {
    if (!this.apiHandlers.getTabs) {
      return this.sendJsonError(res, 501, 'Tabs API not implemented');
    }

    try {
      if (req.method === 'GET') {
        await this.apiHandlers.getTabs(req, res);
      } else if (req.method === 'POST') {
        await this.apiHandlers.addTab(req, res);
      } else {
        return this.sendMethodNotAllowed(res, ['GET', 'POST']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle tab by ID
   */
  async handleTabById(req, res, id) {
    if (!this.apiHandlers.deleteTab || !this.apiHandlers.setActiveTab) {
      return this.sendJsonError(res, 501, 'Tab operations not implemented');
    }

    try {
      if (id === 'active' && req.method === 'PUT') {
        await this.apiHandlers.setActiveTab(req, res);
      } else if (req.method === 'DELETE') {
        await this.apiHandlers.deleteTab(req, res, id);
      } else {
        return this.sendMethodNotAllowed(res, ['PUT', 'DELETE']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle settings API
   */
  async handleSettings(req, res) {
    if (!this.apiHandlers.getSettings) {
      return this.sendJsonError(res, 501, 'Settings API not implemented');
    }

    try {
      if (req.method === 'GET') {
        await this.apiHandlers.getSettings(req, res);
      } else if (req.method === 'PUT') {
        await this.apiHandlers.updateSettings(req, res);
      } else {
        return this.sendMethodNotAllowed(res, ['GET', 'PUT']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle search API
   */
  async handleSearch(req, res, query) {
    if (!this.apiHandlers.search) {
      return this.sendJsonError(res, 501, 'Search API not implemented');
    }

    try {
      if (req.method === 'GET') {
        await this.apiHandlers.search(req, res, query);
      } else {
        return this.sendMethodNotAllowed(res, ['GET']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle sessions API
   */
  async handleSessions(req, res) {
    if (!this.apiHandlers.getSessions) {
      return this.sendJsonError(res, 501, 'Sessions API not implemented');
    }

    try {
      if (req.method === 'GET') {
        await this.apiHandlers.getSessions(req, res);
      } else if (req.method === 'POST') {
        await this.apiHandlers.saveSession(req, res);
      } else {
        return this.sendMethodNotAllowed(res, ['GET', 'POST']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle session by ID
   */
  async handleSessionById(req, res, id, action) {
    if (!this.apiHandlers.restoreSession || !this.apiHandlers.deleteSession) {
      return this.sendJsonError(res, 501, 'Session operations not implemented');
    }

    try {
      if (action === 'restore' && req.method === 'PUT') {
        await this.apiHandlers.restoreSession(req, res, id);
      } else if (!action && req.method === 'DELETE') {
        await this.apiHandlers.deleteSession(req, res, id);
      } else {
        return this.sendMethodNotAllowed(res, ['PUT', 'DELETE']);
      }
    } catch (error) {
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(req, res) {
    if (!this.fileUploadManager) {
      return this.sendJsonError(res, 501, 'File upload not enabled');
    }

    try {
      const { createUploadMiddleware } = require('../utils/upload-middleware');
      const uploadMiddleware = createUploadMiddleware({
        maxFileSize: this.fileUploadManager.maxFileSize
      });

      await new Promise((resolve, reject) => {
        uploadMiddleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      if (!req.files || req.files.length === 0) {
        return this.sendJsonError(res, 400, 'No files uploaded');
      }

      const uploadPromises = req.files.map(async (file) => {
        try {
          return await this.fileUploadManager.saveFile(file);
        } catch (error) {
          console.error('File save error:', error);
          throw error;
        }
      });

      const results = await Promise.allSettled(uploadPromises);
      const successful = results.filter(r => r.status === 'fulfilled').map(r => r.value);
      const failed = results.filter(r => r.status === 'rejected').map(r => r.reason);

      const response = {
        message: `${successful.length} files uploaded successfully`,
        files: successful,
        errors: failed.length > 0 ? failed : undefined
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));

    } catch (error) {
      console.error('Upload error:', error);
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle file download
   */
  async handleFileDownload(req, res, filename) {
    if (!this.fileUploadManager) {
      return this.sendJsonError(res, 501, 'File operations not enabled');
    }

    try {
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename');
      }

      const fileInfo = await this.fileUploadManager.getFileInfo(filename);
      if (!fileInfo) {
        return this.sendJsonError(res, 404, 'File not found');
      }

      const fs = require('fs');
      const fileStream = fs.createReadStream(fileInfo.path);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': fileInfo.size
      });
      fileStream.pipe(res);

    } catch (error) {
      console.error('Download error:', error);
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle file list
   */
  async handleFileList(req, res) {
    if (!this.fileUploadManager) {
      return this.sendJsonError(res, 501, 'File operations not enabled');
    }

    try {
      const query = req.query || {};
      const options = {
        extension: typeof query.extension === 'string' ? query.extension : undefined,
        limit: typeof query.limit === 'string' ? parseInt(query.limit, 10) : undefined
      };

      const files = await this.fileUploadManager.listFiles(options);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files }));

    } catch (error) {
      console.error('File list error:', error);
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle file delete
   */
  async handleFileDelete(req, res, filename) {
    if (!this.fileUploadManager) {
      return this.sendJsonError(res, 501, 'File operations not enabled');
    }

    try {
      if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename');
      }

      const deleted = await this.fileUploadManager.deleteFile(filename);

      if (deleted) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'File deleted successfully' }));
      } else {
        return this.sendJsonError(res, 404, 'File not found');
      }

    } catch (error) {
      console.error('Delete error:', error);
      return this.sendJsonError(res, 500, error.message);
    }

    return true;
  }

  /**
   * Handle billing routes
   */
  async handleBillingRoutes(req, res, pathname) {
    // Placeholder for billing routes - would need StripeService integration
    return this.sendJsonError(res, 501, 'Billing API not implemented');
  }

  /**
   * Handle data export
   */
  async handleDataExport(req, res) {
    try {
      // Parse request body for export options
      const body = await this.parseRequestBody(req);
      const userId = this.getUserIdFromRequest(req); // You'd need to implement this

      if (!userId) {
        return this.sendJsonError(res, 401, 'Authentication required');
      }

      const exportResult = await this.dataExportImport.exportData(userId, body);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(exportResult));

    } catch (error) {
      console.error('Export error:', error);
      return this.sendJsonError(res, 500, error.message);
    }
  }

  /**
   * Handle data import
   */
  async handleDataImport(req, res) {
    try {
      // For file uploads, we'd need to handle multipart data
      // This is a simplified version - you'd need to integrate with file upload handling
      const userId = this.getUserIdFromRequest(req);

      if (!userId) {
        return this.sendJsonError(res, 401, 'Authentication required');
      }

      // This would need to be implemented with proper file upload handling
      return this.sendJsonError(res, 501, 'Import via file upload not implemented yet');

    } catch (error) {
      console.error('Import error:', error);
      return this.sendJsonError(res, 500, error.message);
    }
  }

  /**
   * Handle list exports
   */
  async handleListExports(req, res) {
    try {
      const userId = this.getUserIdFromRequest(req);

      if (!userId) {
        return this.sendJsonError(res, 401, 'Authentication required');
      }

      const exports = await this.dataExportImport.listExports(userId);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ exports }));

    } catch (error) {
      console.error('List exports error:', error);
      return this.sendJsonError(res, 500, error.message);
    }
  }

  /**
   * Handle delete export
   */
  async handleDeleteExport(req, res, exportId) {
    try {
      const userId = this.getUserIdFromRequest(req);

      if (!userId) {
        return this.sendJsonError(res, 401, 'Authentication required');
      }

      const deleted = await this.dataExportImport.deleteExport(exportId);

      if (deleted) {
        res.writeHead(204);
        res.end();
      } else {
        return this.sendJsonError(res, 404, 'Export not found');
      }

    } catch (error) {
      console.error('Delete export error:', error);
      return this.sendJsonError(res, 500, error.message);
    }
  }

  /**
   * Send JSON error response
   */
  sendJsonError(res, statusCode, message, extraData = {}) {
    const response = {
      error: message,
      ...extraData
    };

    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(response));
    return true;
  }

  /**
   * Send method not allowed response
   */
  sendMethodNotAllowed(res, allowedMethods) {
    res.writeHead(405, {
      'Content-Type': 'application/json',
      'Allow': allowedMethods.join(', ')
    });
    res.end(JSON.stringify({
      error: 'Method Not Allowed',
      allowed: allowedMethods
    }));
    return true;
  }
}

module.exports = {
  APIHandlers
};
