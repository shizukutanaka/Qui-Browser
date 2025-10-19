/**
 * VR Browser Settings Manager
 * Manages user preferences for VR browser
 */

class VRSettings {
  constructor() {
    this.defaults = {
      // Display settings
      displayMode: 'immersive-vr',
      targetFPS: 90,
      enableFoveatedRendering: true,
      antialiasing: 'msaa4x',

      // Input settings
      handTracking: true,
      eyeTracking: false,
      gestureControls: true,
      voiceCommands: false,

      // Performance settings
      enablePerformanceMonitor: false,
      cacheStrategy: 'aggressive',
      preloadContent: true,

      // UI settings
      uiScale: 1.0,
      uiDistance: 2.0,
      showFPS: false,
      showNotifications: true,

      // Privacy settings
      saveHistory: true,
      saveCookies: true,
      enableTracking: false,

      // Advanced settings
      debugMode: false,
      experimentalFeatures: false
    };

    this.settings = this.loadSettings();
    this.settingsPanel = null;
  }

  loadSettings() {
    try {
      const saved = localStorage.getItem('vr-settings');
      if (saved) {
        return { ...this.defaults, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.warn('Failed to load settings:', error);
    }
    return { ...this.defaults };
  }

  saveSettings() {
    try {
      localStorage.setItem('vr-settings', JSON.stringify(this.settings));
      VRUtils.showNotification('Settings saved', 'success', 2000);
      return true;
    } catch (error) {
      console.error('Failed to save settings:', error);
      VRUtils.showNotification('Failed to save settings', 'error', 2000);
      return false;
    }
  }

  get(key) {
    return this.settings[key] ?? this.defaults[key];
  }

  set(key, value) {
    this.settings[key] = value;
    this.saveSettings();
    this.emit('change', { key, value });
  }

  reset() {
    this.settings = { ...this.defaults };
    this.saveSettings();
    VRUtils.showNotification('Settings reset to defaults', 'info', 2000);
  }

  createSettingsUI() {
    const panel = document.createElement('div');
    panel.id = 'vr-settings-panel';
    panel.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      border-radius: 20px;
      padding: 30px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      z-index: 10002;
      color: white;
      overflow-y: auto;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    panel.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 15px;">
        <h2 style="margin: 0; font-size: 28px; color: #fff;">⚙️ VR Settings</h2>
        <button id="close-settings" style="background: none; border: none; color: white; font-size: 24px; cursor: pointer; padding: 5px 10px;">✕</button>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">🎮 Display</h3>
        <div class="setting-group">
          <label class="setting-label">
            Target FPS
            <select id="targetFPS" class="setting-input">
              <option value="72">72 FPS</option>
              <option value="90">90 FPS</option>
              <option value="120">120 FPS</option>
            </select>
          </label>

          <label class="setting-label">
            Antialiasing
            <select id="antialiasing" class="setting-input">
              <option value="none">None</option>
              <option value="msaa2x">MSAA 2x</option>
              <option value="msaa4x">MSAA 4x</option>
              <option value="msaa8x">MSAA 8x</option>
            </select>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="enableFoveatedRendering">
            <span>Enable Foveated Rendering</span>
          </label>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">👋 Input</h3>
        <div class="setting-group">
          <label class="setting-checkbox">
            <input type="checkbox" id="handTracking">
            <span>Hand Tracking</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="eyeTracking">
            <span>Eye Tracking</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="gestureControls">
            <span>Gesture Controls</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="voiceCommands">
            <span>Voice Commands (Beta)</span>
          </label>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">⚡ Performance</h3>
        <div class="setting-group">
          <label class="setting-label">
            Cache Strategy
            <select id="cacheStrategy" class="setting-input">
              <option value="minimal">Minimal</option>
              <option value="balanced">Balanced</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="preloadContent">
            <span>Preload Content</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="enablePerformanceMonitor">
            <span>Show Performance Monitor</span>
          </label>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">🎨 Interface</h3>
        <div class="setting-group">
          <label class="setting-label">
            UI Scale
            <input type="range" id="uiScale" min="0.5" max="2" step="0.1" class="setting-slider">
            <span id="uiScaleValue">1.0x</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="showFPS">
            <span>Show FPS Counter</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="showNotifications">
            <span>Show Notifications</span>
          </label>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h3 style="color: #667eea; margin-bottom: 15px; font-size: 18px;">🔒 Privacy</h3>
        <div class="setting-group">
          <label class="setting-checkbox">
            <input type="checkbox" id="saveHistory">
            <span>Save Browsing History</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="saveCookies">
            <span>Save Cookies</span>
          </label>

          <label class="setting-checkbox">
            <input type="checkbox" id="enableTracking">
            <span>Enable Analytics</span>
          </label>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 30px; border-top: 2px solid rgba(255,255,255,0.2); padding-top: 20px;">
        <button id="save-settings" style="flex: 1; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 12px 24px; border-radius: 25px; font-size: 16px; font-weight: 600; cursor: pointer;">
          💾 Save Settings
        </button>
        <button id="reset-settings" style="flex: 1; background: rgba(255, 255, 255, 0.1); color: white; border: 1px solid rgba(255,255,255,0.3); padding: 12px 24px; border-radius: 25px; font-size: 16px; cursor: pointer;">
          🔄 Reset to Defaults
        </button>
      </div>

      <style>
        .setting-group {
          display: flex;
          flex-direction: column;
          gap: 15px;
        }

        .setting-label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .setting-input, .setting-slider {
          padding: 10px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          background: rgba(255, 255, 255, 0.1);
          color: white;
          font-size: 14px;
        }

        .setting-checkbox {
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .setting-checkbox input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        }

        #vr-settings-panel::-webkit-scrollbar {
          width: 8px;
        }

        #vr-settings-panel::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }

        #vr-settings-panel::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 4px;
        }
      </style>
    `;

    document.body.appendChild(panel);
    this.settingsPanel = panel;

    this.bindEvents();
    this.loadValuesToUI();

    return panel;
  }

  bindEvents() {
    // Close button
    document.getElementById('close-settings').addEventListener('click', () => {
      this.hide();
    });

    // Save button
    document.getElementById('save-settings').addEventListener('click', () => {
      this.saveFromUI();
      this.hide();
    });

    // Reset button
    document.getElementById('reset-settings').addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all settings to defaults?')) {
        this.reset();
        this.loadValuesToUI();
      }
    });

    // UI Scale slider
    const uiScaleSlider = document.getElementById('uiScale');
    const uiScaleValue = document.getElementById('uiScaleValue');
    uiScaleSlider.addEventListener('input', () => {
      uiScaleValue.textContent = uiScaleSlider.value + 'x';
    });

    // Close on escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.settingsPanel.style.display !== 'none') {
        this.hide();
      }
    });
  }

  loadValuesToUI() {
    // Load all settings into UI
    for (const [key, value] of Object.entries(this.settings)) {
      const element = document.getElementById(key);
      if (!element) continue;

      if (element.type === 'checkbox') {
        element.checked = value;
      } else if (element.type === 'range') {
        element.value = value;
        if (key === 'uiScale') {
          document.getElementById('uiScaleValue').textContent = value + 'x';
        }
      } else {
        element.value = value;
      }
    }
  }

  saveFromUI() {
    // Save all settings from UI
    for (const key of Object.keys(this.settings)) {
      const element = document.getElementById(key);
      if (!element) continue;

      if (element.type === 'checkbox') {
        this.settings[key] = element.checked;
      } else if (element.type === 'range' || element.type === 'number') {
        this.settings[key] = parseFloat(element.value);
      } else {
        this.settings[key] = element.value;
      }
    }

    this.saveSettings();
  }

  show() {
    if (!this.settingsPanel) {
      this.createSettingsUI();
    }
    this.settingsPanel.style.display = 'block';
  }

  hide() {
    if (this.settingsPanel) {
      this.settingsPanel.style.display = 'none';
    }
  }

  toggle() {
    if (!this.settingsPanel || this.settingsPanel.style.display === 'none') {
      this.show();
    } else {
      this.hide();
    }
  }

  emit(event, data) {
    const customEvent = new CustomEvent('vr-settings-' + event, { detail: data });
    window.dispatchEvent(customEvent);
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.VRSettings = VRSettings;
  window.vrSettings = new VRSettings();

  // Global shortcut to open settings (Ctrl+,)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      window.vrSettings.toggle();
    }
  });
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRSettings;
}
