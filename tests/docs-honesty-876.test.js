/**
 * Round 876 — live docs must not prescribe phantom surface.
 *
 * docs/COMPATIBILITY.md prescribes `VRSettings.set(...)`, `VRInput.setPreferredMode(...)`,
 * a `your-org` placeholder issues URL, a fake `example.com` support email, a version
 * stamp (3.3.0) that doesn't match package.json (2.0.x), and feature-matrix rows for
 * features that don't exist (passthrough AR, WebGPU, "12 gestures").
 * docs/USAGE_GUIDE.md claims the Web Browser Panel is "off by default" and requires a
 * page reload — `enableWebPanel` defaults to true and applies live (Session 74).
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const COMPAT = fs.readFileSync(path.join(DOCS_DIR, 'COMPATIBILITY.md'), 'utf8');
const USAGE = fs.readFileSync(path.join(DOCS_DIR, 'USAGE_GUIDE.md'), 'utf8');
const VRAPP = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');
const PKG = require('../package.json');

function* srcFiles(dir = path.join(__dirname, '..', 'src')) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* srcFiles(p);
    } else if (e.name.endsWith('.js')) {
      yield p;
    }
  }
}
const ALL_SRC = [...srcFiles()].map((f) => fs.readFileSync(f, 'utf8')).join('\n');

// Identifier used as a call target inside a fenced code block of a doc.
function docApiRoots(md) {
  const roots = new Set();
  for (const m of md.matchAll(/```[\s\S]*?```/g)) {
    for (const line of m[0].split('\n')) {
      for (const mm of line.matchAll(/\b([A-Z][A-Za-z0-9_]*)\s*\.\s*[a-zA-Z_$][\w$]*\s*\(/g)) {
        roots.add(mm[1]);
      }
    }
  }
  return [...roots];
}

describe('docs/COMPATIBILITY.md + docs/USAGE_GUIDE.md honesty', () => {
  test('live docs contain no placeholder hosts for this project', () => {
    for (const [name, body] of [
      ['COMPATIBILITY.md', COMPAT],
      ['USAGE_GUIDE.md', USAGE]
    ]) {
      // `example.com` inside a fetch/URL sample is legitimate; banned patterns
      // are placeholders for the project itself.
      expect({ doc: name, hit: /your-org\/|@[a-z0-9.-]*example\.com/i.test(body) }).toEqual({
        doc: name,
        hit: false
      });
    }
  });

  test('APIs prescribed in doc code blocks exist in src', () => {
    for (const root of docApiRoots(COMPAT)) {
      const defRe = new RegExp(`(class|const|let|var|function|export)\\s+${root}\\b|\\b${root}\\s*[:=]`);
      expect(defRe.test(ALL_SRC)).toBe(true);
    }
  });

  test('doc version stamps match package.json version', () => {
    const major = PKG.version.split('.').slice(0, 2).join('.');
    for (const [name, body] of [
      ['COMPATIBILITY.md', COMPAT],
      ['USAGE_GUIDE.md', USAGE]
    ]) {
      for (const m of body.matchAll(/Version:\*?\*?\s*([0-9]+\.[0-9]+)/gi)) {
        expect({ doc: name, version: m[1] }).toEqual({ doc: name, version: major });
      }
    }
  });

  test('docs do not contradict the enableWebPanel live default', () => {
    const def = VRAPP.match(/enableWebPanel:\s*(true|false)/)[1];
    expect(def).toBe('true');
    expect(USAGE).not.toMatch(/off by default/i);
    expect(USAGE).not.toMatch(/reload is required|requires? a (page )?reload/i);
  });
});
