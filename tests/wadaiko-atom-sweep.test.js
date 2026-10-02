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
  // post-divorce koseki & surname-change procedures done (離婚後の戸籍・氏名変更の終了側)
  'name changed', 'surname restored',
  'koseki amended', 'id reissued',
  'bank name updated', 'documents renamed',
  'new koseki issued', 'maiden name back',
];
const closeTabJa = [
  '戸籍', '氏名変更',
  '復氏', '旧姓',
  '戸籍抄本', '戸籍謄本',
  '本籍変更', '印鑑登録',
  '名義変更',
];
const negate = [
  'still updating', 'about to update',
  'まだ変更中', 'これから変更',
];
const nullPins = [
  'mid paperwork',
];
const establishedPins = [
  ['family register updated', 'close-tab'],
  ['除籍', 'close-tab'],
];

describe('pass CDXC: koseki & surname-change idioms (wadaiko)', () => {
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
