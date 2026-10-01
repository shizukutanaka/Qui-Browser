const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

// pass CCLXXXVIII: EN military/schoolhouse dismissal + closing-time idioms,
// JA お暇/解散/本締め/畳み frames; brightness & dismiss-notify misroute fixes.
function makeVc() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    tabs: [{ title: 'Example Page' }],
    closeTab: () => {},
  });
  return vc;
}
function route(vc, p) {
  vc.lastCommand = null;
  vc.processCommand(p, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

describe('larimar atom sweep — EN dismissal/finale idioms', () => {
  const vc = makeVc();
  const cases = [
    'dismissed close it', 'you are dismissed close it',
    'class is over close it', 'meeting adjourned close it',
    'the meeting is adjourned close it', 'stand down close it',
    'at ease close it', 'retreat close it', 'fall out close it',
    'lights off close it', 'curtains close it', 'shutters close it',
    'roll up the sidewalks close it', 'last orders close it',
    'drinks up close it', 'closing time close it', 'wrap party close it',
    'strike the set close it', 'house lights close it',
    'the fat lady sang close it', 'show over close it',
    'credits rolled close it', 'episode over close it',
    'session expired close it', 'party is over close it',
    'kick everyone out close it', 'empty the room close it',
    'shut the place down', 'shut down the shop',
    'raid over close it', 'mission complete close it',
    'debrief done close it', 'dismiss the troops close it',
    'go home now close it', 'everyone out close it',
    'out you go close it', 'get out close it',
    'turn off the lights on it',
  ];
  test.each(cases)('%s → close-tab', (p) => {
    expect(route(vc, p)).toBe('close-tab');
  });
});

describe('larimar atom sweep — JA お暇/解散/本締め/畳み frames', () => {
  const vc = makeVc();
  const cases = [
    'お暇だ', 'お暇にして', 'お暇にする', 'お暇をとる', '暇をとる',
    'ご免いただく', 'ご免で', '暇いただき', '失礼する', '席を外す',
    '席を立つ', '撤去する',
    '本締めだ', '本締めにして', '本締めにする', '締めにして',
    'おしまいにしよう', '解散する', '解散にする', '解散しよう',
    '退散する', '退散しよう', '閉廷にする', '閉廷する', '閉廷とする',
    '終演にする', '終演する', '閉幕にする', '閉幕する', '閉幕とする',
    '幕を降ろす', '打ち上げにする', '納会だ', '納会にする', '納会とする',
    '切り上げる', '切り上げて', '切り上げだ', '切り上げにする',
    '畳みにする', 'お仕舞いにする', '打ち切りにする', '仕舞いにする',
    '閉じろ閉じろ', '閉じちゃえ閉じちゃえ', 'もう消せ', '消えろ消えろ',
    '消えてしまえ', '消えてしまえよ', 'お役御免にする', '御免だ',
    '任務終了', '任務終わり', '任務を終える', '作戦終了', '作戦終わり',
    '訓練終了',
  ];
  test.each(cases)('%s → close-tab', (p) => {
    expect(route(vc, p)).toBe('close-tab');
  });
});

describe('larimar atom sweep — established pins stay intact', () => {
  const vc = makeVc();
  const cases = [
    ['消して', 'dismiss-notify'],
    ['通知を消して', 'dismiss-notify'],
    ['lights on', 'brightness'],
    ['lights on for the room', 'brightness'],
    ['畳んで', 'close-all-tabs'],
    ['curtain call', null],
    ['まだ閉じてない', null],
    ['close it', 'close-tab'],
    ['elvis has left the building', 'close-tab'],
  ];
  test.each(cases)('%s → %s', (p, k) => {
    expect(route(vc, p)).toBe(k);
  });
});
