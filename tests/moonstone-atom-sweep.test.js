/**
 * Voice atoms CCCXXVII — flight arrival & deplaning idioms (EN)
 * + 着陸/降機/入国 (JA). Wheels down and bags in hand = close the tab.
 * Boarding, in-flight, and departure-side phrases stay out (CCCXI covered departure).
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
  // --- touchdown & taxi ---
  'we landed', 'finally landed', 'safely landed', 'plane landed',
  'flight landed', 'on the ground', 'on the tarmac', 'touched the runway',
  'runway touchdown', 'made it down', 'down at last', 'arrived on time',
  'landed on time', 'early arrival', 'delayed landing done',
  'taxiied to the gate', 'pulled into the gate', 'at the gate',
  'engines off', 'engines cut', 'apu off', 'chocks on',
  'parked at the gate', 'gate arrival', 'seatbelt sign off',
  'seatbelt light off', 'sign turned off', 'row lights on',
  // --- deplane ---
  'deplaned', 'off the plane', 'got off the plane', 'exited the plane',
  'off the aircraft', 'left the aircraft', 'walked down the jet bridge',
  'jet bridge', 'down the jetway', 'into the terminal',
  'in the terminal', 'through the gate', 'down the airstairs',
  'off the tarmac bus', 'shuttle to the terminal',
  // --- immigration & bags ---
  'through immigration', 'cleared immigration', 'passport stamped',
  'stamped through', 'e gate cleared', 'through passport control',
  'cleared customs', 'through customs', 'customs cleared',
  'nothing to declare', 'green channel', 'through the green channel',
  'bags claimed', 'baggage claim done', 'got the bags',
  'grabbed the bags', 'luggage collected', 'carousel emptied',
  'last bag off', 'met at arrivals', 'arrivals hall',
  'through arrivals', 'out of the airport', 'left the airport',
  'journey done', 'adventure over', 'made it home',
  'home from the trip', 'back from vacation', 'vacation memories',
  // --- connection done ---
  'connection made', 'final leg done', 'last leg done',
  'layover over', 'stopover done', 'red eye survived',
];

const closeTabJa = [
  // --- 着陸 ---
  '到着', '無事着陸', '定刻着', '早朝着',
  '遅れて着陸', '滑走路に着いて', '地上に降りて',
  'エンジン停止', '駐機場に着いて', 'スポットイン',
  'ベルトサイン消灯', 'シートベルトサインが消えて', '着陸態勢解除',
  // --- 降機/ターミナル ---
  '降機', '降機しました', '飛行機を降りて', '機内を出て',
  'ボーディングブリッジ', 'タラップを降りて', 'ターミナルに入って',
  '到着ゲート', '到着ロビー', '到着口を出て', 'ゲートを出て',
  '沖止めからバスで', '沖止め',
  // --- 入国/手荷物 ---
  '入国審査', '入国審査を通って', '入国スタンプ', 'スタンプを押されて',
  '自動化ゲートを通って', '税関通過', '税関を通って',
  '申告なしで通って', '手荷物を受け取って', '荷物を受け取って',
  'ターンテーブルで受け取って', '手荷物回収', '預け荷物が出てきて',
  '最後の荷物を取って', '空港を出て', '空港を後にして',
  '旅が終わって', '旅行が終わって', '旅の終わり', '帰ってきました',
  'ただいま', '無事帰国', '帰国しました', '旅の思い出',
  // --- 乗継 ---
  '乗り継ぎ終了', '乗継完了', '最終区間終了', 'トランジット終了',
];

const negate = [
  'stay on the plane', 'keep flying', 'stay in the air',
  'keep traveling', 'keep the trip going', 'まだ旅行中',
  'まだ旅の途中', '旅行を続けて', '乗り続けて',
];

const nullPins = [
  // departure / in-flight side
  'boarding now', 'final boarding call', 'gate is open',
  'boarding pass ready', 'at the departure gate', 'pre boarding',
  'in the air', 'cruising altitude', 'seatbelt sign on',
  'turbulence', 'in flight', 'mid flight', '飛行中',
  '搭乗中', '搭乗手続き', '出発ゲート', '出発ロビー',
  '離陸準備', '離陸しました', '巡航中', '機内サービス中',
  'チェックイン済み', '保安検査場', '出国審査', '乗り継ぎ中',
];

const establishedPins = [
  ['trip over', 'close-tab'],
  ['到着しました', 'close-tab'],
  ['touched down', 'close-tab'],
  ['wheels down', 'close-tab'],
  ['landed', 'close-tab'],
  ['disembarked', 'close-tab'],
  ['arrived at the gate', 'close-tab'],
  ['着陸', 'close-tab'],
  ['着陸しました', 'close-tab'],
];

describe('Voice atoms CCCXXVII — flight arrival & deplaning', () => {
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
