/**
 * Voice atoms CCCVI — bedtime / lights-out / night-end idioms (EN)
 * + 就寝/消灯/お休み (JA). Family routing:
 *   self-sleep ("I'm going to bed") -> sleep-mode (matches 寝る/おやすみ)
 *   light-extinction -> dark-mode (matches lights out) / brightness (JA 消灯)
 *   object-sleep ("put the tab to bed") -> close-tab
 *   staying-up forms -> negate; waking/deferral forms -> null.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const sleepMode = [
  // --- going to bed (self) ---
  'hit the sack', 'hitting the hay', 'off to bed', 'off to dreamland',
  'bedtime', 'time for bed', 'tuck in for the night', 'down for the night',
  'retire for the night', 'turning in', 'turn in early',
  'snooze it', 'catch some zzz', 'zzz it', 'saw logs', 'forty winks',
  'nod off', 'drift off', 'drifted off', 'count sheep',
  'night night', 'nighty night', 'nodding off to sleep', 'shut eye',
  'get some shut-eye', 'close my eyes', 'past my bedtime',
  'night cap', 'nightcap it',
  // --- taps / curfew / sundown ---
  'taps', 'taps played', 'bugle call taps',
  'sunset', 'sun is down', 'sun went down', 'sundown',
  'darkness falls', 'night falls', 'dusk settled', 'evening came',
  'curfew', 'curfew time', 'past curfew', 'cinderella time',
  'stroke of midnight', 'midnight struck', 'after hours',
  'the hour is late', 'witching hour',
  // --- pillow ritual (self) ---
  'fluff the pillow', 'pillow fluffed', 'pull the covers',
  'blanket pulled', 'under the covers', 'covers up',
  'warm the bed', 'bed warmed', 'eyes shut',
  // --- JA 就寝 ---
  '寝ましょう', '就寝', '就寝時間', '寝る時間', 'お休み', '晚安',
  '寝るとしよう', '床に就く', '床につく', '布団に入る', '布団にもぐる',
  '床につこう', '寝床に入って', '横になって', '横になります',
  'もう眠い', '眠くなった', '瞼が重い',
  '夢を見に行って', '夢の中へ', 'おやすみして', '眠りに落ちて',
  'ぐっすり寝て', '熟睡して', '一眠りして', '仮眠して',
  // --- JA 門限/夜更かし終了 ---
  '門限', '門限時間', '門限過ぎてる', '夜更かしはここまで',
  'もう夜遅い', '日が暮れた', '日が落ちた', '日没', '夕暮れ',
  '暮れなずむ', '夜のとばり', '宵闇', '真夜中', '夜中になった',
  '丑三つ時', '深夜です',
  'お布団を敷いて', '枕を整えて', '瞼を閉じて',
  '窓を閉めて眠る', '窓を閉めて寝る',
];

const darkMode = [
  // --- light-extinction (lights out family) ---
  'lights off', 'kill the lights', 'douse the lights',
  'extinguish the lights', 'dim the lights', 'black out the room',
  'curtains drawn', 'close the curtains', 'draw the blinds',
  'pull the shades', 'shutters closed',
];

const brightnessJa = [
  // --- JA 消灯/遮光 ---
  '消灯', '消灯時間', '照明を消して', 'ライトを消して',
  '明かりを消して', '灯りを消して', '火を消して', '灯を消して',
  'ランプを消して', '遮光カーテン',
  'カーテンを引いて', 'ブラインドを下ろして',
];

const closeTab = [
  // --- object-sleep: put the tab to bed ---
  'put it to bed', 'put the tab to bed', 'tuck it in',
  'rock it to sleep', 'sing it a lullaby', 'lullaby time',
];

const vrExit = ['one for the road'];

const negate = [
  'stay up', 'stay awake', 'keep the lights on', 'burn the midnight oil',
  'pull an all-nighter', '夜更かしして', 'まだ起きてる',
];

const nullPins = [
  // sleeping-on-it = deferral, not closing; waking forms = resumption
  'sleep on it', 'sleep on it first', 'wake me at dawn',
  'rise and shine', 'early to rise', 'morning person',
  'alarm set for six',
  '起きる', '目覚める', '朝寝坊', '寝坊した',
  '二度寝して', '朝まで寝かせて', '寝かせておいて',
];

const establishedPins = [
  ['寝る', 'sleep-mode'],
  ['寝ます', 'sleep-mode'],
  ['おやすみ', 'sleep-mode'],
  ['おやすみなさい', 'sleep-mode'],
  ['call it a night', 'sleep-mode'],
  ['hit the hay', 'sleep-mode'],
  ['turn in', 'sleep-mode'],
  ['put it to sleep', 'sleep-mode'],
  ['wake up', 'sleep-mode'],
  ['lights out', 'dark-mode'],
  ['暗くして', 'brightness'],
  ['寝ないで', 'negate'],
  ['眠い', 'trouble'],
  ['目覚まし', 'device-apps'],
  ['電気を消して', 'close-tab'],
  ['カーテンを閉めて', 'close-tab'],
  ['真っ暗にして', 'close-tab'],
  ['目を閉じて', 'close-tab'],
  ['sleep tight', 'close-tab'],
  ['play taps', 'close-tab'],
];

describe('Voice atoms CCCVI — bedtime & lights-out idioms', () => {
  test.each(sleepMode.map((p) => [p]))('"%s" -> sleep-mode', (p) => {
    expect(key(makeVC(), p)).toBe('sleep-mode');
  });
  test.each(darkMode.map((p) => [p]))('"%s" -> dark-mode', (p) => {
    expect(key(makeVC(), p)).toBe('dark-mode');
  });
  test.each(brightnessJa.map((p) => [p]))('"%s" -> brightness', (p) => {
    expect(key(makeVC(), p)).toBe('brightness');
  });
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(vrExit.map((p) => [p]))('"%s" -> vr-exit', (p) => {
    expect(key(makeVC(), p)).toBe('vr-exit');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
