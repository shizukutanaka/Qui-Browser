/**
 * Lightweight bookmark and browsing-history store backed by localStorage.
 * FR-1.4 — no dependencies, works in both browser and Node (with shim).
 */

const BOOKMARKS_KEY = 'quiBrowser_bookmarks';
const HISTORY_KEY   = 'quiBrowser_history';
const MAX_HISTORY   = 200;
const FRECENCY_HALF_LIFE_DAYS = 7; // recency weight halves every week

/**
 * Frecency score for a history entry: visit frequency weighted by recency.
 *
 * Backs the "Top Sites" quick-access — an accessibility feature, not just a
 * convenience: a gaze-dwell / hands-free user reaches their most likely
 * destination in the fewest dwells when the surface is ranked by how much a
 * site is actually used, rather than chronologically (history) or by manual
 * curation (bookmarks).
 *
 * score = visits × 0.5^(ageInDays / halfLife). A site visited often and
 * recently scores highest; an old one decays smoothly toward zero. Pure /
 * dependency-free so the ranking is unit-testable.
 *
 * @param {{visits?: number, visitedAt?: number}} entry
 * @param {number} [now=Date.now()]              reference time (ms)
 * @param {number} [halfLifeDays=FRECENCY_HALF_LIFE_DAYS]
 * @returns {number}
 */
export function frecencyScore(entry, now = Date.now(), halfLifeDays = FRECENCY_HALF_LIFE_DAYS) {
  if (!entry) {
    return 0;
  }
  const visits = entry.visits > 0 ? entry.visits : 1;
  const ageMs = Math.max(0, now - (entry.visitedAt || 0));
  const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;
  const decay = Math.pow(0.5, ageMs / halfLifeMs);
  return visits * decay;
}

/** Strip a leading "www." so apex and www variants group as one site. */
function stripWww(host) {
  return host.startsWith('www.') ? host.slice(4) : host;
}

/**
 * Normalised, lower-cased host of a URL for site grouping: a leading "www." is
 * folded so https://www.example.com and https://example.com count as the same
 * site (otherwise they'd split into two tiles, fragmenting the site's frecency
 * and visit count). Falls back to the raw string when the URL can't be parsed.
 */
function hostOf(url) {
  try {
    return stripWww(new URL(url).host.toLowerCase());
  } catch {
    return stripWww(String(url).toLowerCase());
  }
}

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
    // Dedupe by URL across the WHOLE history, not just the most-recent entry.
    // Revisiting a site seen earlier (the common A → B → A case) must bump its
    // visit count and move it to the front — not append a duplicate. The old
    // code only collapsed consecutive repeats (all[0]), so non-consecutive
    // revisits created separate visits:1 entries: that undercounts true visit
    // frequency (the signal Top Sites / frecency rank on) and bloats the bounded
    // history with duplicates of the same URL.
    const existingIdx = all.findIndex(e => e && e.url === url);
    if (existingIdx !== -1) {
      const [entry] = all.splice(existingIdx, 1);
      entry.visits = (entry.visits || 1) + 1;
      entry.visitedAt = Date.now();
      // Refresh the title only when a real one is supplied (the param defaults
      // to the url), so a revisit without a title can't clobber a good one.
      if (title && title !== url) {
        entry.title = title;
      }
      all.unshift(entry);
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

  /**
   * Frecency-ranked "Top Sites": the most-used destinations, deduped per host
   * so one busy site can't crowd out the rest, newest-and-most-frequent first.
   *
   * Powers a fewest-dwell quick-access surface for hands-free users. A host's
   * rank is its *aggregate* frecency — the sum of its pages' scores — so broad
   * engagement across many pages counts, not just the single best page. The
   * tile's representative URL/title is the host's highest-scoring page. Returns
   * `[{ url, title, host, visits, score }]` (score = host-aggregate frecency).
   *
   * `exclude` skips given hosts entirely — used to keep search-engine result
   * pages (every search resolves to e.g. duckduckgo.com) from dominating the
   * speed dial, which would otherwise surface the search engine as the user's
   * "top site" and waste the highest-value, fewest-dwell slot.
   *
   * @param {number} [limit=8]         max tiles to return
   * @param {number} [now=Date.now()]  reference time for the recency decay
   * @param {string[]} [exclude=[]]    hosts to omit (case-insensitive)
   * @returns {Array<{url:string,title:string,host:string,visits:number,score:number}>}
   */
  getTopSites(limit = 8, now = Date.now(), exclude = []) {
    const history = readJSON(HISTORY_KEY, []);
    // Normalise the exclude list the same way as entry hosts (lowercase +
    // www-fold) so e.g. 'www.google.com' matches the folded 'google.com' key.
    const skip = new Set((exclude || []).map(h => stripWww(String(h).toLowerCase())));
    const byHost = new Map();
    for (const entry of history) {
      if (!entry || !entry.url) {
        continue;
      }
      const host = hostOf(entry.url);
      if (skip.has(host)) {
        continue;
      }
      const score = frecencyScore(entry, now);
      const visits = entry.visits > 0 ? entry.visits : 1;
      const existing = byHost.get(host);
      if (!existing) {
        byHost.set(host, {
          url: entry.url,
          title: entry.title || entry.url,
          host,
          visits,
          score,        // running host-aggregate frecency
          _bestScore: score // highest single-page score → picks the representative
        });
      } else {
        // Aggregate the host's total visits AND frecency so broad usage ranks;
        // keep the best-scoring page as the representative URL/title.
        existing.visits += visits;
        existing.score += score;
        if (score > existing._bestScore) {
          existing._bestScore = score;
          existing.url = entry.url;
          existing.title = entry.title || entry.url;
        }
      }
    }
    return [...byHost.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit))
      .map(({ _bestScore, ...site }) => site); // drop the internal field
  }

  /**
   * Frecency-ranked URL completions for a partial query.
   *
   * Searches history and bookmarks for entries whose URL or title contains
   * `query` (case-insensitive substring). History entries score by their real
   * frecency (visits × recency decay). A bookmark-only URL scores as one
   * virtual visit at its `addedAt` time — recently-added bookmarks therefore
   * appear even before the user has visited them via history, but decay
   * naturally with age. When a URL appears in both history and bookmarks the
   * history entry wins (real visit data is more accurate).
   *
   * This backs the in-VR address-bar autocomplete surface: a gaze user who
   * has visited github.com 30 times can dwell on one suggestion instead of
   * typing 10 characters (10 × 1 500 ms ≈ 15 s saved per navigation).
   *
   * @param {string}  [query='']           case-insensitive substring to match
   * @param {number}  [limit=5]            max results to return
   * @param {number}  [now=Date.now()]     reference time for recency decay
   * @returns {Array<{url:string, title:string, score:number}>}
   */
  search(query = '', limit = 5, now = Date.now()) {
    // NFC-normalize so an NFD query (e.g. か + combining ゙ from some IMEs /
    // macOS paste) matches NFC-stored history titles (the common storage form).
    // Without this, NFD "が" and NFC "が" compare unequal via String.includes,
    // so a Japanese user who just typed a title gets zero suggestions despite
    // the page being in history. ASCII is unaffected.
    const q = String(query).normalize('NFC').toLowerCase();
    const history   = readJSON(HISTORY_KEY,   []);
    const bookmarks = readJSON(BOOKMARKS_KEY, []);

    // Case- and NFC-insensitive substring test over an entry's url + title.
    // Both sides are coerced with String() so a malformed/legacy entry whose
    // url is a number can't throw via .normalize and break every keystroke.
    const matches = (url, title) => {
      if (!q) {
        return true;
      }
      return String(url).normalize('NFC').toLowerCase().includes(q) ||
        String(title || '').normalize('NFC').toLowerCase().includes(q);
    };

    const byUrl = new Map();

    for (const entry of history) {
      if (!entry || !entry.url) {
        continue;
      }
      if (!matches(entry.url, entry.title)) {
        continue;
      }
      byUrl.set(entry.url, {
        url:   entry.url,
        title: entry.title || entry.url,
        score: frecencyScore(entry, now)
      });
    }

    // Bookmark-only URLs get one virtual visit scored at addedAt so recently
    // bookmarked sites surface even before the user builds up visit history.
    for (const bm of bookmarks) {
      if (!bm || !bm.url) {
        continue;
      }
      if (byUrl.has(bm.url)) {
        continue; // history entry already present — it wins (real visit data)
      }
      if (!matches(bm.url, bm.title)) {
        continue;
      }
      // Bookmarks without a timestamp (legacy/corrupted data) are treated as
      // newly bookmarked (addedAt = now) so they surface immediately rather
      // than being silently dropped with a zero score. A user will revisit it,
      // building real history, or it stays visible.
      const addedAt = bm.addedAt || now;
      byUrl.set(bm.url, {
        url:   bm.url,
        title: bm.title || bm.url,
        score: frecencyScore({ visitedAt: addedAt, visits: 1 }, now)
      });
    }

    return [...byUrl.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(0, limit));
  }
}
