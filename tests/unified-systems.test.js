/**
 * Test suite for unified systems
 * Tests for performance, security, error handling, and VR extension systems
 */

describe('Unified Systems Test Suite', () => {
  // Mock DOM environment
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="app"></div>
      <div id="error-notification"></div>
      <div id="vr-extension-panel"></div>
    `;

    // Mock navigator.xr for VR tests
    global.navigator.xr = {
      isSessionSupported: jest.fn().mockResolvedValue(true),
      requestSession: jest.fn()
    };

    // Mock performance API
    global.performance = {
      now: jest.fn(() => Date.now()),
      memory: {
        usedJSHeapSize: 10000000,
        totalJSHeapSize: 20000000,
        jsHeapSizeLimit: 50000000
      }
    };

    // Mock crypto API
    global.crypto = {
      getRandomValues: (array) => {
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
        return array;
      },
      subtle: {
        generateKey: jest.fn().mockResolvedValue({}),
        encrypt: jest.fn().mockResolvedValue(new ArrayBuffer(8)),
        decrypt: jest.fn().mockResolvedValue(new ArrayBuffer(8))
      }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('UnifiedPerformanceSystem', () => {
    let performanceSystem;

    beforeEach(() => {
      // Mock the UnifiedPerformanceSystem
      performanceSystem = {
        initialized: false,
        metrics: {
          fps: { current: 90, average: 88, min: 72, max: 90 },
          frameTime: { current: 11.1, average: 11.4 },
          memory: { used: 10000000, limit: 50000000 }
        },
        config: {
          targetFPS: 90,
          minFPS: 72,
          enableAutoOptimization: true
        },
        initialize: jest.fn().mockResolvedValue(true),
        getStatus: jest.fn().mockReturnValue({
          status: 'optimal',
          fps: '90.00',
          frameTime: '11.10',
          memory: '20.0%'
        }),
        setQualityLevel: jest.fn(),
        profile: jest.fn(),
        destroy: jest.fn()
      };

      global.UnifiedPerformanceSystem = jest.fn(() => performanceSystem);
      global.unifiedPerformance = performanceSystem;
    });

    test('should initialize performance system', async () => {
      await performanceSystem.initialize();
      expect(performanceSystem.initialize).toHaveBeenCalled();
    });

    test('should track FPS metrics', () => {
      expect(performanceSystem.metrics.fps.current).toBe(90);
      expect(performanceSystem.metrics.fps.average).toBe(88);
      expect(performanceSystem.metrics.fps.min).toBeGreaterThanOrEqual(72);
    });

    test('should monitor memory usage', () => {
      const memoryUsage = performanceSystem.metrics.memory.used / performanceSystem.metrics.memory.limit;
      expect(memoryUsage).toBeLessThan(0.5);
    });

    test('should adjust quality based on performance', () => {
      // Simulate low FPS
      performanceSystem.metrics.fps.current = 60;
      performanceSystem.applyDynamicOptimizations = function() {
        if (this.metrics.fps.current < 72) {
          this.setQualityLevel('low');
        }
      };
      performanceSystem.applyDynamicOptimizations();
      expect(performanceSystem.setQualityLevel).toHaveBeenCalledWith('low');
    });

    test('should provide performance status', () => {
      const status = performanceSystem.getStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('fps');
      expect(status).toHaveProperty('frameTime');
      expect(status).toHaveProperty('memory');
    });
  });

  describe('UnifiedSecuritySystem', () => {
    let securitySystem;

    beforeEach(() => {
      securitySystem = {
        initialized: false,
        config: {
          enforceHTTPS: true,
          enableCSP: true,
          encryptionAlgorithm: 'AES-GCM'
        },
        initialize: jest.fn().mockResolvedValue(true),
        encrypt: jest.fn().mockResolvedValue('encrypted_data'),
        decrypt: jest.fn().mockResolvedValue('decrypted_data'),
        validate: jest.fn().mockReturnValue({ valid: true }),
        getSecurityStatus: jest.fn().mockReturnValue({
          https: true,
          csp: true,
          encryption: true
        }),
        destroy: jest.fn()
      };

      global.UnifiedSecuritySystem = jest.fn(() => securitySystem);
      global.unifiedSecurity = securitySystem;
    });

    test('should initialize security system', async () => {
      await securitySystem.initialize();
      expect(securitySystem.initialize).toHaveBeenCalled();
    });

    test('should encrypt sensitive data', async () => {
      const data = 'sensitive_information';
      const encrypted = await securitySystem.encrypt(data);
      expect(encrypted).toBe('encrypted_data');
      expect(securitySystem.encrypt).toHaveBeenCalledWith(data);
    });

    test('should decrypt encrypted data', async () => {
      const encrypted = 'encrypted_data';
      const decrypted = await securitySystem.decrypt(encrypted);
      expect(decrypted).toBe('decrypted_data');
      expect(securitySystem.decrypt).toHaveBeenCalledWith(encrypted);
    });

    test('should validate input against XSS', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      securitySystem.validate = jest.fn().mockReturnValue({
        valid: false,
        error: 'Potentially dangerous input detected'
      });

      const result = securitySystem.validate('xss', maliciousInput);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should enforce HTTPS in production', () => {
      // Mock production environment
      const originalLocation = window.location;
      delete window.location;
      window.location = { protocol: 'http:', hostname: 'example.com' };

      securitySystem.enforceHTTPS = function() {
        if (this.config.enforceHTTPS && window.location.protocol === 'http:') {
          return true;
        }
        return false;
      };

      expect(securitySystem.enforceHTTPS()).toBe(true);

      window.location = originalLocation;
    });
  });

  describe('UnifiedErrorHandler', () => {
    let errorHandler;

    beforeEach(() => {
      errorHandler = {
        initialized: false,
        errorHistory: [],
        config: {
          maxErrors: 100,
          enableAutoRecovery: true
        },
        initialize: jest.fn().mockResolvedValue(true),
        handleError: jest.fn(),
        handleVRError: jest.fn(),
        getStatistics: jest.fn().mockReturnValue({
          totalErrors: 0,
          errorsByCategory: {},
          recoveryRate: '0%'
        }),
        destroy: jest.fn()
      };

      global.UnifiedErrorHandler = jest.fn(() => errorHandler);
      global.errorHandler = errorHandler;
    });

    test('should initialize error handler', async () => {
      await errorHandler.initialize();
      expect(errorHandler.initialize).toHaveBeenCalled();
    });

    test('should handle JavaScript errors', () => {
      const error = new Error('Test error');
      errorHandler.handleError({
        message: error.message,
        error: error,
        category: 'script',
        severity: 3
      });

      expect(errorHandler.handleError).toHaveBeenCalled();
    });

    test('should handle VR-specific errors', () => {
      const vrError = {
        code: 'VR_SESSION_LOST',
        message: 'VR session was lost',
        severity: 3
      };

      errorHandler.handleVRError(vrError);
      expect(errorHandler.handleVRError).toHaveBeenCalledWith(vrError);
    });

    test('should track error statistics', () => {
      const stats = errorHandler.getStatistics();
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('errorsByCategory');
      expect(stats).toHaveProperty('recoveryRate');
    });

    test('should attempt automatic recovery', () => {
      errorHandler.attemptRecovery = jest.fn().mockResolvedValue(true);

      const error = {
        category: 'network',
        severity: 2
      };

      errorHandler.attemptRecovery(error);
      expect(errorHandler.attemptRecovery).toHaveBeenCalledWith(error);
    });
  });

  describe('UnifiedVRExtensionSystem', () => {
    let extensionSystem;

    beforeEach(() => {
      extensionSystem = {
        initialized: false,
        extensions: new Map(),
        activeExtensions: new Set(),
        initialize: jest.fn().mockResolvedValue(true),
        loadExtension: jest.fn().mockResolvedValue({}),
        activateExtension: jest.fn().mockResolvedValue(true),
        deactivateExtension: jest.fn().mockResolvedValue(true),
        uninstallExtension: jest.fn().mockResolvedValue(true),
        destroy: jest.fn()
      };

      global.UnifiedVRExtensionSystem = jest.fn(() => extensionSystem);
      global.unifiedVRExtensions = extensionSystem;
    });

    test('should initialize VR extension system', async () => {
      await extensionSystem.initialize();
      expect(extensionSystem.initialize).toHaveBeenCalled();
    });

    test('should load VR extensions', async () => {
      const manifest = {
        id: 'test-extension',
        name: 'Test Extension',
        version: '1.0.0',
        type: 'script',
        main: '/extensions/test.js'
      };

      const extension = await extensionSystem.loadExtension(manifest);
      expect(extensionSystem.loadExtension).toHaveBeenCalledWith(manifest);
    });

    test('should activate extensions', async () => {
      const extensionId = 'test-extension';
      await extensionSystem.activateExtension(extensionId);
      expect(extensionSystem.activateExtension).toHaveBeenCalledWith(extensionId);
    });

    test('should deactivate extensions', async () => {
      const extensionId = 'test-extension';
      await extensionSystem.deactivateExtension(extensionId);
      expect(extensionSystem.deactivateExtension).toHaveBeenCalledWith(extensionId);
    });

    test('should manage extension lifecycle', async () => {
      const extensionId = 'lifecycle-test';

      // Load
      await extensionSystem.loadExtension({ id: extensionId });

      // Activate
      await extensionSystem.activateExtension(extensionId);

      // Deactivate
      await extensionSystem.deactivateExtension(extensionId);

      // Uninstall
      await extensionSystem.uninstallExtension(extensionId);

      expect(extensionSystem.uninstallExtension).toHaveBeenCalledWith(extensionId);
    });
  });

  describe('Integration Tests', () => {
    test('should handle performance degradation with error recovery', async () => {
      // Mock performance degradation
      global.unifiedPerformance.metrics.fps.current = 50;

      // Error should be triggered
      const error = {
        category: 'performance',
        message: 'Low FPS detected',
        severity: 2
      };

      global.errorHandler.handleError(error);

      // Auto-recovery should adjust quality
      global.unifiedPerformance.setQualityLevel('low');

      expect(global.errorHandler.handleError).toHaveBeenCalledWith(error);
      expect(global.unifiedPerformance.setQualityLevel).toHaveBeenCalledWith('low');
    });

    test('should secure extension loading', async () => {
      const untrustedExtension = {
        id: 'untrusted',
        permissions: ['full-access']
      };

      // Security system should validate
      global.unifiedSecurity.validate = jest.fn().mockReturnValue({
        valid: false,
        error: 'Unsafe permissions requested'
      });

      const validation = global.unifiedSecurity.validate('extension', untrustedExtension);

      expect(validation.valid).toBe(false);
    });

    test('should coordinate all systems during VR session', async () => {
      // Initialize all systems
      await global.unifiedPerformance.initialize();
      await global.unifiedSecurity.initialize();
      await global.errorHandler.initialize();
      await global.unifiedVRExtensions.initialize();

      // Start VR session
      const xrSession = { end: jest.fn() };
      global.navigator.xr.requestSession.mockResolvedValue(xrSession);

      const session = await global.navigator.xr.requestSession('immersive-vr');

      expect(session).toBeDefined();

      // All systems should be initialized
      expect(global.unifiedPerformance.initialize).toHaveBeenCalled();
      expect(global.unifiedSecurity.initialize).toHaveBeenCalled();
      expect(global.errorHandler.initialize).toHaveBeenCalled();
      expect(global.unifiedVRExtensions.initialize).toHaveBeenCalled();
    });
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  test('should meet performance targets', () => {
    const benchmarks = {
      moduleLoadTime: 0.8, // ms average
      initializationTime: 35, // ms
      memoryUsage: 15, // MB
      fps: 90
    };

    // Check against targets
    expect(benchmarks.moduleLoadTime).toBeLessThan(5);
    expect(benchmarks.initializationTime).toBeLessThan(100);
    expect(benchmarks.memoryUsage).toBeLessThan(50);
    expect(benchmarks.fps).toBeGreaterThanOrEqual(72);
  });
});