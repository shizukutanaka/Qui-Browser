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
  // parents-of-bride/groom side done (結婚式の親側準備・後始末)
  'kimono rented', 'speech rehearsed',
  'parents speech done', 'congrats money wrapped',
  'guests met', 'both families met',
  'sankon done', 'tears dried',
  'second party seen off',
];
const closeTabJa = [
  '留袖を借りて', 'スピーチを練習して',
  '両家の挨拶をして', 'ご祝儀を包んで',
  '親戚に連絡して', '顔合わせが終わって',
  '三三九度が終わって', '涙を拭いて',
  '二次会を見送って',
];
const negate = [
  'still preparing the speech',
  'まだスピーチ準備中', 'これから練習する',
];
const nullPins = [
  'mid wedding prep', 'parents side', 'guest list',
  '準備中', '親側の準備', '招待者リスト',
];
const establishedPins = [
  ['写真を撮り終えて', 'close-tab'],
];

describe('pass CDXLV: parents-side wedding idioms (zunda)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
