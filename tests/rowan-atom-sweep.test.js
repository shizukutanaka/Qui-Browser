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
  // connectivity
  'fiber installed', 'modem set up',
  'internet live', 'router configured',
  'utilities transferred', 'power turned on',
  'gas connected', 'phone line active',
  // phone & plan
  'new phone set up', 'phone activated',
  'sim swapped', 'plan changed',
  'data transferred', 'contacts imported',
  // devices
  'os installed', 'updates done',
  'backup done', 'smart home paired',
  'tv mounted',
];
const closeTabJa = [
  '回線開通', '光回線終了',
  'モデムを置いて', 'ルーターを設定して',
  'ネットがついて', '水道を使えるようにして',
  '新しいスマホを設定して', '機種変更終了',
  'simを差し替えて', 'プランを変えて',
  'データを移して', '連絡先を移して',
  'パソコンをセットアップして', 'osを入れて',
  'アップデート終了', 'バックアップを取って',
  'スマートホームをつなげて', 'テレビを壁掛けして',
];
const negate = [
  'still setting up', 'still without internet',
  'まだ設定中', 'まだネットなし',
];
const nullPins = [
  'about to set up', 'mid install',
  'user manual', 'setup guide', 'router password',
  '設定の途中', 'これから設定',
  '取扱説明書', '設定ガイド',
];
const establishedPins = [
  ['water running', 'close-tab'], ['laptop set up', 'close-tab'],
  ['ガスを開栓して', 'go-to'], ['電話を開通させて', 'go-to'],
  ['電気を開通させて', 'go-to'],
  ['install tomorrow', 'date'], ['明日開通工事', 'defer'],
];

describe('pass CCCLXXXII: connectivity & device setup done idioms (rowan)', () => {
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
