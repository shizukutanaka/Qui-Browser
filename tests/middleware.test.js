/**
 * Middleware System Tests
 */

const test = require('node:test');
const assert = require('node:assert');
const { MiddlewareManager, CommonMiddleware } = require('../core/middleware');

test('MiddlewareManager - basic instantiation', () => {
  const middleware = new MiddlewareManager();
  assert.ok(middleware);
  assert.strictEqual(middleware.beforeMiddlewares.length, 0);
  assert.strictEqual(middleware.afterMiddlewares.length, 0);
  assert.strictEqual(middleware.errorMiddlewares.length, 0);
});

test('MiddlewareManager - register before middleware', () => {
  const middleware = new MiddlewareManager();

  const fn = async (req, res, next) => {
    await next();
  };

  middleware.before(fn, { name: 'test' });

  assert.strictEqual(middleware.beforeMiddlewares.length, 1);
  assert.strictEqual(middleware.beforeMiddlewares[0].name, 'test');
});

test('MiddlewareManager - register after middleware', () => {
  const middleware = new MiddlewareManager();

  const fn = async (req, res, result, next) => {
    await next();
  };

  middleware.after(fn, { name: 'test' });

  assert.strictEqual(middleware.afterMiddlewares.length, 1);
  assert.strictEqual(middleware.afterMiddlewares[0].name, 'test');
});

test('MiddlewareManager - register error middleware', () => {
  const middleware = new MiddlewareManager();

  const fn = async (_error, _req, _res, _next) => {
    // Handle error
  };

  middleware.error(fn, { name: 'errorHandler' });

  assert.strictEqual(middleware.errorMiddlewares.length, 1);
  assert.strictEqual(middleware.errorMiddlewares[0].name, 'errorHandler');
});

test('MiddlewareManager - priority ordering', () => {
  const middleware = new MiddlewareManager();

  middleware.before((_req, _res, _next) => {}, { name: 'low', priority: 10 });
  middleware.before((_req, _res, _next) => {}, { name: 'high', priority: 100 });
  middleware.before((_req, _res, _next) => {}, { name: 'medium', priority: 50 });

  assert.strictEqual(middleware.beforeMiddlewares[0].name, 'high');
  assert.strictEqual(middleware.beforeMiddlewares[1].name, 'medium');
  assert.strictEqual(middleware.beforeMiddlewares[2].name, 'low');
});

test('MiddlewareManager - execute before middleware chain', async () => {
  const middleware = new MiddlewareManager();
  const executionOrder = [];

  middleware.before(
    async (req, res, next) => {
      executionOrder.push('first');
      await next();
    },
    { name: 'first', priority: 100 }
  );

  middleware.before(
    async (req, res, next) => {
      executionOrder.push('second');
      await next();
    },
    { name: 'second', priority: 50 }
  );

  const req = {};
  const res = {};

  await middleware.executeBefore(req, res);

  assert.deepStrictEqual(executionOrder, ['first', 'second']);
});

test('MiddlewareManager - execute after middleware chain', async () => {
  const middleware = new MiddlewareManager();
  const executionOrder = [];

  middleware.after(
    async (req, res, result, next) => {
      executionOrder.push('after1');
      await next();
    },
    { name: 'after1' }
  );

  middleware.after(
    async (req, res, result, next) => {
      executionOrder.push('after2');
      await next();
    },
    { name: 'after2' }
  );

  const req = {};
  const res = {};
  const result = { success: true };

  await middleware.executeAfter(req, res, result);

  assert.deepStrictEqual(executionOrder, ['after1', 'after2']);
});

test('MiddlewareManager - middleware can modify request', async () => {
  const middleware = new MiddlewareManager();

  middleware.before(async (req, res, next) => {
    req.modified = true;
    await next();
  });

  const req = {};
  const res = {};

  await middleware.executeBefore(req, res);

  assert.strictEqual(req.modified, true);
});

test('MiddlewareManager - middleware chain stops if next not called', async () => {
  const middleware = new MiddlewareManager();
  const executionOrder = [];

  middleware.before(
    async (_req, _res, _next) => {
      executionOrder.push('first');
      // Don't call next() - chain should stop
    },
    { priority: 100 }
  );

  middleware.before(
    async (_req, _res, next) => {
      executionOrder.push('second');
      await next();
    },
    { priority: 50 }
  );

  const req = {};
  const res = {};

  await middleware.executeBefore(req, res);

  // Only first middleware should execute
  assert.deepStrictEqual(executionOrder, ['first']);
});

test('MiddlewareManager - error handling middleware', async () => {
  const middleware = new MiddlewareManager();
  let errorHandled = false;

  middleware.error(async (error, _req, _res, _next) => {
    errorHandled = true;
    assert.strictEqual(error.message, 'Test error');
  });

  const error = new Error('Test error');
  const req = {};
  const res = {};

  await middleware.executeError(error, req, res);

  assert.strictEqual(errorHandled, true);
});

test('MiddlewareManager - get stats', () => {
  const middleware = new MiddlewareManager();

  middleware.before(() => {}, { name: 'before1' });
  middleware.before(() => {}, { name: 'before2' });
  middleware.after(() => {}, { name: 'after1' });
  middleware.error(() => {}, { name: 'error1' });

  const stats = middleware.getStats();

  assert.strictEqual(stats.before, 2);
  assert.strictEqual(stats.after, 1);
  assert.strictEqual(stats.error, 1);
  assert.strictEqual(stats.total, 4);
});

test('MiddlewareManager - clear all middleware', () => {
  const middleware = new MiddlewareManager();

  middleware.before(() => {});
  middleware.after(() => {});
  middleware.error(() => {});

  middleware.clear();

  assert.strictEqual(middleware.beforeMiddlewares.length, 0);
  assert.strictEqual(middleware.afterMiddlewares.length, 0);
  assert.strictEqual(middleware.errorMiddlewares.length, 0);
});

test('MiddlewareManager - remove specific middleware', () => {
  const middleware = new MiddlewareManager();

  middleware.before(() => {}, { name: 'test1' });
  middleware.before(() => {}, { name: 'test2' });

  const removed = middleware.remove('test1', 'before');

  assert.strictEqual(removed, true);
  assert.strictEqual(middleware.beforeMiddlewares.length, 1);
  assert.strictEqual(middleware.beforeMiddlewares[0].name, 'test2');
});

test('MiddlewareManager - type validation', () => {
  const middleware = new MiddlewareManager();

  assert.throws(() => {
    middleware.before('not a function');
  }, TypeError);

  assert.throws(() => {
    middleware.after(123);
  }, TypeError);

  assert.throws(() => {
    middleware.error({});
  }, TypeError);
});

test('CommonMiddleware - logger', async () => {
  const logger = CommonMiddleware.logger({ verbose: false });

  const req = { method: 'GET', url: '/test' };
  const res = {};
  let nextCalled = false;

  await logger(req, res, async () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.ok(req._middlewareStartTime);
});

test('CommonMiddleware - timing', async () => {
  const timing = CommonMiddleware.timing();

  const req = { _middlewareStartTime: Date.now() };
  const res = {
    setHeader: (key, value) => {
      res[key] = value;
    }
  };
  let nextCalled = false;

  await timing(req, res, null, async () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.ok(res['X-Response-Time']);
  assert.ok(res['X-Response-Time'].endsWith('ms'));
});

test('CommonMiddleware - securityHeaders', async () => {
  const security = CommonMiddleware.securityHeaders({
    'X-Custom': 'value'
  });

  const req = {};
  const res = {
    headers: {},
    setHeader: (key, value) => {
      res.headers[key] = value;
    }
  };
  let nextCalled = false;

  await security(req, res, async () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.strictEqual(res.headers['X-Frame-Options'], 'DENY');
  assert.strictEqual(res.headers['X-Custom'], 'value');
});

test('CommonMiddleware - cors', async () => {
  const cors = CommonMiddleware.cors({
    origin: 'https://example.com',
    methods: 'GET,POST'
  });

  const req = { method: 'GET' };
  const res = {
    headers: {},
    setHeader: (key, value) => {
      res.headers[key] = value;
    }
  };
  let nextCalled = false;

  await cors(req, res, async () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res.headers['Access-Control-Allow-Origin'], 'https://example.com');
  assert.strictEqual(res.headers['Access-Control-Allow-Methods'], 'GET,POST');
});

test('CommonMiddleware - cors OPTIONS handling', async () => {
  const cors = CommonMiddleware.cors();

  const req = { method: 'OPTIONS' };
  const res = {
    headers: {},
    writeHead: status => {
      res.statusCode = status;
    },
    setHeader: (key, value) => {
      res.headers[key] = value;
    },
    end: () => {
      res.ended = true;
    }
  };

  await cors(req, res, async () => {
    // Should not be called for OPTIONS
  });

  assert.strictEqual(res.statusCode, 204);
  assert.strictEqual(res.ended, true);
});

console.log('✅ All middleware tests completed');
