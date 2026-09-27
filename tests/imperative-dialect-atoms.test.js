// JA 命令・方言残層 + EN 前置/タグ・俗語 テスト（pass XLIX）
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

describe('dict形+終助詞（よな/べ/のう/やろ/がいい/に限る/んちゃう）', () => {
  KEY('閉じるよな', 'close-tab');
  KEY('閉じるべ', 'close-tab');
  KEY('読むべ', 'read-aloud');
  KEY('閉じるのう', 'close-tab');
  KEY('読むのう', 'read-aloud');
  KEY('閉じるやろ', 'close-tab');
  KEY('読むやろ', 'read-aloud');
  KEY('閉じるがいい', 'close-tab');
  KEY('読むがいい', 'read-aloud');
  KEY('閉じるに限る', 'close-tab');
  KEY('閉じるんちゃう', 'close-tab');
});
describe('語幹命令（なはれ/やれ/がてら/や）・引用って', () => {
  KEY('閉じなはれ', 'close-tab');
  KEY('読みなはれ', 'read-aloud');
  KEY('閉じやれ', 'close-tab');
  KEY('閉じがてら', 'close-tab');
  KEY('読みがてら', 'read-aloud');
  KEY('閉じや', 'close-tab');
  KEY('読みや', 'read-aloud');
  KEY('かたがた閉じて', 'close-tab');
  KEY('閉じろって', 'close-tab');
  KEY('閉じろってば', 'close-tab');
});
describe('条件・ておく残り・義務', () => {
  KEY('読めばいいのに', 'read-aloud');
  KEY('閉じればいいのに', 'close-tab');
  KEY('閉じりゃいい', 'close-tab');
  KEY('閉じちゃえば', 'close-tab');
  KEY('読んじゃえば', 'read-aloud');
  KEY('閉じとけば', 'close-tab');
  KEY('読んどけば', 'read-aloud');
  KEY('閉じときゃ', 'close-tab');
  KEY('読みときゃ', 'read-aloud');
  KEY('閉じとき', 'close-tab');
  KEY('閉じときな', 'close-tab');
  KEY('閉じとこか', 'close-tab');
  KEY('閉じたほうがええ', 'close-tab');
  KEY('閉じなくちゃ', 'close-tab');
  KEY('読まなくちゃ', 'read-aloud');
  KEY('閉じねば', 'close-tab');
  KEY('読まねば', 'read-aloud');
  KEY('閉じずには', 'close-tab');
  KEY('閉じないとね', 'close-tab');
  KEY('閉じんと', 'close-tab');
  KEY('読まんと', 'read-aloud');
});
describe('て形末口語（ぇ/やあ/くれや/といてや）', () => {
  KEY('閉じてぇ', 'close-tab');
  KEY('読んでぇ', 'read-aloud');
  KEY('閉じてやあ', 'close-tab');
  KEY('読んでやあ', 'read-aloud');
  KEY('閉じてくれや', 'close-tab');
  KEY('読んでくれや', 'read-aloud');
  KEY('閉じといてや', 'close-tab');
});
describe('否定・不可能 → negate', () => {
  KEY('閉じらんね', 'negate');
  KEY('読めんね', 'negate');
  KEY('閉じられへん', 'negate');
  KEY('読まれへん', 'negate');
  KEY('読めへん', 'negate');
  KEY('消せへん', 'negate');
  KEY('閉じてへんの', 'close-tab');
  KEY('読んでへんの', 'read-aloud');
  KEY('閉じるもんか', 'negate');
  KEY('読むもんか', 'negate');
  KEY('閉じるわけない', 'negate');
  KEY('閉じるわけ', 'ack');
});
describe('EN 前置詞・タグ質問・語尾', () => {
  KEY('could we close it', 'close-tab');
  KEY('can we go back', 'back-status');
  KEY('why dont you close it', 'close-tab');
  KEY('why not close it', 'close-tab');
  KEY('hows about closing it', 'close-tab');
  KEY('do us a favor and close it', 'close-tab');
  KEY('i need you to close it', 'close-tab');
  KEY('i want you to close it', 'close-tab');
  KEY('id like you to close it', 'close-tab');
  KEY('dont forget to close it', 'close-tab');
  KEY('make sure to close it', 'close-tab');
  KEY('be sure to close it', 'close-tab');
  KEY('remember to close it', 'close-tab');
  KEY('try and close it', 'close-tab');
  KEY('try to close it', 'close-tab');
  KEY('just close it', 'close-tab');
  KEY('simply close it', 'close-tab');
  KEY('go ahead and close it', 'close-tab');
  KEY('feel free to close it', 'close-tab');
  KEY('help me close it', 'close-tab');
  KEY('oh close it', 'close-tab');
  KEY('well close it', 'close-tab');
  KEY('say close it', 'close-tab');
  KEY('listen close it', 'close-tab');
  KEY('alright close it', 'close-tab');
  KEY('thanks close it', 'close-tab');
  KEY('cheers close it', 'close-tab');
  KEY('mate close it', 'close-tab');
  KEY('first close it', 'close-tab');
  KEY('also close it', 'close-tab');
  KEY('close it would you', 'close-tab');
  KEY('close it will you', 'close-tab');
  KEY('close it eh', 'close-tab');
  KEY('close it yeah', 'close-tab');
  KEY('close it real quick', 'close-tab');
  KEY('close it quick', 'close-tab');
  KEY('close it real fast', 'close-tab');
  KEY('close it for us', 'close-tab');
  KEY('close it please thanks', 'close-tab');
  KEY('close it now', 'close-tab');
  KEY('close it then', 'close-tab');
  KEY('close it first', 'close-tab');
  KEY('close it again', 'close-tab');
  KEY('close it once more', 'close-tab');
  KEY('close it already', 'close-tab');
  KEY('close it and', 'close-tab');
});
describe('EN 俗語 close/stop・否定・状況句', () => {
  KEY('kill it', 'close-tab');
  KEY('axe it', 'close-tab');
  KEY('trash it', 'close-tab');
  KEY('bin it', 'close-tab');
  KEY('ditch it', 'close-tab');
  KEY('dump it', 'close-tab');
  KEY('yeet it', 'close-tab');
  KEY('off it', 'close-tab');
  KEY('do away with it', 'close-tab');
  KEY('done with it', 'close-tab');
  KEY('over it', 'close-tab');
  KEY('through with it', 'close-tab');
  KEY('finished with it', 'close-tab');
  KEY('wrap it up', 'stop-everything');
  KEY('wrap up', 'stop-everything');
  KEY('enough of that', 'stop-everything');
  KEY('cut it out', 'stop-everything');
  KEY('cut that out', 'stop-everything');
  KEY('knock it off', 'stop-everything');
  KEY('pack it in', 'stop-everything');
  KEY('nevermind that', 'negate');
  KEY('scratch it', 'negate');
  KEY('nix that', 'negate');
  KEY('nix it', 'negate');
  KEY('as you were', 'resume-reading');
  KEY('keep going with it', 'resume-reading');
  KEY('stick with it', 'resume-reading');
  KEY('stay on it', 'resume-reading');
  KEY('still open', 'describe-tab');
  KEY('still reading', 'speaking-status');
  KEY('still working on it', 'working-status');
  KEY('still at it', 'working-status');
  KEY('already closed it', 'ack');
  KEY('already did it', 'ack');
});
describe('共存ガード', () => {
  KEY('閉じて', 'close-tab');
  KEY('読んで', 'read-aloud');
  KEY('戻って', 'back');
  KEY('close the tab', 'close-tab');
  KEY('go back', 'back');
  KEY('閉じるな', 'negate');
  KEY('keep it up', 'resume-reading');
  KEY('leave it', 'negate');
  KEY('forget it', 'negate');
  KEY('dont do that', 'negate');
  KEY('never mind', 'negate');
  KEY('call it quits', 'stop-everything');
  KEY('thats enough', 'stop-everything');
  KEY('戻れへん', 'back-status');
});
