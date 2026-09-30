// dict形+接続尾・させて依頼尾・EN/JA相槌拡充テスト（pass XLVII）
const VC = require('../src/vr/input/VoiceCommands').VoiceCommands;
function mk() {
  const vc = new VC({ enabled: true });
  const calls = [];
  const tm = {
    tabs: [{ currentTitle: 'T', currentUrl: 'https://x', pinned: false }],
    activeIndex: 0,
    getActiveTab() { return this.tabs[this.activeIndex]; },
    setActive(i) { calls.push(['setActive', i]); this.activeIndex = i; },
    closeTab(i) { calls.push(['closeTab', i]); return true; },
    closeAllTabs() { calls.push(['closeAllTabs']); return this.tabs.length; },
    nextTab() { calls.push(['nextTab']); },
    prevTab() { calls.push(['prevTab']); },
    togglePin(i) { calls.push(['togglePin', i]); },
    moveTabToStart(i) { calls.push(['moveTabToStart', i]); return true; },
    moveTabToEnd(i) { calls.push(['moveTabToEnd', i]); return true; }
  };
  const said = [];
  vc.speak = (t) => said.push(t);
  vc.connectBrowser({ tabManager: tm, onGoTo: () => calls.push(['goTo']) });
  return { vc, tm, calls, said };
}
function run(p) {
  const { vc, calls, said } = mk();
  vc.processCommand(p);
  return { key: vc.lastCommand ? vc.lastCommand.key : null, calls, said };
}
const KEY = (phrase, k) => test(phrase, () => expect(run(phrase).key).toBe(k));

describe('dict形+接続尾 → て形', () => {
  KEY('閉じるか', 'close-tab');
  KEY('読むか', 'read-aloud');
  KEY('閉じるの', 'close-tab');
  KEY('読むの', 'read-aloud');
  KEY('閉じるけど', 'close-tab');
  KEY('読むけど', 'read-aloud');
  KEY('閉じるし', 'close-tab');
  KEY('読むし', 'read-aloud');
  KEY('閉じるから', 'close-tab');
  KEY('読むから', 'read-aloud');
  KEY('閉じるんや', 'close-tab');
  KEY('読むんや', 'read-aloud');
  KEY('戻るんや', 'back');
  KEY('閉じるんだ', 'close-tab');
  KEY('読むんだ', 'read-aloud');
  KEY('読むじゃ', 'read-aloud');
  KEY('閉じるじゃ', 'close-tab');
});
describe('まい 否定意志 → negate（実害修正: 戻るまい が実行していた）', () => {
  KEY('閉じるまい', 'negate');
  KEY('読むまい', 'negate');
  KEY('戻るまい', 'negate');
  test('戻るまい does not navigate', () => {
    const { calls } = run('戻るまい');
    expect(calls).not.toContainEqual(['goTo']);
  });
});
describe('させて-依頼尾', () => {
  KEY('閉じさせてくれ', 'close-tab');
  KEY('読ませてくれ', 'read-aloud');
  KEY('戻らせてくれ', 'back');
  KEY('閉じさせてもらう', 'close-tab');
  KEY('読ませてもらう', 'read-aloud');
  KEY('閉じさせていただけないか', 'close-tab');
});
describe('繰り返し・頻度句', () => {
  KEY('何度も読んで', 'read-aloud');
  KEY('もっかい読んで', 'read-aloud');
  KEY('もいっかい読んで', 'read-aloud');
  KEY('ついでに読む', 'read-aloud');
  KEY('もっかい', 'repeat-command');
  KEY('もいっかい', 'repeat-command');
  KEY('もういっかい', 'repeat-command');
  KEY('もう一度だけ', 'repeat-command');
  KEY('もう一回だけ', 'repeat-command');
});
describe('命令・敬語命令形', () => {
  KEY('閉じれ', 'close-tab');
  KEY('止まれ', 'stop-everything');
  KEY('やまれ', 'stop-everything');
  KEY('とまれ', 'stop-everything');
  KEY('ご覧なさい', 'describe-tab');
  KEY('お戻りなさい', 'back');
  KEY('お進みなさい', 'navigate');
});
describe('別れ・終了句 → vr-exit', () => {
  KEY('じゃあね', 'vr-exit');
  KEY('ばいばい', 'vr-exit');
  KEY('さようなら', 'vr-exit');
  KEY('またね', 'vr-exit');
  KEY('また後で', 'vr-exit');
  KEY('お疲れさま', 'vr-exit');
  KEY('終わり', 'vr-exit');
  KEY('終わります', 'vr-exit');
  KEY('おしまい', 'vr-exit');
  KEY('しゅうりょう', 'vr-exit');
  KEY('see ya', 'vr-exit');
  KEY('later', 'vr-exit');
  KEY('peace', 'vr-exit');
  KEY('peace out', 'vr-exit');
  KEY('bye bye', 'vr-exit');
  KEY('adios', 'vr-exit');
  KEY('ciao', 'vr-exit');
  KEY('ta ta', 'vr-exit');
  KEY('toodles', 'vr-exit');
  KEY('im out', 'vr-exit');
});
describe('JA 了解・同意・感嘆 → ack', () => {
  KEY('承知', 'ack');
  KEY('承知しました', 'ack');
  KEY('かしこまり', 'ack');
  KEY('畏まりました', 'ack');
  KEY('合点', 'ack');
  KEY('合点承知', 'ack');
  KEY('御意', 'ack');
  KEY('よろしい', 'ack');
  KEY('そうだ', 'ack');
  KEY('そうだよ', 'ack');
  KEY('そうなの', 'ack');
  KEY('そうなんですね', 'ack');
  KEY('そのとおり', 'ack');
  KEY('その通り', 'ack');
  KEY('ほんそれ', 'ack');
  KEY('ほんまそれ', 'ack');
  KEY('まさに', 'ack');
  KEY('正に', 'ack');
  KEY('そうそう', 'ack');
  KEY('うんうん', 'ack');
  KEY('へえ', 'ack');
  KEY('ほう', 'ack');
  KEY('さすが', 'ack');
  KEY('やった', 'ack');
  KEY('いい感じ', 'ack');
  KEY('いいじゃん', 'ack');
  KEY('あざます', 'ack');
  KEY('あざっす', 'ack');
  KEY('どうもありがとう', 'ack');
  KEY('めっちゃありがとう', 'ack');
  KEY('感謝', 'ack');
  KEY('感謝します', 'ack');
});
describe('EN 相槌・フィラー → ack', () => {
  KEY('ya got it', 'ack');
  KEY('yer good', 'ack');
  KEY('gotcha covered', 'ack');
  KEY('right on', 'ack');
  KEY('rock on', 'ack');
  KEY('way to go', 'ack');
  KEY('attaboy', 'ack');
  KEY('bravo', 'ack');
  KEY('umm', 'ack');
  KEY('um', 'ack');
  KEY('err', 'ack');
  KEY('uhh', 'ack');
  KEY('uh', 'ack');
  KEY('ah', 'ack');
  KEY('oh', 'ack');
  KEY('ahh', 'ack');
});
describe('依頼前置詞・困惑 → help', () => {
  KEY('お願いします', 'help');
  KEY('お願いしますよ', 'help');
  KEY('よろしく', 'help');
  KEY('よろしくお願いします', 'help');
  KEY('どうぞ', 'help');
  KEY('どうぞよろしく', 'help');
  KEY('わかんない', 'help');
  KEY('わかりません', 'help');
  KEY('わかりませんでした', 'help');
  KEY('どうしたら', 'help');
});
describe('稼働・状態確認', () => {
  KEY('生きてる', 'working-status');
  KEY('いきてる', 'working-status');
  KEY('動作してます', 'working-status');
  KEY('動いてます', 'working-status');
  KEY('働いてる', 'working-status');
  KEY('whats going on', 'working-status');
  KEY('whats the status', 'working-status');
  KEY('whats the state', 'working-status');
  KEY('hows it looking', 'working-status');
  KEY('how are things', 'working-status');
  KEY('ya hear me', 'mic-status');
  KEY('dya hear me', 'mic-status');
});
describe('keep 系の誤ルート修正（negate keep-it 正規表現が所有していた）', () => {
  KEY('keep it up', 'resume-reading');
  KEY('keep it going', 'resume-reading');
  KEY('keep it rolling', 'resume-reading');
  KEY('keep at it', 'resume-reading');
  KEY('press on', 'resume-reading');
  KEY('move along', 'resume-reading');
  KEY('carry on with it', 'resume-reading');
  KEY('continue on', 'resume-reading');
});
describe('過去形質問 → status（実行しない）', () => {
  KEY('did it mute', 'mute-status');
  KEY('did it go mute', 'mute-status');
  KEY('did it get muted', 'mute-status');
  KEY('did i pin it', 'pin-status');
  KEY('did i pin this', 'pin-status');
  KEY('is it saved', 'bookmark-status');
  KEY('did it save', 'bookmark-status');
  KEY('did it bookmark', 'bookmark-status');
});
describe('EN 強否定・どうでも → negate', () => {
  KEY('nah bruh', 'negate');
  KEY('nah dude', 'negate');
  KEY('no can do', 'negate');
  KEY('no dice', 'negate');
  KEY('negative ghostrider', 'negate');
  KEY('most certainly not', 'negate');
  KEY('whatever', 'negate');
  KEY('whatever dude', 'negate');
  KEY('ok whatever', 'negate');
  KEY('doesnt matter', 'negate');
  KEY('doesnt matter anymore', 'negate');
  KEY('forget everything', 'negate');
});
describe('音量・その他', () => {
  KEY('bump it up', 'volume-up');
  KEY('bump it down', 'volume-down');
});
describe('共存ガード', () => {
  KEY('読んで', 'read-aloud');
  KEY('閉じて', 'close-tab');
  KEY('戻って', 'back');
  KEY('keep going', 'resume-reading');
  KEY('go back', 'back');
  KEY('close the tab', 'close-tab');
  KEY('戻るな', 'negate');
  KEY('turn it up', 'volume-up');
});
