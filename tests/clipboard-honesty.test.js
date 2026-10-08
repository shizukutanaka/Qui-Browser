/**
 * Invariant: a copy command's announce must match the clipboard outcome.
 * The clipboard write is async — a hook that reports only the *content*
 * cannot know whether `navigator.clipboard.writeText` actually ran. Hooks
 * may therefore return a Promise: resolved content announces success,
 * resolved null announces "nothing to copy", and a REJECTION announces
 * 'コピーできませんでした'. A fire-and-forget hook (sync return) keeps the
 * synchronous announce for backward compatibility — but a Promise that
 * rejects must never be read as success just because it is truthy.
 *
 * Pre-fix every rejection pin below hears 'コピーしました' while nothing
 * reached the clipboard — a lying announce (WCAG 4.1.3 Status Messages).
 */

const fs = require('fs');
const path = require('path');
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

global.SpeechSynthesisUtterance = class {
  constructor(text) {
    this.text = text;
  }
};

function makeVC(opts) {
  const vc = new VoiceCommands();
  const spoken = [];
  vc.callbacks.onSpeak = (t) => spoken.push(t);
  vc.connectBrowser(opts);
  return [vc, spoken];
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('voice announce honesty — clipboard writes', () => {
  test('copy-url announces the copy when the write resolves with a URL', async () => {
    const [vc, spoken] = makeVC({ onCopyUrl: () => Promise.resolve('https://a.jp') });
    vc.processCommand('URLをコピー', 0.9);
    await flush();
    expect(spoken).toContain('URLをコピーしました');
  });

  test('copy-url announces the gap when the hook resolves null', async () => {
    const [vc, spoken] = makeVC({ onCopyUrl: () => Promise.resolve(null) });
    vc.processCommand('URLをコピー', 0.9);
    await flush();
    expect(spoken).toContain('コピーするURLがありません');
    expect(spoken).not.toContain('URLをコピーしました');
  });

  test('copy-url announces the failure when the write rejects', async () => {
    const [vc, spoken] = makeVC({ onCopyUrl: () => Promise.reject(new Error('denied')) });
    vc.processCommand('URLをコピー', 0.9);
    await flush();
    expect(spoken).toContain('コピーできませんでした');
    expect(spoken).not.toContain('URLをコピーしました');
  });

  test('copy-url keeps the synchronous announce for a sync hook', () => {
    const [vc, spoken] = makeVC({ onCopyUrl: () => 'https://a.jp' });
    vc.processCommand('URLをコピー', 0.9);
    expect(spoken).toContain('URLをコピーしました');
  });

  test('copy-title announces the failure when the write rejects', async () => {
    const [vc, spoken] = makeVC({ onCopyTitle: () => Promise.reject(new Error('denied')) });
    vc.processCommand('タイトルをコピー', 0.9);
    await flush();
    expect(spoken).toContain('コピーできませんでした');
    expect(spoken).not.toContain('タイトルをコピーしました');
  });

  test('copy-title announces the copy when the write resolves', async () => {
    const [vc, spoken] = makeVC({ onCopyTitle: () => Promise.resolve('Page') });
    vc.processCommand('タイトルをコピー', 0.9);
    await flush();
    expect(spoken).toContain('タイトルをコピーしました');
  });

  test('copy-line announces the failure when the write rejects', async () => {
    const [vc, spoken] = makeVC({ onCopyLine: () => Promise.reject(new Error('denied')) });
    vc.processCommand('この行をコピー', 0.9);
    await flush();
    expect(spoken).toContain('コピーできませんでした');
    expect(spoken).not.toContain('行をコピーしました');
  });

  test('copy-article announces the failure when the write rejects', async () => {
    const [vc, spoken] = makeVC({ onCopyArticle: () => Promise.reject(new Error('denied')) });
    vc.processCommand('記事をコピー', 0.9);
    await flush();
    expect(spoken).toContain('コピーできませんでした');
    expect(spoken.join('')).not.toContain('記事をコピーしました');
  });

  test('copy-article announces the count when the write resolves', async () => {
    const [vc, spoken] = makeVC({ onCopyArticle: () => Promise.resolve(1234) });
    vc.processCommand('記事をコピー', 0.9);
    await flush();
    expect(spoken.join('')).toContain('記事をコピーしました（1234文字）');
  });
});

describe('clipboard honesty — VRApp host hooks', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'vr', 'VRApp.js'), 'utf8');

  // Extract a hook body: from "onCopyX:" to the closing "}," at hook level.
  function hookBody(name) {
    const start = src.indexOf(`onCopy${name}:`);
    expect(start).toBeGreaterThan(-1);
    return src.slice(start, src.indexOf('},', start) + 1);
  }

  test.each(['Url', 'Title', 'Line', 'Article'])('onCopy%s is async and awaits the clipboard write', (name) => {
    const body = hookBody(name);
    expect(body).toMatch(/:\s*async/);
    expect(body).toContain('await navigator.clipboard.writeText');
  });
});
