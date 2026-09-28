import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function run(phrase) {
  const vc = new VoiceCommands({ enabled: true });
  const calls = [];
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
  vc.speak = () => {};
  vc.processCommand(phrase, 0.9);
  return { key: vc.lastCommand ? vc.lastCommand.key : null };
}
const KEY = (phrase, k) => test(phrase, () => expect(run(phrase).key).toBe(k));

describe('EN disposal verbs II (get-rid/dispose/destroy)', () => {
  KEY('get this out of here', 'close-tab');
  KEY('get this tab out of here', 'close-tab');
  KEY('get this thing out of here', 'close-tab');
  KEY('get rid of it', 'close-tab');
  KEY('get rid of this thing', 'close-tab');
  KEY('rid me of this tab', 'close-tab');
  KEY('dispose of it', 'close-tab');
  KEY('dispose of this tab', 'close-tab');
  KEY('dispose of the tab', 'close-tab');
  KEY('destroy it', 'close-tab');
  KEY('destroy this tab', 'close-tab');
  KEY('obliterate it', 'close-tab');
});

describe('EN toss/yeet/get-shut dialect', () => {
  KEY('toss the tab', 'close-tab');
  KEY('toss this tab', 'close-tab');
  KEY('yeet the tab', 'close-tab');
  KEY('get shut of it', 'close-tab');
  KEY('get shot of it', 'close-tab');
});

describe('EN be-through/be-done + finish-off/polish', () => {
  KEY('be through with it', 'close-tab');
  KEY('be through with this', 'close-tab');
  KEY('be done with this', 'close-tab');
  KEY('be done with the tab', 'close-tab');
  KEY('finish it off', 'close-tab');
  KEY('finish the tab off', 'close-tab');
  KEY('finish off the tab', 'close-tab');
  KEY('polish it off', 'close-tab');
  KEY('polish off the tab', 'close-tab');
});

describe('EN close-up phrasal + bye forms', () => {
  // 'close up (the|this) tab' は by-name 確立ピン（'up this'/'up the' をタブ名捕捉）
  KEY('close it up', 'close-tab');
  KEY('say bye to the tab', 'close-tab');
  KEY('wave goodbye to the tab', 'close-tab');
  KEY('kiss it goodbye', 'close-tab');
  KEY('kiss the tab goodbye', 'close-tab');
});

describe('EN slang discourse prefixes II', () => {
  KEY('no cap close it', 'close-tab');
  KEY('real talk close it', 'close-tab');
  KEY('for real close it', 'close-tab');
  KEY('not gonna lie close it', 'close-tab');
  KEY('lmao close it', 'close-tab');
  KEY('lmaooo close it', 'close-tab');
  KEY('lmfao close it', 'close-tab');
  KEY('im telling you close it', 'close-tab');
  KEY('istg close it', 'close-tab');
  KEY('i swear close it', 'close-tab');
});

describe('EN close-all purgers', () => {
  KEY('purge the tabs', 'close-all-tabs');
  KEY('purge all tabs', 'close-all-tabs');
  KEY('purge all the tabs', 'close-all-tabs');
  KEY('finish it all off', 'close-all-tabs');
  KEY('finish them all off', 'close-all-tabs');
  KEY('clean out the tabs', 'close-all-tabs');
  KEY('empty the tabs', 'close-all-tabs');
  KEY('clear out the tabs', 'close-all-tabs');
});

describe('JA 方言・依頼残置 IV', () => {
  KEY('閉じちょいて', 'close-tab');
  KEY('閉じてみるわ', 'close-tab');
  KEY('閉じてもええんやない', 'close-tab');
  KEY('閉じてもかまへん', 'close-tab');
  KEY('閉じるにかぎる', 'close-tab');
  KEY('閉じろっちゅうの', 'close-tab');
  KEY('閉じなはれや', 'close-tab');
  KEY('閉じたもれ', 'close-tab');
  KEY('閉じちゃおうぜ', 'close-tab');
  KEY('閉じちゃおうわ', 'close-tab');
  KEY('閉じちゃった方が', 'close-tab');
  KEY('閉じちまえよ', 'close-tab');
  KEY('閉じしまえ', 'close-tab');
  KEY('閉じてもらおうか', 'close-tab');
  KEY('閉じとこっか', 'close-tab');
  KEY('閉じときなはれ', 'close-tab');
  KEY('閉じときや', 'close-tab');
  KEY('閉じってば', 'close-tab');
});

describe('JA dict 名詞尾 XXXIII (妥当・順当・どおり)', () => {
  KEY('閉じるのが妥当です', 'close-tab');
  KEY('閉じるのが順当です', 'close-tab');
  KEY('閉じるのが適切です', 'close-tab');
  KEY('閉じるのが筋です', 'close-tab');
  KEY('閉じるのが正攻法です', 'close-tab');
  KEY('閉じるのが定石どおり', 'close-tab');
  KEY('閉じるのが王道どおり', 'close-tab');
  KEY('閉じるのが正攻法どおり', 'close-tab');
  KEY('閉じるのが常套どおり', 'close-tab');
  KEY('閉じるのが賢明どおり', 'close-tab');
});

describe('確立ピン・意図スキップ維持', () => {
  KEY('閉じまへん', 'negate');
  KEY('閉じまいな', 'negate');
  KEY('閉じしまいな', 'negate'); // まい volitional-negative 優先（'閉じしまいな' は曖昧のため拒否側へ）
  KEY('shut her down', null);
  KEY('close her up', null);
  KEY('閉じてんか', 'describe-tab'); // 進行質問 '閉じているのか' → 状態問いは正当
  KEY('close up the tab', 'close-tab-by-name');
  KEY('close up this tab', 'close-tab-by-name');
  KEY('no cap', null); // bare discourse marker must not fire alone
});
