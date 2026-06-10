/**
 * Unit tests for BookmarkStore (FR-1.4).
 * localStorage is shimmed by tests/setup.js so no extra mock needed.
 */
const { BookmarkStore } = require('../src/utils/BookmarkStore.js');

describe('BookmarkStore — bookmarks', () => {
  let store;

  beforeEach(() => {
    // Clear localStorage between tests so state doesn't leak.
    localStorage.clear();
    store = new BookmarkStore();
  });

  test('getBookmarks() returns [] when empty', () => {
    expect(store.getBookmarks()).toEqual([]);
  });

  test('addBookmark() stores and retrieves an entry', () => {
    store.addBookmark('https://example.com', 'Example');
    const list = store.getBookmarks();
    expect(list).toHaveLength(1);
    expect(list[0].url).toBe('https://example.com');
    expect(list[0].title).toBe('Example');
  });

  test('addBookmark() deduplicates by URL', () => {
    store.addBookmark('https://example.com', 'Old title');
    store.addBookmark('https://example.com', 'New title');
    const list = store.getBookmarks();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('New title');
  });

  test('removeBookmark() deletes the entry', () => {
    store.addBookmark('https://example.com', 'Example');
    store.removeBookmark('https://example.com');
    expect(store.getBookmarks()).toHaveLength(0);
  });

  test('isBookmarked() returns true only for known URLs', () => {
    store.addBookmark('https://example.com', 'Example');
    expect(store.isBookmarked('https://example.com')).toBe(true);
    expect(store.isBookmarked('https://other.com')).toBe(false);
  });

  test('toggleBookmark() adds when absent and returns true', () => {
    const state = store.toggleBookmark('https://example.com', 'Example');
    expect(state).toBe(true);
    expect(store.isBookmarked('https://example.com')).toBe(true);
  });

  test('toggleBookmark() removes when present and returns false', () => {
    store.addBookmark('https://example.com', 'Example');
    const state = store.toggleBookmark('https://example.com');
    expect(state).toBe(false);
    expect(store.isBookmarked('https://example.com')).toBe(false);
  });

  test('toggleBookmark() round-trips', () => {
    expect(store.toggleBookmark('https://x.com')).toBe(true);
    expect(store.toggleBookmark('https://x.com')).toBe(false);
    expect(store.toggleBookmark('https://x.com')).toBe(true);
    expect(store.getBookmarks()).toHaveLength(1);
  });
});

describe('BookmarkStore — history', () => {
  let store;

  beforeEach(() => {
    localStorage.clear();
    store = new BookmarkStore();
  });

  test('getHistory() returns [] when empty', () => {
    expect(store.getHistory()).toEqual([]);
  });

  test('addHistory() appends an entry', () => {
    store.addHistory('https://example.com', 'Example');
    const h = store.getHistory();
    expect(h).toHaveLength(1);
    expect(h[0].url).toBe('https://example.com');
    expect(h[0].visits).toBe(1);
  });

  test('consecutive same-URL visits are collapsed (visits counter incremented)', () => {
    store.addHistory('https://example.com', 'Example');
    store.addHistory('https://example.com', 'Example');
    const h = store.getHistory();
    expect(h).toHaveLength(1);
    expect(h[0].visits).toBe(2);
  });

  test('different URLs produce separate entries', () => {
    store.addHistory('https://a.com', 'A');
    store.addHistory('https://b.com', 'B');
    expect(store.getHistory()).toHaveLength(2);
  });

  test('getHistory(limit) returns at most limit entries', () => {
    for (let i = 0; i < 10; i++) {
      store.addHistory(`https://example.com/${i}`, `Page ${i}`);
    }
    expect(store.getHistory(3)).toHaveLength(3);
  });

  test('clearHistory() removes all entries', () => {
    store.addHistory('https://example.com', 'Example');
    store.clearHistory();
    expect(store.getHistory()).toHaveLength(0);
  });

  test('removeHistory() removes one entry', () => {
    store.addHistory('https://a.com', 'A');
    store.addHistory('https://b.com', 'B');
    store.removeHistory('https://a.com');
    const h = store.getHistory();
    expect(h).toHaveLength(1);
    expect(h[0].url).toBe('https://b.com');
  });
});
