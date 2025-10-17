/**
 * Zstandard (Zstd) Compression Manager
 *
 * Based on 2025 research: Zstandard is the future of web compression
 *
 * Key Performance Benefits (2025 research):
 * - 42% faster compression than Brotli
 * - Nearly equivalent compression ratio to Brotli
 * - 11.3% smaller files than GZIP
 * - Extremely fast decompression
 * - Real-time application friendly
 *
 * Browser Support (2025):
 * - Chrome 123+ (March 2024)
 * - Cloudflare full support (2025)
 * - Enterprise and pay-as-you-go plans
 * - Free plans (October 2024+)
 *
 * Use Cases:
 * - High compression ratios with fast decompression
 * - Real-time applications
 * - Static asset compression
 * - Server-to-server communication
 * - API responses
 *
 * Comparison (2025 data):
 * - Zstd: Fast compression, fast decompression, good ratio
 * - Brotli: Slower compression, good decompression, best ratio
 * - GZIP: Fast compression, fast decompression, moderate ratio
 *
 * @see https://peazip.github.io/fast-compression-benchmark-brotli-zstandard.html
 * @see https://paulcalvano.com/2024-03-19-choosing-between-gzip-brotli-and-zstandard-compression/
 * @see https://blog.cloudflare.com/new-standards/
 */

const EventEmitter = require('events');
const zlib = require('zlib');

class ZstandardCompression extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Compression levels
      // Zstd: 1-22 (default: 3)
      // Brotli: 0-11 (default: 4)
      // GZIP: 1-9 (default: 6)
      zstdLevel: options.zstdLevel || 3,
      brotliLevel: options.brotliLevel || 4,
      gzipLevel: options.gzipLevel || 6,

      // Algorithm selection
      preferredAlgorithm: options.preferredAlgorithm || 'auto', // auto, zstd, brotli, gzip

      // Minimum size to compress
      minSize: options.minSize || 1024, // 1KB

      // Content types to compress
      compressibleTypes: options.compressibleTypes || [
        'text/html',
        'text/css',
        'text/javascript',
        'application/javascript',
        'application/json',
        'application/xml',
        'text/xml',
        'text/plain',
        'image/svg+xml'
      ],

      // Enable caching
      enableCache: options.enableCache !== false,
      cacheSize: options.cacheSize || 100, // Cache 100 compressed responses
      cacheTTL: options.cacheTTL || 3600000, // 1 hour

      // Performance optimization
      enableStreaming: options.enableStreaming !== false,

      // Fallback strategy
      fallbackOrder: options.fallbackOrder || ['zstd', 'brotli', 'gzip', 'identity'],

      ...options
    };

    // Compression cache
    this.cache = new Map();

    // Statistics
    this.stats = {
      totalRequests: 0,
      compressed: 0,
      uncompressed: 0,
      zstdCompressed: 0,
      brotliCompressed: 0,
      gzipCompressed: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      avgCompressionTime: 0,
      totalCompressionTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };

    // Compression algorithms metadata
    this.algorithms = {
      zstd: {
        name: 'zstd',
        encoding: 'zstd',
        level: this.options.zstdLevel,
        minLevel: 1,
        maxLevel: 22,
        defaultLevel: 3,
        available: this.checkZstdAvailability(),
        compressionSpeed: 'fast', // 42% faster than Brotli
        decompressionSpeed: 'very-fast',
        ratio: 'good' // Nearly equivalent to Brotli
      },
      brotli: {
        name: 'brotli',
        encoding: 'br',
        level: this.options.brotliLevel,
        minLevel: 0,
        maxLevel: 11,
        defaultLevel: 4,
        available: true, // Native in Node.js
        compressionSpeed: 'slow',
        decompressionSpeed: 'good',
        ratio: 'best'
      },
      gzip: {
        name: 'gzip',
        encoding: 'gzip',
        level: this.options.gzipLevel,
        minLevel: 1,
        maxLevel: 9,
        defaultLevel: 6,
        available: true, // Native in Node.js
        compressionSpeed: 'fast',
        decompressionSpeed: 'fast',
        ratio: 'moderate'
      }
    };
  }

  /**
   * Create middleware for compression
   */
  createMiddleware() {
    return async (req, res, next) => {
      this.stats.totalRequests++;

      // Store original methods
      const originalWrite = res.write;
      const originalEnd = res.end;
      const originalWriteHead = res.writeHead;

      // Buffer for response body
      let chunks = [];
      let writtenHeaders = false;

      // Override writeHead to intercept headers
      res.writeHead = (...args) => {
        writtenHeaders = true;
        return originalWriteHead.apply(res, args);
      };

      // Override write to capture chunks
      res.write = (chunk, encoding) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }
        return true;
      };

      // Override end to compress and send
      res.end = async (chunk, encoding) => {
        if (chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
        }

        const body = Buffer.concat(chunks);

        // Determine if should compress
        if (this.shouldCompress(req, res, body)) {
          try {
            const result = await this.compress(body, req, res);

            // Set compressed headers
            if (!writtenHeaders) {
              res.setHeader('Content-Encoding', result.encoding);
              res.setHeader('Vary', 'Accept-Encoding');
              res.setHeader('Content-Length', result.compressed.length);

              // Add compression info header
              res.setHeader('X-Compression-Algorithm', result.algorithm);
              res.setHeader('X-Compression-Ratio',
                (result.originalSize / result.compressedSize).toFixed(2));
            }

            // Send compressed data
            originalWrite.call(res, result.compressed);
            originalEnd.call(res);

            this.stats.compressed++;
            this.updateCompressionStats(result);

            this.emit('compressed', {
              algorithm: result.algorithm,
              originalSize: result.originalSize,
              compressedSize: result.compressedSize,
              ratio: result.ratio,
              time: result.time
            });

          } catch (error) {
            // Fallback to uncompressed
            this.emit('compressionError', { error, path: req.url });

            originalWrite.call(res, body);
            originalEnd.call(res);

            this.stats.uncompressed++;
          }
        } else {
          // Send uncompressed
          originalWrite.call(res, body);
          originalEnd.call(res);

          this.stats.uncompressed++;
        }
      };

      next();
    };
  }

  /**
   * Determine if response should be compressed
   */
  shouldCompress(req, res, body) {
    // Check if already compressed
    if (res.getHeader('Content-Encoding')) {
      return false;
    }

    // Check minimum size
    if (body.length < this.options.minSize) {
      return false;
    }

    // Check content type
    const contentType = res.getHeader('Content-Type');
    if (!contentType) return false;

    const isCompressible = this.options.compressibleTypes.some(type =>
      contentType.toLowerCase().includes(type)
    );

    if (!isCompressible) return false;

    // Check client support
    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding) return false;

    return true;
  }

  /**
   * Compress data with best algorithm
   */
  async compress(data, req, res) {
    const startTime = Date.now();

    // Check cache
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(data, req);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.options.cacheTTL) {
        this.stats.cacheHits++;

        return {
          ...cached,
          time: Date.now() - startTime
        };
      }

      this.stats.cacheMisses++;
    }

    // Select compression algorithm
    const algorithm = this.selectAlgorithm(req);

    // Compress data
    let compressed;

    switch (algorithm) {
      case 'zstd':
        compressed = await this.compressZstd(data);
        this.stats.zstdCompressed++;
        break;

      case 'brotli':
        compressed = await this.compressBrotli(data);
        this.stats.brotliCompressed++;
        break;

      case 'gzip':
        compressed = await this.compressGzip(data);
        this.stats.gzipCompressed++;
        break;

      default:
        throw new Error(`Unknown compression algorithm: ${algorithm}`);
    }

    const time = Date.now() - startTime;

    const result = {
      algorithm,
      encoding: this.algorithms[algorithm].encoding,
      originalSize: data.length,
      compressedSize: compressed.length,
      compressed,
      ratio: (1 - compressed.length / data.length) * 100,
      time,
      timestamp: Date.now()
    };

    // Cache result
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(data, req);
      this.cache.set(cacheKey, result);

      // Cleanup old cache entries
      if (this.cache.size > this.options.cacheSize) {
        const oldestKey = this.cache.keys().next().value;
        this.cache.delete(oldestKey);
      }
    }

    return result;
  }

  /**
   * Select best compression algorithm
   */
  selectAlgorithm(req) {
    const acceptEncoding = (req.headers['accept-encoding'] || '').toLowerCase();

    // Auto mode: Select based on client support and performance
    if (this.options.preferredAlgorithm === 'auto') {
      // Try algorithms in fallback order
      for (const algo of this.options.fallbackOrder) {
        if (algo === 'identity') continue;

        const algorithm = this.algorithms[algo];
        if (!algorithm || !algorithm.available) continue;

        // Check client support
        if (acceptEncoding.includes(algorithm.encoding)) {
          return algo;
        }
      }

      return 'identity'; // No compression
    }

    // Explicit algorithm
    const algorithm = this.algorithms[this.options.preferredAlgorithm];

    if (!algorithm || !algorithm.available) {
      throw new Error(`Algorithm not available: ${this.options.preferredAlgorithm}`);
    }

    if (!acceptEncoding.includes(algorithm.encoding)) {
      throw new Error(`Client doesn't support: ${algorithm.encoding}`);
    }

    return this.options.preferredAlgorithm;
  }

  /**
   * Compress with Zstandard
   */
  async compressZstd(data) {
    // In production: Use @mongodb-js/zstd or zstd-codec
    // const zstd = require('@mongodb-js/zstd');
    // return await zstd.compress(data, this.options.zstdLevel);

    // Fallback to Brotli (similar compression ratio, available natively)
    // Zstd: 42% faster, nearly equivalent ratio
    return await this.compressBrotli(data);
  }

  /**
   * Compress with Brotli
   */
  async compressBrotli(data) {
    return new Promise((resolve, reject) => {
      zlib.brotliCompress(data, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.brotliLevel
        }
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Compress with GZIP
   */
  async compressGzip(data) {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, {
        level: this.options.gzipLevel
      }, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Decompress data
   */
  async decompress(data, encoding) {
    switch (encoding) {
      case 'zstd':
        return await this.decompressZstd(data);

      case 'br':
        return await this.decompressBrotli(data);

      case 'gzip':
        return await this.decompressGzip(data);

      default:
        throw new Error(`Unknown encoding: ${encoding}`);
    }
  }

  /**
   * Decompress Zstandard
   */
  async decompressZstd(data) {
    // In production: Use @mongodb-js/zstd
    // const zstd = require('@mongodb-js/zstd');
    // return await zstd.decompress(data);

    // Fallback to Brotli
    return await this.decompressBrotli(data);
  }

  /**
   * Decompress Brotli
   */
  async decompressBrotli(data) {
    return new Promise((resolve, reject) => {
      zlib.brotliDecompress(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Decompress GZIP
   */
  async decompressGzip(data) {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (error, result) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
  }

  /**
   * Check if Zstandard is available
   */
  checkZstdAvailability() {
    try {
      // Try to require Zstd library
      // require('@mongodb-js/zstd');
      // return true;

      // Not available by default
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get cache key for request
   */
  getCacheKey(data, req) {
    // Create hash of data + URL
    const crypto = require('crypto');
    const hash = crypto.createHash('md5')
      .update(data)
      .update(req.url)
      .digest('hex');

    return hash;
  }

  /**
   * Update compression statistics
   */
  updateCompressionStats(result) {
    this.stats.totalOriginalSize += result.originalSize;
    this.stats.totalCompressedSize += result.compressedSize;
    this.stats.compressionRatio =
      (1 - this.stats.totalCompressedSize / this.stats.totalOriginalSize) * 100;

    this.stats.totalCompressionTime += result.time;
    this.stats.avgCompressionTime =
      this.stats.totalCompressionTime / this.stats.compressed;
  }

  /**
   * Get compression statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      compressionRate: this.stats.totalRequests > 0
        ? this.stats.compressed / this.stats.totalRequests
        : 0,
      algorithms: {
        zstd: {
          count: this.stats.zstdCompressed,
          percentage: this.stats.compressed > 0
            ? (this.stats.zstdCompressed / this.stats.compressed) * 100
            : 0
        },
        brotli: {
          count: this.stats.brotliCompressed,
          percentage: this.stats.compressed > 0
            ? (this.stats.brotliCompressed / this.stats.compressed) * 100
            : 0
        },
        gzip: {
          count: this.stats.gzipCompressed,
          percentage: this.stats.compressed > 0
            ? (this.stats.gzipCompressed / this.stats.compressed) * 100
            : 0
        }
      },
      cacheHitRate: (this.stats.cacheHits + this.stats.cacheMisses) > 0
        ? this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)
        : 0,
      bandwidthSaved: this.stats.totalOriginalSize - this.stats.totalCompressedSize
    };
  }

  /**
   * Clear compression cache
   */
  clearCache() {
    this.cache.clear();
    this.emit('cacheCleared');
  }

  /**
   * Get algorithm information
   */
  getAlgorithmInfo(name) {
    return this.algorithms[name] || null;
  }

  /**
   * Set compression level for algorithm
   */
  setCompressionLevel(algorithm, level) {
    const algo = this.algorithms[algorithm];

    if (!algo) {
      throw new Error(`Unknown algorithm: ${algorithm}`);
    }

    if (level < algo.minLevel || level > algo.maxLevel) {
      throw new Error(`Invalid level: ${level} (range: ${algo.minLevel}-${algo.maxLevel})`);
    }

    algo.level = level;

    // Update options
    switch (algorithm) {
      case 'zstd':
        this.options.zstdLevel = level;
        break;
      case 'brotli':
        this.options.brotliLevel = level;
        break;
      case 'gzip':
        this.options.gzipLevel = level;
        break;
    }

    this.emit('levelChanged', { algorithm, level });
  }
}

module.exports = ZstandardCompression;
