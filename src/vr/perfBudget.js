/**
 * Per-frame performance accounting and adaptive quality stepping.
 * Extracted from VRApp — `app` supplies renderer/performanceMonitor/ffrSystem.
 */

export function updatePerformanceMonitor(app, frameTime) {
  // Exponential moving average for smooth values
  const alpha = 0.1;
  app.performanceMonitor.frameTime =
    app.performanceMonitor.frameTime * (1 - alpha) + frameTime * alpha;

  app.performanceMonitor.fps = 1000 / app.performanceMonitor.frameTime;

  // Track memory usage
  if (performance.memory) {
    app.performanceMonitor.memoryUsed =
      performance.memory.usedJSHeapSize / 1024 / 1024; // MB
  }

  // Real GPU metrics from the renderer.
  const info = app.renderer.info;
  app.performanceMonitor.drawCalls = info.render.calls;
  app.performanceMonitor.triangles = info.render.triangles;
}

export function getPerformanceStats(app) {
  const info = app.renderer.info;
  const stats = {
    fps: Math.round(app.performanceMonitor.fps),
    frameTime: app.performanceMonitor.frameTime.toFixed(2) + 'ms',
    memory: app.performanceMonitor.memoryUsed.toFixed(1) + 'MB',
    drawCalls: app.performanceMonitor.drawCalls,
    triangles: app.performanceMonitor.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs ? info.programs.length : 0
  };

  // Add system-specific stats
  if (app.ffrSystem) {
    stats.ffrIntensity = (app.ffrSystem.intensity * 100).toFixed(0) + '%';
  }

  return stats;
}

export function adjustQuality(app) {
  const targetFrameTime = 1000 / app.settings.targetFPS;
  const currentFrameTime = app.performanceMonitor.frameTime;

  if (currentFrameTime > targetFrameTime * 1.2) {
    // Performance is poor, reduce quality
    reduceQuality(app);
  } else if (currentFrameTime < targetFrameTime * 0.8) {
    // Performance is good, increase quality
    increaseQuality(app);
  }
}

function reduceQuality(app) {
  // Increase FFR intensity
  if (app.ffrSystem) {
    app.ffrSystem.adjustIntensity(0.1);
  }

  // Reduce render scale (if implemented)
  // app.renderer.setPixelRatio(0.8);

  console.debug('VRApp: Quality reduced for performance');
}

function increaseQuality(app) {
  // Decrease FFR intensity
  if (app.ffrSystem) {
    app.ffrSystem.adjustIntensity(-0.1);
  }

  // Increase render scale (if implemented)
  // app.renderer.setPixelRatio(1.0);

  console.debug('VRApp: Quality increased');
}

