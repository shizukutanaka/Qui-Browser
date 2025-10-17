/**
 * Multipart form data parser middleware for file uploads
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Writable } = require('stream');

class MultipartParser extends Writable {
  constructor(options = {}) {
    super(options);
    this.boundary = options.boundary;
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB
    this.uploadDir = options.uploadDir || path.join(__dirname, '..', 'uploads', 'temp');
    this.files = [];
    this.currentFile = null;
    this.buffer = Buffer.alloc(0);
    this.state = 'boundary';
  }

  _write(chunk, encoding, callback) {
    try {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.parseBuffer();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _final(callback) {
    try {
      this.finalizeParsing();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  parseBuffer() {
    while (this.buffer.length > 0) {
      switch (this.state) {
        case 'boundary':
          this.parseBoundary();
          break;
        case 'headers':
          this.parseHeaders();
          break;
        case 'data':
          this.parseData();
          break;
        case 'end':
          return;
      }
    }
  }

  parseBoundary() {
    const boundaryStr = `--${this.boundary}`;
    const boundaryIndex = this.buffer.indexOf(boundaryStr);

    if (boundaryIndex === -1) {
      return; // Need more data
    }

    // Check for end boundary
    const endBoundaryIndex = this.buffer.indexOf(`${boundaryStr}--`);
    if (endBoundaryIndex !== -1) {
      this.state = 'end';
      this.buffer = this.buffer.slice(endBoundaryIndex + boundaryStr.length + 2);
      return;
    }

    // Remove boundary and CRLF
    this.buffer = this.buffer.slice(boundaryIndex + boundaryStr.length + 2);
    this.state = 'headers';
    this.currentFile = {
      fieldname: '',
      originalname: '',
      encoding: '',
      mimetype: '',
      size: 0,
      buffer: Buffer.alloc(0),
      path: ''
    };
  }

  parseHeaders() {
    const headerEndIndex = this.buffer.indexOf('\r\n\r\n');

    if (headerEndIndex === -1) {
      return; // Need more data
    }

    const headersStr = this.buffer.slice(0, headerEndIndex).toString('utf8');
    const headers = this.parseHeadersString(headersStr);

    // Parse Content-Disposition
    const contentDisposition = headers['content-disposition'] || '';
    const fieldMatch = contentDisposition.match(/name="([^"]+)"/);
    const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);

    if (fieldMatch) {
      this.currentFile.fieldname = fieldMatch[1];
    }
    if (filenameMatch) {
      this.currentFile.originalname = filenameMatch[1];
    }

    this.currentFile.mimetype = headers['content-type'] || 'application/octet-stream';

    this.buffer = this.buffer.slice(headerEndIndex + 4);
    this.state = 'data';
  }

  parseHeadersString(headersStr) {
    const headers = {};
    const lines = headersStr.split('\r\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const name = line.slice(0, colonIndex).toLowerCase().trim();
        const value = line.slice(colonIndex + 1).trim();
        headers[name] = value;
      }
    }

    return headers;
  }

  parseData() {
    const boundaryStr = `\r\n--${this.boundary}`;
    const boundaryIndex = this.buffer.indexOf(boundaryStr);

    if (boundaryIndex === -1) {
      // No boundary found, accumulate all data
      if (this.currentFile.size + this.buffer.length > this.maxFileSize) {
        throw new Error('File size limit exceeded');
      }
      this.currentFile.buffer = Buffer.concat([this.currentFile.buffer, this.buffer]);
      this.currentFile.size += this.buffer.length;
      this.buffer = Buffer.alloc(0);
      return;
    }

    // Found boundary, extract data up to boundary
    const data = this.buffer.slice(0, boundaryIndex);
    if (this.currentFile.size + data.length > this.maxFileSize) {
      throw new Error('File size limit exceeded');
    }

    this.currentFile.buffer = Buffer.concat([this.currentFile.buffer, data]);
    this.currentFile.size += data.length;

    // Save file to temp location if it has content
    if (this.currentFile.size > 0) {
      this.saveTempFile();
      this.files.push(this.currentFile);
    }

    this.buffer = this.buffer.slice(boundaryIndex);
    this.state = 'boundary';
  }

  saveTempFile() {
    const tempName = crypto.randomBytes(16).toString('hex');
    const tempPath = path.join(this.uploadDir, tempName);

    try {
      fs.writeFileSync(tempPath, this.currentFile.buffer);
      this.currentFile.path = tempPath;
    } catch (error) {
      console.error('Failed to save temp file:', error);
      throw new Error('Failed to save uploaded file');
    }
  }

  finalizeParsing() {
    if (this.currentFile && this.currentFile.size > 0) {
      this.saveTempFile();
      this.files.push(this.currentFile);
    }
  }
}

/**
 * Create multer-like middleware for file uploads
 * @param {Object} options
 * @returns {Function}
 */
function createUploadMiddleware(options = {}) {
  return async (req, res, next) => {
    try {
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) {
        return next();
      }

      const boundaryMatch = contentType.match(/boundary=([^;]+)/);
      if (!boundaryMatch) {
        throw new Error('Invalid multipart form data');
      }

      const boundary = boundaryMatch[1];
      const parser = new MultipartParser({
        boundary,
        maxFileSize: options.maxFileSize,
        uploadDir: options.uploadDir
      });

      req.files = [];
      req.body = {};

      // Parse the request body
      await new Promise((resolve, reject) => {
        parser.on('error', reject);
        parser.on('finish', () => {
          req.files = parser.files;
          resolve();
        });

        req.pipe(parser);
      });

      next();
    } catch (error) {
      console.error('Upload middleware error:', error);
      res.statusCode = 400;
      res.end(JSON.stringify({ error: error.message }));
    }
  };
}

module.exports = {
  MultipartParser,
  createUploadMiddleware
};
