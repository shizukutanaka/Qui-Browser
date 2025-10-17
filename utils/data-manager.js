const fs = require('fs');
const path = require('path');

/** @type {Set<BufferEncoding>} */
const SUPPORTED_ENCODINGS = new Set([
  'ascii',
  'utf8',
  'utf-8',
  'utf16le',
  'ucs2',
  'ucs-2',
  'base64',
  'base64url',
  'latin1',
  'binary',
  'hex'
]);

/**
 * @param {unknown} value
 * @returns {BufferEncoding}
 */
function normalizeEncoding(value) {
  if (typeof value === 'string') {
    const lower = /** @type {BufferEncoding} */ (value.toLowerCase());
    if (SUPPORTED_ENCODINGS.has(lower)) {
      return lower;
    }
  }
  return 'utf8';
}

/**
 * @param {unknown} error
 * @returns {NodeJS.ErrnoException & Error}
 */
function toErrnoError(error) {
  if (error instanceof Error) {
    return /** @type {NodeJS.ErrnoException & Error} */ (error);
  }
  const fallback = new Error(typeof error === 'string' ? error : 'Unknown error');
  return /** @type {NodeJS.ErrnoException & Error} */ (fallback);
}

/**
 * DataManager
 *
 * セキュアで安定したJSONストレージ操作を提供するヘルパークラス。
 * - パストラバーサル防止のためファイル名を厳格に検証
 * - 原子性を担保するため一時ファイルへ書き込んでからリネーム
 * - ファイル単位のロックで同時書き込み競合を防止
 */
class DataManager {
  constructor(options = {}) {
    this.dataDir = path.resolve(options.dataDir || path.join(__dirname, '..', 'data'));
    this.encoding = normalizeEncoding(options.encoding);
    this.indent = Number.isInteger(options.indent) ? options.indent : 2;
    this.fileLocks = new Map();

    this.ensureDataDirectory();
  }

  ensureDataDirectory() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o750 });
    }
  }

  validateFileName(fileName) {
    if (typeof fileName !== 'string') {
      throw new TypeError('fileName must be a string');
    }

    if (fileName.length === 0) {
      throw new Error('fileName must not be empty');
    }

    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new Error(`Invalid file path: ${fileName}`);
    }

    if (!/^[A-Za-z0-9._-]+\.json$/u.test(fileName)) {
      throw new Error(`Unsupported file name: ${fileName}`);
    }
  }

  resolveFilePath(fileName) {
    const filePath = path.join(this.dataDir, fileName);
    const resolved = path.resolve(filePath);

    if (!resolved.startsWith(this.dataDir)) {
      throw new Error(`Resolved path escapes data directory: ${fileName}`);
    }

    return resolved;
  }

  clone(value) {
    if (value === undefined || value === null) {
      return value;
    }

    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
  }

  async enqueue(filePath, task) {
    const previous = this.fileLocks.get(filePath) || Promise.resolve();

    /** @type {() => void} */
    let release = () => {};
    const current = new Promise(resolve => {
      release = () => resolve(undefined);
    });

    this.fileLocks.set(
      filePath,
      previous.then(() => current)
    );

    await previous;

    try {
      return await task();
    } finally {
      release();
      const chained = this.fileLocks.get(filePath);
      if (chained === current) {
        this.fileLocks.delete(filePath);
      }
    }
  }

  async read(fileName, defaultValue, options = {}) {
    this.validateFileName(fileName);
    const filePath = this.resolveFilePath(fileName);

    const validator = typeof options.validate === 'function' ? options.validate : null;

    return this.enqueue(filePath, async () => {
      try {
        const raw = await fs.promises.readFile(filePath, { encoding: this.encoding });
        const data = JSON.parse(raw);

        if (validator && !validator(data)) {
          throw new Error(`Validation failed for ${fileName}`);
        }

        return this.clone(data);
      } catch (error) {
        const err = toErrnoError(error);

        if (err.code === 'ENOENT') {
          return this.clone(defaultValue);
        }

        if (err.name === 'SyntaxError') {
          const backupPath = `${filePath}.corrupted-${Date.now()}`;
          await fs.promises.rename(filePath, backupPath).catch(() => {});
          return this.clone(defaultValue);
        }

        throw err;
      }
    });
  }

  async write(fileName, data, options = {}) {
    this.validateFileName(fileName);
    const filePath = this.resolveFilePath(fileName);

    const payload = `${JSON.stringify(data, null, options.indent ?? this.indent)}\n`;
    const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

    const mode = options.mode || 0o600;

    return this.enqueue(filePath, async () => {
      await fs.promises.mkdir(path.dirname(filePath), { recursive: true, mode: 0o750 });
      await fs.promises.writeFile(tmpPath, payload, { encoding: this.encoding, mode });
      await fs.promises.rename(tmpPath, filePath);
    });
  }

  async delete(fileName) {
    this.validateFileName(fileName);
    const filePath = this.resolveFilePath(fileName);

    return this.enqueue(filePath, async () => {
      await fs.promises.rm(filePath, { force: true });
    });
  }

  async exists(fileName) {
    this.validateFileName(fileName);
    const filePath = this.resolveFilePath(fileName);

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = DataManager;
