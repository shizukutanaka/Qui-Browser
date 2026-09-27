// -*- coding: utf-8 -*-
// Round 116 (Session 190): frame-residue atoms.
//  JA て受益残置VIII (くれんかね/くれますかねえ/もらってよろしいか/もらいますか/
//    はくれませんか/おきませんか/おきますか/しまおうかな/ちゃうかな/
//    ちゃってもよろしい/もろて系/結構ですか/構いませんか/くれないものか)
//  JA dict 条件・引用残置 (ことか/ことなんだけど/ってことで/ということで…/
//    のならば/のであったら/んだったら系)
//  JA ものと意図 (ことにしようかな/ことにした方がいい/というわけにはいかない/
//    のが筋ではないだろうか/ことにします/ものとする/ものと思います/がよい)
//  JA ものか → negate (rhetorical refusal, もんか precedent)
//  EN modal II (what about we / would it hurt to / would it kill you to /
//    is there a chance you could / can you be bothered to / manage to /
//    even / actually / i take it you can / i assume you can /
//    are you able to / capable of / is it possible you could /
//    might it be possible to)

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

describe('て受益残置VIII', () => {
  KEY('閉じてくれんかね', 'close-tab');
  KEY('閉じてくれますかねえ', 'close-tab');
  KEY('閉じてもらってよろしいか', 'close-tab');
  KEY('閉じてもらいますか', 'close-tab');
  KEY('閉じておいていただけると', 'close-tab');
  KEY('閉じてはくれませんか', 'close-tab');
  KEY('閉じてはくれないか', 'close-tab');
  KEY('閉じておきませんか', 'close-tab');
  KEY('閉じておきますか', 'close-tab');
  KEY('閉じてしまおうかな', 'close-tab');
  KEY('閉じてくれないものか', 'close-tab');
  KEY('閉じて結構ですか', 'close-tab');
  KEY('閉じて構いませんか', 'close-tab');
  KEY('戻ってくれんかね', 'back');
  KEY('読んでくれますかねえ', 'read-aloud');
  KEY('戻ってはくれませんか', 'back');
  KEY('読んではくれないか', 'read-aloud');
});

describe('ちゃ残置・関西もろて', () => {
  KEY('閉じちゃうかな', 'close-tab');
  KEY('閉じちゃってもよろしいですか', 'close-tab');
  KEY('閉じてもろてええか', 'close-tab');
  KEY('閉じてもろてよろしいか', 'close-tab');
  KEY('読んでもろて', 'read-aloud');
  KEY('戻っちゃうかな', 'back');
});

describe('dict 条件・引用残置', () => {
  KEY('閉じることか', 'close-tab');
  KEY('閉じることなんだけど', 'close-tab');
  KEY('閉じるってことで', 'close-tab');
  KEY('閉じるってことですか', 'close-tab');
  KEY('閉じるということで', 'close-tab');
  KEY('閉じるということでよろしいですか', 'close-tab');
  KEY('閉じるものなら', 'close-tab');
  KEY('閉じるのならば', 'close-tab');
  KEY('閉じるのであったら', 'close-tab');
  KEY('閉じるんだったら早く', 'close-tab');
  KEY('閉じるんだったらね', 'close-tab');
  KEY('戻るってことで', 'back');
  KEY('読むのならば', 'read-aloud');
  KEY('戻るんだったらね', 'back');
});

describe('ものと意図・判定残置', () => {
  KEY('閉じることにしようかな', 'close-tab');
  KEY('閉じることにした方がいい', 'close-tab');
  KEY('閉じるというわけにはいかない', 'close-tab');
  KEY('閉じるのが筋ではないだろうか', 'close-tab');
  KEY('閉じることにします', 'close-tab');
  KEY('閉じることに致します', 'close-tab');
  KEY('閉じるものとする', 'close-tab');
  KEY('閉じるものとします', 'close-tab');
  KEY('閉じるものと思います', 'close-tab');
  KEY('閉じるものと考えます', 'close-tab');
  KEY('閉じるがよい', 'close-tab');
  KEY('閉じるがよろしい', 'close-tab');
  KEY('戻ることにします', 'back');
  KEY('読むものとする', 'read-aloud');
  KEY('戻るがよい', 'back');
});

describe('ものか拒否・わけにはいかない否定維持', () => {
  KEY('閉じるものかな', 'negate');   // ものか = もんか rhetorical refusal
  KEY('閉じるものか', 'negate');
  KEY('戻るものかな', 'negate');
  KEY('閉じるわけにはいくまい', 'negate'); // まい refusal stays
});

describe('EN modal II', () => {
  KEY('what about we close it', 'close-tab');
  KEY('would it hurt to close it', 'close-tab');
  KEY('would it kill you to close it', 'close-tab');
  KEY('is there a chance you could close it', 'close-tab');
  KEY('is there any chance you could close it', 'close-tab');
  KEY('can you be bothered to close it', 'close-tab');
  KEY('could you be bothered to close it', 'close-tab');
  KEY('can you manage to close it', 'close-tab');
  KEY('could you manage to close it', 'close-tab');
  KEY('can you even close it', 'close-tab');
  KEY('could you even close it', 'close-tab');
  KEY('can you actually close it', 'close-tab');
  KEY('i take it you can close it', 'close-tab');
  KEY('i assume you can close it', 'close-tab');
  KEY('are you able to close it', 'close-tab');
  KEY('are you capable of closing it', 'close-tab');
  KEY('is it possible you could close it', 'close-tab');
  KEY('might it be possible to close it', 'close-tab');
  KEY('should we go back', 'back');
  KEY('would it hurt to go back', 'back');
  KEY('are you able to read it', 'read-aloud');
});

describe('R116 回帰不変条件', () => {
  KEY('first tab', 'first-tab');
  KEY('it reopened', 'reopen-tab');
  KEY('i want my money back', null);
  KEY('閉じるもんか', 'negate');
  KEY('閉じるべきかな', 'help');
  KEY('is it possible to close it', 'help');
  KEY('あとで閉じて', 'defer');
  KEY('元に戻して', 'reopen-tab');
  KEY('あとどのくらい', 'remaining-time');
  KEY('閉じて', 'close-tab');
  KEY('how about it', null);
});
