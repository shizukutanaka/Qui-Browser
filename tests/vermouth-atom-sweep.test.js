const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  // recital prep done (発表会準備の終了側)
  'costume fitted', 'costume picked up',
  'tickets reserved', 'last rehearsal done',
  'flowers ordered', 'video booked',
  'program printed', 'recital prep done',
];
const closeTabJa = [
  '衣装を受け取って', '衣装合わせが終わって',
  'チケットを取って', 'リハーサルが終わって',
  '通しリハが終わって', '最後の練習が終わって',
  '花束を注文して', 'ビデオを予約して',
  'パンフレットを印刷して', '発表会準備が終わって',
];
const nullPins = [
  'mid prep', 'recital prep', 'dance costume',
  'これからリハする', '準備中',
  '発表会準備', 'ダンス衣装',
];
const establishedPins = [
  ['about to rehearse', null],
  ['rehearsal done', 'close-tab'],
  ['dress rehearsal done', 'close-tab'],
  ['photos taken', 'close-tab'],
  ['写真を撮って', 'screenshot'],
  ['still rehearsing', 'negate'],
  ['まだ練習中', 'negate'],
  ['まだリハ中', 'negate'],
];

describe('pass CDXLI: recital prep idioms (vermouth)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
