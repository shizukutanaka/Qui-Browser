// pass CCXCII sweep: EN void/shadow-realm + weather-disaster + maritime + cosmic
// disposal idioms; JA 水に流す/消失/追放/処遇 chains, plus coexistence pins.
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

const tm = {
  getActiveTab: () => ({ title: 't', url: 'u' }),
  closeTab: () => {},
  tabs: [{ title: 't' }]
};

let vc;
beforeEach(() => {
  vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser(tm);
});

function key(p) {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // EN void / shadow-realm / abyss
  'off to the shadow realm', 'cast into darkness', 'swallowed by the void',
  'banish to the shadow realm', 'the void calls for it',
  'bottomless pit for it', 'cast into the pit', 'throw it in the pit',
  'dump it in the abyss', 'hurl into darkness', 'sacrifice to the void',
  'return to the void', 'void bound', 'shadow realm awaits',
  // EN weather / natural disaster / erasure
  'rained out', 'cancelled due to rain', 'snow it under',
  'bury it in snow', 'blow it down', 'wipe off the map',
  'drop off the radar', 'fell off the radar', 'scatter to the winds',
  'dust in the wind', 'blown off course', 'struck by lightning',
  'hit by a meteor', 'vaporized by the sun', 'caught in the flood',
  'swept out to sea', 'avalanche for it', 'buried in rubble',
  'tsunami wash', 'ashes to ashes tab', 'burned to cinders',
  // EN maritime disposal
  'over the horizon', 'beyond the horizon', 'adrift at sea',
  'marooned island', 'desert island drop', 'shipwreck it',
  'sink to the bottom', 'mutiny against it', 'unmoor it',
  'off the deep end',
  // EN cosmic / space exile
  'eject it into space', 'vent it', 'vent it to space',
  'teleport it away', 'beam it out', 'into hyperspace',
  'hyperspace it', 'into orbit', 'orbital drop', 'off planet',
  'jettison into space', 'eject to space', 'blast it to mars',
  'one way trip to mars', 'off to mars', 'moon shot for it',
  'drop it on the moon', 'exile to the moon', 'stratosphere for it',
  'into the exosphere',
  // JA 水/自然に流す・消失
  '川に流して', '海に流して', '波に消されて', '波にさらって',
  '津波に飲まれて', '流れに任せて', '風に流して', '風に飛ばして',
  '風にさらされて', '雲散霧消', '煙にして', '煙に消えて',
  '砂に書いて消して', '木っ端微塵', '跡形もなく', '跡形も無い',
  '形見も残さず', '氷漬けにして', '氷の中へ', '雪に埋めて',
  '雪崩に飲まれて', '流砂に沈めて', '泥に沈めて', '沼に沈めて',
  '地の底へ', '海底に沈めて', '深海に沈めて', '沈みゆけ',
  '奈落へ', '奈落に落ちて', '大穴に落として',
  '崖から突き落として', '谷底に落とせ', '溶岩に投げて',
  '火山に投げて', '火葬の炎へ',
  // JA 追放 / 処遇 / 幽閉
  '島流しにして', '流刑にして', '追放処分', '国外追放',
  '国外退去', '退去強制', '放校にして', '退場処分',
  '一発退場', '無期追放', '永久追放', '幽閉して',
  '牢に入れて', '獄に投げて', '投獄して', '禁錮にして',
  '流刑宣告', '追放宣告', '追放者になれ', '追放者にして',
  '縁を切られて', '勘当宣告', '追放しよう', '放逐せよ',
  '追い込んで消せ',
  // JA 消失 / 昇華 / 宇宙送り
  '消えて無くなれ', '跡形なく消えて', '溶けて消えて',
  '溶けて無くなれ', '融けて消えて', '燃えて消えて',
  '燃え尽きて', '灰に帰して', '塵に帰して', '砂に帰れ',
  '土になれ', '消失させて', '消失して', '木っ端にして',
  '跡形なく消せ', '雲に隠れて消えて', '夜空の星になれ',
  '星に帰れ', '月に帰って', '大気圏外へ飛ばして',
  '宇宙に捨てて', '宇宙塵になれ', 'ブラックホールに投げて',
  'ブラックホールに飲ませて', 'ワームホールに投げて',
  '異次元に放って', '別次元に送って', '五次元に送って',
  '遠い世界に送って',
];

const pins = [
  ['wash your hands of it', 'close-tab'],  // already-established literal
  ['vanish into thin air', 'close-tab'],   // already-established literal
  ['gone with the wind', 'close-tab'],     // already-established literal
];

const nullPins = [
  // conceal-not-dispose: hiding it, not closing it
  'swept under the rug',
];

describe('labradorite atom sweep — close-tab literals', () => {
  test.each(closeTab.map(p => [p]))('routes %s to close-tab', (p) => {
    expect(key(p)).toBe('close-tab');
  });
});

describe('labradorite atom sweep — established pins hold', () => {
  test.each(pins)('routes %s to %s', (p, k) => {
    expect(key(p)).toBe(k);
  });
});

describe('labradorite atom sweep — null pins stay unrouted', () => {
  test.each(nullPins.map(p => [p]))('does not route %s', (p) => {
    expect(key(p)).toBeNull();
  });
});
