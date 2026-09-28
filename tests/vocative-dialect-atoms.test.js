// Pass CXC — vocatives, British/Commonwealth request idioms, eye-dialect 'er/'em,
// JA dialect residue (もうて/しもて/おくり/てんか/なはれ/といてちょ/ときなよ/たろか/させます),
// dict noun-tail XXIX (見込み/思惑/目論見/腹積もり/心づもり/筋書き/目算/意中/胸中/肚/腹/おぼしめし),
// vague-disposal → ack, てよかった → ack, ばっかりだ → trouble.
import { describe, it, expect } from '@jest/globals';
import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

const mk = () => {
  const vc = new VoiceCommands({ enabled: true });
  const tm = { activeTabId:'t1', tabs:[{id:'t1',title:'X',url:'https://x'},{id:'t2',title:'Y',url:'https://y'},{id:'t3',title:'Z',url:'https://z'}],
    getActiveTab(){return this.tabs[0];}, closeAllTabs(){return 1;}, closeTab(){}, pinTab(){}, closeOtherTabs(){} };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  return vc;
};
const route = (p) => { const vc = mk(); vc.processCommand(p, 0.9); return vc.lastCommand ? vc.lastCommand.key : null; };

const CASES = [
  // EN vocative tails
  ['close it man', 'close-tab'], ['close it pal', 'close-tab'], ['close it champ', 'close-tab'],
  ['close it love', 'close-tab'], ['close it darling', 'close-tab'], ['close it honey', 'close-tab'],
  ['close it guys', 'close-tab'], ['close it yall', 'close-tab'], ["close it y'all", 'close-tab'],
  ['close it bro', 'close-tab'], ['close it dude', 'close-tab'], ['close it mate', 'close-tab'],
  // EN vocative prefixes
  ['hey browser close it', 'close-tab'], ['ok browser close it', 'close-tab'],
  ['bruh close it', 'close-tab'], ['dude close it', 'close-tab'],
  // British/Commonwealth request frames
  ['be a champ and close it', 'close-tab'], ['be a good chap and close it', 'close-tab'],
  ['be ever so good and close it', 'close-tab'], ['be an angel and close it', 'close-tab'],
  ['do us a favour and close it', 'close-tab'], ['do me a favour and close it', 'close-tab'],
  ['do yourself a favour and close it', 'close-tab'], ['do yourselves a favour and close it', 'close-tab'],
  ['would you mind awfully and close it', 'close-tab'], ['mind awfully and close it', 'close-tab'],
  // 'there's a (good) X' tails
  ['close it theres a good chap', 'close-tab'], ['close it theres a love', 'close-tab'],
  ['close it theres a dear', 'close-tab'], ['close it theres a good lad', 'close-tab'],
  ['close it theres a good girl', 'close-tab'],
  // eye-dialect er/'em
  ['shut er down', 'vr-exit'], ['shut it down', 'vr-exit'],
  ['close er up', 'close-tab'], ['wrap er up', 'stop-everything'],
  ['close em up', 'close-all-tabs'], ['close em all', 'close-all-tabs'], ['close em down', 'close-all-tabs'],
  // disposal phrasals
  ['off with it', 'close-tab'], ['away with it', 'close-tab'], ['down with it', 'close-tab'],
  ['off with this', 'close-tab'], ['close it up', 'close-tab'], ['close it down', 'close-tab'],
  // vague-disposal → ack (honest no-op)
  ['sort it out', 'ack'], ['sort that out', 'ack'], ['take care of it', 'ack'],
  ['deal with it', 'ack'], ['handle it', 'ack'], ['leave it with me', 'ack'],
  // JA dialect / volitional residue
  ['閉じてもうて', 'close-tab'], ['閉じてしもて', 'close-tab'], ['閉じておくり', 'close-tab'],
  ['閉じててんか', 'close-tab'], ['閉じてなはれ', 'close-tab'], ['閉じといてちょ', 'close-tab'],
  ['閉じときなよ', 'close-tab'], ['閉じたろか', 'close-tab'], ['閉じたろうか', 'close-tab'],
  ['閉じさせます', 'close-tab'],
  // JA reports & complaints
  ['閉じてよかった', 'ack'], ['閉じてよかったよ', 'ack'],
  ['閉じてばっかりだ', 'trouble'], ['閉じてばっかり', 'trouble'],
  ['閉じたるわ', 'describe-tab'], ['閉じたります', 'describe-tab'], ['閉じたって', 'describe-tab'],
  // dict noun-tail XXIX
  ['閉じるのが見込みです', 'close-tab'], ['閉じるのが思惑です', 'close-tab'],
  ['閉じるのが目論見です', 'close-tab'], ['閉じるのが腹積もりです', 'close-tab'],
  ['閉じるのが心づもりです', 'close-tab'], ['閉じるのが筋書きです', 'close-tab'],
  ['閉じるのが目算です', 'close-tab'], ['閉じるのが意中です', 'close-tab'],
  ['閉じるのが胸中です', 'close-tab'], ['閉じるのが肚です', 'close-tab'],
  ['閉じるのが腹です', 'close-tab'], ['閉じるのがおぼしめしです', 'close-tab'],
];
describe('vocative/dialect atoms CXC', () => {
  it.each(CASES)('%s → %s', (phrase, expected) => {
    expect(route(phrase)).toBe(expected);
  });
});
