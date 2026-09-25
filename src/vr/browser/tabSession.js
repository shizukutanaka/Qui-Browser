/**
 * Tab session snapshot — persists open tab URLs plus the active index so a
 * restarted VR session can resume the browser where the user left off.
 *
 * Grounding: Wolvic 1.9 (2026) shipped "remember browser state" after users
 * kept losing open tabs across app upgrades; Firefox and Chrome desktop both
 * default to restoring the previous session. The same failure is more
 * expensive in VR — reopening a page costs a full dwell-chain, so losing the
 * tab set on restart hits hands-free users hardest.
 *
 * Privacy: panels flagged `isPrivate` are excluded here AND from history
 * writes, so a private session's destinations never reach persistent
 * storage — matching Quest Browser's private window, which drops all session
 * data on exit.
 *
 * Pure / dependency-free. Storage access is guarded for environments without
 * localStorage (tests, SSR) and quota errors report `false`, never throw.
 */

export const TAB_SESSION_KEY = 'qui-browser:tabSession';
export const MAX_RESTORE_TABS = 8;

function isRestorableUrl(u) {
  return typeof u === 'string' && (/^https?:\/\//i).test(u.trim());
}

/**
 * Build a snapshot record from live panels.
 *
 * @param {Array<{url:string, isPrivate:boolean}>} panels  panels in strip order
 * @param {number} activeIdx  index into `panels` of the active tab
 * @returns {{v:number, tabs:string[], active:number}|null}
 *   null when nothing restorable remains (all private / empty / non-http).
 */
export function serializeTabSession(panels, activeIdx = -1) {
  const urls = [];
  const keptIdx = [];
  (panels || []).forEach((p, i) => {
    if (p && !p.isPrivate && isRestorableUrl(p.url)) {
      urls.push(p.url);
      keptIdx.push(i);
    }
  });
  if (urls.length === 0) {
    return null;
  }
  let active = keptIdx.indexOf(activeIdx);
  if (active < 0) {
    // The active panel was dropped (private or unrestorable) — keep the
    // nearest surviving tab at-or-before its old position, else the first.
    active = 0;
    for (let k = 0; k < keptIdx.length; k++) {
      if (keptIdx[k] <= activeIdx) {
        active = k;
      } else {
        break;
      }
    }
  }
  const tabs = urls.slice(0, MAX_RESTORE_TABS);
  return { v: 1, tabs, active: Math.min(active, tabs.length - 1) };
}

/**
 * Validate an arbitrary parsed value into a snapshot, or null.
 * Storage is user-writable, so every field is re-checked: only http(s) URLs
 * survive (a `javascript:` entry must never reach `navigate`), the tab list
 * is capped, and the active index is clamped into range.
 */
export function validateTabSession(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.tabs)) {
    return null;
  }
  const tabs = raw.tabs.filter(isRestorableUrl).slice(0, MAX_RESTORE_TABS);
  if (tabs.length === 0) {
    return null;
  }
  const active = Number.isInteger(raw.active)
    ? Math.min(Math.max(raw.active, 0), tabs.length - 1)
    : 0;
  return { tabs, active };
}

export function loadTabSession() {
  try {
    const raw = typeof localStorage !== 'undefined'
      ? localStorage.getItem(TAB_SESSION_KEY)
      : null;
    return raw ? validateTabSession(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveTabSession(snapshot) {
  try {
    if (typeof localStorage === 'undefined') {
      return false;
    }
    if (!snapshot) {
      localStorage.removeItem(TAB_SESSION_KEY);
    } else {
      localStorage.setItem(TAB_SESSION_KEY, JSON.stringify(snapshot));
    }
    return true;
  } catch {
    return false;
  }
}
