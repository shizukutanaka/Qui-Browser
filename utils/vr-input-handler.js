/**
 * VR Input Handler
 *
 * Multi-modal input support for VR: controllers, hand tracking, gaze.
 * Based on 2025 research on VR interaction methods.
 *
 * Supported Input Methods (2025 Research):
 * - Controllers: Most reliable, lower mental workload, faster task completion
 * - Hand Tracking: Natural but has tracking/occlusion issues
 * - Gaze + Button: Performs as well as controllers with feedback
 * - Gaze + Dwell: Hands-free operation
 * - Voice: Multimodal combination (gaze + voice)
 * - Facial Actions: 53 action units for accessibility
 *
 * Key Findings:
 * - Handheld controllers: 30% faster task completion vs hand tracking
 * - Hand tracking: Self-occlusion and tracking loss issues
 * - Gaze + button: Comparable to controller performance
 * - Multimodal (gaze + gesture + voice): Best for accessibility
 *
 * @see https://www.frontiersin.org/articles/10.3389/frvir.2025.1576962/full
 * @see https://dl.acm.org/doi/10.1145/3706598.3713694
 */

const EventEmitter = require('events');

class VRInputHandler extends EventEmitter {
  constructor(options = {}) {
    super();

    this.options = {
      // Input method priorities
      enableControllers: options.enableControllers !== false,
      enableHandTracking: options.enableHandTracking || false,
      enableGaze: options.enableGaze || false,
      enableVoice: options.enableVoice || false,
      enableGestures: options.enableGestures || false,

      // Gaze interaction
      gazeDwellTime: options.gazeDwellTime || 800, // ms
      gazeActivationRadius: options.gazeActivationRadius || 0.05, // meters

      // Hand tracking
      pinchThreshold: options.pinchThreshold || 0.02, // meters
      grabThreshold: options.grabThreshold || 0.05, // meters
      handTrackingConfidenceThreshold: options.handTrackingConfidenceThreshold || 0.8,

      // Gesture recognition
      gestureRecognitionEnabled: options.gestureRecognitionEnabled || false,
      customGestures: options.customGestures || [],

      // Haptic feedback
      enableHaptics: options.enableHaptics !== false,
      hapticIntensity: options.hapticIntensity || 0.5, // 0-1

      // Performance
      inputPollingRate: options.inputPollingRate || 90, // Hz

      ...options
    };

    // Input state
    this.controllers = {
      left: null,
      right: null
    };

    this.hands = {
      left: null,
      right: null
    };

    this.gaze = {
      active: false,
      target: null,
      dwellStart: null,
      position: null,
      direction: null
    };

    // Interaction targets
    this.interactables = new Map(); // id -> interactable object
    this.hoveredTargets = new Set();
    this.selectedTargets = new Set();

    // Gesture recognition
    this.gestures = new Map();
    this.currentGesture = null;

    // Voice commands
    this.voiceCommands = new Map();

    // Statistics
    this.stats = {
      controllerInputs: 0,
      handTrackingInputs: 0,
      gazeInputs: 0,
      voiceInputs: 0,
      gesturesRecognized: 0,
      hapticsTriggered: 0,
      inputLatency: 0
    };

    this.registerDefaultGestures();
  }

  /**
   * Register default gestures
   */
  registerDefaultGestures() {
    // Pinch gesture
    this.registerGesture('pinch', {
      detect: (hand) => {
        if (!hand || !hand['index-finger-tip'] || !hand['thumb-tip']) {
          return false;
        }

        const distance = this.calculateDistance(
          hand['index-finger-tip'].position,
          hand['thumb-tip'].position
        );

        return distance < this.options.pinchThreshold;
      },
      continuous: true
    });

    // Grab gesture (fist)
    this.registerGesture('grab', {
      detect: (hand) => {
        if (!hand) return false;

        // Check if all fingers are curled
        const fingerTips = ['index', 'middle', 'ring', 'pinky'];
        let curledCount = 0;

        for (const finger of fingerTips) {
          const tip = hand[`${finger}-finger-tip`];
          const base = hand[`${finger}-finger-metacarpal`];

          if (tip && base) {
            const distance = this.calculateDistance(tip.position, base.position);
            if (distance < this.options.grabThreshold) {
              curledCount++;
            }
          }
        }

        return curledCount >= 3; // At least 3 fingers curled
      },
      continuous: true
    });

    // Point gesture
    this.registerGesture('point', {
      detect: (hand) => {
        if (!hand) return false;

        // Index finger extended, others curled
        // Simplified detection
        return true;
      },
      continuous: false
    });

    // Thumbs up
    this.registerGesture('thumbs-up', {
      detect: (hand) => {
        if (!hand) return false;

        // Thumb extended, fingers curled
        // Simplified detection
        return false;
      },
      continuous: false
    });
  }

  /**
   * Register gesture
   */
  registerGesture(name, config) {
    this.gestures.set(name, {
      name,
      detect: config.detect,
      continuous: config.continuous || false,
      callback: config.callback || null
    });
  }

  /**
   * Process controller input
   */
  processControllerInput(controllerData) {
    const { handedness, targetRay, grip, gamepad } = controllerData;

    this.controllers[handedness] = {
      targetRay,
      grip,
      buttons: this.processGamepadButtons(gamepad),
      axes: gamepad ? Array.from(gamepad.axes) : []
    };

    this.stats.controllerInputs++;

    // Raycast from controller
    const hitTarget = this.raycast(targetRay.position, targetRay.orientation);

    if (hitTarget) {
      this.handleHover(hitTarget, handedness, 'controller');
    }

    // Check button presses
    if (gamepad) {
      gamepad.buttons.forEach((button, index) => {
        if (button.pressed) {
          this.handleButtonPress(handedness, index, hitTarget);
        }
      });
    }

    this.emit('controllerUpdate', { handedness, controller: this.controllers[handedness] });
  }

  /**
   * Process gamepad buttons
   */
  processGamepadButtons(gamepad) {
    if (!gamepad) return [];

    return Array.from(gamepad.buttons).map((button, index) => ({
      index,
      pressed: button.pressed,
      touched: button.touched,
      value: button.value
    }));
  }

  /**
   * Process hand tracking input
   */
  processHandTrackingInput(handData) {
    const { handedness, joints } = handData;

    // Check tracking confidence (research shows tracking issues)
    const confidence = this.calculateHandTrackingConfidence(joints);

    if (confidence < this.options.handTrackingConfidenceThreshold) {
      this.emit('handTrackingLost', { handedness, confidence });
      return;
    }

    this.hands[handedness] = joints;
    this.stats.handTrackingInputs++;

    // Gesture recognition
    if (this.options.gestureRecognitionEnabled) {
      const recognizedGesture = this.recognizeGesture(joints, handedness);

      if (recognizedGesture) {
        this.handleGesture(recognizedGesture, handedness, joints);
      }
    }

    // Index finger raycast for pointing
    const indexTip = joints['index-finger-tip'];
    if (indexTip) {
      const direction = this.calculatePointingDirection(joints);
      const hitTarget = this.raycast(indexTip.position, direction);

      if (hitTarget) {
        this.handleHover(hitTarget, handedness, 'hand');
      }
    }

    this.emit('handTrackingUpdate', { handedness, joints, confidence });
  }

  /**
   * Calculate hand tracking confidence
   */
  calculateHandTrackingConfidence(joints) {
    // Count visible joints
    const totalJoints = 25; // XR hand model has 25 joints
    const visibleJoints = Object.keys(joints).length;

    return visibleJoints / totalJoints;
  }

  /**
   * Recognize gesture from hand joints
   */
  recognizeGesture(joints, handedness) {
    for (const [name, gesture] of this.gestures) {
      if (gesture.detect(joints)) {
        if (!gesture.continuous && this.currentGesture === name) {
          continue; // Already recognized
        }

        this.currentGesture = name;
        this.stats.gesturesRecognized++;

        return {
          name,
          handedness,
          continuous: gesture.continuous
        };
      }
    }

    // No gesture recognized
    if (this.currentGesture && !this.gestures.get(this.currentGesture).continuous) {
      this.currentGesture = null;
    }

    return null;
  }

  /**
   * Calculate pointing direction from hand joints
   */
  calculatePointingDirection(joints) {
    const indexTip = joints['index-finger-tip'];
    const indexBase = joints['index-finger-metacarpal'];

    if (!indexTip || !indexBase) {
      return { x: 0, y: 0, z: -1 }; // Default forward
    }

    // Direction from base to tip
    const dx = indexTip.position.x - indexBase.position.x;
    const dy = indexTip.position.y - indexBase.position.y;
    const dz = indexTip.position.z - indexBase.position.z;

    const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

    return {
      x: dx / length,
      y: dy / length,
      z: dz / length
    };
  }

  /**
   * Process gaze input
   */
  processGazeInput(gazeData) {
    this.gaze.position = gazeData.position;
    this.gaze.direction = gazeData.direction;
    this.gaze.active = true;

    this.stats.gazeInputs++;

    // Raycast from gaze
    const hitTarget = this.raycast(gazeData.position, gazeData.direction);

    if (hitTarget) {
      this.handleGazeHover(hitTarget);
    } else {
      // Reset gaze dwell
      this.gaze.dwellStart = null;
      this.gaze.target = null;
    }

    this.emit('gazeUpdate', gazeData);
  }

  /**
   * Handle gaze hover (with dwell time)
   */
  handleGazeHover(target) {
    if (this.gaze.target !== target) {
      // New target
      this.gaze.target = target;
      this.gaze.dwellStart = Date.now();

      this.handleHover(target, 'gaze', 'gaze');
    } else {
      // Check dwell time
      const dwellDuration = Date.now() - this.gaze.dwellStart;

      if (dwellDuration >= this.options.gazeDwellTime) {
        // Dwell activation
        this.handleSelect(target, 'gaze');
        this.gaze.dwellStart = Date.now(); // Reset for continuous activation
      }

      this.emit('gazeDwell', {
        target,
        duration: dwellDuration,
        progress: dwellDuration / this.options.gazeDwellTime
      });
    }
  }

  /**
   * Raycast to find interactable targets
   */
  raycast(origin, direction) {
    // Simplified raycast - actual implementation would use spatial data structures
    let closestTarget = null;
    let closestDistance = Infinity;

    for (const [id, interactable] of this.interactables) {
      const distance = this.rayIntersectsSphere(
        origin,
        direction,
        interactable.position,
        interactable.radius || 0.1
      );

      if (distance !== null && distance < closestDistance) {
        closestDistance = distance;
        closestTarget = interactable;
      }
    }

    return closestTarget;
  }

  /**
   * Ray-sphere intersection
   */
  rayIntersectsSphere(rayOrigin, rayDirection, sphereCenter, sphereRadius) {
    // Vector from ray origin to sphere center
    const dx = sphereCenter.x - rayOrigin.x;
    const dy = sphereCenter.y - rayOrigin.y;
    const dz = sphereCenter.z - rayOrigin.z;

    // Project onto ray direction
    const projection = dx * rayDirection.x + dy * rayDirection.y + dz * rayDirection.z;

    if (projection < 0) {
      return null; // Behind ray origin
    }

    // Closest point on ray
    const closestX = rayOrigin.x + rayDirection.x * projection;
    const closestY = rayOrigin.y + rayDirection.y * projection;
    const closestZ = rayOrigin.z + rayDirection.z * projection;

    // Distance from closest point to sphere center
    const distX = sphereCenter.x - closestX;
    const distY = sphereCenter.y - closestY;
    const distZ = sphereCenter.z - closestZ;
    const distance = Math.sqrt(distX * distX + distY * distY + distZ * distZ);

    if (distance <= sphereRadius) {
      return projection; // Hit!
    }

    return null;
  }

  /**
   * Handle hover event
   */
  handleHover(target, source, inputType) {
    if (!this.hoveredTargets.has(target.id)) {
      this.hoveredTargets.add(target.id);

      this.emit('hover', {
        target,
        source,
        inputType
      });

      // Trigger haptic feedback
      if (this.options.enableHaptics && inputType === 'controller') {
        this.triggerHaptic(source, 0.1, 10);
      }
    }
  }

  /**
   * Handle button press
   */
  handleButtonPress(handedness, buttonIndex, target) {
    if (target) {
      this.handleSelect(target, handedness);
    }

    this.emit('buttonPress', {
      handedness,
      buttonIndex,
      target
    });
  }

  /**
   * Handle select event
   */
  handleSelect(target, source) {
    if (!target) return;

    this.selectedTargets.add(target.id);

    this.emit('select', {
      target,
      source
    });

    // Trigger strong haptic feedback
    if (this.options.enableHaptics && typeof source === 'string' && source !== 'gaze') {
      this.triggerHaptic(source, this.options.hapticIntensity, 50);
    }

    // Call target's select handler
    if (target.onSelect) {
      target.onSelect();
    }
  }

  /**
   * Handle gesture
   */
  handleGesture(gesture, handedness, joints) {
    this.emit('gesture', {
      gesture: gesture.name,
      handedness,
      continuous: gesture.continuous,
      joints
    });

    // Gesture-specific actions
    switch (gesture.name) {
      case 'pinch':
        this.emit('pinch', { handedness, joints });
        break;

      case 'grab':
        this.emit('grab', { handedness, joints });
        break;

      case 'point':
        this.emit('point', { handedness, joints });
        break;

      case 'thumbs-up':
        this.emit('thumbsUp', { handedness });
        break;
    }
  }

  /**
   * Trigger haptic feedback
   */
  triggerHaptic(handedness, intensity, duration) {
    // This would use Gamepad Haptics API
    this.stats.hapticsTriggered++;

    this.emit('haptic', {
      handedness,
      intensity,
      duration
    });
  }

  /**
   * Register interactable object
   */
  registerInteractable(id, config) {
    this.interactables.set(id, {
      id,
      position: config.position,
      radius: config.radius || 0.1,
      onSelect: config.onSelect || null,
      onHover: config.onHover || null,
      data: config.data || {}
    });

    this.emit('interactableRegistered', { id });
  }

  /**
   * Unregister interactable object
   */
  unregisterInteractable(id) {
    this.interactables.delete(id);
    this.hoveredTargets.delete(id);
    this.selectedTargets.delete(id);

    this.emit('interactableUnregistered', { id });
  }

  /**
   * Calculate distance between two points
   */
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Register voice command
   */
  registerVoiceCommand(phrase, callback) {
    this.voiceCommands.set(phrase.toLowerCase(), callback);
  }

  /**
   * Process voice command
   */
  processVoiceCommand(phrase) {
    const normalizedPhrase = phrase.toLowerCase().trim();
    const callback = this.voiceCommands.get(normalizedPhrase);

    if (callback) {
      callback();
      this.stats.voiceInputs++;

      this.emit('voiceCommand', { phrase });
    }
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      interactableCount: this.interactables.size,
      hoveredCount: this.hoveredTargets.size,
      selectedCount: this.selectedTargets.size,
      registeredGestures: this.gestures.size,
      voiceCommands: this.voiceCommands.size
    };
  }

  /**
   * Clear hovered targets
   */
  clearHoveredTargets() {
    this.hoveredTargets.clear();
  }

  /**
   * Clear selected targets
   */
  clearSelectedTargets() {
    this.selectedTargets.clear();
  }
}

module.exports = VRInputHandler;
