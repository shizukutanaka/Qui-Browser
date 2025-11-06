/**
 * Haptic Feedback System for VR Controllers
 * Touch sensations through vibration patterns
 *
 * John Carmack principle: Haptics complete the VR illusion
 */

export class HapticFeedback {
  constructor() {
    this.gamepads = new Map();
    this.enabled = true;

    // Predefined haptic patterns
    this.patterns = {
      // Basic patterns
      click: { duration: 10, intensity: 0.3 },
      tap: { duration: 20, intensity: 0.5 },
      impact: { duration: 50, intensity: 0.8 },
      error: { duration: 100, intensity: 1.0 },

      // Complex patterns
      heartbeat: [
        { duration: 50, intensity: 0.7 },
        { pause: 50 },
        { duration: 50, intensity: 0.7 },
        { pause: 500 }
      ],

      notification: [
        { duration: 30, intensity: 0.5 },
        { pause: 30 },
        { duration: 30, intensity: 0.5 }
      ],

      success: [
        { duration: 20, intensity: 0.4 },
        { pause: 20 },
        { duration: 40, intensity: 0.6 },
        { pause: 20 },
        { duration: 60, intensity: 0.8 }
      ],

      warning: [
        { duration: 100, intensity: 0.8 },
        { pause: 100 },
        { duration: 100, intensity: 0.8 },
        { pause: 100 },
        { duration: 100, intensity: 0.8 }
      ],

      // Material-based haptics
      wood: { duration: 30, intensity: 0.4 },
      metal: { duration: 15, intensity: 0.9 },
      glass: { duration: 10, intensity: 0.2 },
      rubber: { duration: 40, intensity: 0.5 },

      // Interaction patterns
      scroll: { duration: 5, intensity: 0.2 },
      drag: { duration: 8, intensity: 0.3 },
      resize: { duration: 12, intensity: 0.4 },
      drop: { duration: 50, intensity: 0.6 },

      // UI feedback
      buttonPress: { duration: 15, intensity: 0.5 },
      buttonRelease: { duration: 10, intensity: 0.3 },
      toggle: { duration: 20, intensity: 0.4 },
      slider: { duration: 5, intensity: 0.3 },

      // Spatial awareness
      boundary: { duration: 100, intensity: 1.0 },
      proximity: { duration: 30, intensity: 0.5 },
      collision: { duration: 50, intensity: 0.9 }
    };

    // Statistics
    this.stats = {
      pulsesGenerated: 0,
      totalDuration: 0,
      averageIntensity: 0,
      controllersDetected: 0
    };
  }

  /**
   * Update gamepad list
   */
  update() {
    const gamepads = navigator.getGamepads();

    for (let i = 0; i < gamepads.length; i++) {
      const gamepad = gamepads[i];

      if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
        if (!this.gamepads.has(i)) {
          console.log(`HapticFeedback: Controller ${i} connected (${gamepad.id})`);
          this.stats.controllersDetected++;
        }
        this.gamepads.set(i, gamepad);
      } else if (this.gamepads.has(i)) {
        console.log(`HapticFeedback: Controller ${i} disconnected`);
        this.gamepads.delete(i);
      }
    }
  }

  /**
   * Trigger haptic pulse
   */
  async pulse(hand, duration, intensity) {
    if (!this.enabled) return;

    // Find gamepad for specified hand
    const gamepad = this.getGamepadForHand(hand);
    if (!gamepad || !gamepad.hapticActuators || gamepad.hapticActuators.length === 0) {
      return;
    }

    try {
      // Normalize values
      duration = Math.max(1, Math.min(5000, duration)); // 1-5000ms
      intensity = Math.max(0, Math.min(1, intensity)); // 0-1

      // Trigger pulse
      const actuator = gamepad.hapticActuators[0];

      if (actuator.pulse) {
        // Standard API
        await actuator.pulse(intensity, duration);
      } else if (actuator.playEffect) {
        // WebXR Gamepads Module API
        await actuator.playEffect('dual-rumble', {
          duration: duration,
          strongMagnitude: intensity,
          weakMagnitude: intensity * 0.5
        });
      }

      // Update stats
      this.stats.pulsesGenerated++;
      this.stats.totalDuration += duration;
      this.stats.averageIntensity =
        (this.stats.averageIntensity * (this.stats.pulsesGenerated - 1) + intensity) /
        this.stats.pulsesGenerated;

    } catch (error) {
      console.warn('HapticFeedback: Pulse failed', error);
    }
  }

  /**
   * Play predefined pattern
   */
  async playPattern(hand, patternName) {
    const pattern = this.patterns[patternName];
    if (!pattern) {
      console.warn(`HapticFeedback: Pattern "${patternName}" not found`);
      return;
    }

    if (Array.isArray(pattern)) {
      // Complex pattern (sequence)
      for (const step of pattern) {
        if (step.duration) {
          await this.pulse(hand, step.duration, step.intensity);
        } else if (step.pause) {
          await this.wait(step.pause);
        }
      }
    } else {
      // Simple pattern
      await this.pulse(hand, pattern.duration, pattern.intensity);
    }
  }

  /**
   * Play pattern on both hands
   */
  async playPatternBothHands(patternName, delay = 0) {
    const leftPromise = this.playPattern('left', patternName);

    if (delay > 0) {
      await this.wait(delay);
    }

    const rightPromise = this.playPattern('right', patternName);

    await Promise.all([leftPromise, rightPromise]);
  }

  /**
   * Custom pattern builder
   */
  createCustomPattern(name, steps) {
    this.patterns[name] = steps;
    console.log(`HapticFeedback: Created custom pattern "${name}"`);
  }

  /**
   * Simulate texture feeling
   */
  async simulateTexture(hand, textureType, duration = 1000) {
    const patterns = {
      smooth: { pulseInterval: 100, intensity: 0.1 },
      rough: { pulseInterval: 20, intensity: 0.5 },
      bumpy: { pulseInterval: 50, intensity: 0.7 },
      soft: { pulseInterval: 150, intensity: 0.2 },
      hard: { pulseInterval: 10, intensity: 0.9 }
    };

    const pattern = patterns[textureType];
    if (!pattern) return;

    const startTime = Date.now();
    while (Date.now() - startTime < duration) {
      await this.pulse(hand, 10, pattern.intensity);
      await this.wait(pattern.pulseInterval);
    }
  }

  /**
   * Simulate force feedback
   */
  async simulateForce(hand, force, duration) {
    // Map force (0-1) to haptic intensity
    const intensity = Math.min(force * 1.5, 1.0);

    // Continuous pulses to simulate sustained force
    const pulseInterval = 50;
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      await this.pulse(hand, pulseInterval, intensity);
      await this.wait(pulseInterval);
    }
  }

  /**
   * Simulate impact with physics
   */
  async simulateImpact(hand, velocity, mass) {
    // Calculate impact intensity from physics
    const kineticEnergy = 0.5 * mass * velocity * velocity;
    const intensity = Math.min(kineticEnergy / 10, 1.0);
    const duration = Math.min(50 + intensity * 100, 200);

    await this.pulse(hand, duration, intensity);
  }

  /**
   * Proximity feedback (intensity increases as object gets closer)
   */
  async proximityFeedback(hand, distance, maxDistance = 1.0) {
    if (distance > maxDistance) return;

    const normalizedDistance = distance / maxDistance;
    const intensity = 1.0 - normalizedDistance;

    // Very short pulse for proximity
    await this.pulse(hand, 5, intensity * 0.5);
  }

  /**
   * Directional haptic (indicate direction)
   */
  async directionalPulse(hand, direction) {
    // Different patterns for different directions
    const patterns = {
      up: [
        { duration: 20, intensity: 0.3 },
        { pause: 10 },
        { duration: 30, intensity: 0.6 }
      ],
      down: [
        { duration: 30, intensity: 0.6 },
        { pause: 10 },
        { duration: 20, intensity: 0.3 }
      ],
      left: { duration: 40, intensity: 0.5 },
      right: { duration: 40, intensity: 0.5 }
    };

    const pattern = patterns[direction];
    if (Array.isArray(pattern)) {
      for (const step of pattern) {
        if (step.duration) {
          await this.pulse(hand, step.duration, step.intensity);
        } else if (step.pause) {
          await this.wait(step.pause);
        }
      }
    } else if (pattern) {
      await this.pulse(hand, pattern.duration, pattern.intensity);
    }
  }

  /**
   * Rhythm pattern (for music/timing feedback)
   */
  async playRhythm(hand, bpm, beats) {
    const beatDuration = 60000 / bpm; // ms per beat

    for (let i = 0; i < beats; i++) {
      await this.pulse(hand, 30, 0.6);
      await this.wait(beatDuration - 30);
    }
  }

  /**
   * Alert pattern (attention-grabbing)
   */
  async alert(urgency = 'normal') {
    const patterns = {
      low: 'notification',
      normal: 'warning',
      high: [
        { duration: 100, intensity: 1.0 },
        { pause: 50 },
        { duration: 100, intensity: 1.0 },
        { pause: 50 },
        { duration: 100, intensity: 1.0 }
      ]
    };

    const pattern = patterns[urgency] || patterns.normal;

    // Play on both hands for alerts
    await Promise.all([
      typeof pattern === 'string'
        ? this.playPattern('left', pattern)
        : this.playCustomSequence('left', pattern),
      typeof pattern === 'string'
        ? this.playPattern('right', pattern)
        : this.playCustomSequence('right', pattern)
    ]);
  }

  /**
   * Play custom sequence
   */
  async playCustomSequence(hand, sequence) {
    for (const step of sequence) {
      if (step.duration) {
        await this.pulse(hand, step.duration, step.intensity);
      } else if (step.pause) {
        await this.wait(step.pause);
      }
    }
  }

  /**
   * Get gamepad for specified hand
   */
  getGamepadForHand(hand) {
    for (const gamepad of this.gamepads.values()) {
      if (gamepad.hand === hand) {
        return gamepad;
      }
    }

    // Fallback: return first available gamepad
    return this.gamepads.values().next().value;
  }

  /**
   * Enable/disable haptics
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    console.log(`HapticFeedback: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Get list of available patterns
   */
  getPatterns() {
    return Object.keys(this.patterns);
  }

  /**
   * Test haptic feedback
   */
  async test(hand = 'right') {
    console.log('HapticFeedback: Testing...');

    const testPatterns = ['click', 'tap', 'impact', 'success'];

    for (const pattern of testPatterns) {
      console.log(`Testing pattern: ${pattern}`);
      await this.playPattern(hand, pattern);
      await this.wait(500);
    }

    console.log('HapticFeedback: Test complete');
  }

  /**
   * Utility: Wait for specified duration
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      enabled: this.enabled,
      controllersConnected: this.gamepads.size,
      patternsAvailable: Object.keys(this.patterns).length
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      pulsesGenerated: 0,
      totalDuration: 0,
      averageIntensity: 0,
      controllersDetected: this.stats.controllersDetected
    };
  }
}

/**
 * Usage Examples:
 *
 * const haptics = new HapticFeedback();
 *
 * // Update in render loop
 * haptics.update();
 *
 * // Simple pulse
 * haptics.pulse('right', 50, 0.7);
 *
 * // Play pattern
 * haptics.playPattern('left', 'click');
 * haptics.playPattern('right', 'success');
 *
 * // Both hands
 * haptics.playPatternBothHands('notification');
 *
 * // Custom pattern
 * haptics.createCustomPattern('mypattern', [
 *   { duration: 30, intensity: 0.5 },
 *   { pause: 20 },
 *   { duration: 50, intensity: 0.8 }
 * ]);
 *
 * // Texture simulation
 * haptics.simulateTexture('right', 'rough', 2000);
 *
 * // Impact with physics
 * haptics.simulateImpact('right', velocity, mass);
 *
 * // Proximity feedback
 * haptics.proximityFeedback('right', distance, maxDistance);
 *
 * // Alert
 * haptics.alert('high');
 */