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
  // report card issued & diploma awarded
  'report card issued', 'diploma awarded',
];
const closeTabJa = [
  '教育基本法', '学校教育法',
  '義務教育', '小学校',
  '中学校', '高等学校',
  '中高一貫', '特別支援学校',
  '学習指導要領', '教育課程',
  '年間指導計画', '校長',
  '教頭', '講師',
  '特別支援教育', '通級指導',
  '修学旅行', '林間学校',
  '学級編制', '学級担任',
  '学力テスト', '全国学力学習状況調査',
  '進路指導', '生徒指導',
  'いじめ防止対策推進法', '不登校',
  '欠席届', '休学',
  '復学', '編入学',
  '転入学', '転学届',
  '担任持ち上がり', '定期考査',
  '中間考査', '期末考査',
  '学習参観', '授業参観',
  '保護者懇談', '運動会',
  '入学式', '卒業式',
  '始業式', '時間割',
  '教科担任', '生徒会',
  '児童会', '給食当番',
  '日直',
];
const negate = [
  'still awaiting the enrollment notice',
  'これから入学', 'まだ登校前',
  'これから編入',
];
const nullPins = [
  'about to enroll the child',
  'about to file the absence notice',
];
const establishedPins = [
  ['まだ入学前', 'negate'],
  ['graduation certificate awarded', 'security-status'],
];

describe('pass DCLIX: compulsory-education & school administration idioms (viola)', () => {
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
