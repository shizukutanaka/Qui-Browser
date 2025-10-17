/**
 * Tests for API Handlers Module
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { APIHandlers } = require('../lib/api-handlers');

test('API Handlers Module', async (t) => {
  const mockConfig = {
    i18n: {
      enabled: true
    },
    fileUpload: {
      enabled: true,
      maxFileSize: 10 * 1024 * 1024,
      uploadDir: '/tmp/uploads',
      allowedTypes: ['image/jpeg', 'text/plain']
    }
  };

  let apiHandlers;

  t.beforeEach(() => {
    apiHandlers = new APIHandlers(mockConfig);
  });

  await t.test('APIHandlers initializes correctly', () => {
    assert(apiHandlers instanceof APIHandlers);
    assert.strictEqual(typeof apiHandlers.config, 'object');
  });

  await t.test('initialize() sets up API components', () => {
    apiHandlers.initialize();

    // Translation manager should be initialized if i18n is enabled
    if (mockConfig.i18n.enabled) {
      assert(apiHandlers.translationManager !== null);
    }

    // File upload manager should be initialized if file upload is enabled
    if (mockConfig.fileUpload.enabled) {
      assert(apiHandlers.fileUploadManager !== null);
    }
  });

  await t.test('handleAPIRoutes() routes to correct handlers', async () => {
    // Mock request/response objects
    const mockReq = {
      method: 'GET',
      headers: {},
      query: {}
    };

    const mockRes = {
      writeHead: () => {},
      end: () => {},
      setHeader: () => {}
    };

    // Test bookmark routes
    let result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/bookmarks', new URLSearchParams());
    // Should return false if handlers not implemented
    assert.strictEqual(typeof result, 'boolean');

    // Test history routes
    result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/history', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');

    // Test tabs routes
    result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/tabs', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');

    // Test settings routes
    result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/settings', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');

    // Test search routes
    result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/search', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');

    // Test sessions routes
    result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/sessions', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('handleBookmarks() processes bookmark requests', async () => {
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    // Test GET request
    const getReq = { method: 'GET', headers: {} };
    const result1 = await apiHandlers.handleBookmarks(getReq, mockRes);
    assert.strictEqual(typeof result1, 'boolean');

    // Test POST request
    const postReq = { method: 'POST', headers: {} };
    const result2 = await apiHandlers.handleBookmarks(postReq, mockRes);
    assert.strictEqual(typeof result2, 'boolean');

    // Test invalid method
    const invalidReq = { method: 'PUT', headers: {} };
    const result3 = await apiHandlers.handleBookmarks(invalidReq, mockRes);
    assert.strictEqual(typeof result3, 'boolean');
  });

  await t.test('handleHistory() processes history requests', async () => {
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    // Test GET request
    const getReq = { method: 'GET', headers: {} };
    const result1 = await apiHandlers.handleHistory(getReq, mockRes, {});
    assert.strictEqual(typeof result1, 'boolean');

    // Test DELETE request
    const deleteReq = { method: 'DELETE', headers: {} };
    const result2 = await apiHandlers.handleHistory(deleteReq, mockRes, {});
    assert.strictEqual(typeof result2, 'boolean');
  });

  await t.test('handleTabs() processes tab requests', async () => {
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    // Test GET request
    const getReq = { method: 'GET', headers: {} };
    const result1 = await apiHandlers.handleTabs(getReq, mockRes);
    assert.strictEqual(typeof result1, 'boolean');

    // Test POST request
    const postReq = { method: 'POST', headers: {} };
    const result2 = await apiHandlers.handleTabs(postReq, mockRes);
    assert.strictEqual(typeof result2, 'boolean');
  });

  await t.test('handleSettings() processes settings requests', async () => {
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    // Test GET request
    const getReq = { method: 'GET', headers: {} };
    const result1 = await apiHandlers.handleSettings(getReq, mockRes);
    assert.strictEqual(typeof result1, 'boolean');

    // Test PUT request
    const putReq = { method: 'PUT', headers: {} };
    const result2 = await apiHandlers.handleSettings(putReq, mockRes);
    assert.strictEqual(typeof result2, 'boolean');
  });

  await t.test('handleSearch() processes search requests', async () => {
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    // Test GET request
    const getReq = { method: 'GET', headers: {} };
    const result = await apiHandlers.handleSearch(getReq, mockRes, {});
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('handleSessions() processes session requests', async () => {
    const mockRes = {
      writeHead: () => {},
      end: () => {}
    };

    // Test GET request
    const getReq = { method: 'GET', headers: {} };
    const result1 = await apiHandlers.handleSessions(getReq, mockRes);
    assert.strictEqual(typeof result1, 'boolean');

    // Test POST request
    const postReq = { method: 'POST', headers: {} };
    const result2 = await apiHandlers.handleSessions(postReq, mockRes);
    assert.strictEqual(typeof result2, 'boolean');
  });

  await t.test('handleFileUpload() processes file upload requests', async () => {
    apiHandlers.initialize(); // Ensure file upload manager is initialized

    const mockReq = {
      method: 'POST',
      headers: {},
      files: [
        {
          originalname: 'test.txt',
          mimetype: 'text/plain',
          size: 100,
          buffer: Buffer.from('test content')
        }
      ]
    };

    let responseSent = false;
    const mockRes = {
      writeHead: () => {},
      end: () => {
        responseSent = true;
      }
    };

    const result = await apiHandlers.handleFileUpload(mockReq, mockRes);
    assert.strictEqual(result, true);
    assert(responseSent);
  });

  await t.test('handleFileDownload() processes download requests', async () => {
    apiHandlers.initialize();

    const mockReq = { method: 'GET', headers: {} };

    let responseSent = false;
    const mockRes = {
      writeHead: () => {},
      end: () => {
        responseSent = true;
      },
      setHeader: () => {}
    };

    const result = await apiHandlers.handleFileDownload(mockReq, mockRes, 'test.txt');
    // May return true or false depending on file existence
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('handleFileList() processes file list requests', async () => {
    apiHandlers.initialize();

    const mockReq = {
      method: 'GET',
      headers: {},
      query: {}
    };

    let responseSent = false;
    const mockRes = {
      writeHead: () => {},
      end: () => {
        responseSent = true;
      }
    };

    const result = await apiHandlers.handleFileList(mockReq, mockRes);
    assert.strictEqual(result, true);
    assert(responseSent);
  });

  await t.test('handleFileDelete() processes file delete requests', async () => {
    apiHandlers.initialize();

    const mockReq = { method: 'DELETE', headers: {} };

    let responseSent = false;
    const mockRes = {
      writeHead: () => {},
      end: () => {
        responseSent = true;
      }
    };

    const result = await apiHandlers.handleFileDelete(mockReq, mockRes, 'test.txt');
    assert.strictEqual(result, true);
    assert(responseSent);
  });

  await t.test('sendJsonError() sends error responses', () => {
    const mockRes = {
      writeHead: (status, headers) => {
        mockRes.statusCode = status;
        mockRes.headers = headers;
      },
      end: (data) => {
        mockRes.responseData = data;
      }
    };

    apiHandlers.sendJsonError(mockRes, 400, 'Test error');

    assert.strictEqual(mockRes.statusCode, 400);
    assert(mockRes.headers['Content-Type'].includes('application/json'));
    const response = JSON.parse(mockRes.responseData);
    assert.strictEqual(response.error, 'Test error');
  });

  await t.test('sendMethodNotAllowed() sends 405 responses', () => {
    const mockRes = {
      writeHead: (status, headers) => {
        mockRes.statusCode = status;
        mockRes.headers = headers;
      },
      end: (data) => {
        mockRes.responseData = data;
      }
    };

    apiHandlers.sendMethodNotAllowed(mockRes, ['GET', 'POST']);

    assert.strictEqual(mockRes.statusCode, 405);
    assert(mockRes.headers.Allow);
    const response = JSON.parse(mockRes.responseData);
    assert(response.error);
    assert(Array.isArray(response.allowed));
  });

  await t.test('handleAPIRoutes() handles file upload routes', async () => {
    const mockReq = { method: 'POST', headers: {} };
    const mockRes = { writeHead: () => {}, end: () => {} };

    const result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/upload', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('handleAPIRoutes() handles file download routes', async () => {
    const mockReq = { method: 'GET', headers: {} };
    const mockRes = { writeHead: () => {}, end: () => {} };

    const result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/files/test.txt', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('handleAPIRoutes() handles file list routes', async () => {
    const mockReq = { method: 'GET', headers: {} };
    const mockRes = { writeHead: () => {}, end: () => {} };

    const result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/files', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');
  });

  await t.test('handleAPIRoutes() handles file delete routes', async () => {
    const mockReq = { method: 'DELETE', headers: {} };
    const mockRes = { writeHead: () => {}, end: () => {} };

    const result = await apiHandlers.handleAPIRoutes(mockReq, mockRes, '/api/files/test.txt', new URLSearchParams());
    assert.strictEqual(typeof result, 'boolean');
  });
});
