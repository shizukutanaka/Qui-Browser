/**
 * Dead-store audit (round 905): constructor fields that were assigned but
 * never read — the same class as round 841 (southpaw / _settingsSections),
 * unblocked by the #1127 merge.
 *
 *  - VoiceCommands.fallbackLanguage: stored 'en-US' next to the live
 *    `language` field, then never consulted anywhere — a reader would
 *    reasonably assume the recognizer falls back to English on misses, but
 *    no such code path exists.
 *  - VRJapaneseKeyboard.candidatePanel: set to null in the constructor and
 *    again in dispose, read nowhere — leftover from a panel object that was
 *    replaced by the `_candidatesGroup`/`_candidateMeshes` strip.
 *
 * The pins assert the fields are absent (not just unused): a field that is
 * written but never read is indistinguishable from live state, and removing
 * it is behaviour-preserving.
 */

import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const VC_SRC = fs.readFileSync(path.join(ROOT, 'src', 'vr', 'input', 'VoiceCommands.js'), 'utf8');
const IME_SRC = fs.readFileSync(path.join(ROOT, 'src', 'vr', 'input', 'JapaneseIME.js'), 'utf8');

describe('VoiceCommands language surface', () => {
  test('exposes the live language field only — no unread fallbackLanguage', () => {
    const vc = new VoiceCommands();
    expect(vc.language).toBe('ja-JP');
    expect('fallbackLanguage' in vc).toBe(false);
  });

  test('source has no fallbackLanguage assignment left', () => {
    expect(VC_SRC).not.toMatch(/this\.fallbackLanguage\s*=/);
  });
});

describe('VRJapaneseKeyboard candidate surface', () => {
  test('source has no candidatePanel field left (live strip is _candidatesGroup)', () => {
    expect(IME_SRC).not.toMatch(/this\.candidatePanel\b/);
    // The live candidate machinery must remain.
    expect(IME_SRC).toMatch(/this\._candidatesGroup/);
    expect(IME_SRC).toMatch(/this\._candidateMeshes/);
  });
});
