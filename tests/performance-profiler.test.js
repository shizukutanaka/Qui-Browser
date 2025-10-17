/**
 * Performance Profiler Tests
 * Comprehensive test suite for performance profiling system
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  PerformanceProfiler,
  getProfiler,
  profile,
  createProfilingMiddleware
} = require('../utils/performance-profiler');

describe('PerformanceProfiler', () => {
  let profiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler({
      enabled: true,
      sampleInterval: 100,
      maxSamples: 1000
    });
  });

  describe('Timing Measurements', () => {
    it('should start and end measurements', () => {
      profiler.start('test-operation');

      // Simulate work
      const sum = Array(1000).fill(0).reduce((a, b, i) => a + i, 0);

      const duration = profiler.end('test-operation');

      assert.ok(duration >= 0);
      assert.strictEqual(typeof duration, 'number');
    });

    it('should return 0 for unknown measurement', () => {
      const duration = profiler.end('non-existent');
      assert.strictEqual(duration, 0);
    });

    it('should track multiple measurements', () => {
      profiler.start('op1');
      profiler.start('op2');

      profiler.end('op1');
      profiler.end('op2');

      assert.ok(profiler.timings.has('op1'));
      assert.ok(profiler.timings.has('op2'));
    });

    it('should allow same name multiple times', () => {
      profiler.start('operation');
      profiler.end('operation');

      profiler.start('operation');
      profiler.end('operation');

      const timings = profiler.timings.get('operation');
      assert.strictEqual(timings.length, 2);
    });

    it('should record memory usage with timing', () => {
      profiler.start('operation');
      profiler.end('operation');

      const timings = profiler.timings.get('operation');
      assert.ok(timings[0].memory);
      assert.ok(timings[0].memory.heapUsed);
      assert.ok(timings[0].memory.heapTotal);
    });

    it('should limit stored timings', () => {
      const smallProfiler = new PerformanceProfiler({ maxSamples: 5 });

      for (let i = 0; i < 10; i++) {
        smallProfiler.start('operation');
        smallProfiler.end('operation');
      }

      const timings = smallProfiler.timings.get('operation');
      assert.strictEqual(timings.length, 5);
    });

    it('should do nothing when disabled', () => {
      const disabled = new PerformanceProfiler({ enabled: false });

      disabled.start('operation');
      const duration = disabled.end('operation');

      assert.strictEqual(duration, 0);
      assert.strictEqual(disabled.timings.size, 0);
    });
  });

  describe('Measure Function', () => {
    it('should measure async function execution', async () => {
      const fn = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'result';
      };

      const result = await profiler.measure('async-op', fn);

      assert.strictEqual(result, 'result');
      assert.ok(profiler.timings.has('async-op'));
    });

    it('should measure sync function execution', async () => {
      const fn = () => {
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += i;
        }
        return sum;
      };

      const result = await profiler.measure('sync-op', fn);

      assert.ok(result > 0);
      assert.ok(profiler.timings.has('sync-op'));
    });

    it('should handle errors in measured functions', async () => {
      const fn = async () => {
        throw new Error('Test error');
      };

      await assert.rejects(
        async () => await profiler.measure('error-op', fn),
        { message: 'Test error' }
      );

      // Should still record timing
      assert.ok(profiler.timings.has('error-op'));
    });

    it('should work when disabled', async () => {
      const disabled = new PerformanceProfiler({ enabled: false });

      const fn = async () => 'result';

      const result = await disabled.measure('operation', fn);

      assert.strictEqual(result, 'result');
      assert.strictEqual(disabled.timings.size, 0);
    });
  });

  describe('Metrics Recording', () => {
    it('should record metrics', () => {
      profiler.recordMetric('cpu-usage', 45.5);
      profiler.recordMetric('memory-usage', 128);

      assert.ok(profiler.metrics.has('cpu-usage'));
      assert.ok(profiler.metrics.has('memory-usage'));
    });

    it('should record metrics with tags', () => {
      profiler.recordMetric('http-request', 150, {
        method: 'GET',
        path: '/api/users'
      });

      const metrics = profiler.metrics.get('http-request');
      assert.strictEqual(metrics[0].value, 150);
      assert.deepStrictEqual(metrics[0].tags, { method: 'GET', path: '/api/users' });
    });

    it('should track multiple metric values', () => {
      profiler.recordMetric('response-time', 100);
      profiler.recordMetric('response-time', 150);
      profiler.recordMetric('response-time', 200);

      const metrics = profiler.metrics.get('response-time');
      assert.strictEqual(metrics.length, 3);
    });

    it('should limit stored metrics', () => {
      const smallProfiler = new PerformanceProfiler({ maxSamples: 5 });

      for (let i = 0; i < 10; i++) {
        smallProfiler.recordMetric('metric', i);
      }

      const metrics = smallProfiler.metrics.get('metric');
      assert.strictEqual(metrics.length, 5);
    });
  });

  describe('Performance Sampling', () => {
    it('should take performance samples', () => {
      const sample = profiler.takeSample();

      assert.ok(sample);
      assert.ok(sample.timestamp);
      assert.ok(sample.memory);
      assert.ok(sample.cpu);
      assert.ok(typeof sample.uptime === 'number');
    });

    it('should track samples', () => {
      profiler.takeSample();
      profiler.takeSample();
      profiler.takeSample();

      assert.strictEqual(profiler.samples.length, 3);
    });

    it('should limit stored samples', () => {
      const smallProfiler = new PerformanceProfiler({ maxSamples: 5 });

      for (let i = 0; i < 10; i++) {
        smallProfiler.takeSample();
      }

      assert.strictEqual(smallProfiler.samples.length, 5);
    });

    it('should return null when disabled', () => {
      const disabled = new PerformanceProfiler({ enabled: false });

      const sample = disabled.takeSample();
      assert.strictEqual(sample, null);
    });
  });

  describe('Timing Statistics', () => {
    it('should calculate timing statistics', () => {
      profiler.start('operation');
      profiler.end('operation');

      const stats = profiler.getTimingStats('operation');

      assert.ok(stats);
      assert.strictEqual(stats.name, 'operation');
      assert.strictEqual(stats.count, 1);
      assert.ok(stats.min >= 0);
      assert.ok(stats.max >= 0);
      assert.ok(stats.mean >= 0);
    });

    it('should calculate percentiles', () => {
      for (let i = 0; i < 100; i++) {
        profiler.start('operation');
        profiler.end('operation');
      }

      const stats = profiler.getTimingStats('operation');

      assert.ok(stats.median >= 0);
      assert.ok(stats.p95 >= 0);
      assert.ok(stats.p99 >= 0);
      assert.ok(stats.p99 >= stats.p95);
      assert.ok(stats.p95 >= stats.median);
    });

    it('should return null for non-existent measurement', () => {
      const stats = profiler.getTimingStats('non-existent');
      assert.strictEqual(stats, null);
    });

    it('should get all timing stats', () => {
      profiler.start('op1');
      profiler.end('op1');

      profiler.start('op2');
      profiler.end('op2');

      const allStats = profiler.getAllTimingStats();

      assert.strictEqual(allStats.length, 2);
      assert.ok(allStats.every(s => s.name && s.count > 0));
    });

    it('should sort stats by mean descending', () => {
      // Create operations with different durations
      profiler.start('fast');
      profiler.end('fast');

      profiler.start('slow');
      const slowWork = Array(10000).fill(0).reduce((a, b, i) => a + i, 0);
      profiler.end('slow');

      const allStats = profiler.getAllTimingStats();

      // First should be slowest
      assert.ok(allStats[0].mean >= allStats[1].mean);
    });
  });

  describe('Metric Statistics', () => {
    it('should calculate metric statistics', () => {
      profiler.recordMetric('response-time', 100);
      profiler.recordMetric('response-time', 150);
      profiler.recordMetric('response-time', 200);

      const stats = profiler.getMetricStats('response-time');

      assert.strictEqual(stats.name, 'response-time');
      assert.strictEqual(stats.count, 3);
      assert.strictEqual(stats.min, 100);
      assert.strictEqual(stats.max, 200);
      assert.strictEqual(stats.mean, 150);
      assert.strictEqual(stats.latest, 200);
    });

    it('should return null for non-existent metric', () => {
      const stats = profiler.getMetricStats('non-existent');
      assert.strictEqual(stats, null);
    });
  });

  describe('Memory Statistics', () => {
    it('should calculate memory statistics', () => {
      profiler.takeSample();
      profiler.takeSample();
      profiler.takeSample();

      const stats = profiler.getMemoryStats();

      assert.ok(stats);
      assert.ok(stats.heapUsed);
      assert.ok(stats.heapTotal);
      assert.ok(stats.external);
      assert.ok(stats.heapUsed.current > 0);
    });

    it('should return null with no samples', () => {
      const stats = profiler.getMemoryStats();
      assert.strictEqual(stats, null);
    });

    it('should track min/max/mean memory', () => {
      for (let i = 0; i < 10; i++) {
        profiler.takeSample();
      }

      const stats = profiler.getMemoryStats();

      assert.ok(stats.heapUsed.min > 0);
      assert.ok(stats.heapUsed.max >= stats.heapUsed.min);
      assert.ok(stats.heapUsed.mean > 0);
    });
  });

  describe('Bottleneck Detection', () => {
    it('should detect bottlenecks', async () => {
      // Fast operation
      await profiler.measure('fast-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Slow operation (bottleneck)
      await profiler.measure('slow-op', async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      const bottlenecks = profiler.detectBottlenecks(100);

      assert.ok(bottlenecks.length > 0);
      assert.strictEqual(bottlenecks[0].name, 'slow-op');
    });

    it('should use custom threshold', async () => {
      await profiler.measure('operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      const bottlenecks = profiler.detectBottlenecks(30);

      assert.ok(bottlenecks.length > 0);
    });

    it('should sort bottlenecks by p95 descending', async () => {
      await profiler.measure('slow', async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
      });

      await profiler.measure('medium', async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      const bottlenecks = profiler.detectBottlenecks(100);

      assert.ok(bottlenecks[0].p95 >= bottlenecks[1].p95);
    });
  });

  describe('Report Generation', () => {
    it('should generate performance report', async () => {
      await profiler.measure('operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      profiler.takeSample();

      const report = profiler.generateReport();

      assert.ok(report);
      assert.ok(report.uptime > 0);
      assert.ok(Array.isArray(report.timings));
      assert.ok(report.memory);
      assert.ok(Array.isArray(report.bottlenecks));
      assert.ok(report.timestamp);
    });

    it('should export report as JSON', () => {
      profiler.takeSample();

      const json = profiler.exportReport();

      assert.strictEqual(typeof json, 'string');

      const parsed = JSON.parse(json);
      assert.ok(parsed.uptime);
      assert.ok(parsed.timestamp);
    });

    it('should include all report sections', async () => {
      await profiler.measure('operation', async () => 'result');
      profiler.recordMetric('custom-metric', 42);
      profiler.takeSample();

      const report = profiler.generateReport();

      assert.ok(report.timings.length > 0);
      assert.ok(report.memory);
      assert.strictEqual(report.sampleCount, 1);
    });
  });

  describe('Clear Data', () => {
    it('should clear all data', async () => {
      await profiler.measure('operation', async () => 'result');
      profiler.recordMetric('metric', 100);
      profiler.takeSample();

      profiler.clear();

      assert.strictEqual(profiler.timings.size, 0);
      assert.strictEqual(profiler.metrics.size, 0);
      assert.strictEqual(profiler.samples.length, 0);
      assert.strictEqual(profiler.marks.size, 0);
    });
  });

  describe('Enable/Disable', () => {
    it('should enable profiling', () => {
      profiler.disable();
      profiler.enable();

      profiler.start('operation');
      const duration = profiler.end('operation');

      assert.ok(duration > 0);
    });

    it('should disable profiling', () => {
      profiler.disable();

      profiler.start('operation');
      const duration = profiler.end('operation');

      assert.strictEqual(duration, 0);
    });

    it('should toggle enabled state', () => {
      assert.strictEqual(profiler.enabled, true);

      profiler.disable();
      assert.strictEqual(profiler.enabled, false);

      profiler.enable();
      assert.strictEqual(profiler.enabled, true);
    });
  });
});

describe('Global Profiler', () => {
  it('should get global profiler instance', () => {
    const profiler1 = getProfiler();
    const profiler2 = getProfiler();

    assert.strictEqual(profiler1, profiler2);
  });

  it('should create profiler if not exists', () => {
    const profiler = getProfiler();

    assert.ok(profiler instanceof PerformanceProfiler);
  });
});

describe('Profiling Middleware', () => {
  let profiler;

  beforeEach(() => {
    profiler = new PerformanceProfiler();
  });

  it('should create profiling middleware', () => {
    const middleware = createProfilingMiddleware(profiler);

    assert.strictEqual(typeof middleware, 'function');
  });

  it('should profile requests', (t, done) => {
    const middleware = createProfilingMiddleware(profiler);

    const req = {
      method: 'GET',
      path: '/api/users'
    };

    const res = {
      on: (event, handler) => {
        if (event === 'finish') {
          // Simulate response finish
          setTimeout(() => {
            handler();

            // Check profiling data
            const route = 'GET /api/users';
            assert.ok(profiler.timings.has(route));

            done();
          }, 10);
        }
      }
    };

    const next = () => {};

    middleware(req, res, next);
  });

  it('should record request duration metric', (t, done) => {
    const middleware = createProfilingMiddleware(profiler);

    const req = {
      method: 'POST',
      path: '/api/posts'
    };

    const res = {
      statusCode: 201,
      on: (event, handler) => {
        if (event === 'finish') {
          setTimeout(() => {
            handler();

            assert.ok(profiler.metrics.has('http_request_duration'));

            const metrics = profiler.metrics.get('http_request_duration');
            assert.ok(metrics.length > 0);
            assert.strictEqual(metrics[0].tags.method, 'POST');
            assert.strictEqual(metrics[0].tags.path, '/api/posts');
            assert.strictEqual(metrics[0].tags.status, 201);

            done();
          }, 10);
        }
      }
    };

    const next = () => {};

    middleware(req, res, next);
  });

  it('should call next middleware', () => {
    const middleware = createProfilingMiddleware(profiler);

    const req = { method: 'GET', path: '/' };
    const res = { on: () => {} };

    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    middleware(req, res, next);

    assert.strictEqual(nextCalled, true);
  });

  it('should profile different routes separately', (t, done) => {
    const middleware = createProfilingMiddleware(profiler);

    let finishCount = 0;

    const makeRequest = (method, path) => {
      const req = { method, path };
      const res = {
        on: (event, handler) => {
          if (event === 'finish') {
            setTimeout(() => {
              handler();
              finishCount++;

              if (finishCount === 2) {
                assert.ok(profiler.timings.has('GET /users'));
                assert.ok(profiler.timings.has('POST /posts'));
                done();
              }
            }, 10);
          }
        }
      };

      middleware(req, res, () => {});
    };

    makeRequest('GET', '/users');
    makeRequest('POST', '/posts');
  });
});
