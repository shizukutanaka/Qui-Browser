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
  // drive / tour end
  'drive done', 'back from the drive', 'touring done',
  'touring over', 'ride done bike', 'motorcycle ride done',
  // park / garage
  'turned off the engine', 'parked the car',
  'garage door closed', 'parking spot found',
  'parallel parked', 'car parked',
  // fuel / wash / upkeep
  'filled up', 'tanked up', 'filled the tank',
  'gas station done', 'washed the car', 'car wash done',
  'car cleaned inside', 'interior vacuumed',
  'dashboard wiped', 'oil topped off', 'tires checked',
  'air pressure checked', 'car washed drive',
  'detailing done drive',
  // tolls / fees
  'toll paid', 'tolls paid', 'parking fee paid',
  'meter fed', 'parking ticket paid',
  // traffic / scenic
  'traffic cleared', 'made it through traffic',
  'rush hour survived', 'coast drove', 'sunset drove',
  'night drive done',
];
const closeTabJa = [
  'ドライブが終わって', 'ツーリング終了',
  'ツーリングが終わって', '運転が終わって',
  'エンジンを切って', '車を停めて',
  '縦列駐車して', '駐車場を出て', '駐車場に停めて',
  '駐車料金を払って',
  '給油して', 'ガソリンを入れ終わって',
  'ガソリンスタンドを出て',
  '洗車して', '洗車が終わって', '洗車機を出て',
  'タイヤをチェックして', '空気圧を見て',
  'オイルを補充して', '充電して',
  '充電ケーブルを外して',
  '高速を降りて', '料金所を通って', 'etcを通って',
  '渋滞を抜けて', '海岸沿いを走って',
  '夜景ドライブ終了', 'ドライブインを出て',
];
const negate = [
  'still driving', 'まだ運転中', 'まだドライブ中',
];
const nullPins = [
  'about to drive', 'mid drive', 'rest stop', 'car keys',
  '運転の途中', 'これからドライブ', '車の鍵', '休憩所',
];
const establishedPins = [
  ['drove home', 'close-tab'],
  ['road trip done', 'close-tab'],
  ['road trip over', 'close-tab'],
  ['engine off', 'close-tab'],
  ['in the garage', 'close-tab'],
  ['gas filled', 'close-tab'],
  ['wipers replaced', 'close-tab'],
  ['unplugged the car', 'close-tab'],
  ['scenic route done', 'close-tab'],
  ['charging done', 'battery-status'],
  ['still on the road', 'negate'],
  ['drive tomorrow', 'date'],
  ['ドライブ終了', 'close-tab'],
  ['ドライブを終えて', 'close-tab'],
  ['運転終了', 'close-tab'], ['車を止めて', 'close-tab'],
  ['駐車して', 'close-tab'], ['ガレージに入れて', 'close-tab'],
  ['車庫に入れて', 'close-tab'],
  ['ガソリンを入れて', 'close-tab'],
  ['満タンにして', 'close-tab'],
  ['車内を掃除して', 'close-tab'],
  ['充電が終わって', 'close-tab'],
  ['峠を越えて', 'close-tab'],
  ['明日ドライブ', 'defer'],
];

describe('pass CCCLIX: drive & touring end idioms (cosmos)', () => {
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
