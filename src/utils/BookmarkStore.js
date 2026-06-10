/**
 * Lightweight bookmark and browsing-history store backed by localStorage.
 * FR-1.4 — no dependencies, works in both browser and Node (with shim).
 */

const BOOKMARKS_KEY = 'quiBrowser_bookmarks';
const HISTORY_KEY   = 'quiBrowser_history';
const MAX_HISTORY   = 200;

function readJSON(key, fallback) {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(key)
      : null;
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch { /* storage full or unavailable */ }
}

export class BookmarkStore {
  // ── Bookmarks ───────────────────────────────────────────────────────────────

  /** Return all bookmarks as `[{ url, title, addedAt }]` sorted by addedAt desc. */
  getBookmarks() {
    return readJSON(BOOKMARKS_KEY, []);
  }

  /**
   * Add or update a bookmark.  If the URL already exists the title is updated
   * and `addedAt` is refreshed.
   */
  addBookmark(url, title = url) {
    const list = this.getBookmarks().filter(b => b.url !== url);
    list.unshift({ url, title, addedAt: Date.now() });
    writeJSON(BOOKMARKS_KEY, list);
    return list[0];
  }

  /** Remove a bookmark by URL. */
  removeBookmark(url) {
    const list = this.getBookmarks().filter(b => b.url !== url);
    writeJSON(BOOKMARKS_KEY, list);
  }

  /** Return true when the URL is bookmarked. */
  isBookmarked(url) {
    return this.getBookmarks().some(b => b.url === url);
  }

  /**
   * Toggle a bookmark: removes it if present, adds it otherwise.
   * @returns {boolean} the new bookmarked state (true = now bookmarked).
   */
  toggleBookmark(url, title = url) {
    if (this.isBookmarked(url)) {
      this.removeBookmark(url);
      return false;
    }
    this.addBookmark(url, title);
    return true;
  }

  // ── History ─────────────────────────────────────────────────────────────────

  /** Return the most recent `limit` history entries (default 50). */
  getHistory(limit = 50) {
    const all = readJSON(HISTORY_KEY, []);
    return all.slice(0, limit);
  }

  /**
   * Append a visit.  Duplicate consecutive URLs are collapsed into one entry
   * with an incremented `visits` counter.
   */
  addHistory(url, title = url) {
    const all = readJSON(HISTORY_KEY, []);
    const last = all[0];
    if (last && last.url === url) {
      last.visits = (last.visits || 1) + 1;
      last.visitedAt = Date.now();
    } else {
      all.unshift({ url, title, visitedAt: Date.now(), visits: 1 });
    }
    // Trim to keep storage bounded.
    if (all.length > MAX_HISTORY) all.length = MAX_HISTORY;
    writeJSON(HISTORY_KEY, all);
    return all[0];
  }

  /** Remove a single history entry by URL. */
  removeHistory(url) {
    const all = readJSON(HISTORY_KEY, []).filter(e => e.url !== url);
    writeJSON(HISTORY_KEY, all);
  }

  /** Wipe all history. */
  clearHistory() {
    writeJSON(HISTORY_KEY, []);
  }
}
