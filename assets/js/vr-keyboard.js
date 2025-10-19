/**
 * VR Keyboard
 * Virtual keyboard for text input in VR mode
 * @version 2.0.0
 */

class VRKeyboard {
    constructor() {
        this.isVisible = false;
        this.currentInput = null;
        this.keyboardElement = null;
        this.layout = 'qwerty';
        this.shift = false;
        this.capsLock = false;
        this.currentText = '';
        this.cursorPosition = 0;
        this.suggestions = [];
        this.history = this.loadHistory();

        this.layouts = {
            qwerty: [
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
                ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
                ['shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'back'],
                ['url', 'space', '.com', 'enter']
            ],
            url: [
                ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
                ['http://', 'https://', 'www.', '.com', '.net'],
                ['/', ':', '.', '-', '_', '@'],
                ['back', 'qwerty']
            ],
            numbers: [
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['0', '.', 'back']
            ]
        };
    }

    /**
     * Initialize VR keyboard
     */
    init() {
        this.createKeyboard();
        this.attachEventListeners();
        return this;
    }

    /**
     * Create keyboard UI
     */
    createKeyboard() {
        this.keyboardElement = document.createElement('div');
        this.keyboardElement.id = 'vr-keyboard';
        this.keyboardElement.className = 'vr-keyboard';
        this.keyboardElement.innerHTML = `
            <div class="vr-keyboard-container">
                <div class="vr-keyboard-header">
                    <div class="vr-keyboard-input-display">
                        <input type="text" class="vr-keyboard-input" readonly />
                        <button class="vr-keyboard-clear" aria-label="Clear">×</button>
                    </div>
                    <div class="vr-keyboard-suggestions"></div>
                </div>

                <div class="vr-keyboard-keys">
                    ${this.renderKeys()}
                </div>

                <div class="vr-keyboard-footer">
                    <button class="vr-keyboard-layout-btn" data-layout="qwerty">ABC</button>
                    <button class="vr-keyboard-layout-btn" data-layout="url">URL</button>
                    <button class="vr-keyboard-layout-btn" data-layout="numbers">123</button>
                    <button class="vr-keyboard-close">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.keyboardElement);
        this.attachKeyboardEvents();
    }

    /**
     * Render keyboard keys
     */
    renderKeys() {
        const layout = this.layouts[this.layout];
        return layout.map(row => `
            <div class="vr-keyboard-row">
                ${row.map(key => this.renderKey(key)).join('')}
            </div>
        `).join('');
    }

    /**
     * Render individual key
     */
    renderKey(key) {
        const displayKey = this.shift || this.capsLock ? key.toUpperCase() : key;
        const keyClass = this.getKeyClass(key);
        const keyLabel = this.getKeyLabel(key);

        return `
            <button
                class="vr-key ${keyClass}"
                data-key="${key}"
                aria-label="${keyLabel}"
            >
                ${displayKey}
            </button>
        `;
    }

    /**
     * Get key CSS class
     */
    getKeyClass(key) {
        const classes = [];

        if (key === 'space') classes.push('vr-key-space');
        if (key === 'enter') classes.push('vr-key-enter');
        if (key === 'back') classes.push('vr-key-back');
        if (key === 'shift') {
            classes.push('vr-key-shift');
            if (this.shift) classes.push('active');
            if (this.capsLock) classes.push('caps-lock');
        }

        return classes.join(' ');
    }

    /**
     * Get key label for accessibility
     */
    getKeyLabel(key) {
        const labels = {
            'space': 'Space',
            'enter': 'Enter',
            'back': 'Backspace',
            'shift': 'Shift',
            'url': 'URL shortcuts',
            'qwerty': 'Letters',
            'numbers': 'Numbers',
            '.com': 'Dot com'
        };

        return labels[key] || key;
    }

    /**
     * Attach keyboard event listeners
     */
    attachKeyboardEvents() {
        const keyboard = this.keyboardElement;

        // Key clicks
        keyboard.querySelectorAll('.vr-key').forEach(keyBtn => {
            keyBtn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                this.handleKeyPress(key);
            });
        });

        // Layout buttons
        keyboard.querySelectorAll('.vr-keyboard-layout-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const layout = e.target.dataset.layout;
                this.switchLayout(layout);
            });
        });

        // Clear button
        keyboard.querySelector('.vr-keyboard-clear').addEventListener('click', () => {
            this.clear();
        });

        // Close button
        keyboard.querySelector('.vr-keyboard-close').addEventListener('click', () => {
            this.hide();
        });

        // Prevent keyboard from closing when clicking inside
        keyboard.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    /**
     * Attach global event listeners
     */
    attachEventListeners() {
        // Show keyboard when input is focused
        document.addEventListener('focusin', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                this.show(e.target);
            }
        });

        // Hide keyboard when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isVisible && !this.keyboardElement.contains(e.target)) {
                this.hide();
            }
        });

        // Physical keyboard support
        document.addEventListener('keydown', (e) => {
            if (!this.isVisible) return;

            e.preventDefault();
            this.handlePhysicalKey(e.key);
        });
    }

    /**
     * Handle key press
     */
    handleKeyPress(key) {
        switch (key) {
            case 'back':
                this.backspace();
                break;

            case 'enter':
                this.enter();
                break;

            case 'space':
                this.insertText(' ');
                break;

            case 'shift':
                this.toggleShift();
                break;

            case 'url':
            case 'qwerty':
            case 'numbers':
                this.switchLayout(key);
                break;

            case '.com':
            case 'http://':
            case 'https://':
            case 'www.':
                this.insertText(key);
                break;

            default:
                const char = this.shift || this.capsLock ? key.toUpperCase() : key;
                this.insertText(char);

                // Reset shift after key press (but not caps lock)
                if (this.shift && !this.capsLock) {
                    this.shift = false;
                    this.updateKeyboard();
                }
        }

        this.updateSuggestions();
        this.vibrate();
    }

    /**
     * Handle physical keyboard key
     */
    handlePhysicalKey(key) {
        if (key === 'Backspace') {
            this.backspace();
        } else if (key === 'Enter') {
            this.enter();
        } else if (key === 'Shift') {
            this.toggleShift();
        } else if (key.length === 1) {
            this.insertText(key);
        }
    }

    /**
     * Insert text at cursor position
     */
    insertText(text) {
        const before = this.currentText.substring(0, this.cursorPosition);
        const after = this.currentText.substring(this.cursorPosition);

        this.currentText = before + text + after;
        this.cursorPosition += text.length;

        this.updateDisplay();
        this.updateInput();
    }

    /**
     * Backspace
     */
    backspace() {
        if (this.cursorPosition === 0) return;

        const before = this.currentText.substring(0, this.cursorPosition - 1);
        const after = this.currentText.substring(this.cursorPosition);

        this.currentText = before + after;
        this.cursorPosition--;

        this.updateDisplay();
        this.updateInput();
    }

    /**
     * Enter/Submit
     */
    enter() {
        if (this.currentInput) {
            // Trigger input event
            this.currentInput.value = this.currentText;
            this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
            this.currentInput.dispatchEvent(new Event('change', { bubbles: true }));

            // Add to history
            if (this.currentText.trim()) {
                this.addToHistory(this.currentText);
            }
        }

        this.hide();
    }

    /**
     * Clear text
     */
    clear() {
        this.currentText = '';
        this.cursorPosition = 0;
        this.updateDisplay();
        this.updateInput();
        this.updateSuggestions();
    }

    /**
     * Toggle shift
     */
    toggleShift() {
        if (this.shift && !this.capsLock) {
            // Shift is on, turn on caps lock
            this.capsLock = true;
            this.shift = false;
        } else if (this.capsLock) {
            // Caps lock is on, turn off both
            this.capsLock = false;
            this.shift = false;
        } else {
            // Both off, turn on shift
            this.shift = true;
        }

        this.updateKeyboard();
    }

    /**
     * Switch keyboard layout
     */
    switchLayout(layout) {
        if (!this.layouts[layout]) return;

        this.layout = layout;
        this.updateKeyboard();
        VRUtils.showNotification(`${layout} keyboard`, 'info');
    }

    /**
     * Update keyboard display
     */
    updateKeyboard() {
        const keysContainer = this.keyboardElement.querySelector('.vr-keyboard-keys');
        keysContainer.innerHTML = this.renderKeys();

        // Reattach events to new keys
        keysContainer.querySelectorAll('.vr-key').forEach(keyBtn => {
            keyBtn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                this.handleKeyPress(key);
            });
        });
    }

    /**
     * Update input display
     */
    updateDisplay() {
        const input = this.keyboardElement.querySelector('.vr-keyboard-input');
        if (input) {
            input.value = this.currentText;
        }
    }

    /**
     * Update original input element
     */
    updateInput() {
        if (this.currentInput) {
            this.currentInput.value = this.currentText;
        }
    }

    /**
     * Update suggestions
     */
    updateSuggestions() {
        const text = this.currentText.toLowerCase();
        if (text.length < 2) {
            this.suggestions = [];
            this.renderSuggestions();
            return;
        }

        // Get suggestions from history
        this.suggestions = this.history
            .filter(item => item.toLowerCase().includes(text))
            .slice(0, 5);

        // Add common URLs if typing URL
        if (text.includes('.') || text.includes('http')) {
            const commonUrls = [
                'https://www.google.com',
                'https://www.youtube.com',
                'https://www.github.com',
                'https://www.wikipedia.org'
            ];

            commonUrls.forEach(url => {
                if (url.toLowerCase().includes(text) && !this.suggestions.includes(url)) {
                    this.suggestions.push(url);
                }
            });
        }

        this.renderSuggestions();
    }

    /**
     * Render suggestions
     */
    renderSuggestions() {
        const container = this.keyboardElement.querySelector('.vr-keyboard-suggestions');
        if (!container) return;

        if (this.suggestions.length === 0) {
            container.innerHTML = '';
            return;
        }

        container.innerHTML = this.suggestions.map(suggestion => `
            <button class="vr-suggestion" data-text="${suggestion}">
                ${suggestion}
            </button>
        `).join('');

        // Attach click events
        container.querySelectorAll('.vr-suggestion').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.currentText = e.target.dataset.text;
                this.cursorPosition = this.currentText.length;
                this.updateDisplay();
                this.updateInput();
                this.suggestions = [];
                this.renderSuggestions();
            });
        });
    }

    /**
     * Show keyboard
     */
    show(inputElement) {
        this.currentInput = inputElement;
        this.currentText = inputElement.value || '';
        this.cursorPosition = this.currentText.length;
        this.isVisible = true;

        this.keyboardElement.classList.add('active');
        this.updateDisplay();
        this.updateSuggestions();

        // Auto-select appropriate layout
        if (inputElement.type === 'url' || inputElement.type === 'email') {
            this.switchLayout('url');
        } else if (inputElement.type === 'number') {
            this.switchLayout('numbers');
        } else {
            this.switchLayout('qwerty');
        }
    }

    /**
     * Hide keyboard
     */
    hide() {
        this.isVisible = false;
        this.keyboardElement.classList.remove('active');
        this.currentInput = null;
    }

    /**
     * Toggle keyboard visibility
     */
    toggle(inputElement) {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show(inputElement);
        }
    }

    /**
     * Vibrate for haptic feedback
     */
    vibrate() {
        if (navigator.vibrate) {
            navigator.vibrate(10);
        }
    }

    /**
     * Add to history
     */
    addToHistory(text) {
        // Remove if already exists
        const index = this.history.indexOf(text);
        if (index > -1) {
            this.history.splice(index, 1);
        }

        // Add to beginning
        this.history.unshift(text);

        // Limit history size
        if (this.history.length > 50) {
            this.history = this.history.slice(0, 50);
        }

        this.saveHistory();
    }

    /**
     * Load history from storage
     */
    loadHistory() {
        try {
            const saved = localStorage.getItem('vr-keyboard-history');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            console.error('Error loading keyboard history:', error);
            return [];
        }
    }

    /**
     * Save history to storage
     */
    saveHistory() {
        try {
            localStorage.setItem('vr-keyboard-history', JSON.stringify(this.history));
        } catch (error) {
            console.error('Error saving keyboard history:', error);
        }
    }

    /**
     * Clear history
     */
    clearHistory() {
        this.history = [];
        this.saveHistory();
        VRUtils.showNotification('Keyboard history cleared', 'success');
    }

    /**
     * Destroy keyboard
     */
    destroy() {
        if (this.keyboardElement && this.keyboardElement.parentNode) {
            this.keyboardElement.parentNode.removeChild(this.keyboardElement);
        }
        this.currentInput = null;
        this.isVisible = false;
    }
}

// Initialize VR keyboard on load
let vrKeyboard = null;

document.addEventListener('DOMContentLoaded', () => {
    vrKeyboard = new VRKeyboard();
    vrKeyboard.init();
});

// Export for global access
if (typeof window !== 'undefined') {
    window.VRKeyboard = VRKeyboard;
    Object.defineProperty(window, 'vrKeyboard', {
        get: () => vrKeyboard
    });
}
