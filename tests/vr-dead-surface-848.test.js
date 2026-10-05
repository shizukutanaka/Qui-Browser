/**
 * Pin the consumed surface of BookmarkStore — VR-only consumers
 * (VRApp / BookmarkPanel / WebPanel / VoiceCommands / JapaneseIME).
 * Dead surface removed in round 848: isQuotaExceededError (zero src callers,
 * self-tested only) and removeHistory (zero src callers, self-tested only).
 */
const store = require('../src/utils/BookmarkStore.js');
const { BookmarkStore } = store;

describe('BookmarkStore — dead surface removed (round 848)', () => {
  test('isQuotaExceededError export is gone (zero src consumers)', () => {
    expect(store.isQuotaExceededError).toBeUndefined();
  });

  test('removeHistory is gone (zero src consumers)', () => {
    const s = new BookmarkStore();
    expect(s.removeHistory).toBeUndefined();
  });
});

describe('BookmarkStore — live surface pinned', () => {
  test('module exports the consumed surface', () => {
    expect(typeof BookmarkStore).toBe('function');
    expect(typeof store.MAX_HISTORY).toBe('number');
    expect(typeof store.frecencyScore).toBe('function');
  });

  test('instance keeps every method src actually calls', () => {
    const s = new BookmarkStore();
    for (const m of [
      'getBookmarks',
      'addBookmark',
      'removeBookmark',
      'isBookmarked',
      'toggleBookmark',
      'getHistory',
      'addHistory',
      'clearHistory',
      'getTopSites',
      'search'
    ]) {
      expect(typeof s[m]).toBe('function');
    }
  });
});
