/**
 * VR Input Handler Module
 *
 * Handle user input in VR
 * - Controller input (buttons, triggers)
 * - Hand tracking (point, grab gestures)
 * - Convert to web interactions (click, scroll)
 *
 * ~250 lines
 */

class VRInputHandler {
  constructor(vrBrowser) {
    this.vrBrowser = vrBrowser;
    this.xrSession = null;
    this.inputSources = [];

    this.lastClickTime = 0;
    this.clickThreshold = 300; // ms for double-click

    // Gesture detection
    this.gestures = {
      point: false,
      grab: false,
      thumbsUp: false,
      pinch: false
    };

    // Input state
    this.controllerState = {
      left: { buttons: {}, axes: {} },
      right: { buttons: {}, axes: {} }
    };
  }

  /**
   * Setup XR input handling
   */
  setupXRInput(xrSession) {
    console.log('[InputHandler] Setting up XR input...');

    this.xrSession = xrSession;

    // Listen for input source events
    xrSession.addEventListener('inputsourceschange', (event) => {
      this.onInputSourcesChange(event);
    });

    // Get initial input sources
    this.updateInputSources();
  }

  /**
   * Update input sources
   */
  updateInputSources() {
    if (!this.xrSession) return;

    this.inputSources = Array.from(this.xrSession.inputSources);
    console.log('[InputHandler] Input sources updated:', this.inputSources.length);

    for (const source of this.inputSources) {
      console.log('[InputHandler] - ' + source.handedness + ' (' + source.targetRayMode + ')');
    }
  }

  /**
   * Handle input sources change
   */
  onInputSourcesChange(event) {
    this.updateInputSources();
  }

  /**
   * Update input state (called every frame)
   */
  update() {
    if (!this.xrSession) {
      this.updateNonVRInput();
      return;
    }

    // Process each input source
    for (const source of this.inputSources) {
      this.processInputSource(source);
    }

    // Update gesture detection
    this.detectGestures();
  }

  /**
   * Process single input source
   */
  processInputSource(source) {
    // Get gamepad if available (controller)
    if (source.gamepad) {
      this.processGamepad(source);
    }

    // Get hand tracking if available
    if (source.hand) {
      this.processHandTracking(source);
    }
  }

  /**
   * Process gamepad input (controllers)
   */
  processGamepad(source) {
    const gamepad = source.gamepad;
    const side = source.handedness; // 'left' or 'right'

    if (!gamepad) return;

    // Track button states
    for (let i = 0; i < gamepad.buttons.length; i++) {
      const button = gamepad.buttons[i];

      if (button.pressed) {
        this.onButtonPressed(side, i, button.value);
      } else {
        this.onButtonReleased(side, i);
      }
    }

    // Track axes (analog sticks, triggers)
    for (let i = 0; i < gamepad.axes.length; i++) {
      const axis = gamepad.axes[i];

      if (Math.abs(axis) > 0.1) { // Deadzone
        this.onAxisMove(side, i, axis);
      }
    }
  }

  /**
   * Process hand tracking
   */
  processHandTracking(source) {
    const hand = source.hand;
    const handedness = source.handedness;

    if (!hand) return;

    // Get hand joints
    const wrist = hand.get('wrist');
    const indexFingerTip = hand.get('index-finger-tip');
    const thumbTip = hand.get('thumb-tip');

    if (wrist && indexFingerTip) {
      // Calculate pointing direction
      const wristPos = wrist.pose?.transform?.position;
      const fingerPos = indexFingerTip.pose?.transform?.position;

      if (wristPos && fingerPos) {
        this.detectPointingGesture(handedness, wristPos, fingerPos);
      }
    }

    if (thumbTip && indexFingerTip) {
      // Detect pinch gesture
      const thumbPos = thumbTip.pose?.transform?.position;
      const fingerPos = indexFingerTip.pose?.transform?.position;

      if (thumbPos && fingerPos) {
        this.detectPinchGesture(handedness, thumbPos, fingerPos);
      }
    }
  }

  /**
   * Button pressed
   */
  onButtonPressed(side, buttonIndex, value) {
    console.log('[InputHandler] Button pressed:', side, buttonIndex, value);

    // Common button mapping:
    // 0: Select trigger
    // 1: Squeeze
    // 2: Touchpad/Thumbstick
    // 3: Menu

    switch (buttonIndex) {
      case 0: // Select/Trigger
        this.onSelectButton(side);
        break;

      case 1: // Squeeze
        this.onGrabButton(side);
        break;

      case 2: // Touchpad/Thumbstick
        this.onTouchpadButton(side);
        break;

      case 3: // Menu
        this.onMenuButton(side);
        break;
    }
  }

  /**
   * Button released
   */
  onButtonReleased(side, buttonIndex) {
    console.log('[InputHandler] Button released:', side, buttonIndex);
  }

  /**
   * Axis movement (analog sticks, triggers)
   */
  onAxisMove(side, axisIndex, value) {
    // Common axis mapping:
    // 0-1: Trigger value
    // 2-3: Thumbstick/Touchpad X/Y

    if (side === 'right') {
      this.controllerState.right.axes[axisIndex] = value;
    } else {
      this.controllerState.left.axes[axisIndex] = value;
    }

    // Trigger axis
    if (axisIndex === 1) {
      this.onTriggerAxis(side, value);
    }
  }

  /**
   * Select button (trigger) - Click
   */
  onSelectButton(side) {
    const now = Date.now();
    const isDoubleClick = (now - this.lastClickTime) < this.clickThreshold;
    this.lastClickTime = now;

    console.log('[InputHandler] Select:', side, isDoubleClick ? '(double-click)' : '(single-click)');

    // Emit click event
    if (isDoubleClick) {
      this.vrBrowser.emit('doubleclick', { hand: side });
    } else {
      this.vrBrowser.emit('click', { hand: side });
    }
  }

  /**
   * Grab button (squeeze) - Drag
   */
  onGrabButton(side) {
    console.log('[InputHandler] Grab:', side);
    this.vrBrowser.emit('grab', { hand: side });
  }

  /**
   * Trigger axis - Scroll
   */
  onTriggerAxis(side, value) {
    if (value > 0.5) {
      this.vrBrowser.emit('scroll', {
        hand: side,
        direction: value > 0.5 ? 'up' : 'down',
        amount: Math.abs(value)
      });
    }
  }

  /**
   * Touchpad button
   */
  onTouchpadButton(side) {
    console.log('[InputHandler] Touchpad:', side);
    this.vrBrowser.emit('touchpad', { hand: side });
  }

  /**
   * Menu button
   */
  onMenuButton(side) {
    console.log('[InputHandler] Menu:', side);
    this.vrBrowser.emit('menu', { hand: side });
  }

  /**
   * Detect pointing gesture
   */
  detectPointingGesture(handedness, wristPos, fingerPos) {
    // Check if finger is extended (pointing)
    const distance = Math.hypot(
      fingerPos.x - wristPos.x,
      fingerPos.y - wristPos.y,
      fingerPos.z - wristPos.z
    );

    if (distance > 0.1) { // Finger extended
      this.gestures.point = true;
      this.vrBrowser.emit('gesture:point', { hand: handedness });
    } else {
      this.gestures.point = false;
    }
  }

  /**
   * Detect pinch gesture
   */
  detectPinchGesture(handedness, thumbPos, fingerPos) {
    // Check if thumb and finger are close (pinching)
    const distance = Math.hypot(
      thumbPos.x - fingerPos.x,
      thumbPos.y - fingerPos.y,
      thumbPos.z - fingerPos.z
    );

    if (distance < 0.02) { // Pinching
      if (!this.gestures.pinch) {
        this.gestures.pinch = true;
        this.vrBrowser.emit('gesture:pinch', { hand: handedness });
      }
    } else {
      this.gestures.pinch = false;
    }
  }

  /**
   * Detect gestures
   */
  detectGestures() {
    // This is called every frame to update gesture state
    // Actual gesture detection happens in hand tracking processing
  }

  /**
   * Non-VR input (mouse/keyboard fallback)
   */
  updateNonVRInput() {
    // Support mouse and keyboard for testing in non-VR browser

    document.addEventListener('click', (e) => {
      this.vrBrowser.emit('click', { x: e.clientX, y: e.clientY });
    });

    document.addEventListener('wheel', (e) => {
      this.vrBrowser.emit('scroll', {
        direction: e.deltaY > 0 ? 'down' : 'up',
        amount: Math.abs(e.deltaY)
      });
    });

    document.addEventListener('keydown', (e) => {
      this.vrBrowser.emit('key', { key: e.key, code: e.code });
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRInputHandler;
}
