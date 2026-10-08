/**
 * Round 980 pins — the session-save announce channel must not claim a write
 * that storage refused.
 *
 * `saveTabSession` already returns false when the write throws
 * (quota-exceeded, blocked storage, private-browsing no-store mode), but the
 * `onSessionSave` handler in VRApp discarded that boolean and returned
 * `snapshot.tabs.length` unconditionally — so the voice 'save-session'
 * command announced "N個のタブを保存しました" for a snapshot that was never
 * persisted. The user believes their tabs will restore next boot; they will
 * not. Same defect class as the bookmark persist announcements.
 *
 * Behavioral pins stub localStorage.setItem to throw (simulating quota /
 * blocked storage) so the failure is exercised end-to-end. Structural pins
 * keep the handler's return value conditioned on the write result.
 */
const fs = require('fs');
const path = require('path');

const VRAPP_SRC = path.join(__dirname, '..', 'src', 'vr', 'VRApp.js');

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

/** Extract the body of a `name: (...) => { ... }` arrow property. */
function arrowBody(src, name) {
  const idx = src.indexOf(name + ':');
  expect(idx).toBeGreaterThanOrEqual(0);
  const arrow = src.indexOf('=>', idx);
  expect(arrow).toBeGreaterThan(idx);
  const brace = src.indexOf('{', arrow);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') {
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(brace + 1, i);
      }
    }
  }
  throw new Error('unbalanced braces in ' + name);
}

/**
 * Stub localStorage.setItem to throw — quota-exceeded / blocked-storage
 * simulation. Returns a restore function.
 */
function breakStorage() {
  const original = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  return () => {
    localStorage.setItem = original;
  };
}

const { saveTabSession, loadTabSession } = require('../src/vr/browser/tabSession.js');

describe('onSessionSave must report the write result, not the tab count', () => {
  test('broken storage: saveTabSession reports failure instead of persisting', () => {
    const restore = breakStorage();
    try {
      expect(saveTabSession({ tabs: ['https://a.example'], active: 0 })).toBe(false);
    } finally {
      restore();
    }
    // And nothing was actually written — a later restore finds nothing.
    expect(loadTabSession()).toBeNull();
  });

  test('onSessionSave returns the count only when the write persisted', () => {
    const body = arrowBody(read(VRAPP_SRC), 'onSessionSave');
    // The dishonest shape: write as a bare statement, then return the count
    // unconditionally.
    expect(body).not.toMatch(/saveTabSession\([^)]*\)\s*;\s*return\s+snapshot\.tabs\.length/);
    // The honest shape: the write result gates the returned count.
    expect(body).toMatch(/return\s+saveTabSession\([^)]*\)\s*\?\s*snapshot\.tabs\.length\s*:/);
  });

  test('onSessionSave still short-circuits on an empty snapshot', () => {
    const body = arrowBody(read(VRAPP_SRC), 'onSessionSave');
    expect(body).toMatch(/if\s*\(!snapshot\s*\|\|\s*!snapshot\.tabs\.length\)\s*\{?\s*return\s+0/);
  });

  test('onSessionClear already propagates the write result honestly', () => {
    // Regression pin: clear-session returns saveTabSession(null) — keep it.
    const body = arrowBody(read(VRAPP_SRC), 'onSessionClear');
    expect(body).toMatch(/return\s+saveTabSession\(null\)/);
  });

  test('working storage: a real write round-trips so the announce is truthful', () => {
    expect(saveTabSession({ tabs: ['https://a.example', 'https://b.example'], active: 0 })).toBe(true);
    expect(loadTabSession()).toEqual({
      tabs: ['https://a.example', 'https://b.example'],
      active: 0
    });
  });
});

describe('the voice announce distinguishes saved from failed', () => {
  test("'save-session' announces failure only when the handler reports 0/falsy", () => {
    const src = read(path.join(__dirname, '..', 'src', 'vr', 'input', 'VoiceCommands.js'));
    // Find the save-session command's action body.
    const idx = src.indexOf("registerCommand('save-session'");
    expect(idx).toBeGreaterThanOrEqual(0);
    const actionStart = src.indexOf('action:', idx);
    const speakIdx = src.indexOf('this.speak(', actionStart);
    const speakCall = src.slice(speakIdx, src.indexOf(');', speakIdx) + 2);
    // The saved announce must be gated on n > 0 — the falsy branch is the
    // honest '保存できません' path a failed write now reaches.
    expect(speakCall).toMatch(/n\s*>\s*0/);
    expect(speakCall).toMatch(/保存できません/);
  });
});
