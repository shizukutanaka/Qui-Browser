import { VoiceCommands } from '../src/vr/input/VoiceCommands.js';

function run(phrase) {
  const vc = new VoiceCommands({ enabled: true });
  const tm = {
    activeTabId: 't1',
    tabs: [
      { id: 't1', title: 'X', url: 'https://x' },
      { id: 't2', title: 'Y', url: 'https://y' },
      { id: 't3', title: 'Z', url: 'https://z' },
    ],
    getActiveTab() { return this.tabs[0]; },
    closeAllTabs() { return 1; },
    closeTab() {},
    pinTab() {},
    closeOtherTabs() {},
  };
  vc.connectBrowser({ tabManager: tm, onGoTo: () => {} });
  vc.speak = () => {};
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}
const KEY = (phrase, k) => test(phrase, () => expect(run(phrase)).toBe(k));

describe('EN throw-out disposal IV', () => {
  KEY('toss this', 'close-tab');
  KEY('bin this thing', 'close-tab');
  KEY('chuck it out', 'close-tab');
  KEY('toss it overboard', 'close-tab');
  KEY('fling it out', 'close-tab');
  KEY('hurl it out', 'close-tab');
  KEY('sling it out', 'close-tab');
  KEY('jettison it', 'close-tab');
  KEY('jettison the tab', 'close-tab');
  KEY('send it off', 'close-tab');
  KEY('send it away', 'close-tab');
  KEY('ship it off', 'close-tab');
  KEY('axe this one', 'close-tab');
  KEY('zap this tab', 'close-tab');
  KEY('tear this down', 'close-tab');
});

describe('EN stash/away/destroy-this disposal', () => {
  KEY('tuck this away', 'close-tab');
  KEY('stash this', 'close-tab');
  KEY('purge the tab', 'close-tab');
  KEY('wipe this tab', 'close-tab');
  KEY('delete this page', 'close-tab');
  KEY('bounce this', 'close-tab');
  KEY('boot this', 'close-tab');
  KEY('eject this', 'close-tab');
  KEY('close this sucker', 'close-tab');
  KEY('close this puppy', 'close-tab');
  KEY('be rid of it', 'close-tab');
  KEY('good riddance to this tab', 'close-tab');
});

describe('EN forceful-shut / give-the-X disposal', () => {
  KEY('shut it for good', 'close-tab');
  KEY('close it for good', 'close-tab');
  KEY('slam it shut', 'close-tab');
  KEY('snap it shut', 'close-tab');
  KEY('slap it shut', 'close-tab');
  KEY('weld it shut', 'close-tab');
  KEY('seal it shut', 'close-tab');
  KEY('fold it away', 'close-tab');
  KEY('fold this up', 'close-tab');
  KEY('wrap this thing up', 'close-tab');
  KEY('wrap up the tab', 'close-tab');
  KEY('roll this up', 'close-tab');
  KEY('deep six this tab', 'close-tab');
  KEY('86 this tab', 'close-tab');
  KEY('86 this thing', 'close-tab');
  KEY('give it the axe', 'close-tab');
  KEY('give it the boot', 'close-tab');
  KEY('give it the heave-ho', 'close-tab');
  KEY('shut it completely', 'close-tab');
  KEY('close it entirely', 'close-tab');
  KEY('close it fully', 'close-tab');
  KEY('fully close the tab', 'close-tab');
  KEY('be done with this tab', 'close-tab');
});

describe('EN exasperation prefixes', () => {
  KEY('for the love of god close it', 'close-tab');
  KEY('for gods sake close it', 'close-tab');
  KEY('for petes sake close it', 'close-tab');
  KEY('for crying out loud close it', 'close-tab');
  KEY('jeez close it', 'close-tab');
  KEY('gah close it', 'close-tab');
  KEY('ugh close it', 'close-tab');
  KEY('omg close it', 'close-tab');
  KEY('wtf close it', 'close-tab');
  KEY('fucking close it', 'close-tab');
  KEY('god damn close it', 'close-tab');
  KEY('jesus christ close it', 'close-tab');
  KEY('holy hell close it', 'close-tab');
  KEY('oh for fucks sake close it', 'close-tab');
  KEY('for fucks sake close it', 'close-tab');
  KEY('damn it close it', 'close-tab');
  KEY('dammit close it', 'close-tab');
});

describe('EN wh-request & time frames', () => {
  KEY('whenever youre ready close it', 'close-tab');
  KEY('sometime today close it', 'close-tab');
  KEY('why wont you close it', 'trouble'); // 確立ピン: wh-neg complaint form
  KEY('why cant you close it', 'trouble'); // 確立ピン（relay-obligation 等で固定済み）
  KEY('why couldnt you close it', 'trouble');
  KEY('why wouldnt you close it', null); // 未カバー — trouble pin は wont/cant のみ
});

describe('JA 方言・依頼残置 VI', () => {
  KEY('閉じとくれやす', 'close-tab');
  KEY('閉じてちょー', 'close-tab');
  KEY('閉じるがよか', 'close-tab');
  KEY('閉じたらいいがな', 'close-tab');
  KEY('閉じてもらうがいい', 'close-tab');
  KEY('閉じるのがよいぞ', 'close-tab');
  KEY('閉じたらいいと思うけどな', 'close-tab');
  KEY('閉じるといいんじゃないかな', 'close-tab');
  KEY('閉じるとええな', 'close-tab');
  KEY('閉じてしまってもいいでしょう', 'close-tab');
  KEY('閉じてしまっていいんでしょ', 'close-tab');
  KEY('閉じてしまってもいいんじゃない', 'close-tab');
  KEY('閉じてもいいよな', 'close-tab');
  KEY('閉じてもいいかなあ', 'close-tab');
  KEY('閉じてもいいんか', 'close-tab');
  KEY('閉じてええんかな', 'close-tab');
  KEY('閉じてもいいものか', 'close-tab');
  KEY('閉じときさい', 'close-tab');
  KEY('閉じといておくれ', 'close-tab');
  KEY('閉じといてくれたら', 'close-tab');
  KEY('閉じといてくれれば', 'close-tab');
  KEY('閉じといてくれるかな', 'close-tab');
  KEY('閉じといてほしいなあ', 'close-tab');
  KEY('閉じときますなあ', 'close-tab');
  KEY('閉じとこかなあ', 'close-tab');
  KEY('閉じときゃあ', 'close-tab');
  KEY('閉じときゃええんちゃう', 'close-tab');
  KEY('閉じたらどうよ', 'close-tab');
  KEY('閉じたらええやんか', 'close-tab');
  KEY('閉じたらええがな', 'close-tab');
  KEY('閉じるべきじゃないか', 'close-tab'); // rhetorical should-not→execute
  KEY('閉じるべきかも', 'close-tab');
  KEY('閉じるのもいいかも', 'close-tab');
});

describe('JA dict 推奨・選択尾 XXXV', () => {
  KEY('閉じるのが良い選択です', 'close-tab');
  KEY('閉じるのがいい選択だ', 'close-tab');
  KEY('閉じるのが最適解だ', 'close-tab');
  KEY('閉じるのが最善の選択', 'close-tab');
  KEY('閉じるのがもっとも良い', 'close-tab');
  KEY('閉じるのが一番良い', 'close-tab');
  KEY('閉じるのがベストな選択', 'close-tab');
  KEY('閉じるのがおすすめ', 'close-tab');
  KEY('閉じるのをおすすめします', 'close-tab');
  KEY('閉じるのを推奨します', 'close-tab');
  KEY('閉じることを推奨', 'close-tab');
  KEY('閉じることが望ましい', 'close-tab');
  KEY('閉じることが良い', 'close-tab');
  KEY('閉じることをおすすめ', 'close-tab');
  KEY('閉じることが適切です', 'close-tab');
  KEY('閉じることが妥当です', 'close-tab');
  KEY('閉じることが一番です', 'close-tab');
  KEY('閉じることがベストです', 'close-tab');
  KEY('閉じることが最善です', 'close-tab');
  KEY('閉じることが得策です', 'close-tab');
  KEY('閉じることが正解です', 'close-tab');
  KEY('閉じることが上策です', 'close-tab');
  KEY('閉じることが良いですね', 'close-tab');
  KEY('閉じるほうが良いですね', 'close-tab');
  KEY('閉じるほうがいいかもな', 'close-tab');
  KEY('閉じるほうがましだ', 'close-tab');
  KEY('閉じるほうが得です', 'close-tab');
  KEY('閉じるほうがお得です', 'close-tab');
  KEY('閉じるほうがよさげ', 'close-tab');
  KEY('閉じるほうがよさそう', 'close-tab');
  KEY('閉じるほうが良さげだ', 'close-tab');
  KEY('閉じるのが妥当だと思う', 'close-tab');
  KEY('閉じるのが得策でしょうね', 'close-tab');
  KEY('閉じるのが賢いかも', 'close-tab');
  KEY('閉じるのもいいかも', 'close-tab');
});

describe('確立ピン・意図スキップ維持', () => {
  KEY('call it a day', 'stop-everything'); // 確立ピン: quit for today
  KEY('murk it', null); // niche slang
  KEY('write it off', null); // accounting idiom
  KEY('gut it', null); // gut = disembowel/contents ambiguous
  KEY('wreck it', null); // damage ambiguous
  KEY('smash it', null); // smash it = do great
  KEY('crush it', null); // crush it = do great
  KEY('murder it dead', null); // redundant emphasis
  KEY('vanish this', null); // grammatical stretch
  KEY('make it poof', null);
  KEY('poof it', null);
  KEY('begone tab', null); // archaic address
  KEY('be gone tab', null);
  KEY('hit the bricks', null); // speaker leaves
  KEY('hang it up', null); // retire ambiguous
  KEY('hang this tab up', null);
  KEY('leave the tab', null); // keep-open reading
  KEY('drop it like its hot', null); // meme
  KEY('flush it', null); // toilet idiom ambiguous
  KEY('burn it down', null); // arson ambiguous
  KEY('for good close it', null); // unnatural order
  KEY('batten it down', null); // nautical hatch
  KEY('閉じぬこ', null); // rare southern
  KEY('閉じるべきでは', 'negate'); // shouldn't-close incomplete → negate
});
