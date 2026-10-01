// pass CCXCI sweep: EN courtroom/verdict + eviction/deportation/firing idioms,
// JA 立ち退き/退去 + 解雇/クビ + 裁判/判決 frames, plus coexistence pins.
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
  // EN courtroom/verdict
  'court is adjourned', 'the verdict is in', 'the court finds you guilty',
  'guilty as charged', 'throw the book at it', 'summary judgment',
  'overruled', 'i rest my case', 'rest my case on it', 'plea denied',
  'appeal denied', 'bailiff take it away', 'leave the courtroom',
  'court recessed',
  // EN eviction / deportation / property seizure
  'serve the eviction', 'deport it', 'repossess it', 'foreclose on it',
  'eminent domain', 'squatter rights denied', 'its being towed',
  'tow it away', 'condemned building', 'seized property',
  'pack your bags tab', 'out of my house',
  // EN firing / termination
  'fire that tab', 'pink slip', 'get the axe', 'it is let go',
  'youre fired tab', 'laid off', 'severance for it', 'its been terminated',
  'it is canned', 'pack it up and out', 'force it out', 'golden parachute',
  // JA 立ち退き / 退去
  '立ち退き命令', '退去命令', '強制退去', '追い出し立件',
  '不法占拠を解消', '占拠解消', '撤去して', '家を出ていけ',
  '不法侵入者を追い出して', '立ちのけ',
  // JA 解雇 / クビ
  '解雇して', 'クビにして', '首にして', '首切りして', '馘首して',
  '馘にして', '首を切って', 'リストラして', '役職を外して',
  '免職して', '罷免して', '懲戒解雇', '即時解雇', '解雇通知',
  'ピンクスリップ', 'お前はクビだ', '首宣告', '解雇宣告', '馘首宣告',
  // JA 裁判 / 判決
  '有罪', '判決を下せ', '判決を下して', '判決出て', '評決を下して',
  '禁固刑', '刑に処す', '絞首刑', '判決は有罪', '退廷', '退廷して',
  '閉廷', '休廷', '結審', '審議終了', '証拠提出終わり', '審理終了',
  '控訴棄却', '上告棄却', '棄却して', '却下して', '訴状不受理',
  '起訴して', '召喚状', '差押え', '強制執行', '実刑', '極刑', '重罪',
  '罪名', '判決言い渡し', '言い渡せ', '言い渡して',
];

const pins = [
  ['let it go', 'negate'],            // retract-request, not a close command
  ['can it', 'stop-everything'],      // established pin (収拾/停止)
];

const nullPins = [
  // ambiguous — no disposal intent or unresolved outcome
  'order in the court', 'contempt of court', 'hung jury on it',
];

describe('rhodonite atom sweep — close-tab literals', () => {
  test.each(closeTab.map(p => [p]))('routes %s to close-tab', (p) => {
    expect(key(p)).toBe('close-tab');
  });
});

describe('rhodonite atom sweep — established pins hold', () => {
  test.each(pins)('routes %s to %s', (p, k) => {
    expect(key(p)).toBe(k);
  });
});

describe('rhodonite atom sweep — null pins stay unrouted', () => {
  test.each(nullPins.map(p => [p]))('does not route %s', (p) => {
    expect(key(p)).toBeNull();
  });
});
