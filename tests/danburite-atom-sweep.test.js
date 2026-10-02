/**
 * Voice atoms CCCIX — festival & fair-end idioms (EN)
 * + 祭りのあと/屋台畳み/撤去 (JA). The fireworks ending / stalls
 * folding closes the tab. Festival-start and keep-enjoying stay out.
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

const closeTab = [
  // --- fireworks / finale ---
  'fireworks done', 'fireworks ended', 'last firework',
  'grand finale done', 'finale faded', 'sky went dark',
  'embers faded', 'smoke cleared', 'last sparkler out',
  'sparklers burned out', 'bottle rocket done',
  'pyrotechnics over', 'show in the sky ended',
  // --- fair / carnival teardown ---
  'festival over', 'the festival is over', 'fair is over',
  'fair closed', 'carnival packed up', 'carnival left town',
  'midway closed', 'rides shut down', 'rides stopped',
  'ferris wheel stopped', 'carousel stopped', 'merry go round off',
  'fairgrounds empty', 'fairground cleared', 'gates closed at the fair',
  'ticket booth closed', 'booths packed up', 'stalls folded',
  'vendors gone home', 'food trucks left', 'corn dogs sold out',
  'big top came down', 'circus left town', 'circus packed up',
  'tent folded', 'tents came down', 'marquee came down',
  'stage dismantled', 'stage hands struck', 'bunting taken down',
  // --- parade / party end ---
  'parade passed', 'parade ended', 'last float gone',
  'balloons deflated', 'confetti swept', 'streamers down',
  'party favors done', 'piñata broken', 'pinata broken',
  'cake is gone', 'candles blown out', 'blow out the candles',
  'music stopped playing', 'dance floor emptied', 'last dance',
  'lights came on', 'house lights up', 'everyone went home',
  'last call was made', 'bartender closed', 'keg tapped out',
];

const closeTabJa = [
  // --- 祭りのあと ---
  '祭りが終わって', '祭り終了', '祭りのあと', '祭りの終わり',
  'お祭り終了', '夏祭り終了', '花火大会終了', '花火が終わって',
  '打ち上げ終了', '最後の花火', 'フィナーレ', 'フィナーレです',
  '空が暗くなって', '煙が消えて', '余韻が消えて',
  // --- 屋台畳み ---
  '屋台を畳んで', '屋台が畳んで', '屋台撤収', '夜店終わり',
  '夜店が閉まって', '出店終了', '出店を畳んで', '売店を畳んで',
  '提灯を下ろして', '紅白幕を外して', '看板を下ろして',
  '売り切れ終了', '品切れ終了', 'たこ焼き売り切れ',
  '金魚すくい終了', '輪投げ終了', '射的終了',
  // --- 撤去/片付け ---
  '撤去', '撤去作業', '撤収完了', '片付けが終わって',
  '後片付け完了', '跡地', '跡を片付けて', '会場を畳んで',
  '会場撤収', 'テントを畳んで', 'テント撤収', 'ステージを解体して',
  '舞台を解体して', '観覧車停止', '観覧車が止まって',
  'メリーゴーランド停止', '回転木馬が止まって',
  'パレード終了', '行列が通り過ぎて', '神輿を下ろして',
  '神社の祭り終了', '境内が静まって', '山車をしまって',
  '太鼓が止まって', '囃子が止まって', '踊りが終わって',
];

const negate = [
  'keep the festival going', 'stay for the fireworks',
  'the party continues', 'still at the fair', '祭りを続けて',
  'まだ祭り中', '花火はまだ続く',
];

const nullPins = [
  // festival start / going = setup, not ending
  'festival begins', 'gates open', 'fair opens', 'buy tickets',
  'first ride', 'parade starts', '祭りが始まって',
  '屋台を見て回る', '縁日', '盆踊り',
];

const establishedPins = [
  ['撤去して', 'close-tab'],
  ['祭りに行く', 'go-to'],
  ['花火を見に行く', 'go-to'],
];

describe('Voice atoms CCCIX — festival & fair-end idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
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
