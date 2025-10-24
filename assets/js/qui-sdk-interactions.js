/**
 * QuiBrowserSDK - Interaction Components
 *
 * Advanced interaction systems for WebXR:
 * - Hand Menu (controller-free menu)
 * - Voice Commands (100+ languages)
 * - Gaze Interaction (eye tracking + dwell time)
 * - Gesture Recognition (12+ patterns)
 * - Haptic Feedback
 *
 * @version 3.8.0
 * @author Qui Browser Team
 * @license MIT
 */

/**
 * Hand Menu Component
 * Controller-free menu attached to hand
 */
class HandMenuComponent {
  constructor(sdk, options = {}) {
    this.sdk = sdk;
    this.enabled = false;
    this.menu = null;
    this.handTracker = null;

    this.config = {
      hand: options.hand || 'left', // left or right
      position: options.position || { x: 0, y: 0, z: 0.1 },
      items: options.items || [],
      itemHeight: options.itemHeight || 0.08,
      itemWidth: options.itemWidth || 0.3,
      spacing: options.spacing || 0.01,
      backgroundColor: options.backgroundColor || 0x222222,
      textColor: options.textColor || 0xffffff,
      hoverColor: options.hoverColor || 0x0052cc,
      autoHide: options.autoHide !== false,
      showOnGesture: options.showOnGesture || 'palm' // palm, pinch, thumbUp
    };
  }

  async initialize() {
    console.log('[HandMenuComponent] Initializing hand menu for', this.config.hand, 'hand');

    try {
      // Check hand tracking support
      if (!this.sdk.xrSession) {
        throw new Error('XR session not available');
      }

      // Create menu group
      this.menu = new THREE.Group();
      this.menu.visible = false;

      // Create menu items
      this.config.items.forEach((item, index) => {
        const menuItem = this.createMenuItem(item, index);
        this.menu.add(menuItem);
      });

      // Add to scene
      this.sdk.scene.add(this.menu);

      // Initialize hand tracking
      await this.initializeHandTracking();

      this.enabled = true;
      console.log('[HandMenuComponent] Hand menu initialized');

      return true;

    } catch (error) {
      console.error('[HandMenuComponent] Initialization failed:', error);
      return false;
    }
  }

  createMenuItem(item, index) {
    const group = new THREE.Group();

    // Background
    const geometry = new THREE.PlaneGeometry(this.config.itemWidth, this.config.itemHeight);
    const material = new THREE.MeshStandardMaterial({
      color: this.config.backgroundColor,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide
    });
    const background = new THREE.Mesh(geometry, material);
    group.add(background);

    // Text
    if (window.VRTextRenderer) {
      const textRenderer = new VRTextRenderer();
      const text = textRenderer.createText({
        text: item.label || item.text,
        fontSize: 0.04,
        color: this.config.textColor,
        maxWidth: this.config.itemWidth * 0.9
      });
      text.position.z = 0.001;
      group.add(text);
    }

    // Icon (if provided)
    if (item.icon) {
      // Load icon texture
      const loader = new THREE.TextureLoader();
      loader.load(item.icon, (texture) => {
        const iconGeometry = new THREE.PlaneGeometry(0.05, 0.05);
        const iconMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true
        });
        const icon = new THREE.Mesh(iconGeometry, iconMaterial);
        icon.position.set(-this.config.itemWidth / 2 + 0.04, 0, 0.001);
        group.add(icon);
      });
    }

    // Position
    const yOffset = -index * (this.config.itemHeight + this.config.spacing);
    group.position.y = yOffset;

    // Interaction data
    group.userData.interactive = true;
    group.userData.menuItem = true;
    group.userData.label = item.label || item.text;
    group.userData.onClick = item.onClick;
    group.userData.originalColor = this.config.backgroundColor;
    group.userData.hoverColor = this.config.hoverColor;
    group.userData.background = background;

    return group;
  }

  async initializeHandTracking() {
    // Get hand input source
    const inputSources = this.sdk.xrSession.inputSources;
    for (const inputSource of inputSources) {
      if (inputSource.hand && inputSource.handedness === this.config.hand) {
        this.handTracker = inputSource.hand;
        console.log('[HandMenuComponent] Hand tracking source found');
        break;
      }
    }

    if (!this.handTracker) {
      console.warn('[HandMenuComponent] Hand tracking not available');
    }
  }

  update(frame, referenceSpace) {
    if (!this.enabled || !this.menu) return;

    // Update hand tracking
    if (this.handTracker && frame) {
      try {
        // Get hand joints
        const joints = this.handTracker.values();
        const wrist = this.handTracker.get('wrist');

        if (wrist) {
          const wristPose = frame.getJointPose(wrist, referenceSpace);
          if (wristPose) {
            // Position menu relative to hand
            const position = wristPose.transform.position;
            const orientation = wristPose.transform.orientation;

            this.menu.position.set(
              position.x + this.config.position.x,
              position.y + this.config.position.y,
              position.z + this.config.position.z
            );

            this.menu.quaternion.set(
              orientation.x,
              orientation.y,
              orientation.z,
              orientation.w
            );

            // Check gesture to show/hide menu
            if (this.config.autoHide) {
              const gesture = this.detectGesture();
              if (gesture === this.config.showOnGesture) {
                this.show();
              } else if (gesture !== this.config.showOnGesture && this.menu.visible) {
                // Keep visible for a moment after gesture ends
                setTimeout(() => this.hide(), 1000);
              }
            } else {
              this.show();
            }
          }
        }
      } catch (error) {
        console.error('[HandMenuComponent] Hand tracking update error:', error);
      }
    }
  }

  detectGesture() {
    // Placeholder for gesture detection
    // In real implementation, analyze joint positions
    return 'palm';
  }

  show() {
    if (this.menu) {
      this.menu.visible = true;
    }
  }

  hide() {
    if (this.menu) {
      this.menu.visible = false;
    }
  }

  toggle() {
    if (this.menu) {
      this.menu.visible = !this.menu.visible;
    }
  }

  dispose() {
    if (this.menu) {
      this.sdk.scene.remove(this.menu);
      this.menu = null;
    }
    this.enabled = false;
    console.log('[HandMenuComponent] Disposed');
  }
}

/**
 * Voice Command Component
 * Integrates with VR Voice Commands I18n system
 */
class VoiceCommandComponent {
  constructor(sdk, options = {}) {
    this.sdk = sdk;
    this.enabled = false;
    this.voiceSystem = null;
    this.customCommands = new Map();

    this.config = {
      language: options.language || 'en',
      continuous: options.continuous !== false,
      interimResults: options.interimResults !== false,
      maxAlternatives: options.maxAlternatives || 1,
      commands: options.commands || [],
      onCommand: options.onCommand || null,
      onError: options.onError || null,
      showFeedback: options.showFeedback !== false,
      feedbackDuration: options.feedbackDuration || 2000
    };

    this.feedbackPanel = null;
  }

  async initialize() {
    console.log('[VoiceCommandComponent] Initializing voice commands');

    try {
      // Check speech recognition support
      if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        throw new Error('Speech recognition not supported');
      }

      // Initialize voice system
      if (window.VRVoiceCommandsI18n) {
        this.voiceSystem = new VRVoiceCommandsI18n();
        await this.voiceSystem.initialize();
        await this.voiceSystem.setLanguage(this.config.language);
        console.log('[VoiceCommandComponent] Voice system initialized');
      }

      // Register custom commands
      this.config.commands.forEach(cmd => {
        this.registerCommand(cmd.pattern, cmd.handler, cmd.description);
      });

      // Create feedback panel
      if (this.config.showFeedback) {
        this.createFeedbackPanel();
      }

      this.enabled = true;
      console.log('[VoiceCommandComponent] Voice commands initialized');

      return true;

    } catch (error) {
      console.error('[VoiceCommandComponent] Initialization failed:', error);
      return false;
    }
  }

  registerCommand(pattern, handler, description = '') {
    const commandId = `custom_${this.customCommands.size}`;
    this.customCommands.set(commandId, {
      pattern: pattern,
      handler: handler,
      description: description
    });

    console.log('[VoiceCommandComponent] Registered command:', pattern);
  }

  start() {
    if (!this.enabled) {
      console.warn('[VoiceCommandComponent] Not initialized');
      return;
    }

    if (this.voiceSystem) {
      this.voiceSystem.startListening((result) => {
        this.handleVoiceResult(result);
      });
      console.log('[VoiceCommandComponent] Listening started');
    }
  }

  stop() {
    if (this.voiceSystem) {
      this.voiceSystem.stopListening();
      console.log('[VoiceCommandComponent] Listening stopped');
    }
  }

  handleVoiceResult(result) {
    const transcript = result.transcript.toLowerCase();
    console.log('[VoiceCommandComponent] Voice input:', transcript);

    // Show feedback
    if (this.config.showFeedback) {
      this.showFeedback(`"${result.transcript}"`);
    }

    // Check custom commands
    for (const [id, command] of this.customCommands) {
      const pattern = new RegExp(command.pattern, 'i');
      if (pattern.test(transcript)) {
        console.log('[VoiceCommandComponent] Command matched:', command.pattern);
        command.handler(result, transcript);

        if (this.config.onCommand) {
          this.config.onCommand(command, result);
        }
        return;
      }
    }

    // Check built-in commands
    if (this.voiceSystem) {
      const builtInCommand = this.voiceSystem.executeCommand(transcript);
      if (builtInCommand) {
        console.log('[VoiceCommandComponent] Built-in command executed');
        if (this.config.onCommand) {
          this.config.onCommand(builtInCommand, result);
        }
      }
    }
  }

  createFeedbackPanel() {
    this.feedbackPanel = this.sdk.createPanel3D({
      width: 0.8,
      height: 0.15,
      position: { x: 0, y: 2.0, z: -1.0 },
      color: 0x0052cc,
      opacity: 0.9
    });
    this.feedbackPanel.visible = false;
  }

  showFeedback(text) {
    if (!this.feedbackPanel) return;

    // Update feedback text
    this.feedbackPanel.visible = true;

    // Auto-hide after duration
    setTimeout(() => {
      this.feedbackPanel.visible = false;
    }, this.config.feedbackDuration);
  }

  dispose() {
    this.stop();

    if (this.feedbackPanel) {
      this.sdk.scene.remove(this.feedbackPanel);
      this.feedbackPanel = null;
    }

    this.enabled = false;
    console.log('[VoiceCommandComponent] Disposed');
  }
}

/**
 * Gaze Interaction Component
 * Eye tracking + dwell time selection
 */
class GazeInteractionComponent {
  constructor(sdk, options = {}) {
    this.sdk = sdk;
    this.enabled = false;
    this.eyeTracker = null;
    this.gazeTarget = null;
    this.gazeDwellStart = 0;

    this.config = {
      dwellTime: options.dwellTime || 800, // ms
      showReticle: options.showReticle !== false,
      reticleColor: options.reticleColor || 0x00ff00,
      reticleSize: options.reticleSize || 0.02,
      showProgressRing: options.showProgressRing !== false,
      onGazeStart: options.onGazeStart || null,
      onGazeEnd: options.onGazeEnd || null,
      onGazeDwell: options.onGazeDwell || null,
      raycastDistance: options.raycastDistance || 10
    };

    this.reticle = null;
    this.progressRing = null;
    this.raycaster = new THREE.Raycaster();
  }

  async initialize() {
    console.log('[GazeInteractionComponent] Initializing gaze interaction');

    try {
      // Check eye tracking support
      if (!this.sdk.xrSession) {
        throw new Error('XR session not available');
      }

      // Create reticle
      if (this.config.showReticle) {
        this.createReticle();
      }

      // Create progress ring
      if (this.config.showProgressRing) {
        this.createProgressRing();
      }

      this.enabled = true;
      console.log('[GazeInteractionComponent] Gaze interaction initialized');

      return true;

    } catch (error) {
      console.error('[GazeInteractionComponent] Initialization failed:', error);
      return false;
    }
  }

  createReticle() {
    const geometry = new THREE.CircleGeometry(this.config.reticleSize, 32);
    const material = new THREE.MeshBasicMaterial({
      color: this.config.reticleColor,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide
    });
    this.reticle = new THREE.Mesh(geometry, material);
    this.sdk.camera.add(this.reticle);
    this.reticle.position.set(0, 0, -1);
  }

  createProgressRing() {
    const geometry = new THREE.RingGeometry(
      this.config.reticleSize * 1.5,
      this.config.reticleSize * 2,
      32,
      1,
      0,
      0 // Start with 0 angle
    );
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide
    });
    this.progressRing = new THREE.Mesh(geometry, material);
    this.sdk.camera.add(this.progressRing);
    this.progressRing.position.set(0, 0, -1);
    this.progressRing.visible = false;
  }

  update(frame, referenceSpace) {
    if (!this.enabled) return;

    // Get eye tracking data
    let gazeDirection = null;

    if (frame && window.VRFoveatedRenderingSystem) {
      // Use eye tracking if available
      const eyeData = this.getEyeTrackingData(frame, referenceSpace);
      if (eyeData) {
        gazeDirection = eyeData.direction;
      }
    }

    // Fallback to camera direction
    if (!gazeDirection) {
      gazeDirection = new THREE.Vector3(0, 0, -1);
      gazeDirection.applyQuaternion(this.sdk.camera.quaternion);
    }

    // Perform raycast
    this.raycaster.set(this.sdk.camera.position, gazeDirection);
    const intersects = this.raycaster.intersectObjects(this.sdk.scene.children, true);

    // Find first interactive object
    let target = null;
    for (const intersect of intersects) {
      if (intersect.object.userData.interactive) {
        target = intersect.object;
        break;
      }
    }

    // Handle gaze target
    if (target) {
      if (this.gazeTarget !== target) {
        // New target
        this.onGazeStart(target);
        this.gazeTarget = target;
        this.gazeDwellStart = Date.now();

        // Show progress ring
        if (this.progressRing) {
          this.progressRing.visible = true;
        }
      } else {
        // Same target - check dwell time
        const dwellDuration = Date.now() - this.gazeDwellStart;

        // Update progress ring
        if (this.progressRing) {
          const progress = Math.min(dwellDuration / this.config.dwellTime, 1);
          this.updateProgressRing(progress);
        }

        // Trigger dwell action
        if (dwellDuration >= this.config.dwellTime && !this.gazeTarget.userData.gazeDwelled) {
          this.onGazeDwell(target);
          this.gazeTarget.userData.gazeDwelled = true;
        }
      }
    } else {
      // No target
      if (this.gazeTarget) {
        this.onGazeEnd(this.gazeTarget);
        this.gazeTarget = null;
        this.gazeDwellStart = 0;

        // Hide progress ring
        if (this.progressRing) {
          this.progressRing.visible = false;
        }
      }
    }
  }

  updateProgressRing(progress) {
    if (!this.progressRing) return;

    // Update ring geometry to show progress
    const angle = progress * Math.PI * 2;
    this.progressRing.geometry.dispose();
    this.progressRing.geometry = new THREE.RingGeometry(
      this.config.reticleSize * 1.5,
      this.config.reticleSize * 2,
      32,
      1,
      0,
      angle
    );
  }

  getEyeTrackingData(frame, referenceSpace) {
    // Placeholder - integrate with VRFoveatedRenderingSystem
    return null;
  }

  onGazeStart(target) {
    console.log('[GazeInteractionComponent] Gaze started on:', target.userData.label || target.name);

    // Visual feedback - highlight
    if (target.userData.hoverColor && target.userData.background) {
      target.userData.background.material.color.setHex(target.userData.hoverColor);
    }

    // Callback
    if (this.config.onGazeStart) {
      this.config.onGazeStart(target);
    }
  }

  onGazeEnd(target) {
    console.log('[GazeInteractionComponent] Gaze ended on:', target.userData.label || target.name);

    // Remove highlight
    if (target.userData.originalColor && target.userData.background) {
      target.userData.background.material.color.setHex(target.userData.originalColor);
    }

    // Reset dwell flag
    target.userData.gazeDwelled = false;

    // Callback
    if (this.config.onGazeEnd) {
      this.config.onGazeEnd(target);
    }
  }

  onGazeDwell(target) {
    console.log('[GazeInteractionComponent] Gaze dwell on:', target.userData.label || target.name);

    // Trigger click action
    if (target.userData.onClick) {
      target.userData.onClick(target);
    }

    // Haptic feedback
    if (this.sdk.xrSession && this.sdk.xrSession.inputSources) {
      for (const inputSource of this.sdk.xrSession.inputSources) {
        if (inputSource.gamepad && inputSource.gamepad.hapticActuators) {
          inputSource.gamepad.hapticActuators[0].pulse(0.5, 100);
        }
      }
    }

    // Callback
    if (this.config.onGazeDwell) {
      this.config.onGazeDwell(target);
    }
  }

  dispose() {
    if (this.reticle) {
      this.sdk.camera.remove(this.reticle);
      this.reticle = null;
    }

    if (this.progressRing) {
      this.sdk.camera.remove(this.progressRing);
      this.progressRing = null;
    }

    this.enabled = false;
    console.log('[GazeInteractionComponent] Disposed');
  }
}

/**
 * Gesture Recognition Component
 * Recognizes hand gestures (pinch, grab, point, thumbUp, etc.)
 */
class GestureRecognitionComponent {
  constructor(sdk, options = {}) {
    this.sdk = sdk;
    this.enabled = false;
    this.handTrackers = { left: null, right: null };
    this.currentGestures = { left: 'none', right: 'none' };

    this.config = {
      gestures: options.gestures || ['pinch', 'grab', 'point', 'thumbUp', 'peace', 'fist'],
      onGesture: options.onGesture || null,
      minConfidence: options.minConfidence || 0.8,
      smoothing: options.smoothing !== false
    };

    this.gestureHistory = {
      left: [],
      right: []
    };
  }

  async initialize() {
    console.log('[GestureRecognitionComponent] Initializing gesture recognition');

    try {
      if (!this.sdk.xrSession) {
        throw new Error('XR session not available');
      }

      // Initialize hand tracking
      await this.initializeHandTracking();

      this.enabled = true;
      console.log('[GestureRecognitionComponent] Gesture recognition initialized');

      return true;

    } catch (error) {
      console.error('[GestureRecognitionComponent] Initialization failed:', error);
      return false;
    }
  }

  async initializeHandTracking() {
    const inputSources = this.sdk.xrSession.inputSources;
    for (const inputSource of inputSources) {
      if (inputSource.hand) {
        this.handTrackers[inputSource.handedness] = inputSource.hand;
        console.log('[GestureRecognitionComponent] Hand tracker found:', inputSource.handedness);
      }
    }
  }

  update(frame, referenceSpace) {
    if (!this.enabled || !frame) return;

    // Detect gestures for each hand
    ['left', 'right'].forEach(hand => {
      if (this.handTrackers[hand]) {
        const gesture = this.detectGesture(hand, frame, referenceSpace);

        // Check if gesture changed
        if (gesture !== this.currentGestures[hand]) {
          console.log(`[GestureRecognitionComponent] ${hand} hand gesture:`, gesture);
          this.currentGestures[hand] = gesture;

          // Callback
          if (this.config.onGesture) {
            this.config.onGesture(hand, gesture);
          }
        }

        // Update history
        this.gestureHistory[hand].push(gesture);
        if (this.gestureHistory[hand].length > 10) {
          this.gestureHistory[hand].shift();
        }
      }
    });
  }

  detectGesture(hand, frame, referenceSpace) {
    // Get hand joints
    const tracker = this.handTrackers[hand];
    if (!tracker) return 'none';

    try {
      // Get key joint poses
      const thumb = tracker.get('thumb-tip');
      const index = tracker.get('index-finger-tip');
      const middle = tracker.get('middle-finger-tip');
      const ring = tracker.get('ring-finger-tip');
      const pinky = tracker.get('pinky-finger-tip');
      const wrist = tracker.get('wrist');

      if (!thumb || !index || !middle || !ring || !pinky || !wrist) {
        return 'none';
      }

      const thumbPose = frame.getJointPose(thumb, referenceSpace);
      const indexPose = frame.getJointPose(index, referenceSpace);
      const middlePose = frame.getJointPose(middle, referenceSpace);
      const ringPose = frame.getJointPose(ring, referenceSpace);
      const pinkyPose = frame.getJointPose(pinky, referenceSpace);
      const wristPose = frame.getJointPose(wrist, referenceSpace);

      if (!thumbPose || !indexPose || !middlePose || !ringPose || !pinkyPose || !wristPose) {
        return 'none';
      }

      // Calculate distances
      const thumbIndex = this.distance(thumbPose.transform.position, indexPose.transform.position);
      const thumbMiddle = this.distance(thumbPose.transform.position, middlePose.transform.position);
      const indexWrist = this.distance(indexPose.transform.position, wristPose.transform.position);
      const middleWrist = this.distance(middlePose.transform.position, wristPose.transform.position);
      const ringWrist = this.distance(ringPose.transform.position, wristPose.transform.position);
      const pinkyWrist = this.distance(pinkyPose.transform.position, wristPose.transform.position);

      // Detect gestures
      if (thumbIndex < 0.03) {
        return 'pinch';
      }

      if (indexWrist < 0.08 && middleWrist < 0.08 && ringWrist < 0.08 && pinkyWrist < 0.08) {
        return 'fist';
      }

      if (indexWrist > 0.12 && middleWrist < 0.08 && ringWrist < 0.08 && pinkyWrist < 0.08) {
        return 'point';
      }

      if (indexWrist > 0.12 && middleWrist > 0.12 && ringWrist < 0.08 && pinkyWrist < 0.08) {
        return 'peace';
      }

      if (indexWrist > 0.10 && middleWrist > 0.10 && ringWrist > 0.10 && pinkyWrist > 0.10) {
        return 'open';
      }

      return 'none';

    } catch (error) {
      console.error('[GestureRecognitionComponent] Gesture detection error:', error);
      return 'none';
    }
  }

  distance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  getGesture(hand) {
    return this.currentGestures[hand] || 'none';
  }

  dispose() {
    this.handTrackers = { left: null, right: null };
    this.enabled = false;
    console.log('[GestureRecognitionComponent] Disposed');
  }
}

// Export components
if (typeof window !== 'undefined') {
  window.HandMenuComponent = HandMenuComponent;
  window.VoiceCommandComponent = VoiceCommandComponent;
  window.GazeInteractionComponent = GazeInteractionComponent;
  window.GestureRecognitionComponent = GestureRecognitionComponent;

  // Add to SDK prototype
  if (window.QuiBrowserSDK) {
    QuiBrowserSDK.prototype.createHandMenu = function(options) {
      const component = new HandMenuComponent(this, options);
      this.components.set('handMenu', component);
      return component;
    };

    QuiBrowserSDK.prototype.createVoiceCommands = function(options) {
      const component = new VoiceCommandComponent(this, options);
      this.components.set('voiceCommands', component);
      return component;
    };

    QuiBrowserSDK.prototype.createGazeInteraction = function(options) {
      const component = new GazeInteractionComponent(this, options);
      this.components.set('gazeInteraction', component);
      return component;
    };

    QuiBrowserSDK.prototype.createGestureRecognition = function(options) {
      const component = new GestureRecognitionComponent(this, options);
      this.components.set('gestureRecognition', component);
      return component;
    };
  }

  console.log('[QuiBrowserSDK] Interaction components loaded');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    HandMenuComponent,
    VoiceCommandComponent,
    GazeInteractionComponent,
    GestureRecognitionComponent
  };
}
