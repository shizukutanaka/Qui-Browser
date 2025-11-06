/**
 * WebXR Hand Tracking System
 * Natural hand interaction with 25 joints per hand
 *
 * John Carmack principle: Natural interaction reduces learning curve
 */

import * as THREE from 'three';

export class HandTracking {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.enabled = false;

    // Hand models
    this.leftHand = null;
    this.rightHand = null;

    // Joint tracking
    this.joints = {
      left: new Map(),
      right: new Map()
    };

    // Gesture recognition
    this.gestures = {
      left: null,
      right: null
    };

    // Gesture callbacks
    this.gestureCallbacks = new Map();

    // Statistics
    this.stats = {
      framesTracked: 0,
      gesturesRecognized: 0,
      pinchAccuracy: 0,
      trackingQuality: 1.0
    };

    // Joint names as per WebXR spec
    this.jointNames = [
      'wrist',
      'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
      'index-finger-metacarpal', 'index-finger-phalanx-proximal',
      'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
      'middle-finger-metacarpal', 'middle-finger-phalanx-proximal',
      'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
      'ring-finger-metacarpal', 'ring-finger-phalanx-proximal',
      'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
      'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal',
      'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip'
    ];

    // Gesture thresholds
    this.thresholds = {
      pinch: 0.02,      // 2cm between thumb and index tips
      fist: 0.1,        // Average finger curl threshold
      pointSpeed: 0.5,  // m/s for pointing gesture
      grabStrength: 0.7 // Strength threshold for grab
    };
  }

  /**
   * Initialize hand tracking
   */
  async initialize(session) {
    if (!session) {
      console.error('HandTracking: No XR session provided');
      return false;
    }

    // Check if hand tracking is supported
    if (!session.inputSources) {
      console.error('HandTracking: Input sources not available');
      return false;
    }

    // Create hand models
    this.createHandModels();

    // Setup input source handlers
    session.addEventListener('inputsourceschange', (event) => {
      this.onInputSourcesChange(event);
    });

    this.enabled = true;
    console.log('HandTracking: Initialized successfully');
    return true;
  }

  /**
   * Create visual hand models
   */
  createHandModels() {
    // Material for hand joints
    const jointMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      emissive: 0x004400,
      transparent: true,
      opacity: 0.8
    });

    // Material for bones (connections between joints)
    const boneMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      emissive: 0x004444,
      transparent: true,
      opacity: 0.6
    });

    // Create hand groups
    this.leftHand = new THREE.Group();
    this.leftHand.name = 'leftHand';

    this.rightHand = new THREE.Group();
    this.rightHand.name = 'rightHand';

    // Create joint spheres for each hand
    ['left', 'right'].forEach(handedness => {
      const handGroup = handedness === 'left' ? this.leftHand : this.rightHand;

      this.jointNames.forEach(jointName => {
        // Joint sphere
        const jointGeometry = new THREE.SphereGeometry(0.008, 8, 8);
        const jointMesh = new THREE.Mesh(jointGeometry, jointMaterial.clone());
        jointMesh.name = jointName;

        handGroup.add(jointMesh);
        this.joints[handedness].set(jointName, jointMesh);
      });

      // Add to scene
      this.scene.add(handGroup);
    });

    console.log('HandTracking: Hand models created');
  }

  /**
   * Update hand tracking
   */
  update(frame, referenceSpace) {
    if (!this.enabled || !frame || !frame.session) return;

    this.stats.framesTracked++;

    // Process each input source
    for (const inputSource of frame.session.inputSources) {
      if (inputSource.hand) {
        this.updateHand(frame, inputSource, referenceSpace);
      }
    }

    // Recognize gestures
    this.recognizeGestures();
  }

  /**
   * Update individual hand
   */
  updateHand(frame, inputSource, referenceSpace) {
    const handedness = inputSource.handedness;
    if (!handedness || handedness === 'none') return;

    const handGroup = handedness === 'left' ? this.leftHand : this.rightHand;
    const joints = this.joints[handedness];

    // Update each joint
    for (const jointName of this.jointNames) {
      const joint = inputSource.hand.get(jointName);
      if (!joint) continue;

      const jointPose = frame.getJointPose(joint, referenceSpace);
      if (!jointPose) continue;

      // Update joint position
      const jointMesh = joints.get(jointName);
      if (jointMesh) {
        const { position, orientation } = jointPose.transform;
        jointMesh.position.set(position.x, position.y, position.z);

        if (orientation) {
          jointMesh.quaternion.set(
            orientation.x,
            orientation.y,
            orientation.z,
            orientation.w
          );
        }

        // Update joint radius based on tracking confidence
        const radius = jointPose.radius || 0.008;
        jointMesh.scale.setScalar(radius / 0.008);

        // Color code by tracking quality
        if (jointMesh.material) {
          const quality = jointPose.radius ? 1.0 : 0.5;
          jointMesh.material.opacity = 0.4 + quality * 0.4;
        }
      }
    }

    // Make hand visible
    handGroup.visible = true;
  }

  /**
   * Recognize hand gestures
   */
  recognizeGestures() {
    ['left', 'right'].forEach(handedness => {
      const joints = this.joints[handedness];
      if (joints.size === 0) return;

      const gesture = this.detectGesture(joints);

      // Check if gesture changed
      if (gesture !== this.gestures[handedness]) {
        this.onGestureChange(handedness, this.gestures[handedness], gesture);
        this.gestures[handedness] = gesture;
      }
    });
  }

  /**
   * Detect current gesture
   */
  detectGesture(joints) {
    const thumbTip = joints.get('thumb-tip');
    const indexTip = joints.get('index-finger-tip');
    const middleTip = joints.get('middle-finger-tip');
    const ringTip = joints.get('ring-finger-tip');
    const pinkyTip = joints.get('pinky-finger-tip');
    const wrist = joints.get('wrist');

    if (!thumbTip || !indexTip || !wrist) return 'none';

    // Pinch detection
    const pinchDistance = thumbTip.position.distanceTo(indexTip.position);
    if (pinchDistance < this.thresholds.pinch) {
      this.stats.gesturesRecognized++;
      return 'pinch';
    }

    // Point detection (index extended, others curled)
    if (this.isFingerExtended(joints, 'index-finger') &&
        !this.isFingerExtended(joints, 'middle-finger') &&
        !this.isFingerExtended(joints, 'ring-finger') &&
        !this.isFingerExtended(joints, 'pinky-finger')) {
      this.stats.gesturesRecognized++;
      return 'point';
    }

    // Open hand (all fingers extended)
    if (this.isFingerExtended(joints, 'index-finger') &&
        this.isFingerExtended(joints, 'middle-finger') &&
        this.isFingerExtended(joints, 'ring-finger') &&
        this.isFingerExtended(joints, 'pinky-finger')) {
      return 'open';
    }

    // Fist (all fingers curled)
    if (!this.isFingerExtended(joints, 'index-finger') &&
        !this.isFingerExtended(joints, 'middle-finger') &&
        !this.isFingerExtended(joints, 'ring-finger') &&
        !this.isFingerExtended(joints, 'pinky-finger')) {
      this.stats.gesturesRecognized++;
      return 'fist';
    }

    // Peace sign (index and middle extended)
    if (this.isFingerExtended(joints, 'index-finger') &&
        this.isFingerExtended(joints, 'middle-finger') &&
        !this.isFingerExtended(joints, 'ring-finger') &&
        !this.isFingerExtended(joints, 'pinky-finger')) {
      this.stats.gesturesRecognized++;
      return 'peace';
    }

    // Thumbs up
    if (this.isThumbUp(joints)) {
      this.stats.gesturesRecognized++;
      return 'thumbsup';
    }

    return 'none';
  }

  /**
   * Check if finger is extended
   */
  isFingerExtended(joints, fingerName) {
    const metacarpal = joints.get(`${fingerName}-metacarpal`);
    const tip = joints.get(`${fingerName}-tip`);
    const wrist = joints.get('wrist');

    if (!metacarpal || !tip || !wrist) return false;

    // Finger is extended if tip is far from wrist
    const tipDistance = tip.position.distanceTo(wrist.position);
    const metacarpalDistance = metacarpal.position.distanceTo(wrist.position);

    return tipDistance > metacarpalDistance * 1.6;
  }

  /**
   * Check for thumbs up gesture
   */
  isThumbUp(joints) {
    const thumbTip = joints.get('thumb-tip');
    const thumbProximal = joints.get('thumb-phalanx-proximal');
    const wrist = joints.get('wrist');

    if (!thumbTip || !thumbProximal || !wrist) return false;

    // Thumb should be pointing up (positive Y)
    const thumbVector = new THREE.Vector3()
      .subVectors(thumbTip.position, thumbProximal.position)
      .normalize();

    return thumbVector.y > 0.7;
  }

  /**
   * Handle gesture changes
   */
  onGestureChange(handedness, oldGesture, newGesture) {
    console.log(`HandTracking: ${handedness} hand gesture: ${oldGesture} → ${newGesture}`);

    // Trigger callbacks
    const callback = this.gestureCallbacks.get(newGesture);
    if (callback) {
      callback(handedness, newGesture);
    }
  }

  /**
   * Register gesture callback
   */
  onGesture(gesture, callback) {
    this.gestureCallbacks.set(gesture, callback);
  }

  /**
   * Get pinch position (for UI interaction)
   */
  getPinchPosition(handedness) {
    const joints = this.joints[handedness];
    const thumbTip = joints.get('thumb-tip');
    const indexTip = joints.get('index-finger-tip');

    if (!thumbTip || !indexTip) return null;

    // Return midpoint between thumb and index
    return new THREE.Vector3()
      .addVectors(thumbTip.position, indexTip.position)
      .multiplyScalar(0.5);
  }

  /**
   * Get pointing ray (for selection)
   */
  getPointingRay(handedness) {
    const joints = this.joints[handedness];
    const indexTip = joints.get('index-finger-tip');
    const indexProximal = joints.get('index-finger-phalanx-proximal');

    if (!indexTip || !indexProximal) return null;

    const origin = indexProximal.position.clone();
    const direction = new THREE.Vector3()
      .subVectors(indexTip.position, indexProximal.position)
      .normalize();

    return new THREE.Ray(origin, direction);
  }

  /**
   * Handle input source changes
   */
  onInputSourcesChange(event) {
    console.log('HandTracking: Input sources changed', {
      added: event.added.length,
      removed: event.removed.length
    });

    // Hide hands that are no longer tracked
    for (const source of event.removed) {
      if (source.handedness === 'left') {
        this.leftHand.visible = false;
      } else if (source.handedness === 'right') {
        this.rightHand.visible = false;
      }
    }
  }

  /**
   * Get tracking statistics
   */
  getStats() {
    return {
      ...this.stats,
      leftGesture: this.gestures.left,
      rightGesture: this.gestures.right,
      trackingActive: this.enabled
    };
  }

  /**
   * Dispose hand tracking
   */
  dispose() {
    this.enabled = false;

    // Remove hand models from scene
    if (this.leftHand) {
      this.scene.remove(this.leftHand);
      this.leftHand.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    if (this.rightHand) {
      this.scene.remove(this.rightHand);
      this.rightHand.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }

    this.joints.left.clear();
    this.joints.right.clear();
    this.gestureCallbacks.clear();

    console.log('HandTracking: Disposed');
  }
}

/**
 * Usage Example:
 *
 * const handTracking = new HandTracking(renderer, scene);
 *
 * // Initialize with XR session
 * await handTracking.initialize(xrSession);
 *
 * // Register gesture callbacks
 * handTracking.onGesture('pinch', (hand, gesture) => {
 *   console.log(`${hand} hand pinched!`);
 *   const position = handTracking.getPinchPosition(hand);
 *   // Use position for UI interaction
 * });
 *
 * handTracking.onGesture('point', (hand, gesture) => {
 *   const ray = handTracking.getPointingRay(hand);
 *   // Use ray for selection
 * });
 *
 * // Update in render loop
 * function render(timestamp, frame) {
 *   handTracking.update(frame, referenceSpace);
 * }
 *
 * // Get statistics
 * const stats = handTracking.getStats();
 * console.log(`Gestures recognized: ${stats.gesturesRecognized}`);
 */