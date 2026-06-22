/**
 * Unit tests for BookmarkStore (FR-1.4).
 * localStorage is shimmed by tests/setup.js so no extra mock needed.
 */
const { BookmarkStore, isQuotaExceededError, frecencyScore } = require('../src/utils/BookmarkStore.js');

const DAY = 24 * 60 * 60 * 1000;

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

  test('non-consecutive revisits dedupe globally (A → B → A increments A, no dupe)', () => {
    store.addHistory('https://a.com', 'A');
    store.addHistory('https://b.com', 'B');
    store.addHistory('https://a.com', 'A'); // revisit A after B
    const h = store.getHistory();
    expect(h).toHaveLength(2);              // not 3 — A was not duplicated
    expect(h[0].url).toBe('https://a.com'); // most-recent visit moved to front
    expect(h[0].visits).toBe(2);            // A's visits accurately counted
    expect(h[1].url).toBe('https://b.com');
  });

  test('revisit without a title keeps the previously captured title', () => {
    store.addHistory('https://a.com', 'Real Title');
    store.addHistory('https://b.com', 'B');
    store.addHistory('https://a.com'); // no title (defaults to url)
    const a = store.getHistory().find(e => e.url === 'https://a.com');
    expect(a.title).toBe('Real Title'); // not clobbered with the url
    expect(a.visits).toBe(2);
  });

  test('revisit with a new distinct title refreshes it', () => {
    store.addHistory('https://a.com', 'Old Title');
    store.addHistory('https://b.com', 'B');
    store.addHistory('https://a.com', 'New Title');
    const a = store.getHistory().find(e => e.url === 'https://a.com');
    expect(a.title).toBe('New Title');
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

describe('isQuotaExceededError — cross-browser detection', () => {
  test('detects Chrome QuotaExceededError by name', () => {
    expect(isQuotaExceededError({ name: 'QuotaExceededError' })).toBe(true);
  });

  test('detects Firefox NS_ERROR_DOM_QUOTA_REACHED by name', () => {
    expect(isQuotaExceededError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
  });

  test('detects by numeric code 22 (WebKit) and 1014 (Firefox)', () => {
    expect(isQuotaExceededError({ code: 22 })).toBe(true);
    expect(isQuotaExceededError({ code: 1014 })).toBe(true);
  });

  test('rejects unrelated errors and falsy values', () => {
    expect(isQuotaExceededError(new Error('network'))).toBe(false);
    expect(isQuotaExceededError({ name: 'TypeError', code: 5 })).toBe(false);
    expect(isQuotaExceededError(null)).toBe(false);
    expect(isQuotaExceededError(undefined)).toBe(false);
  });
});

describe('BookmarkStore — history quota eviction', () => {
  let realSetItem;

  beforeEach(() => {
    localStorage.clear();
    realSetItem = localStorage.setItem;
  });

  afterEach(() => {
    localStorage.setItem = realSetItem;
  });

  test('addHistory evicts and retries when the quota is exceeded', () => {
    const store = new BookmarkStore();
    // Seed a sizeable history under the real setItem.
    for (let i = 0; i < 50; i++) {
      store.addHistory(`https://example.com/${i}`, `Page ${i}`);
    }

    // Now make setItem reject any payload larger than a small budget, the way
    // a full origin would. The store must shed old entries until it fits.
    const BUDGET = 600; // characters
    localStorage.setItem = (key, value) => {
      if (typeof value === 'string' && value.length > BUDGET) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      return realSetItem.call(localStorage, key, value);
    };

    // Should not throw, and should persist a pruned-but-non-empty history.
    expect(() => store.addHistory('https://example.com/new', 'New')).not.toThrow();
    const persisted = store.getHistory(999);
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted[0].url).toBe('https://example.com/new'); // newest kept
    // The serialized payload actually fit within the budget.
    expect(localStorage.getItem('quiBrowser_history').length).toBeLessThanOrEqual(BUDGET);
  });

  test('addHistory does not throw when storage rejects everything', () => {
    const store = new BookmarkStore();
    localStorage.setItem = () => {
      const err = new Error('quota');
      err.name = 'QuotaExceededError';
      throw err;
    };
    expect(() => store.addHistory('https://a.com', 'A')).not.toThrow();
  });
});

describe('frecencyScore — visit frequency weighted by recency', () => {
  test('a just-now single visit scores ~1 (no decay yet)', () => {
    const now = 1_000_000_000_000;
    expect(frecencyScore({ visits: 1, visitedAt: now }, now)).toBeCloseTo(1, 5);
  });

  test('more visits score proportionally higher at equal recency', () => {
    const now = 1_000_000_000_000;
    const a = frecencyScore({ visits: 5, visitedAt: now }, now);
    const b = frecencyScore({ visits: 1, visitedAt: now }, now);
    expect(a).toBeCloseTo(5 * b, 5);
  });

  test('recency halves the score every half-life (7 days)', () => {
    const now = 1_000_000_000_000;
    const weekAgo = now - 7 * DAY;
    expect(frecencyScore({ visits: 4, visitedAt: weekAgo }, now)).toBeCloseTo(2, 5);
  });

  test('a frequent-but-old site can rank below a rare-but-fresh one', () => {
    const now = 1_000_000_000_000;
    const oldFrequent = frecencyScore({ visits: 10, visitedAt: now - 28 * DAY }, now); // 10 * 0.5^4 = 0.625
    const freshRare   = frecencyScore({ visits: 1, visitedAt: now }, now);             // 1
    expect(freshRare).toBeGreaterThan(oldFrequent);
  });

  test('missing/zero visits is treated as a single visit; null is 0', () => {
    const now = 1_000_000_000_000;
    expect(frecencyScore({ visitedAt: now }, now)).toBeCloseTo(1, 5);
    expect(frecencyScore({ visits: 0, visitedAt: now }, now)).toBeCloseTo(1, 5);
    expect(frecencyScore(null, now)).toBe(0);
  });

  test('a future timestamp never boosts above the no-decay maximum', () => {
    const now = 1_000_000_000_000;
    // visitedAt in the future → age clamped to 0 → decay 1, not >1.
    expect(frecencyScore({ visits: 3, visitedAt: now + 10 * DAY }, now)).toBeCloseTo(3, 5);
  });
});

describe('BookmarkStore.getTopSites — frecency-ranked quick access', () => {
  let store;
  const now = 1_000_000_000_000;

  beforeEach(() => {
    localStorage.clear();
    store = new BookmarkStore();
  });

  function seed(entries) {
    // Write a known history array directly (bypassing addHistory's timestamps).
    localStorage.setItem('quiBrowser_history', JSON.stringify(entries));
  }

  test('returns [] when there is no history', () => {
    expect(store.getTopSites(8, now)).toEqual([]);
  });

  test('ranks by frecency, most useful first', () => {
    seed([
      { url: 'https://rare.com/', title: 'Rare', visits: 1, visitedAt: now },
      { url: 'https://daily.com/', title: 'Daily', visits: 20, visitedAt: now },
      { url: 'https://old.com/', title: 'Old', visits: 50, visitedAt: now - 60 * DAY }
    ]);
    const top = store.getTopSites(8, now);
    expect(top.map(s => s.host)).toEqual(['daily.com', 'rare.com', 'old.com']);
  });

  test('dedupes per host and aggregates that host\'s visits', () => {
    seed([
      { url: 'https://news.com/a', title: 'A', visits: 3, visitedAt: now },
      { url: 'https://news.com/b', title: 'B', visits: 4, visitedAt: now },
      { url: 'https://other.com/', title: 'Other', visits: 5, visitedAt: now }
    ]);
    const top = store.getTopSites(8, now);
    const news = top.find(s => s.host === 'news.com');
    expect(news.visits).toBe(7);                 // 3 + 4 aggregated
    expect(top.filter(s => s.host === 'news.com')).toHaveLength(1); // single tile
  });

  test('ranks a host by AGGREGATE frecency, so broad multi-page usage wins', () => {
    // many.com: 3 pages each visited once today → aggregate score ≈ 3.
    // few.com:  1 page visited twice today      → aggregate score ≈ 2.
    // The single best-page score is ~1 for many.com vs ~2 for few.com, so a
    // max-score ranking would (wrongly) put few.com first; the aggregate ranks
    // the more-engaged host (many.com) first.
    seed([
      { url: 'https://many.com/a', title: 'A', visits: 1, visitedAt: now },
      { url: 'https://many.com/b', title: 'B', visits: 1, visitedAt: now },
      { url: 'https://many.com/c', title: 'C', visits: 1, visitedAt: now },
      { url: 'https://few.com/x',  title: 'X', visits: 2, visitedAt: now }
    ]);
    const top = store.getTopSites(8, now);
    expect(top.map(s => s.host)).toEqual(['many.com', 'few.com']);
    expect(top[0].score).toBeCloseTo(3, 5);
    expect(top[1].score).toBeCloseTo(2, 5);
  });

  test('the returned tiles do not leak the internal _bestScore field', () => {
    seed([
      { url: 'https://a.com/1', title: '1', visits: 1, visitedAt: now },
      { url: 'https://a.com/2', title: '2', visits: 1, visitedAt: now }
    ]);
    const [tile] = store.getTopSites(8, now);
    expect(tile).not.toHaveProperty('_bestScore');
    expect(Object.keys(tile).sort()).toEqual(['host', 'score', 'title', 'url', 'visits']);
  });

  test('the per-host tile keeps the highest-scoring page as its representative', () => {
    seed([
      { url: 'https://site.com/old', title: 'Old page', visits: 2, visitedAt: now - 30 * DAY },
      { url: 'https://site.com/hot', title: 'Hot page', visits: 2, visitedAt: now }
    ]);
    const [tile] = store.getTopSites(8, now);
    expect(tile.url).toBe('https://site.com/hot');
    expect(tile.title).toBe('Hot page');
  });

  test('exclude omits given hosts (e.g. the search engine) from the ranking', () => {
    seed([
      { url: 'https://duckduckgo.com/?q=cats', title: 'cats', visits: 40, visitedAt: now },
      { url: 'https://news.com/', title: 'News', visits: 5, visitedAt: now }
    ]);
    // Without exclusion the heavily-used search engine would be #1.
    expect(store.getTopSites(8, now)[0].host).toBe('duckduckgo.com');
    // Excluded → the user's real destination wins the slot.
    const top = store.getTopSites(8, now, ['duckduckgo.com']);
    expect(top.map(s => s.host)).toEqual(['news.com']);
  });

  test('exclude matching is case-insensitive', () => {
    seed([{ url: 'https://Example.COM/', title: 'E', visits: 3, visitedAt: now }]);
    expect(store.getTopSites(8, now, ['EXAMPLE.com'])).toHaveLength(0);
  });

  test('respects the limit', () => {
    seed(Array.from({ length: 12 }, (_, i) => ({
      url: `https://s${i}.com/`, title: `S${i}`, visits: i + 1, visitedAt: now
    })));
    expect(store.getTopSites(5, now)).toHaveLength(5);
  });

  test('skips malformed entries without a url', () => {
    seed([
      { title: 'no url', visits: 9, visitedAt: now },
      null,
      { url: 'https://ok.com/', title: 'OK', visits: 1, visitedAt: now }
    ]);
    const top = store.getTopSites(8, now);
    expect(top).toHaveLength(1);
    expect(top[0].host).toBe('ok.com');
  });
});
