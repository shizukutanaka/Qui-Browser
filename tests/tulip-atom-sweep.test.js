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
  // walk done
  'dog walk done', 'took the dog out', 'dog is walked',
  'back from the walk', 'walk done', 'morning walk done',
  'evening walk done',
  // business / cleanup
  'dog did his business', 'dog pooped', 'poop bag tied',
  'poop picked up',
  // gear off
  'leash off', 'leash hung up', 'harness off', 'collar off',
  'wiped his paws', 'paws wiped', 'toweled the dog',
  // grooming / feeding
  'dog brushed', 'brushed the dog', 'fed the dog',
  'dog fed', 'food bowl filled', 'water bowl filled',
  'topped off the water', 'treats given', 'gave him a treat',
  // settle down
  'dog settled', 'dog asleep', 'dog napping',
  'dog in his crate', 'crate closed', 'kennel door shut',
  // cat / other pets
  'litter changed', 'cat litter done', 'cat fed',
  'fed the cat', 'played with the cat', 'cat entertained',
  'fish fed', 'tank cleaned', 'cage cleaned',
  'birdcage cleaned', 'hamster wheel clean',
  // outings / play
  'nails clipped dog', 'vet run done', 'pet back home',
  'dog back inside', 'brought the dog in', 'let the dog in',
  'dog tired out', 'wore the dog out', 'fetch done',
  'played fetch', 'park done dog', 'dog park done',
  'socialized the pup', 'dog sitting done',
  'pet sitting done', 'doggie daycare done',
];
const closeTabJa = [
  // 散歩
  '散歩終了', '散歩が終わって', '犬を散歩させて',
  '朝散歩終了', '夕方散歩終了',
  // 排泄/片付け
  '排泄を済ませて', '用を足して', 'うんちを拾って',
  'マナー袋を結んで',
  // 装具/拭き
  'リードを外して', 'リードをしまって',
  'ハーネスを外して', '首輪を外して',
  '足を拭いて', '肉球を拭いて', '濡れた体を拭いて',
  // 世話
  'ブラッシングして', '毛を梳いて',
  '犬をシャンプーして', 'ご飯をあげて',
  '水を替えて', 'おやつをあげて',
  // 就寝/ケージ
  '犬が寝て', 'ケージに入れて', 'ケージを閉めて',
  'ハウスに入れて',
  // 猫/他ペット
  'トイレシートを替えて', '猫砂を替えて',
  '猫に餌をあげて', '猫トイレを掃除して',
  '猫じゃらしで遊んで', '金魚に餌をあげて',
  '水槽を掃除して', '鳥かごを掃除して',
  // 外出/遊び
  '爪切り終了', 'トリミングから戻って',
  '動物病院から戻って', '予防注射を済ませて',
  '犬を家に入れて', '犬を中に入れて', '庭から入れて',
  '犬のおもちゃを片付けて',
  '遊んであげて', 'ボール遊びをして', 'ドッグラン終了',
];
const negate = [
  'still walking the dog', 'still out with the dog',
  'まだ散歩中', '散歩の途中',
];
const nullPins = [
  'walk ongoing', 'mid walk', 'dog mid zoomies',
  'taking the dog out', 'about to walk the dog',
  'leash on him', '散歩の支度をして', 'マナー袋',
  '水やりして',
];
const establishedPins = [
  ['walked the dog', 'close-tab'],
  ['litter box cleaned', 'close-tab'],
  ['grooming done', 'close-tab'],
  ['犬の散歩終了', 'close-tab'],
  ['散歩から帰って', 'close-tab'],
  ['餌をあげて', 'close-tab'],
  ['dog walk tomorrow', 'date'],
  ['walk the dog tomorrow', 'date'],
  ['grooming appointment tomorrow', 'date'],
  ['明日散歩', 'defer'],
  ['散歩に行ってきた犬', 'go-to'],
  ['散歩に行くところ', 'go-to'],
];

describe('pass CCCLII: dog-walk & pet-care end idioms (tulip)', () => {
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
