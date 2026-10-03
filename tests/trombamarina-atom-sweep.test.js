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
  // rate hike announced & reserve requirement set
  'rate hike announced', 'reserve requirement set',
];
const closeTabJa = [
  '日本銀行', '日銀',
  '金融政策', '量的緩和',
  '政策金利', '公定歩合',
  '利上げ', '利下げ',
  'マイナス金利', 'イールドカーブ',
  '信用金庫', '信用組合',
  '労働金庫', '地方銀行',
  '都市銀行', 'ネット銀行',
  '信用保証協会', '日本政策金融公庫',
  '商工中金', '住宅金融支援機構',
  '日本銀行券', '資金供給',
  '国債買入', '当座預金',
  '買付オペ', '手形交換所',
  '資金決済', '決済代行',
  '振込', '送金',
  '為替', '外国為替',
  '外貨預金', '普通預金',
  '定期預金', '口座名義',
];
const negate = [
  'still awaiting the rate decision',
  'まだ決定前', 'これから利上げ',
  'まだ開設前',
];
const nullPins = [
  'about to file the reserve report',
  'about to join the clearing house',
];
const establishedPins = [
  // already pinned — kept green
  ['これから口座開設', 'negate'],
];

describe('pass DCLIV: central-bank & monetary-policy idioms (trombamarina)', () => {
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
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
