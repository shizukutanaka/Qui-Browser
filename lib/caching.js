/**
 * Qui Browser - Caching Module
 *
 * Advanced caching system with LRU, LFU, and TTL strategies
 */

const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');
const { AdvancedCacheManager } = require('./advanced-cache');
const { toError } = require('./middleware');

class CacheManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.fileCache = null;
    this.compressionCache = null;
    this.staticRoot = config.static.root;
    this.allowedPaths = new Set(config.static.allowedPaths);
  }

  /**
   * Initialize caching components
   */
  initialize() {
    // Initialize file cache with advanced strategies
    if (this.config.caching.fileCacheEnabled && this.config.caching.fileCacheMaxSize > 0) {
      this.fileCache = new AdvancedCacheManager({
        maxSize: this.config.caching.fileCacheMaxSize * 1024 * 1024, // Convert MB to bytes
        maxEntries: 10000, // Reasonable limit for file entries
        defaultTTL: this.config.caching.fileCacheTTL,
        evictionStrategy: 'combined', // Use combined LRU/LFU/priority strategy
        cleanupInterval: 300000 // 5 minutes
      });

      // Set up event listeners for monitoring
      this.fileCache.on('hit', (data) => {
        this.emit('fileCacheHit', data);
      });

      this.fileCache.on('miss', (data) => {
        this.emit('fileCacheMiss', data);
      });

      this.fileCache.on('eviction', (data) => {
        this.emit('fileCacheEviction', data);
      });
    }

    // Initialize compression cache
    if (this.config.caching.compressionCacheEnabled && this.config.caching.compressionCacheMaxSize > 0) {
      this.compressionCache = new AdvancedCacheManager({
        maxSize: this.config.caching.compressionCacheMaxSize * 1024 * 1024, // Convert MB to bytes
        maxEntries: 5000, // Compression cache can be smaller
        defaultTTL: this.config.caching.compressionCacheTTL,
        evictionStrategy: 'size', // Evict largest compressed items first
        cleanupInterval: Math.min(this.config.caching.compressionCacheTTL, 300000)
      });
    }
  }

  /**
   * Handle static file serving with caching
   */
  async handleStaticFile(req, res, pathname) {
    // Only handle GET/HEAD methods
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return false;
    }

    // Security validation
    if (!this.isPathAllowed(pathname)) {
      return false;
    }

    try {
      const filePath = this.resolveFilePath(pathname);
      let contentBuffer;

      if (!contentBuffer) {
        // Advanced cache check (LRU/LFU/TTL combined)
        if (this.fileCache && this.isCacheableFile(filePath)) {
          const cacheKey = `${filePath}:${await this.getFileMtime(filePath)}`;
          const cached = this.fileCache.get(cacheKey);

          if (cached) {
            contentBuffer = cached;
            this.emit('fileCacheHit', { key: cacheKey, size: cached.length });
          } else {
            this.emit('fileCacheMiss', { key: cacheKey });

            // Load and cache file
            try {
              contentBuffer = await fs.readFile(filePath);

              // Cache with priority based on file type
              const priority = this.getFilePriority(filePath);
              this.fileCache.set(cacheKey, contentBuffer, {
                ttl: this.config.caching.fileCacheTTL,
                priority
              });
            } catch (error) {
              const err = toError(error, `File read error: ${filePath}`);
              console.error(`File read error: ${filePath} - ${err.message}`);
              return false;
            }
          }
        } else {
          // Load without caching
          try {
            contentBuffer = await fs.readFile(filePath);
          } catch (error) {
            const err = toError(error, `File read error: ${filePath}`);
            console.error(`File read error: ${filePath} - ${err.message}`);
            return false;
          }
        }
      }

      // Compress file if needed and supported
      const compressedData = await this.compressIfNeeded(req, res, contentBuffer, filePath);

      // Serve file
      return this.serveFile(req, res, compressedData, filePath);

    } catch (error) {
      if (error.code === 'ENOENT') {
        return false; // File not found
      }
      throw error;
    }
  }

  /**
   * Check if path is allowed
   */
  isPathAllowed(pathname) {
    if (pathname === '/' || pathname === '') {
      return true;
    }

    for (const allowedPath of this.allowedPaths) {
      if (pathname === allowedPath || pathname.startsWith(allowedPath)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Resolve file path from pathname
   */
  resolveFilePath(pathname) {
    if (pathname === '/' || pathname === '') {
      return path.join(this.staticRoot, 'index.html');
    }

    return path.join(this.staticRoot, pathname);
  }

  /**
   * Get file modification time
   */
  async getFileMtime(filePath) {
    const stats = await fs.stat(filePath);
    return stats.mtimeMs;
  }

  /**
   * Check if file is cacheable
   */
  isCacheableFile(filePath) {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Don't cache large files
    if (stats.size > this.config.caching.fileCacheMaxFileSize) {
      return false;
    }

    // Don't cache HTML files (they change frequently)
    if (ext === '.html') {
      return false;
    }

    return true;
  }

  /**
   * Load file from disk
   */
  async loadFile(filePath) {
    const stats = await fs.stat(filePath);

    if (!stats.isFile()) {
      throw new Error('Not a file');
    }

    const buffer = await fs.readFile(filePath);

    return {
      buffer,
      stats,
      mimeType: this.getMimeType(filePath),
      size: stats.size,
      mtime: stats.mtime
    };
  }

  /**
   * Compress file if needed and supported
   */
  async compressIfNeeded(req, res, fileData, filePath) {
    const acceptsGzip = this.acceptsGzip(req);
    if (!acceptsGzip || !this.compressionCache) {
      return fileData;
    }

    const cacheKey = `${filePath}:${fileData.stats.mtimeMs}:${fileData.buffer.length}`;

    // Check compression cache
    const cached = this.compressionCache.get(cacheKey);
    if (cached) {
      return {
        ...fileData,
        buffer: cached.body,
        encoding: cached.encoding,
        compressed: true
      };
    }

    // Compress the content
    const compressed = await this.compressContent(fileData.buffer, fileData.mimeType);

    if (compressed) {
      // Cache compressed result
      this.compressionCache.set(cacheKey, {
        body: compressed.data,
        encoding: compressed.encoding,
        size: compressed.data.length
      });

      return {
        ...fileData,
        buffer: compressed.data,
        encoding: compressed.encoding,
        compressed: true
      };
    }

    return fileData;
  }

  /**
   * Check if client accepts gzip
   */
  acceptsGzip(req) {
    const header = req.headers?.['accept-encoding'];
    if (typeof header !== 'string') {
      return false;
    }
    return /\bgzip\b/i.test(header);
  }

  /**
   * Compress content
   */
  async compressContent(buffer, mimeType) {
    // Import compression utilities
    try {
      const { compressResponse, shouldCompress } = require('../utils/compression');

      if (!shouldCompress(mimeType)) {
        return null;
      }

      const result = await compressResponse(buffer, mimeType, 'gzip', {
        minSize: 1024
      });

      return result.encoding === 'gzip' ? result : null;
    } catch (error) {
      console.warn('Compression failed:', error.message);
      return null;
    }
  }

  /**
   * Serve file from cache
   */
  async serveFromCache(req, res, cachedData, cacheKey) {
    this.setCacheHeaders(res, cachedData, true);
    res.setHeader('X-Cache-Status', 'HIT');

    if (req.method === 'HEAD') {
      res.writeHead(200);
      res.end();
    } else {
      res.writeHead(200);
      res.end(cachedData.buffer);
    }

    return true;
  }

  /**
   * Serve file directly
   */
  async serveFile(req, res, fileData, filePath) {
    this.setCacheHeaders(res, fileData, false);
    res.setHeader('X-Cache-Status', 'MISS');

    if (req.method === 'HEAD') {
      res.writeHead(200);
      res.end();
    } else {
      res.writeHead(200);
      res.end(fileData.buffer);
    }

    return true;
  }

  /**
   * Set appropriate cache headers
   */
  setCacheHeaders(res, fileData, fromCache) {
    const ext = path.extname(fileData.path || '').toLowerCase();
    const isHtml = ext === '.html' || fileData.path?.endsWith('index.html');

    // Set content type
    res.setHeader('Content-Type', fileData.mimeType);

    // Set content length
    res.setHeader('Content-Length', fileData.buffer.length);

    // Set last modified
    res.setHeader('Last-Modified', fileData.mtime.toUTCString());

    // Set ETag
    const etag = this.generateETag(fileData);
    res.setHeader('ETag', etag);

    // Set cache control
    const cacheControl = isHtml ? 'public, max-age=300' : 'public, max-age=3600';
    res.setHeader('Cache-Control', cacheControl);

    // Set compression headers
    if (fileData.encoding) {
      res.setHeader('Content-Encoding', fileData.encoding);
      res.setHeader('Vary', 'Accept-Encoding');
    }

    // Set accept ranges
    res.setHeader('Accept-Ranges', 'bytes');
  }

  /**
   * Generate ETag for file
   */
  generateETag(fileData) {
    const hash = require('crypto').createHash('md5');
    hash.update(fileData.buffer);
    const contentHash = hash.digest('hex').slice(0, 8);
    const mtime = Math.floor(fileData.stats.mtimeMs / 1000);
    return `W/"${contentHash}-${mtime}"`;
  }

  /**
   * Get MIME type for file
   */
  getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webp': 'image/webp',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2'
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Get file priority for caching (higher = more important)
   */
  getFilePriority(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    // Critical files get highest priority
    if (ext === '.html' || filePath.includes('index.html')) {
      return 10;
    }

    // JavaScript and CSS are important for performance
    if (ext === '.js' || ext === '.css') {
      return 8;
    }

    // Images are moderately important
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(ext)) {
      return 6;
    }

    // Fonts are important for rendering
    if (['.woff', '.woff2', '.ttf', '.otf'].includes(ext)) {
      return 7;
    }

    // Other assets get lower priority
    return 3;
  }

  /**
   * Cleanup cache resources
   */
  cleanup() {
    if (this.fileCache) {
      this.fileCache.destroy();
      this.fileCache = null;
    }

    if (this.compressionCache) {
      this.compressionCache.destroy();
      this.compressionCache = null;
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      fileCache: {
        enabled: Boolean(this.fileCache),
        size: this.fileCache?.size || 0,
        maxSize: this.config.caching.fileCacheMaxSize
      },
      compressionCache: {
        enabled: Boolean(this.compressionCache),
        size: this.compressionCache?.size || 0,
        maxSize: this.config.caching.compressionCacheMaxSize
      }
    };
  }
}

module.exports = {
  CacheManager
};
