/**
 * Drawn-snapshot hit-testing for BookmarkPanel (round 844).
 *
 * _draw() paints rows fetched at draw time, but _onSelect() re-fetched the
 * live list and resolved the click against THAT. Between draw and click the
 * list mutates (history prepends on every navigation; the chrome-bar star
 * removes bookmarks on the shared store), so the entry at the aimed position
 * could differ from the row the user saw:
 *   - 'row'       → opened a DIFFERENT url than the one displayed
 *   - 'deleteRow' → removed a DIFFERENT bookmark than the one aimed at
 * Fix: _draw() snapshots the list it painted (_drawnRows) and _onSelect
 * resolves clicks against what the canvas actually shows.
 */

const { PANEL_PX_W, PANEL_PX_H, HEADER_H } = require('../src/vr/browser/bookmarkLayout.js');

const PANEL_W = 1.2;
const PANEL_H = PANEL_W * (PANEL_PX_H / PANEL_PX_W);

class MockGroup {
  constructor() {
    this.position = { set: jest.fn() };
    this.rotation = {};
    this._o = [];
  }
  add(o) {
    this._o.push(o);
  }
  remove(o) {
    this._o = this._o.filter((x) => x !== o);
  }
}
class MockMesh {
  constructor() {
    this.name = '';
    this.visible = true;
    this.geometry = { dispose: jest.fn() };
    this.material = { dispose: jest.fn() };
  }
  worldToLocal() {
    return MockMesh._nextLocal;
  }
}
MockMesh._nextLocal = { x: 0, y: 0 };

jest.mock('three', () => ({
  Group: MockGroup,
  Mesh: MockMesh,
  PlaneGeometry: class {
    dispose() {}
  },
  MeshBasicMaterial: class {
    dispose() {}
  },
  CanvasTexture: class {
    constructor() {
      this.needsUpdate = false;
    }
    dispose() {}
  },
  SRGBColorSpace: 'srgb'
}));

const ctxStub = {
  fillRect() {},
  strokeRect() {},
  clearRect() {},
  fillText() {},
  set fillStyle(v) {},
  set strokeStyle(v) {},
  set font(v) {},
  set textAlign(v) {},
  set lineWidth(v) {}
};
global.document = global.document || {};
global.document.createElement = () => ({
  width: 0,
  height: 0,
  getContext: () => ctxStub
});

const { BookmarkPanel } = require('../src/vr/browser/BookmarkPanel.js');

function localFor(px, py) {
  const u = px / PANEL_PX_W;
  const v = 1 - py / PANEL_PX_H;
  return {
    x: (u - 0.5) * PANEL_W,
    y: (v - 0.5) * PANEL_H,
    clone() {
      return this;
    }
  };
}

function makePanel(store, onSelect = jest.fn()) {
  const p = new BookmarkPanel({
    scene: { add: jest.fn(), remove: jest.fn() },
    registerInteractable: jest.fn(),
    unregisterInteractable: jest.fn(),
    store,
    onSelect
  });
  p.addToScene();
  p.show();
  return p;
}

describe('BookmarkPanel hit-testing acts on the drawn list, not a mutated one', () => {
  test('row select opens the entry shown at draw time, not the new live head', () => {
    // Drawn with [A,B,C]; live list then gains a new head entry X (exactly
    // what a navigation elsewhere does to the history list) before the click.
    let bookmarks = [
      { url: 'https://a.example', title: 'A' },
      { url: 'https://b.example', title: 'B' },
      { url: 'https://c.example', title: 'C' }
    ];
    const store = {
      getBookmarks: () => bookmarks,
      getHistory: () => []
    };
    const onSelect = jest.fn();
    const p = makePanel(store, onSelect);
    // List mutates after the paint: a new head shifts every drawn row down.
    bookmarks = [{ url: 'https://x.example', title: 'X' }, ...bookmarks];
    // Click the first visible row — the canvas still shows A there.
    MockMesh._nextLocal = localFor(100, HEADER_H + 10);
    p._onSelect({
      clone() {
        return MockMesh._nextLocal;
      }
    });
    expect(onSelect).toHaveBeenCalledWith('https://a.example');
  });

  test('deleteRow removes the bookmark the user aimed at, not a shifted one', () => {
    let bookmarks = [
      { url: 'https://a.example', title: 'A' },
      { url: 'https://b.example', title: 'B' },
      { url: 'https://c.example', title: 'C' }
    ];
    const removed = [];
    const store = {
      getBookmarks: () => bookmarks,
      getHistory: () => [],
      removeBookmark: (url) => {
        removed.push(url);
        bookmarks = bookmarks.filter((b) => b.url !== url);
      }
    };
    const p = makePanel(store);
    // A new head lands on the live list (e.g. chrome-bar star added X).
    bookmarks = [{ url: 'https://x.example', title: 'X' }, ...bookmarks];
    // The canvas still shows A at row 0 — aiming at its delete zone must
    // remove A, not B (what live data shifted into that position).
    MockMesh._nextLocal = localFor(PANEL_PX_W - 24, HEADER_H + 10);
    p._onSelect({
      clone() {
        return MockMesh._nextLocal;
      }
    });
    expect(removed).toEqual(['https://a.example']);
    expect(bookmarks.map((b) => b.url)).toEqual(['https://x.example', 'https://b.example', 'https://c.example']);
  });

  test('click on a row drawn but since emptied is a no-op, not a wrong-target act', () => {
    let bookmarks = [
      { url: 'https://a.example', title: 'A' },
      { url: 'https://b.example', title: 'B' }
    ];
    const store = {
      getBookmarks: () => bookmarks,
      getHistory: () => []
    };
    const onSelect = jest.fn();
    const p = makePanel(store, onSelect);
    // Entire list cleared externally before the click.
    bookmarks = [];
    // Click row 0 — pre-fix live lookup found nothing; post-fix the drawn
    // entry A is still the honest target (its url is captured in the paint).
    MockMesh._nextLocal = localFor(100, HEADER_H + 10);
    p._onSelect({
      clone() {
        return MockMesh._nextLocal;
      }
    });
    expect(onSelect).toHaveBeenCalledWith('https://a.example');
  });
});
