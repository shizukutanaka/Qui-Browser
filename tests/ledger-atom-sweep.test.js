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

describe('EN eject/kill colloquial verbs III', () => {
  KEY('ice it', 'close-tab');
  KEY('ice this tab', 'close-tab');
  KEY('ice the tab', 'close-tab');
  KEY('smoke it', 'close-tab');
  KEY('smoke the tab', 'close-tab');
  KEY('can this tab', 'close-tab');
  KEY('can the tab', 'close-tab');
  KEY('86 it', 'close-tab');
  KEY('eighty-six it', 'close-tab');
  KEY('eighty six it', 'close-tab');
  KEY('deep-six it', 'close-tab');
  KEY('nix the tab', 'close-tab');
  KEY('scrub the tab', 'close-tab');
  KEY('see ya tab', 'close-tab');
  KEY('sack the tab', 'close-tab');
  KEY('terminate the tab', 'close-tab');
});

describe('EN put-away / boot-out disposal', () => {
  KEY('put it down', 'close-tab');
  KEY('put this tab down', 'close-tab');
  KEY('put this away', 'close-tab');
  KEY('tuck it away', 'close-tab');
  KEY('drop the tab', 'close-tab');
  KEY('boot it', 'close-tab');
  KEY('boot the tab', 'close-tab');
  KEY('eject it', 'close-tab');
  KEY('eject the tab', 'close-tab');
  KEY('bounce it', 'close-tab');
  KEY('bounce the tab', 'close-tab');
  KEY('send it packing', 'close-tab');
  KEY('pack it off', 'close-tab');
  KEY('kick it out', 'close-tab');
  KEY('kick the tab out', 'close-tab');
});

describe('EN roll/fold/collapse/strike disposal', () => {
  KEY('roll it up', 'close-tab');
  KEY('roll the tab up', 'close-tab');
  KEY('fold it up', 'close-tab');
  KEY('fold the tab', 'close-tab');
  KEY('collapse it', 'close-tab');
  KEY('collapse the tab', 'close-tab');
  KEY('strike it', 'close-tab');
  KEY('strike the tab', 'close-tab');
  KEY('be through with this tab', 'close-tab');
});

describe('EN close-all shop idioms', () => {
  KEY('close shop', 'close-all-tabs');
  KEY('shut shop', 'close-all-tabs');
  // 'shut up shop' は mute-toggle 'shut up' ピン先勝ちのため不登録
  KEY('close the shop', 'close-all-tabs');
  KEY('shut the shop', 'close-all-tabs');
});

describe('EN discourse-marker prefixes III', () => {
  KEY('on second thought close it', 'close-tab');
  KEY('bet close it', 'close-tab');
  KEY('say less close it', 'close-tab');
  KEY('word close it', 'close-tab');
  KEY('good looks close it', 'close-tab');
  KEY('straight up close it', 'close-tab');
  KEY('legit close it', 'close-tab');
  KEY('no lie close it', 'close-tab');
  KEY('dead serious close it', 'close-tab');
  KEY('i mean it close it', 'close-tab');
  KEY('i kid you not close it', 'close-tab');
  KEY('believe me close it', 'close-tab');
  KEY('trust me close it', 'close-tab');
  KEY('ok ok close it', 'close-tab');
  KEY('alright alright close it', 'close-tab');
  KEY('well then close it', 'close-tab');
  KEY('well now close it', 'close-tab');
  KEY('so then close it', 'close-tab');
  KEY('look here close it', 'close-tab');
  KEY('see here close it', 'close-tab');
  KEY('now listen close it', 'close-tab');
  KEY('hear me out close it', 'close-tab');
  KEY('check it close it', 'close-tab');
  KEY('heads up close it', 'close-tab');
  KEY('psst close it', 'close-tab');
  KEY('ahem close it', 'close-tab');
  KEY('excuse me close it', 'close-tab');
  KEY('pardon me close it', 'close-tab');
  KEY('one more thing close it', 'close-tab');
  KEY('also close it', 'close-tab');
  KEY('btw close it', 'close-tab');
  KEY('by the way close it', 'close-tab');
  KEY('oh and close it', 'close-tab');
  KEY('oh also close it', 'close-tab');
  KEY('and another thing close it', 'close-tab');
  KEY('in fact close it', 'close-tab');
  KEY('frankly close it', 'close-tab');
  KEY('honestly close it', 'close-tab');
  KEY('like for real close it', 'close-tab');
  KEY('promise close it', 'close-tab');
  KEY('come now close it', 'close-tab');
  KEY('now now close it', 'close-tab');
  KEY('there there close it', 'close-tab');
  KEY('yall close it', 'close-tab');
  KEY('ya wanna close it', 'close-tab');
});

describe('EN be-a-X vocative II', () => {
  KEY('be a lamb and close it', 'close-tab');
  KEY('be a peach and close it', 'close-tab');
  KEY('be a star and close it', 'close-tab');
  KEY('be a treasure and close it', 'close-tab');
  KEY('be a hero and close it', 'close-tab');
  KEY('be a good lad and close it', 'close-tab');
  KEY('be a good boy and close it', 'close-tab');
  KEY('be a good chap and close it', 'close-tab');
  KEY('be a mate and close it', 'close-tab');
});

describe('JA 方言・依頼残置 V', () => {
  KEY('閉じといてちょうだい', 'close-tab');
  KEY('閉じじゃお', 'close-tab');
  KEY('閉じときたい', 'close-tab');
  KEY('閉じたいし', 'close-tab');
  KEY('閉じたいんだけどな', 'close-tab');
  KEY('閉じた方がええんちゃう', 'close-tab');
  KEY('閉じた方がええんとちゃう', 'close-tab');
  KEY('閉じたらええんとちゃう', 'close-tab');
  KEY('閉じてええんちゃう', 'close-tab');
  KEY('閉じてもええんちゃう', 'close-tab');
  KEY('閉じてもろと', 'close-tab');
  KEY('閉じておくれはる', 'close-tab');
  KEY('閉じてみるで', 'close-tab');
  KEY('閉じてくれせんか', 'close-tab');
  KEY('閉じておくんなさい', 'close-tab');
  KEY('閉じておかれ', 'close-tab');
  KEY('閉じておいと', 'close-tab');
  KEY('閉じておけばええ', 'close-tab');
  KEY('閉じるがよろし', 'close-tab');
  KEY('閉じるがええ', 'close-tab');
  KEY('閉じてえ', 'close-tab');
  KEY('閉じんね', 'close-tab');
  KEY('閉じんせ', 'close-tab');
  KEY('閉じんさ', 'close-tab');
  KEY('閉じましょうぞ', 'close-tab');
  KEY('閉じるぞな', 'close-tab');
  KEY('閉じておくれい', 'close-tab');
  KEY('閉じてよかろ', 'close-tab');
  KEY('閉じるわい', 'close-tab');
  KEY('閉じるってんだよ', 'close-tab');
  KEY('閉じよっか', 'close-tab');
  KEY('閉じてええよ', 'close-tab');
  KEY('閉じなはり', 'close-tab');
});

describe('JA dict 名詞尾 XXXIV (ベスト/一番/最善/どおり)', () => {
  KEY('閉じるのがベストです', 'close-tab');
  KEY('閉じるのがベターです', 'close-tab');
  KEY('閉じるのがベストでしょう', 'close-tab');
  KEY('閉じるのがベターでしょう', 'close-tab');
  KEY('閉じるのがベストだ', 'close-tab');
  KEY('閉じるのがベターだ', 'close-tab');
  KEY('閉じるのが一番でしょう', 'close-tab');
  KEY('閉じるのが一番ですね', 'close-tab');
  KEY('閉じるのが一番かと', 'close-tab');
  KEY('閉じるのが最善でしょう', 'close-tab');
  KEY('閉じるのが最善ですね', 'close-tab');
  KEY('閉じるのが最善かと', 'close-tab');
  KEY('閉じるのが合理的です', 'close-tab');
  KEY('閉じるのが理にかなっています', 'close-tab');
  KEY('閉じるのが筋が通っています', 'close-tab');
  KEY('閉じるのが当然です', 'close-tab');
  KEY('閉じるのが至極当然です', 'close-tab');
});

describe('確立ピン・意図スキップ維持', () => {
  KEY('can it', 'stop-everything'); // 確立ピン: 'can it!' = やめろ
  KEY('call it quits', 'stop-everything'); // 確立ピン
  KEY('nix it', 'negate'); // 取消 semantics
  KEY('drop it', 'negate');
  KEY('scratch it', 'negate');
  KEY('on second thought', 'negate'); // standalone correction only
  KEY('scrub it', null); // cancel 曖昧
  KEY('lose it', null); // emotional
  KEY('bye felicia', null); // person-directed
  KEY('get gone', null); // speaker-dismissal
  KEY('fire the tab', null); // launch/dismiss ambiguous
  KEY('scratch the tab', null); // marginal
  KEY('閉じたる', 'describe-tab'); // progressive pin
  KEY('閉じるわけ', 'ack'); // reason-report pin
  KEY('閉じええよ', null); // nonexistent form
  KEY('shut up shop', 'mute-toggle'); // 'shut up' 確立ピンが先勝ち
});
