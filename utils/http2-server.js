/**
 * HTTP/2 Server Support
 *
 * Implements HTTP/2 with Server Push (Improvement #164)
 * - HTTP/2 server creation
 * - Server Push for critical resources
 * - Backward compatibility with HTTP/1.1
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

let http2;
try {
  http2 = require('http2');
} catch (e) {
  console.warn('HTTP/2 module not available, falling back to HTTP/1.1');
}

/**
 * HTTP/2 configuration
 */
const DEFAULT_HTTP2_CONFIG = {
  allowHTTP1: true, // Fallback to HTTP/1.1
  maxSessionMemory: 10, // MB
  enablePush: true,
  pushPriority: {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3
  }
};

/**
 * Resources to push (critical path)
 */
const PUSH_RESOURCES = {
  '/': [
    { path: '/assets/styles/main.css', type: 'style', priority: 'critical' },
    { path: '/assets/js/app.js', type: 'script', priority: 'critical' },
    { path: '/assets/js/ui-components.js', type: 'script', priority: 'high' }
  ]
};

/**
 * Get MIME type from file extension
 *
 * @param {string} filePath - File path
 * @returns {string} MIME type
 */
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Push resource to client
 *
 * @param {Object} stream - HTTP/2 stream
 * @param {string} resourcePath - Resource path
 * @param {Object} options - Push options
 */
function pushResource(stream, resourcePath, options = {}) {
  if (!http2 || !stream.pushAllowed) {
    return;
  }

  const { basePath = '.', priority = 'medium' } = options;

  try {
    const fullPath = path.join(basePath, resourcePath);

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      return;
    }

    const stat = fs.statSync(fullPath);
    const mimeType = getMimeType(resourcePath);

    // Create push stream
    stream.pushStream(
      {
        ':path': resourcePath,
        ':method': 'GET'
      },
      {
        weight: DEFAULT_HTTP2_CONFIG.pushPriority[priority]
      },
      (err, pushStream, headers) => {
        if (err) {
          console.warn(`Failed to push ${resourcePath}:`, err.message);
          return;
        }

        // Send push response
        pushStream.respond({
          ':status': 200,
          'content-type': mimeType,
          'content-length': stat.size,
          'cache-control': 'public, max-age=31536000, immutable'
        });

        // Stream file
        const fileStream = fs.createReadStream(fullPath);
        fileStream.pipe(pushStream);

        fileStream.on('error', (error) => {
          console.warn(`Error streaming pushed resource ${resourcePath}:`, error.message);
          pushStream.close();
        });
      }
    );
  } catch (error) {
    console.warn(`Failed to push resource ${resourcePath}:`, error.message);
  }
}

/**
 * Push resources for a path
 *
 * @param {Object} stream - HTTP/2 stream
 * @param {string} requestPath - Request path
 * @param {Object} options - Options
 */
function pushResourcesForPath(stream, requestPath, options = {}) {
  const resources = PUSH_RESOURCES[requestPath];

  if (!resources || !Array.isArray(resources)) {
    return;
  }

  for (const resource of resources) {
    pushResource(stream, resource.path, {
      ...options,
      priority: resource.priority
    });
  }
}

/**
 * Create HTTP/2 server
 *
 * @param {Object} options - Server options
 * @param {Function} requestHandler - Request handler
 * @returns {Object} Server instance
 */
function createHttp2Server(options = {}, requestHandler) {
  const { cert, key, enablePush = DEFAULT_HTTP2_CONFIG.enablePush, ...http2Options } = options;

  if (!http2) {
    console.warn('HTTP/2 not available, creating HTTPS server instead');
    return https.createServer({ cert, key }, requestHandler);
  }

  const serverOptions = {
    ...DEFAULT_HTTP2_CONFIG,
    ...http2Options,
    cert,
    key
  };

  const server = http2.createSecureServer(serverOptions);

  server.on('stream', (stream, headers) => {
    const method = headers[':method'];
    const path = headers[':path'];
    const authority = headers[':authority'];

    // Push resources if enabled
    if (enablePush && method === 'GET') {
      pushResourcesForPath(stream, path, { basePath: options.basePath });
    }

    // Create pseudo-request object for compatibility
    const req = {
      method,
      url: path,
      headers: { ...headers, host: authority },
      httpVersion: '2.0',
      stream
    };

    // Create pseudo-response object
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return this.headers[name.toLowerCase()];
      },
      removeHeader(name) {
        delete this.headers[name.toLowerCase()];
      },
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        Object.assign(this.headers, headers);

        const responseHeaders = {
          ':status': statusCode,
          ...this.headers
        };

        stream.respond(responseHeaders);
      },
      write(chunk) {
        stream.write(chunk);
      },
      end(data) {
        if (data) {
          stream.end(data);
        } else {
          stream.end();
        }
      }
    };

    // Handle request
    try {
      requestHandler(req, res);
    } catch (error) {
      console.error('Request handler error:', error);
      if (!stream.headersSent) {
        stream.respond({ ':status': 500 });
      }
      stream.end();
    }
  });

  server.on('error', (error) => {
    console.error('HTTP/2 server error:', error);
  });

  return server;
}

/**
 * Create server with automatic HTTP/2 or HTTP/1.1 selection
 *
 * @param {Object} options - Server options
 * @param {Function} requestHandler - Request handler
 * @returns {Object} Server instance
 */
function createAdaptiveServer(options = {}, requestHandler) {
  const { enableHttps = false, cert, key, http2: enableHttp2 = true } = options;

  // HTTP/2 requires HTTPS
  if (enableHttp2 && enableHttps && cert && key && http2) {
    console.log('Creating HTTP/2 server');
    return createHttp2Server({ cert, key, ...options }, requestHandler);
  }

  // Fallback to HTTPS
  if (enableHttps && cert && key) {
    console.log('Creating HTTPS server');
    return https.createServer({ cert, key }, requestHandler);
  }

  // Fallback to HTTP
  console.log('Creating HTTP server');
  return http.createServer(requestHandler);
}

/**
 * Add HTTP/2 push hints to HTML
 *
 * @param {string} html - HTML content
 * @param {Array} resources - Resources to push
 * @returns {string} HTML with Link headers
 */
function addPushHints(html, resources = []) {
  if (!resources || resources.length === 0) {
    return html;
  }

  const linkTags = resources
    .map((resource) => {
      const { path, type = 'script' } = resource;
      return `<link rel="preload" href="${path}" as="${type}">`;
    })
    .join('\n');

  // Insert before </head>
  return html.replace('</head>', `${linkTags}\n</head>`);
}

/**
 * Generate Link header for HTTP/2 push
 *
 * @param {Array} resources - Resources to push
 * @returns {string} Link header value
 */
function generateLinkHeader(resources = []) {
  return resources
    .map((resource) => {
      const { path, type = 'script' } = resource;
      return `<${path}>; rel=preload; as=${type}`;
    })
    .join(', ');
}

/**
 * Check if client supports HTTP/2
 *
 * @param {Object} req - Request object
 * @returns {boolean} Support status
 */
function supportsHttp2(req) {
  return req.httpVersion === '2.0' || req.httpVersionMajor === 2;
}

/**
 * Register push resource
 *
 * @param {string} requestPath - Request path
 * @param {Array} resources - Resources to push
 */
function registerPushResources(requestPath, resources) {
  PUSH_RESOURCES[requestPath] = resources;
}

module.exports = {
  createHttp2Server,
  createAdaptiveServer,
  pushResource,
  pushResourcesForPath,
  addPushHints,
  generateLinkHeader,
  supportsHttp2,
  registerPushResources,
  DEFAULT_HTTP2_CONFIG,
  PUSH_RESOURCES
};
