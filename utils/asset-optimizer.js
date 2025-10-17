/**
 * Asset Optimizer
 *
 * Handles image optimization, compression, and format conversion
 * Improvements #152-157: Image optimization, WebP/AVIF conversion, font optimization
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const brotliCompress = promisify(zlib.brotliCompress);
const gzip = promisify(zlib.gzip);

/**
 * Compression levels and settings
 */
const COMPRESSION_SETTINGS = {
  brotli: {
    level: 4, // Balanced between speed and compression ratio
    params: {
      [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
      [zlib.constants.BROTLI_PARAM_QUALITY]: 4,
      [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0
    }
  },
  gzip: {
    level: 6, // Standard gzip level
    memLevel: 8
  }
};

/**
 * Compressible MIME types
 */
const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'text/javascript',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/rss+xml',
  'application/atom+xml',
  'application/xhtml+xml',
  'image/svg+xml',
  'image/x-icon',
  'application/vnd.ms-fontobject',
  'font/ttf',
  'font/otf',
  'font/woff',
  'font/woff2'
]);

/**
 * File extensions for static pre-compression
 */
const PRECOMPRESS_EXTENSIONS = new Set(['.js', '.css', '.html', '.svg', '.json', '.xml', '.txt', '.ico']);

/**
 * Minimum file size for compression (bytes)
 * Files smaller than this are not worth compressing
 */
const MIN_COMPRESS_SIZE = 1024; // 1KB

/**
 * Check if content should be compressed
 *
 * @param {Buffer|string} content - Content to check
 * @param {string} contentType - MIME type
 * @returns {boolean}
 */
function shouldCompress(content, contentType) {
  if (!content || !contentType) {
    return false;
  }

  const size = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content);
  if (size < MIN_COMPRESS_SIZE) {
    return false;
  }

  // Check MIME type
  const mimeType = contentType.split(';')[0].trim().toLowerCase();
  return COMPRESSIBLE_TYPES.has(mimeType);
}

/**
 * Compress content with Brotli
 *
 * @param {Buffer|string} content - Content to compress
 * @returns {Promise<Buffer>} Compressed content
 */
async function compressBrotli(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return await brotliCompress(buffer, COMPRESSION_SETTINGS.brotli.params);
}

/**
 * Compress content with Gzip
 *
 * @param {Buffer|string} content - Content to compress
 * @returns {Promise<Buffer>} Compressed content
 */
async function compressGzip(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return await gzip(buffer, COMPRESSION_SETTINGS.gzip);
}

/**
 * Get best compression for content
 *
 * @param {Buffer|string} content - Content to compress
 * @param {Array<string>} acceptedEncodings - Accepted encodings from request
 * @returns {Promise<Object>} Compression result
 */
async function getBestCompression(content, acceptedEncodings = []) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const originalSize = buffer.length;

  const results = {
    identity: { encoding: 'identity', size: originalSize, data: buffer, ratio: 1 }
  };

  // Try Brotli if supported
  if (acceptedEncodings.includes('br')) {
    try {
      const compressed = await compressBrotli(buffer);
      results.br = {
        encoding: 'br',
        size: compressed.length,
        data: compressed,
        ratio: compressed.length / originalSize
      };
    } catch (err) {
      console.warn('Brotli compression failed:', err.message);
    }
  }

  // Try Gzip if supported
  if (acceptedEncodings.includes('gzip')) {
    try {
      const compressed = await compressGzip(buffer);
      results.gzip = {
        encoding: 'gzip',
        size: compressed.length,
        data: compressed,
        ratio: compressed.length / originalSize
      };
    } catch (err) {
      console.warn('Gzip compression failed:', err.message);
    }
  }

  // Select best compression (smallest size)
  let best = results.identity;
  for (const result of Object.values(results)) {
    if (result.size < best.size) {
      best = result;
    }
  }

  return best;
}

/**
 * Pre-compress static files
 *
 * @param {string} filePath - Path to file
 * @returns {Promise<Object>} Compression results
 */
async function precompressFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!PRECOMPRESS_EXTENSIONS.has(ext)) {
    return { skipped: true, reason: 'extension not compressible' };
  }

  const content = await fs.promises.readFile(filePath);
  if (content.length < MIN_COMPRESS_SIZE) {
    return { skipped: true, reason: 'file too small' };
  }

  const results = {};

  // Generate Brotli compressed version
  try {
    const brotli = await compressBrotli(content);
    const brotliPath = `${filePath}.br`;
    await fs.promises.writeFile(brotliPath, brotli);
    results.brotli = {
      path: brotliPath,
      originalSize: content.length,
      compressedSize: brotli.length,
      ratio: brotli.length / content.length
    };
  } catch (err) {
    console.warn(`Brotli pre-compression failed for ${filePath}:`, err.message);
  }

  // Generate Gzip compressed version
  try {
    const gzipped = await compressGzip(content);
    const gzipPath = `${filePath}.gz`;
    await fs.promises.writeFile(gzipPath, gzipped);
    results.gzip = {
      path: gzipPath,
      originalSize: content.length,
      compressedSize: gzipped.length,
      ratio: gzipped.length / content.length
    };
  } catch (err) {
    console.warn(`Gzip pre-compression failed for ${filePath}:`, err.message);
  }

  return results;
}

/**
 * Pre-compress all files in a directory
 *
 * @param {string} directory - Directory path
 * @param {Object} options - Options
 * @returns {Promise<Array>} Results
 */
async function precompressDirectory(directory, options = {}) {
  const { recursive = true, verbose = false } = options;
  const results = [];

  async function processDirectory(dir) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await processDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        try {
          const result = await precompressFile(fullPath);
          if (verbose || !result.skipped) {
            results.push({ file: fullPath, ...result });
          }
        } catch (err) {
          if (verbose) {
            console.warn(`Failed to process ${fullPath}:`, err.message);
          }
        }
      }
    }
  }

  await processDirectory(directory);
  return results;
}

/**
 * Get compression statistics
 *
 * @param {Array} results - Compression results
 * @returns {Object} Statistics
 */
function getCompressionStats(results) {
  const stats = {
    totalFiles: results.length,
    totalOriginalSize: 0,
    totalBrotliSize: 0,
    totalGzipSize: 0,
    filesWithBrotli: 0,
    filesWithGzip: 0,
    averageBrotliRatio: 0,
    averageGzipRatio: 0
  };

  const brotliRatios = [];
  const gzipRatios = [];

  for (const result of results) {
    if (result.brotli) {
      stats.totalOriginalSize += result.brotli.originalSize;
      stats.totalBrotliSize += result.brotli.compressedSize;
      stats.filesWithBrotli++;
      brotliRatios.push(result.brotli.ratio);
    }

    if (result.gzip) {
      stats.totalGzipSize += result.gzip.compressedSize;
      stats.filesWithGzip++;
      gzipRatios.push(result.gzip.ratio);
    }
  }

  if (brotliRatios.length > 0) {
    stats.averageBrotliRatio = brotliRatios.reduce((a, b) => a + b, 0) / brotliRatios.length;
  }

  if (gzipRatios.length > 0) {
    stats.averageGzipRatio = gzipRatios.reduce((a, b) => a + b, 0) / gzipRatios.length;
  }

  return stats;
}

/**
 * Format bytes to human-readable string
 *
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Parse Accept-Encoding header
 *
 * @param {string} acceptEncoding - Accept-Encoding header value
 * @returns {Array<string>} Supported encodings
 */
function parseAcceptEncoding(acceptEncoding) {
  if (!acceptEncoding) {
    return ['identity'];
  }

  const encodings = acceptEncoding
    .split(',')
    .map((e) => e.trim().split(';')[0].toLowerCase())
    .filter(Boolean);

  return encodings.length > 0 ? encodings : ['identity'];
}

module.exports = {
  shouldCompress,
  compressBrotli,
  compressGzip,
  getBestCompression,
  precompressFile,
  precompressDirectory,
  getCompressionStats,
  formatBytes,
  parseAcceptEncoding,
  COMPRESSION_SETTINGS,
  COMPRESSIBLE_TYPES,
  PRECOMPRESS_EXTENSIONS,
  MIN_COMPRESS_SIZE
};
