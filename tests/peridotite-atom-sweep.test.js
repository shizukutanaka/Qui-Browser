// pass CCCXXXIII peridotite atom sweep — salon / barber / beauty / grooming done idioms.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
  return vc;
}
function key(vc, p) { const r = vc._matchCommand(p); return r && r.key; }

const closeTab = [
  // haircut / barber
  'haircut done', 'got a haircut', 'fresh cut', 'new do', 'barber done',
  'left the barbershop', 'trim done', 'bangs trimmed', 'line up done',
  'fade done', 'buzzed', 'head shaved', 'beard trimmed',
  'mustache trimmed', 'shave done', 'clean shave', 'straight razor done',
  'hot towel done', 'chair spun', 'barber chair empty',
  // salon / color / style
  'salon done', 'left the salon', 'stylist done', 'color done',
  'color touched up', 'roots done', 'root touch up', 'highlights done',
  'dye job done', 'toner applied', 'balayage done', 'ombre done',
  'blowout done', 'blow dried', 'styled', 'perms done', 'perm done',
  'straightened', 'curled', 'braids done', 'weave in', 'extensions in',
  'wig on', 'toupee fitted', 'scalp treated', 'keratin done',
  'deep condition done', 'hair washed', 'rinse done', 'shampooed',
  'set and styled', 'updo done', 'braid out', 'twist out',
  'wash and go', 'silk press', 'blow dry bar done', 'dry bar done',
  'layers done', 'bob done', 'pixie done', 'undercut done', 'taper done',
  'edges done', 'baby hairs laid', 'hairspray set',
  // nails / lashes / brows
  'nails done', 'mani pedi done', 'manicure done', 'pedicure done',
  'nail polish dry', 'gel nails done', 'acrylics done', 'nail art done',
  'eyebrows done', 'threading done', 'lashes done', 'lash lift done',
  'wax done',
  // spa / massage / esthetic
  'spa day over', 'spa day done', 'spa closed', 'massage done',
  'got a massage', 'masseuse done', 'table time up', 'session up',
  'facial done', 'self care done', 'me time over', 'pampered',
  'pampered myself', 'feeling fresh',
  // tattoo / piercing / grooming
  'tattoo done', 'ink done', 'tattoo session over', 'pierced',
  'piercing done', 'groomed', 'grooming done', 'pet groomed',
  'dog groomed', 'dog washed',
  // vet / dental / optical quick visits
  'vet visit done', 'checkup done at the vet', 'dentist done',
  'hygienist done', 'braces tightened', 'optometrist done',
  'new glasses', 'contacts fitted', 'eyes checked',
  // checkout / wrap-up
  'chair emptied', 'cape off', 'gown off', 'towel off',
  'mirror check done', 'thumbs up to the barber', 'picture taken',
  'instagram posted', 'selfie taken', 'payment made', 'card swiped',
  'tipped', 'tipped the stylist', 'paid the stylist',
  'booked next appointment', 'see you in six weeks', 'monthly trim',
  'routine cut', 'maintenance done', 'touch up done',
  'kids haircut done', 'first haircut done', 'walk in done',
  'no wait cut', 'quick cut done', 'express cut', 'ten minute cut',
  'salon closed', 'parlor closed', 'boutique closed', 'checkout done',
  'all checked out',
  // result declarations
  'makeover done', 'makeover complete', 'transformation done',
  'glow up done', 'full glam', 'makeup done', 'mua done',
  'wedding prep done', 'bridal ready', 'prom ready', 'dressed up',
  'freshened up', 'cleaned up nice', 'looking sharp',
  'new look', 'new hairstyle', 'fresh fade', 'crisp lineup',
  'smooth shave', 'baby smooth', 'silky smooth', 'silky hair',
  'shiny hair', 'healthy hair', 'split ends gone', 'dead ends gone',
  'inches off', 'design shaved in', 'part lined',
  'glammed up', 'red carpet ready', 'date night ready',
  'wedding ready', 'event ready', 'photo ready', 'camera ready',
];

const closeTabJa = [
  // 散髪/理容
  '散髪', '散髪終了', '床屋を出て', '理容室を出て', 'いつもの床屋行ってきた',
  '顔剃り', 'シェービング終了', 'ひげを剃って', 'ひげを整えて',
  'バリカンで刈って', '坊主にして', 'ツーブロック', '刈り上げて',
  'グラデーション', 'フェード',
  // 美容院
  '美容室を出て', '美容院を出て', 'ヘアサロンを出て', 'サロンを出て',
  'カット終了', 'カットしてもらって', '髪を切って', '髪切った',
  '前髪を切って', 'パーマ終了', 'パーマをかけて', 'カラー終了',
  '染め終わって', '白髪染め', 'リタッチ終了', 'ブリーチ終了',
  'トリートメント終了', 'ヘッドスパ終了', 'シャンプーしてもらって',
  'ブロー終了', 'セットしてもらって', 'アップにしてもらって',
  '編み込んでもらって', 'エクステつけて', 'ウィッグをつけて',
  '指名してもらって', '担当さんに切ってもらって',
  'スタイリストさんに任せて', '美容師さんに切ってもらって',
  // ネイル/まつげ/眉/脱毛
  'ネイル終了', 'ネイルサロンを出て', 'マニキュアを塗って',
  'ジェルネイル終了', 'ペディキュア終了', 'まつげパーマ',
  'まつエク終了', '眉を整えて', '脱毛終了',
  // エステ/マッサージ/温浴
  'エステ終了', 'エステサロンを出て', 'マッサージ終了', '揉みほぐし',
  '整体終了', '整骨院を出て', 'リラクゼーション終了',
  'アロママッサージ終了', 'タイ古式マッサージ終了', '岩盤浴を出て',
  'スパを出て', '温浴施設を出て', '銭湯を出て', '温泉を出て',
  // タトゥー/ペット/クリニック
  'タトゥー完了', '刺青が入って', 'トリミング終了', '犬を洗って',
  '動物病院を出て', '歯医者を出て', '歯のクリーニング',
  '矯正を調整して', '眼科を出て', 'メガネができて',
  'コンタクトを合わせて',
  // 仕上がり/支度/会計
  'メイク完了', 'メイクしてもらって', 'フルメイク', '変身完了',
  'イメチェン', '新しい髪型', 'さっぱりした', 'すっきりした',
  '綺麗になって', '可愛くなって', 'かっこよくなって',
  '身だしなみを整えて', 'おしゃれして', 'ドレスアップ',
  '支度ができて', '準備完了した', 'チップを渡して', 'カードで払って',
  '待合を出て', '順番が来て', '椅子を立って', 'ケープを外して',
  'タオルを取って', 'インスタに載せて', 'パーラーを出て',
];

const negate = [
  'keep growing it out', 'still in the chair', 'dont cut yet',
  'still getting pampered', 'leave it long', 'まだ施術中',
  'まだカット中', 'まだエステ中', 'ネイル中', 'パーマ中',
  '染髪中', 'カラーリング中', '施術を続けて', 'もう少しマッサージして',
  '長めにお願いして', '追加でお願いして',
];

const nullPins = [
  'at the salon', 'in the chair', 'mid haircut', 'under the dryer',
  'salon appointment', 'growing it out', 'roots showing',
  'need a haircut', 'overdue for a trim',
  '美容室にいる', '予約してある', '来週ネイル', '理容院', '美容院',
  'ペットサロン', 'いつもの床屋', 'かかりつけの美容室', '清潔感',
  '盛装', '施術中', 'シャンプー台', 'ドライヤーの下',
];

const establishedPins = [
  ['teeth cleaned', 'close-tab'],
  ['appointment done', 'close-tab'],
  ['次回予約を取って', 'close-tab'],
  ['会計を済ませて', 'close-tab'],
  ['ピアスを開けて', 'go-to'],
  ['予約の時間に行って', 'go-to'],
  ['鏡を見せてもらって', 'web-search'],
  ['写真を撮って', 'screenshot'],
  ['明日美容院', 'defer'],
];

describe('Voice atoms CCCXXXIII — salon/barber/beauty done idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab (JA)', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k2) => {
    expect(key(makeVC(), p)).toBe(k2);
  });
});
