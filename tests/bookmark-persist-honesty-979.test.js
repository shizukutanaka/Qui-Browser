/**
 * BookmarkStore persistence honesty — mutators must not claim a change the
 * storage layer refused to persist.
 *
 * `writeJSON` already returns a boolean (quota-exceeded / storage unavailable
 * → false) but every consumer ignored it, so:
 *  - toggleBookmark() reported "bookmarked" while nothing was written —
 *    _toggleBookmark then captions "Bookmarked" for a bookmark that dies on
 *    reload;
 *  - removeBookmark() dropped nothing yet BookmarkPanel still fired
 *    onDeleteBookmark ("Bookmark deleted" + haptic);
 *  - clearHistory() persisted nothing yet _clearBrowsingHistory toasted
 *    "History cleared".
 *
 * These tests pin the honest contract, not the instances:
 *  - addBookmark returns the entry on success, null when the write failed;
 *  - removeBookmark / clearHistory return writeJSON's boolean;
 *  - toggleBookmark returns null on persist failure (state unchanged), the
 *    new boolean state otherwise;
 *  - every announcing caller conditions its confirmation on that result.
 */

const fs = require('fs');
const path = require('path');
const { BookmarkStore } = require('../src/utils/BookmarkStore.js');

const VRAPP = path.join(__dirname, '..', 'src', 'vr', 'VRApp.js');
const vrAppSrc = fs.readFileSync(VRAPP, 'utf8');
const PANEL = path.join(__dirname, '..', 'src', 'vr', 'browser', 'BookmarkPanel.js');
const panelSrc = fs.readFileSync(PANEL, 'utf8');

function methodBody(src, name) {
  const start = src.indexOf(`\n  ${name}(`);
  if (start === -1) {
    return '';
  }
  let depth = 0;
  let end = src.length;
  for (let i = src.indexOf('{', start); i < src.length; i++) {
    const c = src[i];
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  return src.slice(start, end);
}

// localStorage writes always fail → simulates quota-exceeded / blocked storage.
function breakStorage() {
  const real = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  return () => {
    localStorage.setItem = real;
  };
}

describe('BookmarkStore mutators report persist success honestly', () => {
  let store;
  let restore;
  beforeEach(() => {
    localStorage.clear();
    store = new BookmarkStore();
    restore = breakStorage();
  });
  afterEach(() => {
    restore();
    localStorage.clear();
  });

  test('addBookmark returns null when the write fails', () => {
    expect(store.addBookmark('https://x.com')).toBeNull();
  });

  test('removeBookmark returns false when the write fails', () => {
    // Seed a bookmark while storage still worked, then re-break:
    restore();
    store.addBookmark('https://x.com');
    restore = breakStorage();
    expect(store.removeBookmark('https://x.com')).toBe(false);
  });

  test('toggleBookmark returns null on failed add — not a false "bookmarked"', () => {
    expect(store.toggleBookmark('https://x.com')).toBeNull();
  });

  test('toggleBookmark returns null on failed remove — state unchanged', () => {
    restore();
    store.addBookmark('https://x.com');
    restore = breakStorage();
    expect(store.toggleBookmark('https://x.com')).toBeNull();
    restore();
    expect(store.isBookmarked('https://x.com')).toBe(true);
  });

  test('clearHistory returns false when the wipe cannot persist', () => {
    restore();
    store.addHistory('https://x.com');
    restore = breakStorage();
    expect(store.clearHistory()).toBe(false);
    restore();
    expect(store.getHistory().length).toBeGreaterThan(0);
  });
});

describe('mutators keep reporting success when storage works', () => {
  let store;
  beforeEach(() => {
    localStorage.clear();
    store = new BookmarkStore();
  });
  test('addBookmark returns the entry', () => {
    expect(store.addBookmark('https://x.com', 'X')).toEqual(expect.objectContaining({ url: 'https://x.com' }));
  });
  test('toggleBookmark round-trips booleans', () => {
    expect(store.toggleBookmark('https://x.com')).toBe(true);
    expect(store.toggleBookmark('https://x.com')).toBe(false);
  });
  test('clearHistory returns true', () => {
    store.addHistory('https://x.com');
    expect(store.clearHistory()).toBe(true);
  });
});

describe('announcing callers condition confirmations on the persist result', () => {
  test('_toggleBookmark checks for the null (persist-failed) case before captioning', () => {
    const body = methodBody(vrAppSrc, '_toggleBookmark');
    expect(body).toMatch(/===\s*null|!==\s*null|null\s*===|null\s*!==/);
  });

  test('_clearBrowsingHistory conditions the "history cleared" toast on clearHistory()', () => {
    const body = methodBody(vrAppSrc, '_clearBrowsingHistory');
    expect(body).toMatch(/clearHistory\(\)/);
    // The success toast must be inside a conditional on that return value —
    // not unconditional as before.
    const toastIdx = body.indexOf('historyCleared');
    const clearedIdx = body.indexOf('clearHistory()');
    expect(clearedIdx).toBeGreaterThanOrEqual(0);
    expect(toastIdx).toBeGreaterThan(clearedIdx);
    expect(body.slice(clearedIdx, toastIdx)).toMatch(/if|&&|\?/);
  });

  test('BookmarkPanel deleteRow only confirms delete when removeBookmark persisted', () => {
    const idx = panelSrc.indexOf("case 'deleteRow'");
    expect(idx).toBeGreaterThan(-1);
    const body = panelSrc.slice(idx, idx + 1200);
    const callIdx = body.indexOf('removeBookmark(entry.url)');
    const confirmIdx = body.indexOf('onDeleteBookmark');
    expect(callIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeGreaterThan(callIdx);
    expect(body.slice(callIdx, confirmIdx)).toMatch(/if|&&|\?/);
  });
});
