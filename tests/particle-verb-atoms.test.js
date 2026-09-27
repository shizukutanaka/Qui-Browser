// dict+終助詞・語幹命令・方言進行・EN 句動詞/縮約 テスト（pass XLVIII）
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

describe('dict形+終助詞（わ/のよ/かしら/さ/って/んだって）', () => {
  KEY('閉じるわ', 'close-tab');
  KEY('読むわ', 'read-aloud');
  KEY('閉じるかしら', 'close-tab');
  KEY('読むかしら', 'read-aloud');
  KEY('閉じるのよ', 'close-tab');
  KEY('読むのよ', 'read-aloud');
  KEY('閉じるんだって', 'close-tab');
  KEY('読むんだって', 'read-aloud');
  KEY('閉じるって', 'close-tab');
  KEY('読むってば', 'read-aloud');
  KEY('閉じてって', 'close-tab');
  KEY('読むさ', 'read-aloud');
  KEY('閉じるさ', 'close-tab');
});
describe('語幹命令形（たまえ/給え/やがれ/やす/なよ）', () => {
  KEY('閉じたまえ', 'close-tab');
  KEY('読みたまえ', 'read-aloud');
  KEY('閉じ給え', 'close-tab');
  KEY('読み給え', 'read-aloud');
  KEY('閉じやがれ', 'close-tab');
  KEY('閉じやす', 'close-tab');
  KEY('閉じなよ', 'close-tab');
  KEY('読みなよ', 'read-aloud');
});
describe('てしまう短縮・とく・てって', () => {
  KEY('閉じちまえ', 'close-tab');
  KEY('読んじまえ', 'read-aloud');
  KEY('閉じちまった', 'close-tab');
  KEY('閉じちまう', 'close-tab');
  KEY('閉じちゃうわ', 'close-tab');
  KEY('閉じてしまえ', 'close-tab');
  KEY('閉じとくわ', 'close-tab');
});
describe('方言進行尾 → status/て形', () => {
  KEY('閉じとるよ', 'describe-tab');
  KEY('閉じとった', 'describe-tab');
  KEY('閉じちょる', 'describe-tab');
  KEY('閉じちゅう', 'describe-tab');
  KEY('読みちゅう', 'speaking-status');
  KEY('閉じより', 'describe-tab');
});
describe('過去形+んです・意向+かな', () => {
  KEY('閉じたんだ', 'close-tab');
  KEY('読んだんです', 'read-aloud');
  KEY('閉じようかな', 'close-tab');
  KEY('閉じましょうかな', 'close-tab');
  KEY('閉じとこうかな', 'close-tab');
});
describe('EN 補充動詞・縮約前置詞', () => {
  KEY('supposed to close it', 'close-tab');
  KEY('fixing to close', 'close-tab');
  KEY('about to close', 'close-tab');
  KEY('feel like closing it', 'close-tab');
  KEY('in the mood to read', 'read-aloud');
  KEY('how bout closing it', 'close-tab');
  KEY('what about closing it', 'close-tab');
  KEY('wouldja close it', 'close-tab');
  KEY('couldja read it', 'read-aloud');
  KEY('wontcha close it', 'close-tab');
  KEY('needa close it', 'close-tab');
  KEY('hafta read it', 'read-aloud');
  KEY('tryna close it', 'close-tab');
  KEY('tryin to close', 'close-tab');
  KEY('trying to close', 'close-tab');
  KEY('finna close', 'close-tab');
  KEY('shoulda closed it', 'close-tab');
  KEY('coulda saved it', 'bookmark-page');
  KEY('please kindly close it', 'close-tab');
  KEY('if you could close it', 'close-tab');
  KEY('if you would close it', 'close-tab');
});
describe('EN g-drop・句動詞・使役', () => {
  KEY('closin it', 'close-tab');
  KEY('readin it', 'read-aloud');
  KEY('goin back', 'back');
  KEY('workin', 'working-status');
  KEY('going back', 'back');
  KEY('close it for me', 'close-tab');
  KEY('read it for me', 'read-aloud');
  KEY('close it up', 'close-tab');
  KEY('close it off', 'close-tab');
  KEY('read it out', 'read-aloud');
  KEY('read it through', 'read-aloud');
  KEY('get it closed', 'close-tab');
  KEY('want it closed', 'close-tab');
  KEY('back it up', 'back');
  KEY('bring it back up', 'reopen-tab');
});
describe('EN 過去形質問 → status（実行しない）', () => {
  KEY('was it saved', 'bookmark-status');
  KEY('was it bookmarked', 'bookmark-status');
  KEY('was it muted', 'mute-status');
  KEY('was it pinned', 'pin-status');
  KEY('was i here before', 'history-latest');
  KEY('did i read this', 'history-latest');
  KEY('did i already save', 'bookmark-status');
  KEY('did it fail', 'trouble');
  KEY('did it load', 'describe-tab');
  KEY('did it open', 'describe-tab');
  KEY('did it close', 'describe-tab');
  KEY('is it open', 'describe-tab');
});
describe('不確実・思考句 → ack / negate / help', () => {
  KEY('not sure', 'ack');
  KEY('kinda not', 'ack');
  KEY('dunno', 'ack');
  KEY('beats me', 'ack');
  KEY('who knows', 'ack');
  KEY('hard to say', 'ack');
  KEY('cant tell', 'ack');
  KEY('no idea', 'ack');
  KEY('search me', 'ack');
  KEY('not really', 'negate');
  KEY('probably not', 'negate');
  KEY('doubt it', 'negate');
  KEY('i doubt it', 'negate');
  KEY('かも', 'ack');
  KEY('かもね', 'ack');
  KEY('かなあ', 'ack');
  KEY('だっけ', 'ack');
  KEY('だっけな', 'ack');
  KEY('だったかな', 'ack');
  KEY('どうだっけ', 'ack');
  KEY('何だったっけ', 'ack');
  KEY('わかるかな', 'help');
  KEY('忘れた', 'help');
  KEY('忘れちゃった', 'help');
  KEY('ど忘れ', 'help');
  KEY('思い出せない', 'help');
  KEY('覚えてない', 'help');
  KEY('わすれた', 'help');
});
describe('zoom/brightness 系', () => {
  KEY('zoom way in', 'reader-size-up');
  KEY('zoom way out', 'reader-size-down');
  KEY('unzoom', 'reader-scale-reset');
  KEY('dezoom', 'reader-scale-reset');
  KEY('zoom back', 'reader-scale-reset');
  KEY('zoom normal', 'reader-scale-reset');
  KEY('back to normal size', 'reader-scale-reset');
  KEY('light it up', 'brightness');
  KEY('darken it', 'brightness');
  KEY('dim it', 'brightness');
  KEY('dim the screen', 'brightness');
  KEY('brighten', 'brightness');
  KEY('too bright', 'brightness');
  KEY('way too bright', 'brightness');
  KEY('blinding', 'brightness');
  KEY('lights on', 'brightness');
  KEY('night time', 'dark-mode');
  KEY('turn on dark', 'dark-mode');
  KEY('lights out', 'dark-mode');
});
describe('共存ガード', () => {
  KEY('閉じて', 'close-tab');
  KEY('読んで', 'read-aloud');
  KEY('戻って', 'back');
  KEY('close the tab', 'close-tab');
  KEY('go back', 'back');
  KEY('閉じるな', 'negate');
  KEY('keep it up', 'resume-reading');
  KEY('zoom in', 'reader-size-up');
  KEY('zoom out', 'reader-size-down');
  KEY('zoom reset', 'reader-scale-reset');
  KEY('brightness', 'brightness');
  KEY('is it dark', 'brightness');
  KEY('dark mode', 'dark-mode');
  KEY('閉じるけど', 'close-tab');
  KEY('mute it', 'mute-toggle');
});
