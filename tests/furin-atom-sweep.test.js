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
  // mynumber-card renewal procedures done
  'mynumber card renewed', 'pin reset done',
  'card reissued', 'card collected',
];
const closeTabJa = [
  'マイナンバーカード更新', '暗証番号再設定',
  '署名用電子証明書', '券面更新',
  '受取完了', '顔写真更新',
  '通知カード', '仮カード',
  '引替証', '個人番号カード',
  '有効期限切れ', '再発行手数料',
  '交付受領',
];
const negate = [
  'still waiting for pickup', 'about to renew the card',
  'まだ受取待ち', 'これからカード更新',
];
const nullPins = [
  'mid renewal',
];
const establishedPins = [
  ['e-certificate renewed', 'security-status'],
];

describe('pass DXIX: mynumber-card renewal idioms (furin)', () => {
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
