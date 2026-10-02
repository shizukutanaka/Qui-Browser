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
  // inspection / service
  'car inspection done', 'car passed inspection', 'roadworthy',
  'inspection sticker', 'car serviced', 'service done',
  'dealer service done', 'took the car in', 'picked up the car',
  'car ready', 'car back from the shop', 'shop released the car',
  // fluids / wear parts
  'oil change done', 'oil changed', 'tires rotated',
  'tire rotation done', 'tires changed', 'new tires on',
  'brakes replaced', 'brake pads done', 'battery replaced',
  'wipers replaced', 'air filter changed', 'transmission serviced',
  'radiator flushed', 'spark plugs done', 'timing belt done',
  'exhaust fixed', 'muffler replaced', 'suspension fixed',
  'ac recharged', 'heat fixed',
  // repair
  'engine tuned', 'tune up done', 'car repaired', 'fixed the car',
  'repair done', 'repair finished', 'mechanic done',
  'estimate approved', 'parts installed', 'dents fixed',
  'dent repaired', 'body work done', 'car painted',
  'paint job done', 'scratches buffed', 'windshield replaced',
  'window fixed', 'recall fixed',
  // cleaning
  'car detailed', 'detailing done', 'car washed', 'wash done',
  'interior cleaned', 'car vacuumed', 'car waxed', 'polish done',
  'garage cleaned',
  // fuel / charge
  'tire pressure checked', 'fluids topped', 'tank full',
  'filled up the car', 'gas filled', 'charged the ev',
  'ev charged', 'unplugged the car',
  // emergency / assist
  'emissions passed', 'smog check done', 'passed smog',
  'roadside assistance done', 'towed to shop', 'flat tire fixed',
  'tire patched', 'spare tire on', 'jump started the car',
  'alignments done', 'wheels aligned', 'car winterized',
  'snow tires on', 'chains on',
  // registration / ownership
  'car registered', 'registration renewed', 'plates renewed',
  'dmv done', 'license renewed', 'keys made', 'car unlocked',
  'alarm installed', 'stereo installed', 'car traded in',
  'sold the car', 'bought the car', 'paid off the car',
  'car payment done', 'lease returned', 'turned in the lease',
  'rental car returned', 'returned the rental',
  'walked out of the dealer', 'car in the garage', 'cars parked',
];
const closeTabJa = [
  // 車検/点検/整備
  '車検終了', '車検が終わって', '車検に出して', '車検が通って',
  '車検証がもらって', '点検終了', '六ヶ月点検', '法定点検',
  'メンテナンス終了', '整備終了', '車両整備',
  // 交換/修理
  'オイル交換終了', 'オイルを替えて', 'タイヤ交換終了',
  'タイヤを換えて', 'スタッドレスにして', '夏タイヤにして',
  'パンクを直して', 'ブレーキを換えて', 'ブレーキパッド交換',
  'バッテリー交換', 'バッテリーを換えて', 'ワイパーを換えて',
  'エアコンを直して', '修理が終わって', '修理完了', '直りました',
  '車を直して', 'ディーラーに出して', '整備工場に出して',
  'メカニックに見てもらって', '見積もりをもらって',
  '部品が届いて', '部品を取り寄せて', '板金が終わって',
  'ヘコミを直して', '塗装が終わって', '傷を直して',
  'フロントガラスを換えて', 'リコール対応', '保証修理',
  // 洗車/給油/充電
  '洗車終了', '車を洗って', 'ワックスをかけて',
  '車内を掃除して', '給油した', 'ガソリンを入れて',
  '満タンにして', '充電が終わって', '電欠対策',
  // 緊急/手続き
  'レッカーを呼んで', 'ロードサービスを呼んで',
  'スペアタイヤにして', 'エンジンをかけて',
  '車を買って', '納車されて', '車を売って', 'ローンを払い終えて',
  '残価を払って', 'リースを返して', 'レンタカーを返して',
  '免許を更新して', '車庫証明を取って', 'ナンバーを取って',
  '登録が済んで', '自賠責を入って', '任意保険に入って',
  // 運転終了/駐車
  'ドライブ終了', '帰宅しました', '車を降りて',
  '駐車場に止めて', 'ガレージに入れて',
];
const negate = [
  'keep driving', 'still at the shop', 'still fixing',
  'まだ修理中', 'まだ整備中', '修理を続けて',
];
const nullPins = [
  'car in the shop', 'at the mechanic', 'waiting at the dealer',
  '車を預けて', '入庫中', '整備中', '修理待ち', '愛車の点検',
  '車が壊れて', '故障して', 'エンジンがかからなくて',
  'バッテリーが上がって', '免許が切れて',
];
const establishedPins = [
  ['inspection passed', 'close-tab'], ['wax done', 'close-tab'],
  ['warranty work done', 'close-tab'], ['下取りに出して', 'close-tab'],
  ['運転を終えて', 'close-tab'], ['パーキングに入れて', 'close-tab'],
  ['charging done', 'battery-status'],
  ['車検場に行って', 'go-to'], ['ディーラーに行って', 'go-to'],
  ['ガソリンスタンドに行って', 'go-to'],
  ['tomorrow car service', 'date'],
  ['明日車検', 'defer'], ['明日修理', 'defer'],
];

describe('pass CCCXXXVIII: car service/repair/maintenance end idioms (wisteria)', () => {
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
