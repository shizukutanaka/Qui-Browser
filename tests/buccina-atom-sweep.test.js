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
  // sports grant approved & stadium permit granted
  'sports grant approved', 'stadium permit granted',
];
const closeTabJa = [
  'スポーツ基本法', 'スポーツ庁',
  '日本スポーツ協会', 'スポーツ振興',
  '体育施設', '運動部活動',
  '部活動指導員', '地域移行',
  'プロスポーツ', 'スポーツ審議会',
  '国民体育大会', 'スポーツ祭',
  'オリンピック', 'パラリンピック',
  'フェアプレー', 'ドーピング検査',
  'スポーツ安全保険', 'スポーツ医学',
  'スポーツ施設整備', '体育の日',
  'スポーツ週間', '体育教員',
  '学校体育指導', '地域スポーツクラブ',
  '総合型地域スポーツクラブ', 'スポーツ指導員',
  'スポーツ指導者', 'ジュニアスポーツクラブ',
  'スポーツ少年団', '体育協会',
  '競技団体', 'スポーツ推進委員',
  'スポーツリーダー', 'スポーツマスタープラン',
];
const negate = [
  'still awaiting the sports charter',
  'まだ大会前', 'これから部活登録',
  'これから競技登録',
];
const nullPins = [
  'about to file the facility application',
  'about to join the sports club',
];

describe('pass DCL: sports & physical-education administration idioms (buccina)', () => {
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
});
