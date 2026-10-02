/**
 * Voice atoms CCCXXVI — market close & trading-day end idioms (EN)
 * + 引け/手仕舞い/決済 (JA). The closing bell and flat positions = close the tab.
 * Market open, positions on, and live quotes stay out.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- bell & session end ---
  'market closed', 'markets closed', 'rang the closing bell',
  'rang the bell', 'bell rung', 'session closed', 'trading ended',
  'trading done', 'trading halted', 'halted trading', 'session wrapped',
  'market wrapped', 'market wrap done', 'exchange closed',
  'floor closed', 'pit closed', 'pit emptied', 'trading floor emptied',
  'board went dark', 'ticker stopped', 'tape stopped',
  // --- positions flat ---
  'positions closed', 'closed all positions', 'all positions flat',
  'went flat', 'went to cash', 'all cash', 'flattened the book',
  'unwound the position', 'sold out of everything', 'liquidated',
  'exited the market', 'exited the position', 'cut the position',
  'stopped out', 'took profits', 'took the profit', 'banked the gains',
  'cashed out', 'cashed it in', 'locked in gains', 'booked the profit',
  'booked the loss', 'cut losses', 'settled up', 'settled the account',
  'account settled', 'margin settled', 'day trading done',
  'swing closed', 'trade closed', 'trade is done', 'order filled',
  'all orders filled', 'stopped trading', 'called it a day on the market',
  // --- settlement & statements ---
  'cleared the trades', 'trades settled', 'reconciled the book',
  'books reconciled', 'statements reconciled', 'pnl booked',
  'marked to market', 'eod report filed', 'market recap done',
];

const closeTabJa = [
  // --- 引け ---
  '引け', '前場引け', '後場引け', '立会終了', '立ち会い終了',
  '取引が終わって', '市場が閉まって', '市場閉場', '終値がついて',
  '引け値がついて', '東京市場終了', '取引所が閉まって',
  '夜間取引終了', 'ザラバ終了', '寄り引け', '場が終わって',
  // --- 手仕舞い/ポジション解消 ---
  '手仕舞い', '手仕舞い売り', '手仕舞い買い', 'ノーポジ',
  'ポジションを閉じて', 'ポジション解消', '全ポジションを解消',
  'ポジションを畳んで', '建玉を解消して', '持ち高を整理して',
  '持ち越しなし', 'キャッシュに戻して', '現金化しました',
  '売却完了', '全売却', '利確', '利益確定', '利益を確定して',
  '含み益を確定して', '損切り', '損切り済み', '損失を確定して',
  'ロスカット', '強制決済', '反対売買済み',
  // --- 決済/清算 ---
  '決済', '決済完了', '決済済み', '清算終了', '清算完了',
  '約定しました', '全約定', '注文が約定して', '約定確認',
  '口座を精算して', '証拠金を清算して', '日計り終了',
  '損益を確定して', '評価損益を確定して', '取引報告書が来て',
];

const negate = [
  'keep trading', 'stay in the market', 'still holding',
  'hold the position', 'keep the position open', 'まだ保有中',
  'まだ取引中', 'ホールドして', '持ち続けて',
];

const nullPins = [
  // market open / in progress
  'market open', 'opening bell', 'pre market', 'premarket trading',
  'market is open', 'in the green', 'in the red', 'watching the ticker',
  'day trading', 'swing trading', 'holding a position',
  '寄り付き', '寄り付きました', 'ザラ場', 'ザラバ中',
  '取引中', '保有中', '建玉保有中', '前場寄り', '寄り前',
  'PTS取引中', '監視中の銘柄',
];

const establishedPins = [
  ['closing bell', 'close-tab'],
  ['closing time', 'close-tab'],
  ['大引け', 'close-tab'],
  ['取引終了', 'close-tab'],
  ['after hours', 'sleep-mode'],
  ['手じまい', 'negate'],
];

describe('Voice atoms CCCXXVI — market close & trading-day end', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
