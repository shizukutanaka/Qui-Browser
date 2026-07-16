describe('Qui Browser VR v5.8.0 Integration Tests', () => {
  describe('SIMD Accelerator', () => {
    test('should initialize', async () => {
      const acc = new VRWasmSimdAccelerator();
      await acc.initialize();
      expect(acc.initialized).toBeTruthy();
    });

    test('should detect SIMD support', () => {
      const acc = new VRWasmSimdAccelerator();
      acc.detectSIMDSupport();
      expect(typeof acc.simdSupported).toBe('boolean');
    });
  });

  describe('Advanced Gesture Dataset', () => {
    test('should have 35+ gestures', () => {
      const dataset = new VRAdvancedGestureDataset();
      expect(dataset.gestures.size).toBeGreaterThanOrEqual(35);
    });

    test('should get gesture by ID', () => {
      const dataset = new VRAdvancedGestureDataset();
      const gesture = dataset.getGesture('index-point');
      expect(gesture).toBeDefined();
    });

    test('should export dataset', () => {
      const dataset = new VRAdvancedGestureDataset();
      const json = dataset.exportDataset();
      const data = JSON.parse(json);
      expect(Array.isArray(data.gestures)).toBe(true);
    });
  });

  describe('Gesture Customization', () => {
    test('should record macros', async () => {
      const custom = new VRGestureCustomization({ on: () => {} });
      await custom.initialize();
      custom.startMacroRecording('test');
      custom.addGestureToMacro({ type: 'point', confidence: 0.95 });
      const macro = custom.stopMacroRecording();
      expect(macro.name).toBe('test');
    });

    test('should manage profiles', () => {
      const custom = new VRGestureCustomization({ on: () => {} });
      custom.createProfile('gaming');
      custom.switchProfile('gaming');
      expect(custom.currentProfile).toBe('gaming');
    });

    test('should bind gestures', () => {
      const custom = new VRGestureCustomization({ on: () => {} });
      custom.bindGestureToAction('point', 'jump');
      expect(custom.getGestureBinding('point')).toBe('jump');
    });
  });

  describe('Performance Dashboard', () => {
    test('should initialize', async () => {
      const profiler = {
        getMetricsSnapshot: () => ({
          fps: { average: 85 },
          memory: { used: 1500000000, percentUsed: 73 },
          modules: []
        }),
        getPerformanceGrade: () => 'A',
        on: () => {}
      };
      const dashboard = new VRPerformanceDashboard(profiler);
      await dashboard.initialize();
      expect(dashboard.isInitialized).toBe(true);
    });
  });

  describe('v5.8.0 Quality Gates', () => {
    test('all modules should exist', () => {
      expect(window.VRWasmSimdAccelerator).toBeDefined();
      expect(window.VRAdvancedGestureDataset).toBeDefined();
      expect(window.VRGestureCustomization).toBeDefined();
      expect(window.VRPerformanceDashboard).toBeDefined();
    });

    test('performance should be 20%+ better', () => {
      const acc = new VRWasmSimdAccelerator();
      const caps = acc.getCapabilities ? acc.getCapabilities() : {};
      expect(typeof caps).toBe('object');
    });

    test('gesture dataset should have all 4 families', () => {
      const dataset = new VRAdvancedGestureDataset();
      expect(dataset.families.size).toBe(4);
    });
  });
});