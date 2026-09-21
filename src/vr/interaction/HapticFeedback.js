/**
 * Haptic Feedback System for VR Controllers
 * Touch sensations through vibration patterns
 *
 * John Carmack principle: Haptics complete the VR illusion
 */

export class HapticFeedback {
  constructor() {
    this.gamepads = new Map(); // key → Gamepad; keys are XRInputSource objects (XR path) or numeric indices (Gamepad API path)
    this._hands = new Map();   // key → XRInputSource.handedness ('unknown' for plain gamepads)
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
   * Update gamepad list.
   *
   * @param {XRInputSource[]|undefined} inputSources  the live list from the
   *   active XRSession (e.g. `xrFrame.session.inputSources`). When provided —
   *   even empty — it is authoritative: per the WebXR Gamepads Module,
   *   gamepads belonging to XR input sources MUST NOT appear in
   *   `navigator.getGamepads()`, so scanning that array inside an immersive
   *   session finds nothing and every pulse would silently no-op. When omitted
   *   (no XR session / desktop mirror), the Gamepad API list is used instead.
   */
  update(inputSources) {
    // Reuse one Set across frames — update() runs every render frame, so a
    // fresh Set per call is pure GC churn on the headset.
    if (!this._seen) {
      this._seen = new Set();
    }
    const seen = this._seen;
    seen.clear();

    if (inputSources) {
      for (const src of inputSources) {
        const gamepad = src?.gamepad;
        if (!gamepad?.hapticActuators?.length) {
          continue;
        }
        seen.add(src);
        if (!this.gamepads.has(src)) {
          console.debug(`HapticFeedback: Controller connected (${src.handedness ?? 'unknown'} hand)`);
          this.stats.controllersDetected++;
        }
        this.gamepads.set(src, gamepad);
        this._hands.set(src, src.handedness ?? 'unknown');
      }
    } else if (typeof navigator.getGamepads === 'function') {
      const gamepads = navigator.getGamepads() ?? [];
      for (let i = 0; i < gamepads.length; i++) {
        const gamepad = gamepads[i];
        if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators.length > 0) {
          const key = gamepad.index >= 0 ? gamepad.index : i;
          seen.add(key);
          if (!this.gamepads.has(key)) {
            console.debug(`HapticFeedback: Controller ${i} connected (${gamepad.id})`);
            this.stats.controllersDetected++;
          }
          this.gamepads.set(key, gamepad);
          // The standard Gamepad has no hand property, but a UA that exposes
          // one (or a stubbed harness pad) is honoured; otherwise hand
          // matching falls through to the first-available fallback.
          this._hands.set(key, gamepad.hand ?? gamepad.handedness ?? 'unknown');
        }
      }
    }

    for (const key of this.gamepads.keys()) {
      if (!seen.has(key)) {
        this.gamepads.delete(key);
        this._hands.delete(key);
      }
    }
  }

  /**
   * Trigger haptic pulse
   */
  async pulse(hand, duration, intensity) {
    if (!this.enabled) {
      return;
    }

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
      // Complex pattern (sequence) — individual step failures are warned but
      // do not abort the remaining steps in the sequence.
      for (const step of pattern) {
        try {
          if (step.duration) {
            await this.pulse(hand, step.duration, step.intensity);
          } else if (step.pause) {
            await this.wait(step.pause);
          }
        } catch (e) {
          console.warn('HapticFeedback: playPattern step failed', e);
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
    // With a single connected controller both hands resolve to the same
    // gamepad via the first-available fallback — play once rather than
    // double-firing the pattern on the same actuator.
    const leftGp = this.getGamepadForHand('left');
    const rightGp = this.getGamepadForHand('right');
    if (leftGp && leftGp === rightGp) {
      await this.playPattern('left', patternName);
      return;
    }

    const leftPromise = this.playPattern('left', patternName);

    if (delay > 0) {
      await this.wait(delay);
    }

    const rightPromise = this.playPattern('right', patternName);

    await Promise.all([leftPromise, rightPromise]);
  }

  /**
   * Get gamepad for specified hand
   */
  getGamepadForHand(hand) {
    for (const [key, gamepad] of this.gamepads) {
      if (this._hands.get(key) === hand) {
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
    console.debug(`HapticFeedback: ${enabled ? 'Enabled' : 'Disabled'}`);
  }

  /**
   * Utility: Wait for specified duration
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
 */
