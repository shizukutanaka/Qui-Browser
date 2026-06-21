/**
 * Lightweight bookmark and browsing-history store backed by localStorage.
 * FR-1.4 — no dependencies, works in both browser and Node (with shim).
 */

const BOOKMARKS_KEY = 'quiBrowser_bookmarks';
const HISTORY_KEY   = 'quiBrowser_history';
const MAX_HISTORY   = 200;

/**
 * Detect a localStorage quota-exceeded error across browsers. Chrome throws a
 * DOMException named 'QuotaExceededError' (code 22); Firefox uses
 * 'NS_ERROR_DOM_QUOTA_REACHED' (code 1014); older WebKit/private-mode builds
 * surface code 22 with an empty name. Checking all of these is the standard
 * cross-browser guard (per the JP dev community localStorage-quota posts).
 *
 * Pure — testable without a real Storage.
 *
 * @param {*} e  the caught error
 * @returns {boolean}
 */
export function isQuotaExceededError(e) {
  if (!e) {
    return false;
  }
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
}

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

/**
 * Persist `value` as JSON under `key`.
 * @returns {boolean} true on success, false if storage was unavailable or full.
 */
function writeJSON(key, value) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }
  } catch { /* storage full or unavailable — caller decides whether to retry */ }
  return false;
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
    if (all.length > MAX_HISTORY) {
      all.length = MAX_HISTORY;
    }
    // Persist with evict-and-retry: if the quota is exceeded (other site data
    // filling the origin, or unusually large entries), shed the oldest quarter
    // and try again rather than failing permanently and losing the new visit.
    // Without this the write would keep failing forever and history would stop
    // updating silently. Each retry drops ~25% until it fits or nothing's left.
    if (typeof localStorage !== 'undefined') {
      let working = all;
      while (!writeJSON(HISTORY_KEY, working) && working.length > 1) {
        const keep = Math.floor(working.length * 0.75);
        working = working.slice(0, Math.max(keep, 1));
      }
    }
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
