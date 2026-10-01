// pass CCXC sweep: EN exorcism/ghost + card-table surrender idioms,
// JA お祓い/悪霊退散/除霊 + 降参/投了/白旗 frames, plus coexistence pins.
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
  // EN exorcism/ghost
  'banish the spirit', 'cast out the spirit', 'be gone spirit',
  'release the spirit', 'banish the ghost', 'exorcise this demon',
  'drive out the demons', 'lay the ghost', 'lay it to rest finally',
  'rest in pieces', 'spook it away', 'no more haunting', 'unhaunt it',
  'haunt no more',
  // EN card-table surrender / quitting
  'fold the hand', 'fold this hand',
  'cash out', 'cash me out', 'cash it out', 'cash out now',
  'deal me out', 'deal me out of this', 'count me out',
  'im out of this hand', 'ante up and out', 'i quit this one',
  'throw in the cards', 'throw the hand in', 'walk away from the table',
  'leave the table', 'leave the game',
  // JA お祓い/悪霊退散/除霊
  'お祓いして', 'おはらいして', '悪霊退散', '悪霊払って',
  '悪魔を払って', '悪魔払い', '退魔して', '退治して', '成敗して',
  '呪いを解いて', '呪い解いて', '除霊して', '浄化して',
  '清めて', 'お清めして', 'お清めを', 'お経をあげて',
  'お鎮め', '祟り退治', 'まじないをかけて',
  // JA 降参/投了/白旗
  '降参だ', '降参にしよう', '降参します', '投了します', '投了だ',
  'ギブだ', '負けを認めて', '負けました', '降ります', '降りる',
  '降りていい', 'フォールド', 'フォールドする', '離脱します',
  'ドロップアウト', 'ドロップしよう', '白旗を上げて', '白旗だ',
  '白旗を振って', 'とどめを刺して', 'とどめを刺せ',
  'トドメを刺して', '止めを刺して', 'フィナーレ'
];

const closeAllTabs = ['全員撤退', '撤退開始', '総撤退', '一斉撤収', '一斉撤退'];

describe('pass CCXC — exorcism/surrender atoms', () => {
  test.each(closeTab)('close-tab: %s', (p) => {
    expect(key(p)).toBe('close-tab');
  });
  test.each(closeAllTabs)('close-all-tabs: %s', (p) => {
    expect(key(p)).toBe('close-all-tabs');
  });
  test('presence-state report -> describe-tab', () => {
    expect(key('the ghost is gone')).toBe('describe-tab');
  });
  test('calling it quits -> stop-everything (call it quits twin)', () => {
    expect(key('calling it quits')).toBe('stop-everything');
    expect(key('call it quits')).toBe('stop-everything');
  });
});

describe('pass CCXC — coexistence pins', () => {
  test.each([
    ['参った', 'trouble'],
    ['まいった', 'trouble'],
    ['ギブアップ', 'trouble'],
    ['fold', 'close-tab'],
    ['fold em', 'close-tab'],
    ['i fold', 'close-tab'],
    ['fold it', 'close-tab'],
    ['game over man', 'close-tab'],
    ['checkmate the tab', 'close-tab'],
    ['ghost it', 'close-tab'],
    ['exorcise it', 'close-tab'],
    ['供養してくれ', 'close-tab'],
    ['消し去って', 'close-tab'],
    ['鎮めて', 'close-tab'],
    ['退場します', 'close-tab'],
    ['幕を閉じよう', 'close-tab'],
    ['お開きだ', 'close-tab'],
    ['撤収しよう', 'close-tab'],
    ['成仏して', 'close-tab'],
    ['go into the light', 'close-tab']
  ])('pin %s -> %s', (p, k) => {
    expect(key(p)).toBe(k);
  });
});
