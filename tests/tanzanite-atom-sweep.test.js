// pass CCXCIII sweep: EN medical/surgical + machinery/scrap disposal idioms;
// JA 摘出/切断/末期 + 解体/廃棄処分 chains, plus coexistence pins.
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
  // EN medical / surgical / end-of-life
  'excise it', 'cut it out surgically', 'surgical removal',
  'operate on it out', 'remove it surgically',
  'pull the plug on life support', 'unplug life support',
  'end of life care', 'dnr order', 'let it die peacefully',
  'declared dead', 'call time of death', 'brain dead tab',
  'organ harvest', 'harvest its organs', 'cauterize it',
  'amputated limb', 'sever the limb', 'lop it off clean',
  'chop off the limb', 'bone saw for it', 'transect it',
  'quadsect it', 'cleave it in twain', 'debunk it to pieces',
  'out the window it goes',
  // EN machinery / scrap / demolition
  'salvage the parts', 'junkyard for it', 'crusher for it',
  'grind it down', 'mill it away', 'smelt it down',
  'melt it down for scrap', 'recycle bin for it',
  'throw it in the compactor', 'wreck it',
  'write it off as scrap', 'total writeoff', 'totaled for sure',
  'mark it for scrap', 'retire the machine', 'end of life for it',
  'obsolete anyway', 'beyond repair', 'irreparable damage',
  'condemned to scrap', 'disassemble it', 'dismantle it',
  'unbuild it', 'furnace for it', 'cremate it in the furnace',
  'smelt it to slag', 'slag heap for it',
  // JA 摘出 / 切断 / 末期
  '摘出して', '切除して', '切断せよ', '真っ二つにして',
  '一刀両断', '両断して', '分解して', '外科的に除去',
  '摘出せよ', '手術台に載せて', 'メスを入れて',
  '安楽死させて', '尊厳死を', '呼吸器を外して',
  '延命を止めて', '延命停止', '脳死だ', '逝去宣告',
  '死亡宣告', '葬儀屋を呼べ', '診断は絶望的', '治療不可能',
  '末期だ', '末期症状', '末期的だ', '末期寸前',
  'こん睡状態', '昏睡状態', '植物状態だ', '植物状態にして',
  // JA 解体 / 廃棄処分 / 工業
  '廃車にして', '廃車処分', 'スクラップにして',
  'スクラップ場へ', '鉄屑にして', '屑鉄にして',
  'くず鉄にして', '廃棄処分', '産廃にして',
  '粗大ゴミにして', '粗大ごみに出して', '燃えないゴミにして',
  '解体屋に売って', 'バラして売って', '部品取りにして',
  '部品取りに出して', '実験台にして', '試作品を廃棄',
  '型を壊して', '鋳型を壊して', '焼却炉に入れて',
  '焼却して', '溶鉱炉に投げて', '溶かしてしまえ',
  '製鉄所送り', '資源ゴミにして', '圧縮して捨てて',
  '裁断して', 'シュレッダーにかけて',
  'シュレッダーで切り刻んで', '粉砕機にかけて',
  '破砕して', '破砕機へ', '廃品回収に出して',
  '回収業者に渡して', '解体業者に渡して', '消却して',
  '燃やして処分', '消毒して捨てて', '隔離して捨てて',
  '除去作業', '撤去作業', '塩漬けにして捨てて',
  '封印して捨てて', '地中に封じて', '永久凍土に埋めて',
  // JA 寿命 / 見限り / 処分判断
  'もうだめだ', 'だめになった', '寿命だ', '寿命がきた',
  '寿命を迎えて', '尽きた', '天寿を全うして',
  '天寿を全うさせて', '役目を終えて', '使命を終えて',
  'お役目を終えて', '役割を終えて', '放棄しよう',
  '諦めようと思う', '処分しかない', '処分しかないだろう',
  'もう処分だ', '処分時期だ', '要らなくなった',
  'もう不要', '用済みになった', '役目終了', '使命終了',
];

const pins = [
  ['do not resuscitate', 'negate'],        // don't-command stays a negation
  ['mercy killing', 'close-tab'],          // established literal
  ['pull the plug on it', 'close-tab'],    // established literal
  ['scrap it', 'close-tab'],               // established literal
  ['解体して', 'close-tab'],               // established literal
  ['見捨てて', 'close-tab'],               // established literal
];

describe('tanzanite atom sweep — close-tab literals', () => {
  test.each(closeTab.map(p => [p]))('routes %s to close-tab', (p) => {
    expect(key(p)).toBe('close-tab');
  });
});

describe('tanzanite atom sweep — established pins hold', () => {
  test.each(pins)('routes %s to %s', (p, k) => {
    expect(key(p)).toBe(k);
  });
});
