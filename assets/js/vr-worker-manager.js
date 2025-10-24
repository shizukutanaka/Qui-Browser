/**
 * VR Worker Manager
 * Off-Main-Thread Architecture for VR rendering
 *
 * VRアプリケーションでは、メインスレッドをブロックしないことが
 * 極めて重要です。フレームドロップはモーションシックネスの原因と
 * なるため、重い計算をWeb Workerに委譲します。
 *
 * Use Cases:
 * - Physics simulation
 * - AI pathfinding
 * - Procedural generation
 * - Data processing
 * - Asset loading/decoding
 *
 * Performance Impact:
 * - Main thread freed for rendering (13ms → 1ms in research)
 * - Smooth 90 FPS maintenance
 * - Reduced input lag
 *
 * Based on "Moving Three.js WebXR App Off-Main-Thread" research
 * @see https://surma.dev/things/omt-for-three-xr/
 * @version 1.0.0
 */

class VRWorkerManager {
  constructor() {
    this.workers = new Map();
    this.pendingMessages = new Map();
    this.messageId = 0;

    this.config = {
      maxWorkers: navigator.hardwareConcurrency || 4,
      workerTimeout: 5000, // ms
      enableTransferables: true, // Use transferable objects
      autoTerminate: false // Auto-terminate idle workers
    };

    // Performance metrics
    this.metrics = {
      activeWorkers: 0,
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0,
      mainThreadTimeSaved: 0
    };

    // Worker pool
    this.workerPool = [];
    this.availableWorkers = [];

    console.info('[WorkerManager] VR Worker Manager initialized');
  }

  /**
   * Create worker from URL
   * @param {string} id - Worker ID
   * @param {string} scriptURL - Worker script URL
   * @returns {Promise<Worker>} Worker instance
   */
  async createWorker(id, scriptURL) {
    if (this.workers.has(id)) {
      console.warn(`[WorkerManager] Worker already exists: ${id}`);
      return this.workers.get(id).worker;
    }

    try {
      const worker = new Worker(scriptURL);

      const workerData = {
        id,
        worker,
        scriptURL,
        busy: false,
        taskCount: 0,
        createdAt: Date.now()
      };

      // Setup message handler
      worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(id, event);
      });

      // Setup error handler
      worker.addEventListener('error', (error) => {
        console.error(`[WorkerManager] Worker ${id} error:`, error);
        this.metrics.failedTasks++;
      });

      this.workers.set(id, workerData);
      this.metrics.activeWorkers++;

      console.info(`[WorkerManager] Worker created: ${id}`);

      return worker;

    } catch (error) {
      console.error(`[WorkerManager] Failed to create worker ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create worker from inline code
   * @param {string} id - Worker ID
   * @param {string} code - Worker code
   * @returns {Promise<Worker>} Worker instance
   */
  async createWorkerFromCode(id, code) {
    const blob = new Blob([code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);

    try {
      const worker = await this.createWorker(id, url);
      return worker;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Send message to worker
   * @param {string} workerId - Worker ID
   * @param {Object} data - Message data
   * @param {Array} transferables - Transferable objects (optional)
   * @returns {Promise<any>} Response from worker
   */
  sendMessage(workerId, data, transferables = []) {
    const workerData = this.workers.get(workerId);
    if (!workerData) {
      return Promise.reject(new Error(`Worker not found: ${workerId}`));
    }

    return new Promise((resolve, reject) => {
      const messageId = this.messageId++;
      const startTime = performance.now();

      // Store pending message
      this.pendingMessages.set(messageId, {
        resolve,
        reject,
        startTime,
        timeout: setTimeout(() => {
          this.pendingMessages.delete(messageId);
          reject(new Error(`Worker ${workerId} timeout`));
          this.metrics.failedTasks++;
        }, this.config.workerTimeout)
      });

      // Send message
      const message = { id: messageId, data };

      try {
        if (this.config.enableTransferables && transferables.length > 0) {
          workerData.worker.postMessage(message, transferables);
        } else {
          workerData.worker.postMessage(message);
        }

        workerData.busy = true;
        workerData.taskCount++;
        this.metrics.totalTasks++;

      } catch (error) {
        clearTimeout(this.pendingMessages.get(messageId).timeout);
        this.pendingMessages.delete(messageId);
        reject(error);
        this.metrics.failedTasks++;
      }
    });
  }

  /**
   * Handle message from worker
   * @param {string} workerId - Worker ID
   * @param {MessageEvent} event - Message event
   */
  handleWorkerMessage(workerId, event) {
    const { id: messageId, data, error } = event.data;

    const pending = this.pendingMessages.get(messageId);
    if (!pending) {
      console.warn(`[WorkerManager] No pending message for ID: ${messageId}`);
      return;
    }

    // Clear timeout
    clearTimeout(pending.timeout);
    this.pendingMessages.delete(messageId);

    // Update metrics
    const elapsed = performance.now() - pending.startTime;
    this.updateTaskMetrics(elapsed);

    // Mark worker as available
    const workerData = this.workers.get(workerId);
    if (workerData) {
      workerData.busy = false;
    }

    // Resolve or reject
    if (error) {
      pending.reject(new Error(error));
      this.metrics.failedTasks++;
    } else {
      pending.resolve(data);
      this.metrics.completedTasks++;
    }
  }

  /**
   * Update task metrics
   * @param {number} taskTime - Task time in ms
   */
  updateTaskMetrics(taskTime) {
    const totalTime = this.metrics.averageTaskTime * this.metrics.completedTasks;
    this.metrics.averageTaskTime = (totalTime + taskTime) / (this.metrics.completedTasks + 1);
    this.metrics.mainThreadTimeSaved += taskTime;
  }

  /**
   * Execute task on worker
   * @param {string} workerId - Worker ID
   * @param {Object} task - Task data
   * @returns {Promise<any>} Task result
   */
  async executeTask(workerId, task) {
    const startTime = performance.now();

    try {
      const result = await this.sendMessage(workerId, task);
      const elapsed = performance.now() - startTime;

      console.info(`[WorkerManager] Task completed in ${elapsed.toFixed(2)}ms on worker ${workerId}`);

      return result;

    } catch (error) {
      console.error(`[WorkerManager] Task failed on worker ${workerId}:`, error);
      throw error;
    }
  }

  /**
   * Terminate worker
   * @param {string} workerId - Worker ID
   */
  terminateWorker(workerId) {
    const workerData = this.workers.get(workerId);
    if (!workerData) {
      console.warn(`[WorkerManager] Worker not found: ${workerId}`);
      return;
    }

    workerData.worker.terminate();
    this.workers.delete(workerId);
    this.metrics.activeWorkers--;

    console.info(`[WorkerManager] Worker terminated: ${workerId}`);
  }

  /**
   * Terminate all workers
   */
  terminateAll() {
    for (const [workerId] of this.workers) {
      this.terminateWorker(workerId);
    }

    console.info('[WorkerManager] All workers terminated');
  }

  /**
   * Get worker status
   * @param {string} workerId - Worker ID
   * @returns {Object|null} Worker status
   */
  getWorkerStatus(workerId) {
    const workerData = this.workers.get(workerId);
    if (!workerData) {
      return null;
    }

    return {
      id: workerData.id,
      busy: workerData.busy,
      taskCount: workerData.taskCount,
      uptime: Date.now() - workerData.createdAt
    };
  }

  /**
   * Get metrics
   * @returns {Object} Performance metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalTasks > 0
        ? ((this.metrics.completedTasks / this.metrics.totalTasks) * 100).toFixed(1) + '%'
        : '0%',
      averageTaskTime: this.metrics.averageTaskTime.toFixed(2) + 'ms',
      mainThreadTimeSaved: this.metrics.mainThreadTimeSaved.toFixed(2) + 'ms'
    };
  }

  /**
   * Create physics worker
   * @returns {Promise<Worker>} Physics worker
   */
  async createPhysicsWorker() {
    const code = `
// Physics Worker
let bodies = [];
let gravity = { x: 0, y: -9.8, z: 0 };

self.addEventListener('message', (event) => {
  const { id, data } = event.data;

  try {
    switch (data.type) {
      case 'init':
        bodies = data.bodies || [];
        gravity = data.gravity || gravity;
        self.postMessage({ id, data: { success: true } });
        break;

      case 'step':
        const dt = data.deltaTime || 0.016; // 60 FPS
        updatePhysics(dt);
        self.postMessage({ id, data: { bodies } });
        break;

      case 'addBody':
        bodies.push(data.body);
        self.postMessage({ id, data: { success: true } });
        break;

      default:
        throw new Error('Unknown command: ' + data.type);
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
});

function updatePhysics(dt) {
  for (const body of bodies) {
    if (!body.static) {
      // Apply gravity
      body.velocity.x += gravity.x * dt;
      body.velocity.y += gravity.y * dt;
      body.velocity.z += gravity.z * dt;

      // Update position
      body.position.x += body.velocity.x * dt;
      body.position.y += body.velocity.y * dt;
      body.position.z += body.velocity.z * dt;

      // Simple ground collision
      if (body.position.y < 0) {
        body.position.y = 0;
        body.velocity.y = -body.velocity.y * 0.5; // Bounce
      }
    }
  }
}
`;

    return await this.createWorkerFromCode('physics', code);
  }

  /**
   * Create data processing worker
   * @returns {Promise<Worker>} Data worker
   */
  async createDataWorker() {
    const code = `
// Data Processing Worker
self.addEventListener('message', (event) => {
  const { id, data } = event.data;

  try {
    switch (data.type) {
      case 'sort':
        const sorted = data.array.sort((a, b) => a - b);
        self.postMessage({ id, data: sorted }, [sorted.buffer]);
        break;

      case 'filter':
        const filtered = data.array.filter(data.predicate);
        self.postMessage({ id, data: filtered });
        break;

      case 'process':
        const result = processData(data.input);
        self.postMessage({ id, data: result });
        break;

      default:
        throw new Error('Unknown command: ' + data.type);
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
});

function processData(input) {
  // Heavy computation here
  return input;
}
`;

    return await this.createWorkerFromCode('data', code);
  }

  /**
   * Dispose all resources
   */
  dispose() {
    this.terminateAll();
    this.pendingMessages.clear();
    this.workerPool = [];

    console.info('[WorkerManager] Disposed');
  }

  /**
   * Get usage example
   * @returns {string} Code example
   */
  static getUsageExample() {
    return `
// Initialize worker manager
const workerManager = new VRWorkerManager();

// Create physics worker
await workerManager.createPhysicsWorker();

// Initialize physics
await workerManager.executeTask('physics', {
  type: 'init',
  bodies: [
    { id: 'ball', position: { x: 0, y: 10, z: 0 }, velocity: { x: 0, y: 0, z: 0 }, static: false }
  ],
  gravity: { x: 0, y: -9.8, z: 0 }
});

// In animation loop (off main thread!)
async function updatePhysics(deltaTime) {
  const result = await workerManager.executeTask('physics', {
    type: 'step',
    deltaTime
  });

  // Update scene with new positions
  for (const body of result.bodies) {
    scene.getObjectByName(body.id).position.copy(body.position);
  }
}

// XR frame loop
function onXRFrame(time, frame) {
  // Main rendering on main thread
  renderScene();

  // Heavy physics on worker (non-blocking)
  updatePhysics(0.016).catch(console.error);

  session.requestAnimationFrame(onXRFrame);
}

// Get metrics
const metrics = workerManager.getMetrics();
console.log('Main thread time saved:', metrics.mainThreadTimeSaved);
console.log('Average task time:', metrics.averageTaskTime);

// Cleanup
// workerManager.dispose();
`;
  }

  /**
   * Get best practices
   * @returns {Array} Recommendations
   */
  static getBestPractices() {
    return [
      {
        title: 'Use for Heavy Computation',
        description: 'Move physics, AI, procedural generation to workers.',
        priority: 'high'
      },
      {
        title: 'Use Transferable Objects',
        description: 'Transfer ArrayBuffers for zero-copy performance.',
        priority: 'high'
      },
      {
        title: 'Keep Main Thread for Rendering',
        description: 'VR requires smooth 90 FPS - never block main thread.',
        priority: 'critical'
      },
      {
        title: 'Handle Worker Errors',
        description: 'Always handle errors and timeouts gracefully.',
        priority: 'high'
      },
      {
        title: 'Limit Worker Count',
        description: 'Use navigator.hardwareConcurrency as guide.',
        priority: 'medium'
      },
      {
        title: 'Measure Performance',
        description: 'Track time saved on main thread.',
        priority: 'medium'
      }
    ];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRWorkerManager;
}

// Global instance
window.VRWorkerManager = VRWorkerManager;

console.info('[WorkerManager] VR Worker Manager loaded');
