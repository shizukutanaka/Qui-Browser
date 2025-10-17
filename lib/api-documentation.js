/**
 * API Documentation Server
 *
 * Serves OpenAPI/Swagger documentation
 */

const fs = require('fs');
const path = require('path');

class APIDocumentationServer {
  constructor(config) {
    this.config = config;
    this.openapiSpec = null;
    this.markdownDocs = null;
  }

  /**
   * Initialize documentation server
   */
  initialize() {
    this.loadOpenAPISpec();
    this.loadMarkdownDocs();
  }

  /**
   * Load OpenAPI specification
   */
  loadOpenAPISpec() {
    try {
      const specPath = path.join(__dirname, '..', 'docs', 'api', 'openapi.json');
      const specContent = fs.readFileSync(specPath, 'utf8');
      this.openapiSpec = JSON.parse(specContent);
      console.log('OpenAPI specification loaded');
    } catch (error) {
      console.warn('Failed to load OpenAPI specification:', error.message);
    }
  }

  /**
   * Load markdown documentation
   */
  loadMarkdownDocs() {
    try {
      const docsPath = path.join(__dirname, '..', 'docs', 'api', 'README.md');
      this.markdownDocs = fs.readFileSync(docsPath, 'utf8');
      console.log('API documentation loaded');
    } catch (error) {
      console.warn('Failed to load API documentation:', error.message);
    }
  }

  /**
   * Handle API documentation requests
   */
  async handleDocsRequest(req, res, pathname) {
    const securityContext = this.createSecurityContext(req);

    // Serve OpenAPI spec
    if (pathname === '/api/docs' || pathname === '/api/docs/openapi.json') {
      if (!this.openapiSpec) {
        return this.sendError(res, 404, 'OpenAPI specification not available');
      }

      const headers = this.buildSecurityHeaders({
        ...securityContext,
        additional: { 'Content-Type': 'application/json' }
      });
      res.writeHead(200, headers);
      res.end(JSON.stringify(this.openapiSpec, null, 2));
      return true;
    }

    // Serve markdown documentation
    if (pathname === '/api/docs/README.md' || pathname === '/docs') {
      if (!this.markdownDocs) {
        return this.sendError(res, 404, 'Documentation not available');
      }

      const headers = this.buildSecurityHeaders({
        ...securityContext,
        additional: { 'Content-Type': 'text/markdown; charset=utf-8' }
      });
      res.writeHead(200, headers);
      res.end(this.markdownDocs);
      return true;
    }

    // Serve Swagger UI (basic HTML page)
    if (pathname === '/api/docs/ui' || pathname === '/docs/ui') {
      const html = this.generateSwaggerUI();
      const headers = this.buildSecurityHeaders({
        ...securityContext,
        additional: { 'Content-Type': 'text/html; charset=utf-8' }
      });
      res.writeHead(200, headers);
      res.end(html);
      return true;
    }

    return false;
  }

  /**
   * Generate basic Swagger UI HTML
   */
  generateSwaggerUI() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Qui Browser API Documentation</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.7.2/swagger-ui.css" />
    <style>
        body { margin: 0; padding: 0; }
        #swagger-ui { width: 100vw; height: 100vh; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.7.2/swagger-ui-bundle.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/api/docs/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIBundle.presets.standalone
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>`;
  }

  /**
   * Create security context
   */
  createSecurityContext(req) {
    return {
      requestOrigin: req.headers?.origin,
      requestHost: req.headers?.host,
      requestMethod: req.method,
      isTls: Boolean(req.socket?.encrypted)
    };
  }

  /**
   * Build security headers
   */
  buildSecurityHeaders(context = {}) {
    const { additional = {} } = context;

    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Access-Control-Allow-Origin': context.requestOrigin || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      ...additional
    };
  }

  /**
   * Send error response
   */
  sendError(res, statusCode, message) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff'
    };

    res.writeHead(statusCode, headers);
    res.end(JSON.stringify({ error: message }, null, 2));
  }

  /**
   * Get API documentation info
   */
  getDocsInfo() {
    return {
      available: Boolean(this.openapiSpec && this.markdownDocs),
      openapi: Boolean(this.openapiSpec),
      markdown: Boolean(this.markdownDocs),
      endpoints: {
        spec: '/api/docs/openapi.json',
        markdown: '/api/docs/README.md',
        ui: '/api/docs/ui'
      }
    };
  }
}

module.exports = APIDocumentationServer;
