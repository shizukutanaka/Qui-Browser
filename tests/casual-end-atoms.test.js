import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function run(phrase) {
  const vc = new VoiceCommands({ enabled: true });
  const calls = [];
  const said = [];
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'X', url: 'https://x' },
      { id: 't2', title: 'Y', url: 'https://y' },
      { id: 't3', title: 'Z', url: 'https://z' },
    ],
    getActiveTab() { return this.tabs[0]; },
    closeAllTabs() { calls.push('closeAllTabs'); return 1; },
    closeTab() { calls.push('closeTab'); },
    pinTab() { calls.push('pinTab'); },
    closeOtherTabs() { calls.push('closeOtherTabs'); },
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = (t) => said.push(t);
  vc.processCommand(phrase, 0.9);
  return { key: vc.lastCommand ? vc.lastCommand.key : null, calls, said };
}
const KEY = (phrase, k) => test(phrase, () => expect(run(phrase).key).toBe(k));

describe('EN カジュアル処分・end動詞層', () => {
  KEY('end it', 'close-tab');
  KEY('end this', 'close-tab');
  KEY('end the tab', 'close-tab');
  KEY('end it now', 'close-tab');
  KEY('end this thing', 'close-tab');
  KEY('off this', 'close-tab');
  KEY('off the tab', 'close-tab');
  KEY('done with this', 'close-tab');
  KEY('over this tab', 'close-tab');
  KEY('halt it', 'close-tab');
  KEY('cease it', 'close-tab');
});

describe('EN 俗語断裁動詞', () => {
  KEY('snip it', 'close-tab');
  KEY('snip the tab', 'close-tab');
  KEY('chop it', 'close-tab');
  KEY('chop the tab', 'close-tab');
  KEY('slice it', 'close-tab');
  KEY('murder it', 'close-tab');
  KEY('slay it', 'close-tab');
  KEY('smite it', 'close-tab');
  KEY('smite the tab', 'close-tab');
  KEY('cut the tab', 'close-tab');
});

describe('EN needs-to-go / time-to-close フレーム', () => {
  KEY('needs to go', 'close-tab');
  KEY('it needs to go', 'close-tab');
  KEY('has to go', 'close-tab');
  KEY('it gotta go', 'close-tab');
  KEY('time for it to go', 'close-tab');
  KEY('time to close it', 'close-tab');
  KEY('time to close this', 'close-tab');
  KEY('about time to close it', 'close-tab');
  KEY('go close it', 'close-tab');
  KEY('go and close it', 'close-tab');
  KEY('come close it', 'close-tab');
  KEY('bye tab', 'close-tab');
  KEY('goodbye tab', 'close-tab');
  KEY('goodbye to the tab', 'close-tab');
  KEY('say goodbye to the tab', 'close-tab');
});

describe('JA 方言依頼残置 (とくれ・おくれ・なよ/わよ)', () => {
  // '閉じんといて' 系は '閉じないでおいて' の拒否読みで negate に確立ピン済み (Round 107)
  KEY('閉じんとくれ', 'close-tab');
  KEY('閉じんとくれよ', 'close-tab');
  KEY('閉じとくれ', 'close-tab');
  KEY('閉じとくれよ', 'close-tab');
  KEY('閉じとくれな', 'close-tab');
  KEY('閉じておくれ', 'close-tab');
  KEY('閉じておくれよ', 'close-tab');
  KEY('閉じてなよ', 'close-tab');
  KEY('閉じてわよ', 'close-tab');
  KEY('閉じておらんか', 'close-tab');
});

describe('JA ちゃう残置・許可問いかけ', () => {
  KEY('閉じちゃうなら', 'close-tab');
  KEY('閉じちゃうなら早く', 'close-tab');
  KEY('閉じちゃったほうが', 'close-tab');
  KEY('閉じちゃったほうがいい', 'close-tab');
  KEY('閉じてもいいよね', 'close-tab');
  KEY('閉じていいでしょ', 'close-tab');
  KEY('閉じていいでしょう', 'close-tab');
  KEY('閉じてええよね', 'close-tab');
  KEY('閉じてええか', 'close-tab');
  KEY('閉じてええんちゃう', 'close-tab');
});

describe('JA dict 名詞尾 XXXI (規範・慣行)', () => {
  KEY('閉じるのが慣例です', 'close-tab');
  KEY('閉じるのが定式です', 'close-tab');
  KEY('閉じるのが既定です', 'close-tab');
  KEY('閉じるのが慣行です', 'close-tab');
  KEY('閉じるのが定跡です', 'close-tab');
  KEY('閉じるのが定説です', 'close-tab');
  KEY('閉じるのが原則です', 'close-tab');
  KEY('閉じるのが規範です', 'close-tab');
  KEY('閉じるのが準則です', 'close-tab');
  KEY('閉じるのが規約です', 'close-tab');
  KEY('閉じるのがルールです', 'close-tab');
  KEY('閉じるのがおきてです', 'close-tab');
});

describe('意図的未ルート (曖昧・話者解散・叙述)', () => {
  KEY('begone', null);
  KEY('scram', null);
  KEY('beat it', null);
  KEY('get lost', null);
  KEY('close off', null);
  KEY('shut off', null);
  KEY('shut out', null);
  KEY('cut that', null);
  KEY('stop the tab', null);
  KEY('閉じておるのに', null);
  KEY('閉じとるし', null);
});
