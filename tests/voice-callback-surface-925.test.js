/**
 * VoiceCommands callback-channel boundary audit.
 *
 * The `callbacks` object is the module's event surface: every channel it
 * declares is emitted from setupRecognitionHandlers / speak / dispatch, and
 * every live channel is registered by a real consumer (VRApp wires
 * onTranscript/onSpeak/onCommand/onCommandFailed/onError; tests wire onSpeak).
 * A channel that is declared and emitted but never registered is write-only
 * surface — the module advertises an event nothing can hear.
 *
 * Invariant: every key declared in `this.callbacks = { ... }` has at least
 * one assignment site `callbacks.<key> =` outside VoiceCommands.js itself.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VC = path.join(ROOT, 'src/vr/input/VoiceCommands.js');

function collectJsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
        continue;
      }
      out.push(...collectJsFiles(full));
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
      out.push(full);
    }
  }
  return out;
}

function codeLines(file) {
  // Strip comment-only lines so a docstring naming the channel is not counted
  // as a registrant (the module's own JSDoc shows `callbacks.onCommand = ...`).
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => {
      const t = l.trim();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*');
    })
    .join('\n');
}

describe('VoiceCommands callback channels', () => {
  const src = fs.readFileSync(VC, 'utf8');
  // Capture up to the line-initial closing brace — inline comments like
  // `// ({reason, transcript})` contain `}` and would truncate a `[^}]*` scan.
  // Then drop `//` comment tails so commented keys don't register as fields.
  const block = src
    .match(/this\.callbacks\s*=\s*\{([\s\S]*?)\n\s*\}/)[1]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n');
  const declared = [...block.matchAll(/(\w+)\s*:/g)].map((m) => m[1]);

  const corpus = collectJsFiles(ROOT)
    .filter((f) => f !== VC)
    .map(codeLines)
    .join('\n');

  test('declared channel list is non-empty', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  test('every declared channel has at least one registrant', () => {
    const unwired = declared.filter((name) => !new RegExp(`callbacks\\.${name}\\s*=`).test(corpus));
    expect(unwired).toEqual([]);
  });
});
