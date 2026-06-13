/**
 * Developer Tools for VR Browser
 * Debugging, profiling, and inspection tools
 *
 * John Carmack principle: Good tools make good developers
 */

export class DevTools {
  constructor(app) {
    this.app = app;
    this.enabled = false;
    this.visible = false;

    // Tools state
    this.tools = {
      console: { enabled: true, messages: [] },
      sceneInspector: { enabled: false, selected: null },
      networkMonitor: { enabled: false, requests: [] },
      profiler: { enabled: false, samples: [] },
      logger: { enabled: true, logs: [] },
      debugger: { enabled: false, breakpoints: [] }
    };

    // UI elements
    this.container = null;
    this.tabs = new Map();

    // Keyboard shortcuts
    this.shortcuts = {
      'F12': () => this.toggle(),
      'Ctrl+Shift+I': () => this.toggle(),
      'Ctrl+Shift+C': () => this.selectElement(),
      'Ctrl+Shift+P': () => this.showProfiler()
    };

    // Initialize
    this.setupShortcuts();
  }

  /**
   * Initialize dev tools
   */
  initialize() {
    this.createUI();
    this.interceptConsole();
    this.setupNetworkMonitor();

    console.log('DevTools: Initialized');
  }

  /**
   * Create dev tools UI
   */
  createUI() {
    // Main container
    this.container = document.createElement('div');
    this.container.id = 'dev-tools';
    this.container.style.cssText = `
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 400px;
      background: #1e1e1e;
      color: #d4d4d4;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      border-top: 2px solid #007acc;
      z-index: 9999;
      display: ${this.visible ? 'flex' : 'none'};
      flex-direction: column;
    `;

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
      display: flex;
      background: #252526;
      border-bottom: 1px solid #3e3e42;
      padding: 5px;
      gap: 10px;
    `;

    const tabs = [
      { id: 'console', label: '📝 Console', icon: '▶️' },
      { id: 'scene', label: '🎬 Scene', icon: '🔍' },
      { id: 'network', label: '🌐 Network', icon: '📡' },
      { id: 'profiler', label: '📊 Profiler', icon: '⚡' },
      { id: 'settings', label: '⚙️ Settings', icon: '🔧' }
    ];

    tabs.forEach(tab => {
      const btn = document.createElement('button');
      btn.textContent = tab.label;
      btn.style.cssText = `
        background: #2d2d30;
        border: 1px solid #3e3e42;
        color: #cccccc;
        padding: 5px 15px;
        cursor: pointer;
        border-radius: 3px;
      `;
      btn.onclick = () => this.showTab(tab.id);
      toolbar.appendChild(btn);
      this.tabs.set(tab.id, { button: btn, content: null });
    });

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      background: #c5c5c5;
      border: none;
      color: #1e1e1e;
      padding: 5px 10px;
      cursor: pointer;
      border-radius: 3px;
      margin-left: auto;
    `;
    closeBtn.onclick = () => this.hide();
    toolbar.appendChild(closeBtn);

    this.container.appendChild(toolbar);

    // Content area
    const content = document.createElement('div');
    content.id = 'dev-tools-content';
    content.style.cssText = `
      flex: 1;
      overflow: auto;
      padding: 10px;
    `;
    this.container.appendChild(content);

    // Add to document
    document.body.appendChild(this.container);

    // Create tab contents
    this.createConsoleTab();
    this.createSceneTab();
    this.createNetworkTab();
    this.createProfilerTab();
    this.createSettingsTab();
  }

  /**
   * Create console tab
   */
  createConsoleTab() {
    const consoleDiv = document.createElement('div');
    consoleDiv.id = 'console-tab';
    consoleDiv.style.display = 'none';

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Execute JavaScript...';
    input.style.cssText = `
      width: 100%;
      background: #3c3c3c;
      border: 1px solid #3e3e42;
      color: #d4d4d4;
      padding: 5px;
      font-family: 'Courier New', monospace;
      margin-bottom: 10px;
    `;
    input.onkeypress = (e) => {
      if (e.key === 'Enter') {
        this.executeCode(input.value);
        input.value = '';
      }
    };
    consoleDiv.appendChild(input);

    // Messages
    const messages = document.createElement('div');
    messages.id = 'console-messages';
    messages.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
    `;
    consoleDiv.appendChild(messages);

    this.tabs.get('console').content = consoleDiv;
  }

  /**
   * Create scene inspector tab
   */
  createSceneTab() {
    const sceneDiv = document.createElement('div');
    sceneDiv.id = 'scene-tab';
    sceneDiv.style.display = 'none';

    sceneDiv.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 10px;">
        <div>
          <h3>Scene Graph</h3>
          <div id="scene-tree" style="max-height: 350px; overflow-y: auto;"></div>
        </div>
        <div>
          <h3>Object Properties</h3>
          <div id="object-properties"></div>
        </div>
      </div>
    `;

    this.tabs.get('scene').content = sceneDiv;
  }

  /**
   * Create network monitor tab
   */
  createNetworkTab() {
    const networkDiv = document.createElement('div');
    networkDiv.id = 'network-tab';
    networkDiv.style.display = 'none';

    networkDiv.innerHTML = `
      <div>
        <h3>Network Requests</h3>
        <table id="network-table" style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #2d2d30; border-bottom: 1px solid #3e3e42;">
              <th style="padding: 5px; text-align: left;">Method</th>
              <th style="padding: 5px; text-align: left;">URL</th>
              <th style="padding: 5px; text-align: left;">Status</th>
              <th style="padding: 5px; text-align: left;">Time</th>
              <th style="padding: 5px; text-align: left;">Size</th>
            </tr>
          </thead>
          <tbody id="network-tbody"></tbody>
        </table>
      </div>
    `;

    this.tabs.get('network').content = networkDiv;
  }

  /**
   * Create profiler tab
   */
  createProfilerTab() {
    const profilerDiv = document.createElement('div');
    profilerDiv.id = 'profiler-tab';
    profilerDiv.style.display = 'none';

    profilerDiv.innerHTML = `
      <div>
        <h3>Performance Profiler</h3>
        <button id="profile-start" style="
          background: #0e639c;
          border: none;
          color: white;
          padding: 8px 15px;
          cursor: pointer;
          border-radius: 3px;
          margin: 10px 5px;
        ">Start Recording</button>
        <button id="profile-stop" style="
          background: #c5c5c5;
          border: none;
          color: #1e1e1e;
          padding: 8px 15px;
          cursor: pointer;
          border-radius: 3px;
        ">Stop Recording</button>
        <div id="profile-results" style="margin-top: 10px;"></div>
      </div>
    `;

    this.tabs.get('profiler').content = profilerDiv;

    // Event listeners (will be set when shown)
  }

  /**
   * Create settings tab
   */
  createSettingsTab() {
    const settingsDiv = document.createElement('div');
    settingsDiv.id = 'settings-tab';
    settingsDiv.style.display = 'none';

    settingsDiv.innerHTML = `
      <div>
        <h3>Developer Settings</h3>
        <div style="display: grid; gap: 15px; margin-top: 15px;">
          <label style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" id="show-fps">
            Show FPS Counter
          </label>
          <label style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" id="show-bounds">
            Show Bounding Boxes
          </label>
          <label style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" id="show-grid">
            Show Grid
          </label>
          <label style="display: flex; align-items: center; gap: 10px;">
            <input type="checkbox" id="verbose-logging">
            Verbose Logging
          </label>
        </div>
      </div>
    `;

    this.tabs.get('settings').content = settingsDiv;
  }

  /**
   * Show specific tab
   */
  showTab(tabId) {
    const content = document.getElementById('dev-tools-content');
    if (!content) {
      return;
    }

    // Hide all tabs
    this.tabs.forEach((tab, id) => {
      if (tab.content) {
        tab.content.style.display = 'none';
      }
      tab.button.style.background = '#2d2d30';
    });

    // Show selected tab
    const tab = this.tabs.get(tabId);
    if (tab && tab.content) {
      content.innerHTML = '';
      content.appendChild(tab.content);
      tab.content.style.display = 'block';
      tab.button.style.background = '#0e639c';

      // Update tab content
      switch (tabId) {
      case 'scene':
        this.updateSceneTree();
        break;
      case 'network':
        this.updateNetworkTable();
        break;
      }
    }
  }

  /**
   * Intercept console methods
   */
  interceptConsole() {
    // Keep the originals so dispose() can restore them.
    this.originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error
    };
    const originalLog = this.originalConsole.log;
    const originalWarn = this.originalConsole.warn;
    const originalError = this.originalConsole.error;

    console.log = (...args) => {
      this.logMessage('log', args);
      originalLog.apply(console, args);
    };

    console.warn = (...args) => {
      this.logMessage('warn', args);
      originalWarn.apply(console, args);
    };

    console.error = (...args) => {
      this.logMessage('error', args);
      originalError.apply(console, args);
    };
  }

  /**
   * Log message to dev console
   */
  logMessage(type, args) {
    const message = {
      type,
      args: args.map(arg => this.formatValue(arg)),
      timestamp: new Date().toLocaleTimeString()
    };

    this.tools.console.messages.push(message);

    // Keep only recent messages
    if (this.tools.console.messages.length > 1000) {
      this.tools.console.messages.shift();
    }

    // Update UI if visible
    this.updateConsoleMessages();
  }

  /**
   * Format value for display
   */
  formatValue(value) {
    if (value === null) {
      return 'null';
    }
    if (value === undefined) {
      return 'undefined';
    }
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return value.toString();
      }
    }
    return String(value);
  }

  /**
   * Update console messages display
   */
  updateConsoleMessages() {
    const messagesDiv = document.getElementById('console-messages');
    if (!messagesDiv) {
      return;
    }

    const colors = { log: '#d4d4d4', warn: '#ce9178', error: '#f48771' };
    const frag = document.createDocumentFragment();

    for (const msg of this.tools.console.messages.slice(-100)) {
      const row = document.createElement('div');
      row.style.cssText = `color: ${colors[msg.type] || colors.log}; padding: 2px 0; border-bottom: 1px solid #2d2d30;`;

      const ts = document.createElement('span');
      ts.style.color = '#858585';
      ts.textContent = `[${msg.timestamp}] `;
      row.appendChild(ts);
      row.appendChild(document.createTextNode(msg.args.join(' ')));

      frag.appendChild(row);
    }

    messagesDiv.textContent = '';
    messagesDiv.appendChild(frag);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  /**
   * Execute JavaScript code
   */
  executeCode(code) {
    try {
      let result;
      try {
        // Try as expression so the return value is captured. This is a
        // developer-only console REPL, so dynamic evaluation is intentional.
        // eslint-disable-next-line no-new-func
        result = new Function('"use strict"; return (' + code + ')')();
      } catch {
        // Fall back to statement mode (void return).
        // eslint-disable-next-line no-new-func
        result = new Function('"use strict"; ' + code)();
      }
      this.logMessage('log', [`> ${code}`, result]);
    } catch (error) {
      this.logMessage('error', [`Error: ${error.message}`]);
    }
  }

  /**
   * Update scene tree
   */
  updateSceneTree() {
    const treeDiv = document.getElementById('scene-tree');
    if (!treeDiv || !this.app.scene) {
      return;
    }

    treeDiv.textContent = '';
    treeDiv.appendChild(this.buildSceneTree(this.app.scene, 0));
  }

  /**
   * Build scene tree as a DocumentFragment (safe, no innerHTML).
   */
  buildSceneTree(object, level) {
    const frag = document.createDocumentFragment();

    const row = document.createElement('div');
    row.style.cssText = 'cursor: pointer; padding: 2px;';
    row.style.paddingLeft = (level * 16) + 'px';
    row.textContent = `${object.type || 'Object'} "${object.name || 'unnamed'}"`;
    frag.appendChild(row);

    if (object.children && object.children.length > 0) {
      for (const child of object.children) {
        frag.appendChild(this.buildSceneTree(child, level + 1));
      }
    }

    return frag;
  }

  /**
   * Setup network monitor
   */
  setupNetworkMonitor() {
    // Intercept fetch (original kept so dispose() can restore it).
    this.originalFetch = window.fetch;
    const originalFetch = this.originalFetch;
    window.fetch = async (...args) => {
      const startTime = performance.now();
      const url = args[0];

      try {
        const response = await originalFetch(...args);
        const endTime = performance.now();

        this.logNetworkRequest({
          method: args[1]?.method || 'GET',
          url,
          status: response.status,
          time: endTime - startTime,
          size: response.headers.get('content-length') || 'unknown'
        });

        return response;
      } catch (error) {
        const endTime = performance.now();
        this.logNetworkRequest({
          method: args[1]?.method || 'GET',
          url,
          status: 'failed',
          time: endTime - startTime,
          size: 0
        });
        throw error;
      }
    };
  }

  /**
   * Log network request
   */
  logNetworkRequest(request) {
    this.tools.networkMonitor.requests.push({
      ...request,
      timestamp: Date.now()
    });

    // Keep only recent requests
    if (this.tools.networkMonitor.requests.length > 100) {
      this.tools.networkMonitor.requests.shift();
    }
  }

  /**
   * Update network table
   */
  updateNetworkTable() {
    const tbody = document.getElementById('network-tbody');
    if (!tbody) {
      return;
    }

    const frag = document.createDocumentFragment();
    for (const req of this.tools.networkMonitor.requests) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid #2d2d30';

      const cells = [
        String(req.method),
        String(req.url).substring(0, 50),
        String(req.status),
        typeof req.time === 'number' ? req.time.toFixed(0) + 'ms' : String(req.time),
        String(req.size)
      ];

      cells.forEach((val, i) => {
        const td = document.createElement('td');
        td.style.padding = '5px';
        if (i === 2) {
          td.style.color = (typeof req.status === 'number' && req.status < 400) ? '#4ec9b0' : '#f48771';
        }
        td.textContent = val;
        tr.appendChild(td);
      });

      frag.appendChild(tr);
    }

    tbody.textContent = '';
    tbody.appendChild(frag);
  }

  /**
   * Setup keyboard shortcuts
   */
  setupShortcuts() {
    // Stored on the instance so dispose() can remove it.
    this.keydownHandler = (e) => {
      const key = e.key;
      const ctrl = e.ctrlKey;
      const shift = e.shiftKey;

      let shortcut = key;
      if (ctrl) {
        shortcut = 'Ctrl+' + shortcut;
      }
      if (shift) {
        shortcut = shortcut.replace('Ctrl+', 'Ctrl+Shift+');
      }

      const handler = this.shortcuts[shortcut];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    document.addEventListener('keydown', this.keydownHandler);
  }

  /**
   * Toggle dev tools
   */
  toggle() {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Show dev tools
   */
  show() {
    this.visible = true;
    if (this.container) {
      this.container.style.display = 'flex';
      this.showTab('console');
    }
  }

  /**
   * Hide dev tools
   */
  hide() {
    this.visible = false;
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * Tear down: remove the global listeners, restore the patched globals
   * (console.*, window.fetch) and detach the UI. Without this, DevTools
   * leaks a keydown listener and permanently overrides console/fetch.
   */
  dispose() {
    if (this.keydownHandler) {
      document.removeEventListener('keydown', this.keydownHandler);
      this.keydownHandler = null;
    }
    if (this.originalConsole) {
      console.log = this.originalConsole.log;
      console.warn = this.originalConsole.warn;
      console.error = this.originalConsole.error;
      this.originalConsole = null;
    }
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
    this.container = null;
    this.visible = false;
  }
}

/**
 * Usage:
 *
 * const devTools = new DevTools(app);
 * devTools.initialize();
 *
 * // Toggle with F12 or Ctrl+Shift+I
 * // Or programmatically:
 * devTools.toggle();
 */
