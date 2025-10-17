const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class MediaPipeline extends EventEmitter {
  constructor(options = {}) {
    super();
    this.rootDir = path.resolve(options.rootDir || path.join(__dirname, '..', 'media'));
    this.chunkSize = options.chunkSize || 1_048_576; // 1MB
    this.allowedContentTypes = new Map(
      Object.entries({
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.m4v': 'video/x-m4v',
        '.mp3': 'audio/mpeg',
        '.aac': 'audio/aac',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg'
      })
    );
  }

  resolveMediaPath(requestPath) {
    const sanitized = path.posix.normalize(requestPath).replace(/^\/+/, '');
    if (sanitized.includes('..')) {
      throw new Error('Invalid media path');
    }
    const absolute = path.resolve(this.rootDir, sanitized);
    if (!absolute.startsWith(this.rootDir)) {
      throw new Error('Media path escapes root directory');
    }
    return absolute;
  }

  getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return this.allowedContentTypes.get(ext) || 'application/octet-stream';
  }

  async handleRangeRequest(req, res, filePath) {
    const stats = await fs.promises.stat(filePath);
    if (!stats.isFile()) {
      throw new Error('Not a media file');
    }

    const totalSize = stats.size;
    const rangeHeader = req.headers.range;

    if (!rangeHeader) {
      return this.streamFullFile(res, filePath, totalSize);
    }

    const parsed = rangeHeader.replace(/bytes=/, '').split('-');
    const start = parseInt(parsed[0], 10);
    const end = parsed[1] ? parseInt(parsed[1], 10) : Math.min(start + this.chunkSize - 1, totalSize - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || start >= totalSize || end >= totalSize || start > end) {
      res.writeHead(416, {
        'Content-Range': `bytes */${totalSize}`
      });
      res.end();
      return;
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${totalSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': this.getContentType(filePath),
      'Cache-Control': 'public, max-age=60'
    });

    stream.pipe(res);
    stream.on('error', error => {
      this.emit('error', error, filePath);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    });
  }

  async streamFullFile(res, filePath, totalSize) {
    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': this.getContentType(filePath),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=60'
    });
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', error => {
      this.emit('error', error, filePath);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end();
    });
  }
}

module.exports = MediaPipeline;
