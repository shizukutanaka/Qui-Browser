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
  // safety map posted & scam watchlist updated
  'safety map posted', 'scam watchlist updated',
];
const closeTabJa = [
  '青色防犯パトロール', '防犯診断',
  '防犯設備士', '防犯ガラス',
  '補助錠', '安全まちづくり',
  '地域安全マップ', '犯罪発生状況',
  '防犯情報メール', '安否確認',
  'スクールガード', '安全パス',
  '防犯ベル', '防犯ブザー',
  '自主防犯ボランティア', 'かけつけ隊',
  'ママパトロール', '防犯ポスター',
  '侵入盗',
];
const negate = [
  'still awaiting the patrol sign-up',
  'まだ巡視前', 'これからパトロール',
  'まだ見守り前',
];
const nullPins = [
  'about to post the safety map', 'about to join the watch patrol',
];
const establishedPins = [
  ['防犯協会', 'close-tab'], ['防犯灯', 'close-tab'],
  ['青色回転灯', 'close-tab'], ['防犯カメラ', 'close-tab'],
  ['空き巣', 'close-tab'], ['特殊詐欺', 'close-tab'],
  ['オレオレ詐欺', 'close-tab'], ['還付金詐欺', 'close-tab'],
  ['登下校見守り', 'close-tab'],
];

describe('pass DCXVI: crime-prevention & school-guard idioms (dulian)', () => {
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
  test.each(establishedPins)('pinned "%s" stays "%s"', (p, k) => {
    expect(key(vc, p)).toBe(k);
  });
});
