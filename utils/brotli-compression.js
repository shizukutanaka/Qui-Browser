/**
 * Brotli Compression Module
 *
 * 高効率なBrotli圧縮を提供し、帯域幅を20-30%削減します。
 * Node.js標準のzlibモジュールを使用（追加依存なし）。
 *
 * 特徴:
 * - Gzipより20-30%小さいサイズ
 * - Accept-Encodingヘッダーに基づく自動選択
 * - メモリ効率的なストリーミング圧縮
 * - 圧縮結果のキャッシング
 * - 品質レベルの動的調整
 *
 * @module utils/brotli-compression
 */

const zlib = require('zlib');
const { promisify } = require('util');
const crypto = require('crypto');

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

/**
 * Brotli圧縮マネージャークラス
 */
class BrotliCompression {
  /**
   * コンストラクタ
   * @param {Object} options - 設定オプション
   * @param {number} [options.level=6] - 圧縮品質レベル (0-11, デフォルト: 6)
   * @param {number} [options.threshold=1024] - 圧縮を適用する最小サイズ (バイト)
   * @param {boolean} [options.enableCache=true] - 圧縮結果のキャッシュを有効化
   * @param {number} [options.maxCacheSize=100] - キャッシュの最大エントリ数
   * @param {number} [options.cacheTTL=3600000] - キャッシュのTTL (ミリ秒、デフォルト: 1時間)
   */
  constructor(options = {}) {
    this.level = options.level || zlib.constants.BROTLI_DEFAULT_QUALITY; // 6がデフォルト
    this.threshold = options.threshold || 1024; // 1KB
    this.enableCache = options.enableCache !== false;
    this.maxCacheSize = options.maxCacheSize || 100;
    this.cacheTTL = options.cacheTTL || 3600000; // 1時間

    // 圧縮結果のキャッシュ
    this.cache = new Map();

    // 統計情報
    this.stats = {
      totalRequests: 0,
      brotliCompressed: 0,
      gzipCompressed: 0,
      uncompressed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesOriginal: 0,
      bytesBrotli: 0,
      bytesGzip: 0
    };

    // 定期的なキャッシュクリーンアップ
    this.startCacheCleanup();
  }

  /**
   * データを圧縮（自動エンコーディング選択）
   * @param {Buffer|string} data - 圧縮するデータ
   * @param {string} acceptEncoding - Accept-Encodingヘッダーの値
   * @param {Object} options - 圧縮オプション
   * @returns {Promise<Object>} 圧縮結果 { data: Buffer, encoding: string, originalSize: number, compressedSize: number }
   */
  async compress(data, acceptEncoding = '', options = {}) {
    this.stats.totalRequests++;

    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const originalSize = buffer.length;
    this.stats.bytesOriginal += originalSize;

    // 小さいデータは圧縮しない
    if (originalSize < this.threshold) {
      this.stats.uncompressed++;
      return {
        data: buffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0
      };
    }

    // エンコーディング選択
    const encoding = this.selectEncoding(acceptEncoding);

    if (encoding === 'identity') {
      this.stats.uncompressed++;
      return {
        data: buffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0
      };
    }

    // キャッシュチェック
    const cacheKey = this.generateCacheKey(buffer, encoding);
    if (this.enableCache && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTTL) {
        this.stats.cacheHits++;
        return {
          data: cached.data,
          encoding: cached.encoding,
          originalSize,
          compressedSize: cached.data.length,
          compressionRatio: originalSize / cached.data.length,
          fromCache: true
        };
      } else {
        // 期限切れキャッシュを削除
        this.cache.delete(cacheKey);
      }
    }

    this.stats.cacheMisses++;

    // 圧縮実行
    let compressed;
    const quality = options.quality || this.level;

    try {
      if (encoding === 'br') {
        compressed = await this.compressBrotli(buffer, quality);
        this.stats.brotliCompressed++;
        this.stats.bytesBrotli += compressed.length;
      } else if (encoding === 'gzip') {
        compressed = await this.compressGzip(buffer, quality);
        this.stats.gzipCompressed++;
        this.stats.bytesGzip += compressed.length;
      }

      // キャッシュに保存
      if (this.enableCache && compressed) {
        this.addToCache(cacheKey, compressed, encoding);
      }

      return {
        data: compressed,
        encoding,
        originalSize,
        compressedSize: compressed.length,
        compressionRatio: originalSize / compressed.length,
        fromCache: false
      };

    } catch (error) {
      console.error(`Compression failed (${encoding}):`, error.message);
      // フォールバック: 圧縮なし
      this.stats.uncompressed++;
      return {
        data: buffer,
        encoding: 'identity',
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1.0,
        error: error.message
      };
    }
  }

  /**
   * Brotli圧縮を実行
   * @param {Buffer} buffer - 圧縮するデータ
   * @param {number} quality - 圧縮品質 (0-11)
   * @returns {Promise<Buffer>} 圧縮されたデータ
   */
  async compressBrotli(buffer, quality) {
    return await brotliCompress(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
        [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length
      }
    });
  }

  /**
   * Gzip圧縮を実行
   * @param {Buffer} buffer - 圧縮するデータ
   * @param {number} level - 圧縮レベル (0-9)
   * @returns {Promise<Buffer>} 圧縮されたデータ
   */
  async compressGzip(buffer, level) {
    return await gzipCompress(buffer, {
      level: Math.min(9, level) // Gzipは0-9
    });
  }

  /**
   * ストリーム圧縮を作成
   * @param {string} encoding - エンコーディング ('br', 'gzip', 'identity')
   * @param {Object} options - 圧縮オプション
   * @returns {stream.Transform|null} 圧縮ストリーム
   */
  createCompressionStream(encoding, options = {}) {
    const quality = options.quality || this.level;

    if (encoding === 'br') {
      return zlib.createBrotliCompress({
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: quality,
          [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT
        }
      });
    } else if (encoding === 'gzip') {
      return zlib.createGzip({
        level: Math.min(9, quality)
      });
    }

    return null;
  }

  /**
   * エンコーディングを選択
   * @param {string} acceptEncoding - Accept-Encodingヘッダーの値
   * @returns {string} 選択されたエンコーディング ('br', 'gzip', 'identity')
   */
  selectEncoding(acceptEncoding) {
    if (!acceptEncoding) {
      return 'identity';
    }

    const encodings = acceptEncoding.toLowerCase();

    // Brotli優先（最も効率的）
    if (encodings.includes('br')) {
      return 'br';
    }

    // Gzipフォールバック
    if (encodings.includes('gzip')) {
      return 'gzip';
    }

    // 圧縮なし
    return 'identity';
  }

  /**
   * 圧縮すべきかを判定
   * @param {number} contentLength - コンテンツのサイズ
   * @param {string} contentType - コンテンツタイプ
   * @returns {boolean} 圧縮すべきならtrue
   */
  shouldCompress(contentLength, contentType) {
    // サイズチェック
    if (contentLength < this.threshold) {
      return false;
    }

    // コンテンツタイプチェック
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/xhtml+xml',
      'application/rss+xml',
      'application/atom+xml',
      'image/svg+xml',
      'application/wasm' // WebAssemblyも圧縮可能
    ];

    return compressibleTypes.some(type => contentType?.includes(type));
  }

  /**
   * キャッシュキーを生成
   * @param {Buffer} data - データ
   * @param {string} encoding - エンコーディング
   * @returns {string} キャッシュキー
   */
  generateCacheKey(data, encoding) {
    const hash = crypto.createHash('md5').update(data).digest('hex');
    return `${encoding}:${hash}`;
  }

  /**
   * キャッシュに追加
   * @param {string} key - キャッシュキー
   * @param {Buffer} data - 圧縮データ
   * @param {string} encoding - エンコーディング
   */
  addToCache(key, data, encoding) {
    // キャッシュサイズ制限
    if (this.cache.size >= this.maxCacheSize) {
      // LRU: 最も古いエントリを削除
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      encoding,
      timestamp: Date.now()
    });
  }

  /**
   * 統計情報を取得
   * @returns {Object} 統計情報
   */
  getStats() {
    const brotliSavings = this.stats.bytesOriginal > 0
      ? ((this.stats.bytesOriginal - this.stats.bytesBrotli) / this.stats.bytesOriginal * 100).toFixed(2)
      : 0;

    const gzipSavings = this.stats.bytesOriginal > 0
      ? ((this.stats.bytesOriginal - this.stats.bytesGzip) / this.stats.bytesOriginal * 100).toFixed(2)
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      brotliCompressed: this.stats.brotliCompressed,
      gzipCompressed: this.stats.gzipCompressed,
      uncompressed: this.stats.uncompressed,
      cacheHits: this.stats.cacheHits,
      cacheMisses: this.stats.cacheMisses,
      cacheHitRate: this.stats.totalRequests > 0
        ? (this.stats.cacheHits / this.stats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      bytesOriginal: this.stats.bytesOriginal,
      bytesBrotli: this.stats.bytesBrotli,
      bytesGzip: this.stats.bytesGzip,
      brotliSavings: brotliSavings + '%',
      gzipSavings: gzipSavings + '%',
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * 統計情報をリセット
   */
  resetStats() {
    this.stats = {
      totalRequests: 0,
      brotliCompressed: 0,
      gzipCompressed: 0,
      uncompressed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      bytesOriginal: 0,
      bytesBrotli: 0,
      bytesGzip: 0
    };
  }

  /**
   * キャッシュをクリア
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 定期的なキャッシュクリーンアップを開始
   */
  startCacheCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let deletedCount = 0;

      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.cacheTTL) {
          this.cache.delete(key);
          deletedCount++;
        }
      }

      if (deletedCount > 0) {
        console.log(`[BrotliCompression] Cleaned up ${deletedCount} expired cache entries`);
      }
    }, 300000); // 5分ごと

    // プロセス終了時にクリーンアップタイマーを停止
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * クリーンアップタイマーを停止
   */
  stopCacheCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * インスタンスを破棄
   */
  destroy() {
    this.stopCacheCleanup();
    this.clearCache();
  }
}

/**
 * Express/Connect用のミドルウェアを作成
 * @param {Object} options - BrotliCompressionのオプション
 * @returns {Function} ミドルウェア関数
 */
function createCompressionMiddleware(options = {}) {
  const compressor = new BrotliCompression(options);

  return async (req, res, next) => {
    // リクエストメソッドチェック
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }

    // Accept-Encodingヘッダー取得
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const encoding = compressor.selectEncoding(acceptEncoding);

    // 圧縮不要
    if (encoding === 'identity') {
      return next();
    }

    // 元のres.endをラップ
    const originalEnd = res.end;
    const chunks = [];

    res.write = function(chunk, encoding) {
      if (chunk) {
        chunks.push(Buffer.from(chunk, encoding));
      }
      return true;
    };

    res.end = async function(chunk, encoding) {
      if (chunk) {
        chunks.push(Buffer.from(chunk, encoding));
      }

      const buffer = Buffer.concat(chunks);
      const contentType = res.getHeader('content-type');

      // 圧縮判定
      if (!compressor.shouldCompress(buffer.length, contentType)) {
        res.write = originalEnd;
        return originalEnd.call(res, buffer);
      }

      try {
        const result = await compressor.compress(buffer, acceptEncoding);

        res.setHeader('Content-Encoding', result.encoding);
        res.setHeader('Content-Length', result.compressedSize);
        res.setHeader('Vary', 'Accept-Encoding');

        // 圧縮情報をヘッダーに追加（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
          res.setHeader('X-Original-Size', result.originalSize);
          res.setHeader('X-Compressed-Size', result.compressedSize);
          res.setHeader('X-Compression-Ratio', result.compressionRatio.toFixed(2));
        }

        res.write = originalEnd;
        return originalEnd.call(res, result.data);

      } catch (error) {
        console.error('[BrotliCompression] Middleware error:', error);
        res.write = originalEnd;
        return originalEnd.call(res, buffer);
      }
    };

    next();
  };
}

module.exports = {
  BrotliCompression,
  createCompressionMiddleware
};
