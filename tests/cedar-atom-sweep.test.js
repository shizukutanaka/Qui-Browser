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
  // tours / attractions
  'done sightseeing', 'tour finished', 'guided tour done',
  'bus tour done', 'walking tour done', 'museum done',
  'museum closed', 'left the museum', 'gallery done',
  'exhibit done', 'saw the exhibit', 'zoo done', 'aquarium done',
  'theme park done', 'park closing', 'park closed',
  'last ride done', 'rope drop to fireworks',
  // sights seen
  'castle seen', 'monument seen', 'saw the sights',
  'bucket list item done', 'viewpoint reached', 'overlook done',
  'scenic drive done', 'drove the coast', 'skyline seen',
  'sunset watched', 'sunrise seen', 'sunrise hike done',
  'lookout reached', 'peak bagged', 'summit photo done',
  'visited the shrine', 'temple visited', 'shrine visited',
  'castle tour done', 'guided by a local',
  // photos / souvenirs
  'photo taken there', 'pictures taken', 'souvenirs bought',
  'souvenir shopping done', 'postcards sent', 'stamps collected',
  'got the stamp',
  // day trips / cruises
  'day trip done', 'day trip over', 'excursion done',
  'cruise ended', 'disembarked the ship', 'back at the hotel',
  'returned to the hotel', 'tour bus dropped us',
  'itinerary done', 'itinerary complete', 'every stop done',
  'all sights seen', 'seen everything', 'explored the town',
  'wandered the streets', 'guide finished', 'tour guide done',
  'audio guide done', 'rental returned', 'bike returned',
  'carriage ride done', 'gondola ride done', 'ferry ride done',
  'cable car done',
  // road / hikes
  'road trip done', 'road trip over', 'back on the highway',
  'detour done', 'pit stop done', 'rest stop done',
  'trailhead back', 'trail done hiking', 'path completed',
  'walk done touring', 'stroll done', 'promenade done',
  'boardwalk done', 'map folded', 'map put away',
  'guidebook closed', 'out of the attraction',
  // trip end
  'sights seen', 'vacation done', 'trip done touring',
  'holiday over', 'home from trip', 'bags unpacked trip',
];
const closeTabJa = [
  // 観光/ツアー
  '観光を終えて', '観光が終わって', 'ツアー終了',
  'ツアーが終わって', 'ガイドツアー終了', 'バスツアー終了',
  '周遊終了', '巡り終えて', '名所を回って', '見所を回って',
  '観光地を回って',
  // 施設
  '美術館を出て', '博物館を出て', '展覧会を見て',
  '展示を見終えて', '動物園を出て', '水族館を出て',
  '遊園地を出て', 'テーマパークを出て', '閉園',
  '最後の乗り物',
  // 景色
  '景色を見て', '絶景を見て', '展望台に着いて',
  '展望を見て', 'モニュメントを見て', '記念碑を見て',
  '夕日を見て', '朝日を見て', '朝焼けを見て',
  // ドライブ/日帰り/クルーズ
  'ドライブを終えて', '海岸を走って', '日帰り終了',
  '日帰り旅行終了', '小旅行終了', 'クルーズ終了',
  '船を降りて', '下船しました', 'ホテルに戻って',
  '宿に戻って', '旅程を終えて', '旅程終了',
  // 散策/山
  '全部見て', '全部回って', '見尽くして', '町を歩いて',
  '街歩き終了', '散策終了', '散策を終えて', 'ぶらぶらして',
  '山頂に着いて', '登山を終えて', '下山しました',
  '山から降りて', 'トレイルを歩いて',
  // 参拝/ガイド
  '参拝して', 'お参りして', '神社を参拝して',
  'お寺を巡って', '寺社巡り終了', '御朱印をもらって',
  'スタンプを押して', '記念写真を撮って',
  '土産物を買って', '絵葉書を出して',
  'ガイドが終わって', '音声ガイド終了', '自転車を返して',
  '馬車に乗って', 'ゴンドラに乗って', 'フェリーに乗って',
  'ロープウェイに乗って', '帰路について',
];
const negate = [
  'still sightseeing', 'still touring', 'still exploring',
  'more sights to see', 'still wandering',
  'まだ観光中', 'まだツアー中', 'まだ散策中',
];
const nullPins = [
  'packing for the trip', 'in the middle of the tour',
  'sightseeing now', 'on the tour', 'mid tour',
  '旅行の準備中', 'ツアー中', '散策中', '観光中',
];
const establishedPins = [
  ['sightseeing done', 'close-tab'], ['tour ended', 'close-tab'],
  ['tour over', 'close-tab'], ['excursion over', 'close-tab'],
  ['hike done', 'close-tab'], ['through the gates', 'close-tab'],
  ['vacation over', 'close-tab'], ['back from vacation', 'close-tab'],
  ['landmarks checked off', 'landmarks'],
  ['checked off the landmarks', 'landmarks'],
  ['photographed the landmark', 'landmarks'],
  ['観光終了', 'close-tab'], ['ドライブ終了', 'close-tab'],
  ['レンタカーを返して', 'close-tab'], ['登山終了', 'close-tab'],
  ['お土産を買って', 'close-tab'], ['旅行終了', 'close-tab'],
  ['旅行が終わって', 'close-tab'], ['旅が終わって', 'close-tab'],
  ['まだ旅の途中', 'negate'], ['まだ旅行中', 'negate'],
  ['trip tomorrow', 'date'], ['flight tomorrow', 'date'],
  ['明日旅行', 'defer'], ['明日観光', 'defer'], ['明日出発', 'defer'],
];

describe('pass CCCXLII: sightseeing/tour end idioms (cedar)', () => {
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
