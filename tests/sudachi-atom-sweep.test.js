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
  // traffic-violation wrap-up done
  'ticket paid', 'fine paid',
  'appeal filed', 'court date done',
  'points cleared', 'traffic school done',
  'ticket dismissed', 'license reinstated',
];
const closeTabJa = [
  '罰金を払って', '反則金を納めて',
  '違反切符を処理して', '異議申し立てをして',
  '出頭して', '点数が戻って',
  '講習を受けて', '放置違反金を払って',
  '免停が明けて', '保険を更新して',
];
const negate = [
  'still fighting the ticket', 'still pending',
  'まだ違反処理中', 'まだ裁判待ち',
];
const nullPins = [
  'about to pay the ticket', 'mid appeal',
  'parking ticket', 'speed camera',
  'これから払う', '審理中',
  '駐車違反', 'スピード違反',
];
const establishedPins = [
  ['parking ticket paid', 'close-tab'],
  ['insurance updated', 'close-tab'],
];

describe('pass CDXXXV: traffic-violation wrap-up idioms (sudachi)', () => {
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
