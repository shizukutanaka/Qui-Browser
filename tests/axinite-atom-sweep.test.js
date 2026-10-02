/**
 * Voice atoms CCCXI — hotel checkout & departure idioms (EN)
 * + チェックアウト/退室/帰路 (JA). Checking out / luggage
 * packed closes the tab. Check-in and keep-staying stay out.
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
  // --- checkout ritual ---
  'checked out', 'checking out now', 'checkout time',
  'checked out of the room', 'room vacated', 'room is empty',
  'key card returned', 'dropped the keys', 'keys at the desk',
  'left the keys', 'turned in the key', 'settled the bill',
  'paid the hotel bill', 'folio settled', 'minibar settled',
  'incidentals paid', 'late checkout denied', 'checkout at noon',
  'bags downstairs', 'luggage downstairs', 'luggage at the curb',
  'suitcase zipped', 'suitcase packed', 'bags are packed',
  'packed and ready', 'souvenirs packed', 'duty free bagged',
  'bellhop called', 'porter took the bags', 'valet called',
  // --- leaving the lodging ---
  'left the hotel', 'out of the hotel', 'vacated the room',
  'do not disturb removed', 'sign flipped to clean',
  'room returned', 'checkout complete', 'stay is over',
  'last night in the hotel', 'out of the resort',
  'resort checkout', 'airbnb checkout', 'left the airbnb',
  'checked out of the airbnb', 'host key returned',
  'lockbox sealed', 'cabin locked up', 'campsite cleared',
  'lodge checked out', 'ryokan checkout', 'capsule checkout',
  // --- heading home ---
  'taxi to the airport', 'shuttle to the airport',
  'airport bound', 'headed to the airport', 'off to the airport',
  'boarding pass in hand', 'wheels up', 'red eye boarded',
  'flight home boarded', 'on the flight home', 'jet lag home',
  'train ride home', 'drive home began', 'long drive home',
  'vacation over', 'trip ended', 'holiday is over',
  'back from the trip', 'homeward bound', 'journey home',
  'reentry begins', 'back to reality', 'vacation ended',
];

const closeTabJa = [
  // --- チェックアウト/退室 ---
  'チェックアウト', 'チェックアウト時間', 'チェックアウトします',
  '退室', '退室します', '部屋を出て', '部屋を出ます',
  'カードキーを返して', '鍵を返して', 'フロントに鍵を渡して',
  '精算終了', '宿泊料金を払って', '追加料金を払って',
  'ミニバー精算', '延長を断られて', '荷物を下ろして',
  '荷物をまとめて', '荷造り完了', 'スーツケースを閉めて',
  'パッキング完了', '土産を詰めて', 'お土産を買って',
  'ベルボーイを呼んで', 'ポーターに頼んで', '車を回して',
  // --- 宿を出る ---
  'ホテルを出て', 'ホテルを出ます', '宿を出て', '宿を出ます',
  '旅館を出て', '民宿を出て', 'ログアウト完了', '滞在終了',
  '最後の夜が終わって', '民宿チェックアウト', '民泊を出て',
  '民泊チェックアウト', '貸別荘を出て', 'コテージを畳んで',
  'カプセルを出て', '宿泊終了', '連泊終了', '客室を空けて',
  // --- 帰路 ---
  '帰りの便', '帰りの電車', '帰りのフライト', '空港へ向かって',
  '空港に向かって', '空港行き', '帰路につく', '帰路',
  '搭乗開始', '搭乗時間', 'チケットを持って', '機内に入って',
  '旅行終了', '旅行が終わった', '旅が終わった', '休暇終了',
  '休暇が終わった', '連休終了', '観光終了', '現実に戻って',
  '日常に戻って', '家路につく', '家路', '帰宅ラッシュ',
];

const negate = [
  'extend the stay', 'stay another night', 'late checkout please',
  'keep the room', 'もう一泊して', '滞在を延ばして', 'まだ滞在中',
];

const nullPins = [
  // check-in / arrival = setup, not ending
  'check in', 'checking in', 'arrived at the hotel', 'room key',
  'front desk', 'reservation', 'チェックイン', 'チェックインする',
  '予約確認', '部屋に着いた', '荷物を部屋に運んで', '連泊',
];

const establishedPins = [
  ['checkout time', 'close-tab'],
];

describe('Voice atoms CCCXI — hotel checkout & departure idioms', () => {
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
