/**
 * VR Virtual Keyboard Module
 *
 * Handle text input in immersive VR environment
 * - Keyboard layout with QWERTY, numbers, symbols
 * - Pointer-based key selection
 * - Voice input fallback
 * - Text display and editing
 *
 * ~300 lines
 */

class VRKeyboard {
  constructor(canvasWidth = 1024, canvasHeight = 512) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.canvas = null;
    this.ctx = null;
    this.texture = null;

    this.currentText = '';
    this.isVisible = false;
    this.isActive = false;

    // Keyboard layout
    this.rows = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
      ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
      ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Bck'],
      ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '/', 'Spc']
    ];

    // Create canvas for rendering keyboard
    this.createCanvas();

    // Initialize event listeners
    this.initializeListeners();

    console.log('[VRKeyboard] Initialized');
  }

  /**
   * Create canvas for keyboard rendering
   */
  createCanvas() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvasWidth;
    this.canvas.height = this.canvasHeight;
    this.ctx = this.canvas.getContext('2d');

    // Get Three.js texture (external)
    const THREE = window.THREE;
    if (THREE) {
      const texture = new THREE.CanvasTexture(this.canvas);
      this.texture = texture;
    }
  }

  /**
   * Initialize input listeners
   */
  initializeListeners() {
    // Listen for keyboard show/hide events
    window.addEventListener('vr-keyboard-show', (e) => {
      this.show(e.detail?.callback);
    });

    window.addEventListener('vr-keyboard-hide', () => {
      this.hide();
    });

    // Listen for input events
    window.addEventListener('vr-input-click', (e) => {
      if (this.isActive) {
        this.handleClick(e.detail?.position);
      }
    });

    // Gamepad input for keyboard navigation
    window.addEventListener('vr-input-axis', (e) => {
      if (this.isActive) {
        this.handleAxis(e.detail?.axis, e.detail?.value);
      }
    });
  }

  /**
   * Show keyboard
   */
  show(callback = null) {
    this.isVisible = true;
    this.isActive = true;
    this.callback = callback;
    this.selectedKey = { row: 0, col: 0 };
    this.currentText = '';

    this.render();
    console.log('[VRKeyboard] Shown');
  }

  /**
   * Hide keyboard
   */
  hide() {
    this.isVisible = false;
    this.isActive = false;

    if (this.callback) {
      this.callback(this.currentText);
      this.callback = null;
    }

    console.log('[VRKeyboard] Hidden, text:', this.currentText);
  }

  /**
   * Handle keyboard click/select
   */
  handleClick(position) {
    if (!this.isActive) return;

    // Calculate which key was clicked
    const key = this.getKeyAtPosition(position);
    if (!key) return;

    this.selectKey(key);
  }

  /**
   * Handle axis input (for navigation)
   */
  handleAxis(axis, value) {
    if (!this.isActive || !this.selectedKey) return;

    const threshold = 0.5;
    if (Math.abs(value) < threshold) return;

    const row = this.selectedKey.row;
    const col = this.selectedKey.col;

    if (axis === 'x') {
      // Left/right navigation
      if (value > 0) {
        this.selectedKey.col = Math.min(col + 1, this.rows[row].length - 1);
      } else {
        this.selectedKey.col = Math.max(col - 1, 0);
      }
    } else if (axis === 'y') {
      // Up/down navigation
      if (value > 0) {
        this.selectedKey.row = Math.max(row - 1, 0);
        this.selectedKey.col = Math.min(col, this.rows[this.selectedKey.row].length - 1);
      } else {
        this.selectedKey.row = Math.min(row + 1, this.rows.length - 1);
        this.selectedKey.col = Math.min(col, this.rows[this.selectedKey.row].length - 1);
      }
    }

    this.render();
  }

  /**
   * Select a key and add to text
   */
  selectKey(key) {
    if (key === 'Bck') {
      // Backspace
      this.currentText = this.currentText.slice(0, -1);
    } else if (key === 'Spc') {
      // Space
      this.currentText += ' ';
    } else if (key === 'Enter') {
      // Submit
      this.hide();
      return;
    } else {
      // Regular character
      this.currentText += key;
    }

    this.render();
    console.log('[VRKeyboard] Text:', this.currentText);
  }

  /**
   * Get key at position (pointer or click)
   */
  getKeyAtPosition(position) {
    if (!position) return null;

    const { x, y } = position;
    const keyWidth = this.canvasWidth / 10;
    const keyHeight = (this.canvasHeight - 80) / this.rows.length;

    for (let row = 0; row < this.rows.length; row++) {
      for (let col = 0; col < this.rows[row].length; col++) {
        const keyX = col * keyWidth;
        const keyY = 20 + (row * keyHeight);

        if (x >= keyX && x < keyX + keyWidth &&
            y >= keyY && y < keyY + keyHeight) {
          return this.rows[row][col];
        }
      }
    }

    return null;
  }

  /**
   * Render keyboard to canvas
   */
  render() {
    if (!this.ctx) return;

    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw title
    this.ctx.fillStyle = '#00ff41';
    this.ctx.font = 'bold 24px monospace';
    this.ctx.fillText('Enter URL or Search', 20, 30);

    // Draw current text input
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = '20px monospace';
    this.ctx.fillRect(20, 50, this.canvasWidth - 40, 30);
    this.ctx.fillStyle = '#000000';
    this.ctx.fillText(this.currentText, 30, 70);

    // Draw keyboard
    const keyWidth = this.canvasWidth / 10;
    const keyHeight = (this.canvasHeight - 100) / this.rows.length;
    const keyStartY = 100;

    for (let row = 0; row < this.rows.length; row++) {
      for (let col = 0; col < this.rows[row].length; col++) {
        const key = this.rows[row][col];
        const keyX = col * keyWidth;
        const keyY = keyStartY + (row * keyHeight);

        // Check if selected
        const isSelected = this.selectedKey &&
                          this.selectedKey.row === row &&
                          this.selectedKey.col === col;

        // Draw key background
        if (isSelected) {
          this.ctx.fillStyle = '#00ff41';
        } else {
          this.ctx.fillStyle = '#444444';
        }

        this.ctx.fillRect(keyX + 2, keyY + 2, keyWidth - 4, keyHeight - 4);

        // Draw key text
        this.ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
        this.ctx.font = 'bold 16px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(key, keyX + keyWidth / 2, keyY + keyHeight / 2);
      }
    }

    // Draw instructions
    this.ctx.fillStyle = '#888888';
    this.ctx.font = '12px monospace';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Use controller to navigate, trigger to select, menu to close', 20, this.canvasHeight - 10);

    // Update Three.js texture
    if (this.texture) {
      this.texture.needsUpdate = true;
    }
  }

  /**
   * Get canvas texture for rendering
   */
  getTexture() {
    return this.texture;
  }

  /**
   * Get current text value
   */
  getText() {
    return this.currentText;
  }

  /**
   * Set text value
   */
  setText(text) {
    this.currentText = text;
    if (this.isVisible) {
      this.render();
    }
  }

  /**
   * Clear text
   */
  clearText() {
    this.currentText = '';
    if (this.isVisible) {
      this.render();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRKeyboard;
}
