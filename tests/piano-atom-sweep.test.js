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
  // after-school & temporary childcare procedures done
  'daycare enrollment done',
  'after-school club joined',
];
const closeTabJa = [
  '放課後児童クラブ', '放課後クラブ',
  '留守家庭児童', '一時保育',
  '一時預かり', 'リフレッシュ保育',
  '病児保育', '病後児保育',
  '休日保育', '夜間保育',
  '預かり保育', 'ファミサポ',
  '提供会員', '依頼会員',
  '援助会員', '開所時間',
  '利用定員', '指導員',
  '入会金', '保育料',
];
const negate = [
  'still on waitlist',
  'まだ入会前', 'まだ待機中',
];
const nullPins = [
  'about to pick up',
];
const establishedPins = [
  ['学童保育', 'close-tab'],
  ['延長保育', 'close-tab'],
  ['支援員', 'close-tab'],
  ['これから見学', 'negate'],
];

describe('pass DXLV: after-school & temporary childcare idioms (piano)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
