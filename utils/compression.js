/**
 * Compression Utilities
 *
 * Brotli/Gzipによる自動圧縮サポート
 * Accept-Encodingヘッダーに基づいて最適な圧縮形式を選択
 *
 * @module utils/compression
 */

const zlib = require('zlib');
const { promisify } = require('util');

const brotliCompress = promisify(zlib.brotliCompress);
const gzipCompress = promisify(zlib.gzip);

/**
 * 圧縮可能なMIMEタイプ
 * テキストベースのコンテンツのみ圧縮対象
 */
const COMPRESSIBLE_TYPES = new Set([
  'text/html',
  'text/css',
  'text/plain',
  'text/xml',
  'application/javascript',
  'application/json',
  'application/xml',
  'application/xhtml+xml',
  'application/rss+xml',
  'application/atom+xml',
  'image/svg+xml',
  'font/woff',
  'font/woff2'
]);

/**
 * 圧縮レベル設定 (VR用: 低レイテンシ優先)
 */
const COMPRESSION_LEVELS = {
  brotli: {
    [zlib.constants.BROTLI_PARAM_MODE]: zlib.constants.BROTLI_MODE_TEXT,
    [zlib.constants.BROTLI_PARAM_QUALITY]: 3, // VR用: 3=低レイテンシ (従来4)
    [zlib.constants.BROTLI_PARAM_SIZE_HINT]: 0
  },
  gzip: {
    level: 6 // VR用: 6=高速 (従来-1=デフォルト9)
  }
};

/**
 * MIMEタイプが圧縮可能かチェック
 *
 * @param {string} mimeType - Content-Type
 * @returns {boolean} 圧縮可能ならtrue
 */
function isCompressible(mimeType) {
  if (!mimeType) {
    return false;
  }

  // charset部分を削除
  const baseType = mimeType.split(';')[0].trim().toLowerCase();

  return COMPRESSIBLE_TYPES.has(baseType) || baseType.startsWith('text/');
}

/**
 * Accept-Encodingヘッダーから最適な圧縮形式を決定
 *
 * 優先順位: br (Brotli) > gzip > identity (無圧縮)
 *
 * @param {string} acceptEncoding - Accept-Encodingヘッダー値
 * @returns {string} 'br' | 'gzip' | 'identity'
 */
function negotiateEncoding(acceptEncoding) {
  if (!acceptEncoding) {
    return 'identity';
  }

  const encodings = acceptEncoding.toLowerCase();

  // Brotliが利用可能なら最優先
  if (encodings.includes('br')) {
    return 'br';
  }

  // 次にGzip
  if (encodings.includes('gzip')) {
    return 'gzip';
  }

  // どちらも利用不可なら無圧縮
  return 'identity';
}

/**
 * データを圧縮
 *
 * @param {Buffer} data - 圧縮するデータ
 * @param {string} encoding - 'br' | 'gzip' | 'identity'
 * @returns {Promise<Buffer>} 圧縮済みデータ
 */
async function compress(data, encoding) {
  if (encoding === 'br') {
    return await brotliCompress(data, COMPRESSION_LEVELS.brotli);
  } else if (encoding === 'gzip') {
    return await gzipCompress(data, COMPRESSION_LEVELS.gzip);
  } else {
    // identity (無圧縮)
    return data;
  }
}

/**
 * 圧縮すべきかの総合判定
 *
 * 以下の条件を全て満たす場合のみ圧縮:
 * - MIMEタイプが圧縮可能
 * - データサイズが最小閾値以上
 * - クライアントが圧縮をサポート
 *
 * @param {Buffer} data - データ
 * @param {string} mimeType - Content-Type
 * @param {string} acceptEncoding - Accept-Encodingヘッダー
 * @param {Object} options - オプション
 * @param {number} [options.minSize=860] - 圧縮する最小サイズ (bytes)
 * @returns {boolean}
 */
function shouldCompress(data, mimeType, acceptEncoding, options = {}) {
  const minSize = options.minSize || 860; // Ethernet MTU以下は圧縮効果薄い

  if (!data || data.length < minSize) {
    return false;
  }

  if (!isCompressible(mimeType)) {
    return false;
  }

  const encoding = negotiateEncoding(acceptEncoding);
  return encoding !== 'identity';
}

/**
 * リクエストに対して最適な圧縮を適用
 *
 * @param {Buffer} data - 元データ
 * @param {string} mimeType - Content-Type
 * @param {string} acceptEncoding - Accept-Encodingヘッダー
 * @param {Object} options - オプション
 * @returns {Promise<{data: Buffer, encoding: string}>}
 */
async function compressResponse(data, mimeType, acceptEncoding, options = {}) {
  if (!shouldCompress(data, mimeType, acceptEncoding, options)) {
    return { data, encoding: 'identity' };
  }

  const encoding = negotiateEncoding(acceptEncoding);
  const compressedData = await compress(data, encoding);

  return {
    data: compressedData,
    encoding
  };
}

module.exports = {
  isCompressible,
  negotiateEncoding,
  compress,
  shouldCompress,
  compressResponse,
  COMPRESSIBLE_TYPES,
  COMPRESSION_LEVELS
};
