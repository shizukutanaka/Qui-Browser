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
  // blossoms / hanami
  'hanami done', 'hanami over', 'saw the blossoms',
  'saw the cherry blossoms', 'cherry blossoms seen',
  'petals fallen', 'blossoms past peak',
  // autumn leaves
  'leaf peeping done', 'saw the fall colors',
  'autumn leaves seen', 'fall colors done',
  // picnic / bbq
  'picnic done', 'picnic over', 'picnic under the trees',
  'blanket packed up', 'picnic blanket folded',
  'bbq done', 'bbq over', 'barbecue done',
  'grill cooled down', 'coals out', 'coals cold',
  'fire pit out',
  // fireworks / festival
  'fireworks seen', 'fireworks show over', 'matsuri done',
  'saw the parade', 'parade over', 'floats gone by',
  'lantern festival done', 'illumination done', 'lights seen',
  'christmas lights seen', 'ate the festival food',
  'food stalls done',
  // seasonal rites
  'koi nobori down', 'hinamatsuri over', 'dolls put away',
  'bon dance done', 'odori done',
  'shrine visit done', 'saw the shrine', 'hatsumode done',
  'first visit done', 'omikuji drawn', 'ema hung',
  // school / community events
  'sports day over', 'undokai done', 'culture festival done',
  'school festival over', 'bunkasai done',
  // moon / new year / setsubun
  'moon viewing done', 'tsukimi done', 'dumplings eaten',
  'new year visit done', 'osechi eaten', 'mochi eaten',
  'bean throwing done', 'setsubun done', 'oni out',
  'sakura season over',
];
const closeTabJa = [
  // 花見/紅葉
  '花見終了', '花見が終わって', '桜を見てきた',
  'お花見終了', '花見から帰って', '桜吹雪を見て',
  '散り際を見て', '紅葉狩り終了', '紅葉を見てきた',
  'もみじ狩り終了', '紅葉が終わって',
  'ライトアップ終了', 'イルミネーションを見てきた',
  // ピクニック/BBQ
  'ピクニック終了', 'ピクニックが終わって',
  'シートを畳んで', 'レジャーシートを畳んで',
  '花見弁当を食べて', 'バーベキュー終了',
  'バーベキューが終わって', '炭を消して',
  'グリルを片付けて',
  // 花火/祭り
  '花火を見てきた', '線香花火をして',
  '屋台を回って', '出店を見てきた',
  '金魚すくいをして', '盆踊り終了',
  '太鼓を見てきた', '神輿を見てきた', 'だんじりを見て',
  // 初詣/参拝
  '初詣終了', 'おみくじを引いて', '絵馬を書いて',
  'お守りをもらって', '参拝してきた', 'お参りしてきた',
  '手水で清めて',
  // 学校/地域行事
  '体育祭終了', '文化祭終了', '学園祭終了',
  // 月見/正月/節分
  '月見をして', '十五夜を見て', '団子を食べて',
  '雛祭りを終えて', '雛人形をしまって',
  'こいのぼりをしまって', '節分終了', '豆まきをして',
  '恵方巻を食べて', '七五三終了', '除夜の鐘を聞いて',
  'おせちを食べて', 'もちつきをして',
  '雪まつりを見てきた', '桜祭り終了', '紅葉の季節終わり',
];
const negate = [
  'still at the picnic', 'still hanami',
  'まだ花見中', 'まだピクニック中',
];
const nullPins = [
  'packing up the picnic', 'mid hanami', 'hanami ongoing',
  'blossom season', '花見の途中', 'お花見中',
  'ピクニックの途中', 'まだ紅葉狩り中',
];
const establishedPins = [
  ['sparklers done', 'close-tab'],
  ['visited the shrine', 'close-tab'],
  ['弁当を食べ終えて', 'close-tab'],
  ['炭火を消して', 'close-tab'],
  ['焚き火を消して', 'close-tab'],
  ['花火大会終了', 'close-tab'],
  ['運動会終了', 'close-tab'],
  ['年越しそばを食べて', 'close-tab'],
  ['初詣に行ってきた', 'go-to'],
  ['花見に行って', 'go-to'],
  ['紅葉を見に行って', 'go-to'],
  ['ピクニックに行って', 'go-to'],
  ['hanami tomorrow', 'date'],
  ['picnic tomorrow', 'date'],
  ['bbq tomorrow', 'date'],
  ['明日花見', 'defer'], ['明日ピクニック', 'defer'],
];

describe('pass CCCLI: hanami / seasonal-event end idioms (jasmine)', () => {
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
