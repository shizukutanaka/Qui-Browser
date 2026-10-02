/**
 * Voice atoms CCCXXII — auction & deal-close idioms (EN)
 * + 落札/オークション終了/成約 (JA). Going going gone = close the tab.
 * Bidding in progress and offers open stay out.
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
  // --- hammer / gavel ---
  'going going gone', 'going once going twice sold',
  'hammer fell', 'hammer came down', 'gavel came down',
  'gavel fell', 'pound the gavel', 'final gavel',
  'hammer struck', 'auction hammer down', 'bang the gavel',
  // --- bid won ---
  'won the bid', 'bid won', 'bid accepted', 'offer accepted',
  'final offer accepted', 'asking price met', 'reserve met',
  'sold to the highest bidder', 'highest bid wins',
  'closing bid', 'winning bid placed', 'bid landed',
  'outbid everyone', 'sniped the auction',
  // --- auction ended ---
  'auction ended', 'auction over', 'auction is over',
  'auction closed', 'bidding ended', 'bidding is closed',
  'bidding closed', 'lot sold', 'all lots sold',
  'auctioneer done', 'call the auction', 'last lot sold',
  'no reserve met', 'unsold lots cleared',
  // --- deal closed ---
  'deal closed', 'closed the deal', 'deal is done',
  'signed the deal', 'deal signed', 'shook on it',
  'handshake deal done', 'agreement reached', 'terms agreed',
  'offer accepted in writing', 'contract exchanged',
  'closing escrow', 'escrow done', 'settlement reached',
  'sale completed', 'sale finalized', 'purchase complete',
  'sold sign hung', 'for sale sign down', 'listing closed',
  'sold out of stock', 'last one sold', 'final sale done',
];

const closeTabJa = [
  // --- 落札/競り ---
  '落札', '落札しました', '競り落として', '競り勝って',
  '最高値で落札', '最終入札', '入札が通って',
  'ハンマーが落ちて', '木槌が落ちて', '槌が下りて',
  'せり終了', '競り終了', 'オークション終了',
  '競売終了', '入札終了', '入札締切', '入札が終わって',
  '出品終了', '全品落札', '売り場が閉まって',
  // --- 成約/商談成立 ---
  '成約', '成約しました', '契約成立', '商談成立',
  '商談が成立して', '取引成立', '売買成立', '合意に達して',
  '条件が合意して', '握手で成立して', '口約束が成立して',
  '書面で合意して', '契約書にサインして', '契約を交わして',
  'エスクロー完了しました', '決済成立', '精算成立',
  // --- 売却/完売 ---
  '売約済み', '売約', '完売', '売り切れ', '売れ切れて',
  '全部売れて', '在庫がなくなって', '販売終了',
  '販売を終えて', '出品を取り下げて', '掲載終了',
  '値段がついて', '売り手が決まって', '買い手が決まって',
  '納札', '引き札を受け取って', '売れ筋完売',
];

const negate = [
  'keep bidding', 'stay in the auction', 'keep the listing up',
  'still negotiating', 'hold out for more', 'まだ入札中',
  '競りを続けて', '交渉を続けて', '出品を続けて',
];

const nullPins = [
  // bidding in progress / listing live
  'bidding starts', 'auction starts', 'opening bid',
  'place a bid', 'put in an offer', 'reserve not met',
  'still bidding', 'counter offer made', 'negotiating',
  'listing is live', 'for sale', 'under negotiation',
  '入札中', '競り中', '交渉中', '出品中', '売り出し中',
  'オークション開始', '入札開始', '値上げ交渉中',
  '販売中', '在庫あり',
];

const establishedPins = [
  ['done deal', 'close-tab'],
];

describe('Voice atoms CCCXXII — auction & deal-close idioms', () => {
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
