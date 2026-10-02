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
  // vacant-house bank & relocation procedures done
  'moved to the countryside', 'relocation grant received',
  'trial housing entered', 'empty house registered',
  'town tour done',
];
const closeTabJa = [
  '空き家バンク', '移住支援金',
  '移住相談', 'お試し住宅',
  '空き家登録', 'uiターン',
  '地方移住', '田舎暮らし',
  'ふるさと回帰', '移住体験',
  '定住促進', '移住フェア',
  '空き家改修', '田舎物件',
  '限界集落', '二拠点生活',
  'デュアルライフ', '関係人口',
  'ワーケーション', '移住計画',
];
const negate = [
  'about to register the property',
  'これから移住',
];
const nullPins = [
  'mid relocation',
];
const establishedPins = [
  ['still house hunting', 'negate'],
  ['まだ物件探し中', 'negate'],
];

describe('pass DXXIV: vacant-house bank & relocation idioms (mokkin)', () => {
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
