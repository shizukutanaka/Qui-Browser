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
  // archive cataloged & disclosure granted
  'archive cataloged', 'disclosure granted',
];
const closeTabJa = [
  '公文書管理法', '公文書館',
  '国立公文書館', '行政文書',
  '保存期間', '文書保存',
  '文書廃棄', '文書管理規程',
  '記録管理', '電子記録',
  '行政文書管理', '歴史公文書',
  '公文書公開', '文書請求',
  '閲覧請求', '実施機関',
  '特定歴史公文書', '指定機関',
  '秘密保護', '個人情報保護法',
  '情報公開制度', '不開示情報',
  '情報公開審査会', '公文書館職員',
  'アーキビスト', '個人情報ファイル簿',
  'オープンデータ', '統計情報',
];
const negate = [
  'still awaiting the records review',
  'まだ開示前', 'これから閲覧',
];
const nullPins = [
  'about to file the disclosure request',
  'about to visit the archives',
];
const establishedPins = [
  ['開示請求', 'close-tab'],
  ['部分開示', 'close-tab'],
  ['開示決定', 'close-tab'],
  ['まだ申請中', 'negate'],
];

describe('pass DCLXX: public-records & archives administration (shad)', () => {
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
