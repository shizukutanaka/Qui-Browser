/**
 * readerTextScale: persisted preference must reach the panels at boot.
 *
 * `readerTextScale` is persisted (settings panel stepper + voice commands write
 * it), but `_buildBrowsingSystems()` constructed TabManager without forwarding
 * it — panels always booted at readerScale 1 regardless of the saved value,
 * until the user touched the stepper again. Sibling preferences already take
 * this path: `searchEngine`/`readerProxyUrl` go in via the same opts object,
 * and `privateMode`/`enableCurvedPanel` are applied right after construction
 * (same class as the Session-2 haptics persisted-preference fix).
 *
 * VRApp is driven via the established convention: `VRApp.prototype` bound to a
 * hand-built `this` (a real `new VRApp()` needs a GPU). TabManager and
 * BookmarkPanel are mocked so the constructor opts can be inspected; the real
 * TabManager is pulled back via jest.requireActual to pin the opts → panel
 * consumption path the wiring relies on.
 */

// Real 'three' (same convention as vr-app-wiring.test.js) — only the two
// WebXR-session-touching examples modules VRApp imports are mocked, since
// their top-level code assumes a real navigator.xr.
jest.mock('three/examples/jsm/webxr/VRButton.js', () => ({
  VRButton: { createButton: () => ({}) }
}));
jest.mock('three/examples/jsm/webxr/XRControllerModelFactory.js', () => ({
  XRControllerModelFactory: class {
    createControllerModel() {
      return {};
    }
  }
}));

// ── WebPanel stub — records the opts each panel was built with ────────────────
jest.mock('../src/vr/browser/WebPanel.js', () => ({
  WebPanel: class {
    constructor(opts) {
      this.opts = opts;
      this.group = { position: { set: jest.fn() } };
      this.visible = false;
    }
    addToScene(parent) {
      this.parent = parent;
    }
    setVisible(v) {
      this.visible = !!v;
    }
    navigate(url) {
      this.currentUrl = url;
    }
    dispose() {}
  }
}));

// ── TabManager + BookmarkPanel mocks (capture constructor opts) ───────────────
const tabManagerOptsSeen = [];
jest.mock('../src/vr/browser/TabManager.js', () => ({
  TabManager: class {
    constructor(opts) {
      tabManagerOptsSeen.push(opts);
      this.opts = opts;
      this.count = 1;
      this.addToScene = jest.fn();
      this.setCurved = jest.fn();
      this.setPrivateMode = jest.fn();
      this.restoreSession = jest.fn();
      this.newTab = jest.fn();
      this.getActiveTab = () => ({ navigate: jest.fn() });
      this.dispose = jest.fn();
    }
  }
}));
jest.mock('../src/vr/browser/BookmarkPanel.js', () => ({
  BookmarkPanel: class {
    constructor() {
      this.addToScene = jest.fn();
      this.dispose = jest.fn();
    }
  }
}));

global.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      beginPath: jest.fn(),
      arc: jest.fn(),
      fill: jest.fn(),
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: ''
    })
  })
};

const { VRApp } = require('../src/vr/VRApp.js');
const RealTabManager = jest.requireActual('../src/vr/browser/TabManager.js').TabManager;

function makeApp(settingsOverrides = {}) {
  return {
    tabManager: null,
    bookmarkPanel: null,
    webPanel: null,
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    navigate: jest.fn(),
    _persistTabSession: jest.fn(),
    _requestVRKeyboardInput: jest.fn(),
    _onPanelGrabRequested: jest.fn(),
    _toggleBookmark: jest.fn(),
    showVRToast: jest.fn(),
    captionSystem: null,
    hapticFeedback: null,
    bookmarks: {
      getTopSites: () => [],
      isBookmarked: () => false,
      search: () => []
    },
    settings: {
      readerTextScale: 1.0,
      readerProxyUrl: '',
      searchEngine: 'google',
      privateMode: false,
      enableCurvedPanel: false,
      restoreTabs: false,
      enableGazeDwell: false,
      ...settingsOverrides
    }
  };
}

describe('_buildBrowsingSystems — persisted readerTextScale reaches the panels', () => {
  beforeEach(() => tabManagerOptsSeen.splice(0));

  test('TabManager is constructed with the persisted readerTextScale', () => {
    const app = makeApp({ readerTextScale: 1.6 });
    VRApp.prototype._buildBrowsingSystems.call(app);

    expect(tabManagerOptsSeen).toHaveLength(1);
    expect(tabManagerOptsSeen[0].readerScale).toBe(1.6);
  });

  test('default readerTextScale forwards as 1 (no behavioural change)', () => {
    const app = makeApp();
    VRApp.prototype._buildBrowsingSystems.call(app);

    expect(tabManagerOptsSeen[0].readerScale).toBe(1.0);
  });
});

describe('TabManager — the opts → panel path the wiring relies on', () => {
  function makeManager(readerScale) {
    return new RealTabManager({
      scene: { add: jest.fn(), remove: jest.fn() },
      registerInteractable: jest.fn(),
      unregisterInteractable: jest.fn(),
      readerScale
    });
  }

  test('newTab() forwards opts.readerScale to the panel', () => {
    const tm = makeManager(1.6);
    tm.newTab('https://a.jp');
    expect(tm.tabs[0].opts.readerScale).toBe(1.6);
  });

  test('setReaderScale still updates later tabs (live path unchanged)', () => {
    const tm = makeManager(1.6);
    tm.setReaderScale(2.0);
    tm.newTab('https://b.jp');
    expect(tm.tabs[0].opts.readerScale).toBe(2.0);
  });
});
