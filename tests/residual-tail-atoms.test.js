// JA 残留語尾・口語命令層 + EN 慣用句/修復句 テスト（pass L）
// 外部基準: 関西・九州・土佐方言尾（なあかん/てちょ/はって/たげて/ろや/
// よか/くれい/おくれ/ちゃい/てまう）、ておる系進行・命令、複合動詞
// （終わって/切って/まくって）、EN 'ought to'・do-強調・expletive
// infix ('the damn tab')・stop/quit/repair idiom 群。
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

describe('ちゃい/じゃい・ちゃう+終助詞（縮約完了→て/で）', () => {
  KEY('閉じちゃい', 'close-tab');
  KEY('読んじゃい', 'read-aloud');
  KEY('戻っちゃい', 'back');
  KEY('閉じちゃうよ', 'close-tab');
  KEY('閉じちゃうね', 'close-tab');
  KEY('閉じちゃうか', 'close-tab');
  KEY('読んじゃう', 'read-aloud');       // じゃ→で split (was '読んて' dead)
  KEY('読んじゃうよ', 'read-aloud');
  KEY('消しちゃい', 'dismiss-notify');   // 消して→dismiss-notify convention
});

describe('ておる/ておれ/ておこう（進行・命令・意向）', () => {
  KEY('閉じておる', 'describe-tab');    // →閉じてる (state report)
  KEY('読んでおる', 'speaking-status'); // →読んでる
  KEY('閉じておれ', 'close-tab');       // →閉じて (imperative)
  KEY('戻っておれ', 'back');
  KEY('閉じておこう', 'close-tab');     // →閉じて (volitional)
  KEY('読んでおこう', 'read-aloud');
});

describe('使役・敬語命令（させろ/なされ/たれ）', () => {
  KEY('閉じさせろ', 'close-tab');
  KEY('閉じさせよ', 'close-tab');
  KEY('読ませろ', 'read-aloud');
  KEY('閉じなされ', 'close-tab');
  KEY('読みなされ', 'read-aloud');
  KEY('閉じたれ', 'close-tab');
  KEY('閉じてみろ', 'close-tab');
  KEY('読んでみろ', 'read-aloud');
  KEY('閉じてみな', 'close-tab');
  KEY('読んでみな', 'read-aloud');
});

describe('方言依頼尾（たげて/てちょ/はって/ろや/よか/くれい/おくれ/らっしゃい）', () => {
  KEY('閉じたげて', 'close-tab');       // 九州 てあげて
  KEY('読んだげて', 'read-aloud');
  KEY('閉じてちょ', 'close-tab');       // 土佐 てちょ
  KEY('読んでちょ', 'read-aloud');
  KEY('閉じはって', 'close-tab');       // 関西 てはる縮約
  KEY('読んではって', 'read-aloud');
  KEY('閉じろや', 'close-tab');         // 関西 ろ+や
  KEY('閉じてよか', 'close-tab');       // 博多 てよか
  KEY('読んでよか', 'read-aloud');
  KEY('閉じてくれい', 'close-tab');     // くれい
  KEY('読んでくれい', 'read-aloud');
  KEY('閉じておくれ', 'close-tab');     // ておくれ
  KEY('読んでおくれ', 'read-aloud');
  KEY('閉じてやって', 'close-tab');
  KEY('閉じてらっしゃい', 'close-tab');
});

describe('義務・条件残り（なあかん/んとあかん/ときゃええ/ればええ/たらあ/たらどう/といい）', () => {
  KEY('閉じなあかん', 'close-tab');     // 関西 なければ
  KEY('閉じんとあかん', 'close-tab');
  KEY('読まなあかん', 'read-aloud');
  KEY('閉じときゃええ', 'close-tab');
  KEY('閉じればええ', 'close-tab');
  KEY('読めばええ', 'read-aloud');
  KEY('閉じたらあ', 'close-tab');
  KEY('読んだらあ', 'read-aloud');
  KEY('閉じたらどう', 'close-tab');
  KEY('閉じるといい', 'close-tab');
  KEY('閉じると', 'close-tab');
  KEY('読むと', 'read-aloud');
});

describe('複合動詞尾（終わって/終えて/切って/まくって/てまえ/てまう/てまい）', () => {
  KEY('読み終わって', 'read-aloud');    // →読んで
  KEY('読み終えて', 'read-aloud');
  KEY('読み切って', 'read-aloud');
  KEY('閉じ切って', 'close-tab');
  KEY('閉じ終わって', 'close-tab');
  KEY('閉じてまえ', 'close-tab');       // 関西 てまう
  KEY('閉じてまう', 'close-tab');
  KEY('閉じてまい', 'negate');         // raw /まい$/ wins — defensive
  KEY('閉じまくって', 'close-tab');
  KEY('読みまくって', 'read-aloud');
  KEY('戻り終わって', 'back');
});

describe('て形残尾（どいて/とけ/のう/たろ/だろ）', () => {
  KEY('読んどいて', 'read-aloud');      // どいて→で
  KEY('閉じどいて', 'close-tab');
  KEY('閉じとけ', 'close-tab');         // とけ 命令
  KEY('読んどけ', 'read-aloud');
  KEY('閉じのう', 'close-tab');         // 語幹+のう
  KEY('読みのう', 'read-aloud');
  KEY('閉じたろ', 'close-tab');         // たろ 意向
  KEY('読んだろ', 'read-aloud');
});

describe('くださった敬語・受益質問残り', () => {
  KEY('閉じてくださいよ', 'close-tab');
  KEY('閉じてくださいね', 'close-tab');
  KEY('読んでくださいよ', 'read-aloud');
  KEY('閉じてくれよ', 'close-tab');
  KEY('閉じてくれい', 'close-tab');
  KEY('閉じてくれんか', 'close-tab');   // くれん+か
  KEY('閉じてくれへんか', 'close-tab');
  KEY('読んでくれんか', 'read-aloud');
});

describe('EN 前置（ought to/do-強調/expletive）', () => {
  KEY('you ought to close it', 'close-tab');
  KEY('you oughta close it', 'close-tab');
  KEY('do close it', 'close-tab');
  KEY('do go back', 'back');
  KEY('close the damn tab', 'close-tab');
  KEY('close the stupid tab', 'close-tab');
  KEY('close the bloody tab', 'close-tab');
  KEY('read the damn thing', 'read-aloud');
});

describe('EN stop/quit 慣用句', () => {
  KEY('knock that off', 'stop-everything');
  KEY('cut it', 'stop-everything');
  KEY('quit it', 'stop-everything');
  KEY('quit that', 'stop-everything');
  KEY('cease', 'stop-everything');
  KEY('desist', 'stop-everything');
  KEY('halt', 'stop-everything');
  KEY('thatll do', 'stop-everything');
  KEY('that will do it', 'stop-everything');
  KEY('thats plenty', 'stop-everything');
  KEY('that is enough', 'stop-everything');
  KEY('no more of that', 'stop-everything');
  KEY('no more please', 'stop-everything');
  KEY('enough now', 'stop-everything');
  KEY('enough of this', 'stop-everything');
  KEY('stop doing that', 'stop-everything');
  KEY('wrap this up', 'stop-everything');
  KEY('can it', 'stop-everything');
});

describe('EN 停止 read/pause/exit 系', () => {
  KEY('quit reading', 'stop-reading');
  KEY('quit reading it', 'stop-reading');
  KEY('stop talking', 'stop-reading');
  KEY('shut up', 'mute-toggle');        // existing owner
  KEY('wait a minute', 'pause-reading');
  KEY('just a moment', 'pause-reading');
  KEY('hold on a minute', 'pause-reading');
  KEY('shut this down', 'vr-exit');
  KEY('shut that down', 'vr-exit');
  KEY('close up shop', 'close-all-tabs');
});

describe('EN 修復句（ASR repair → negate）', () => {
  KEY('wrong thing', 'negate');
  KEY('not what i meant', 'negate');
  KEY('thats not it', 'negate');
  KEY('not it', 'negate');
  KEY('not that one', 'negate');
  KEY('the wrong one', 'negate');
  KEY('wrong tab', 'negate');
  KEY('wrong page', 'negate');
  KEY('let it go', 'negate');
  KEY('i take it back', 'negate');
  KEY('you misheard', 'negate');
});

describe('EN read/close 補完', () => {
  KEY('read it out loud', 'read-aloud');
  KEY('read it aloud', 'read-aloud');
  KEY('read this out', 'read-aloud');
  KEY('read that out loud', 'read-aloud');
  KEY('read the thing', 'read-aloud');
  KEY('close this down', 'close-tab');
  KEY('close this up', 'close-tab');
  KEY('get rid of it', 'close-tab');
  KEY('get rid of this', 'close-tab');
  KEY('ditch this', 'close-tab');
  KEY('hows it look', 'describe-tab');
  KEY('how does it look', 'describe-tab');
});

describe('EN progress/remaining 質問', () => {
  KEY('almost there', 'reader-progress');
  KEY('nearly there', 'reader-progress');
  KEY('almost done', 'reader-progress');
  KEY('how much left', 'remaining-time');
  KEY('how much more', 'remaining-time');
  KEY('whats left', 'remaining-time');
  KEY('how much is left', 'remaining-time');
});

describe('共存（raw 優先・既存ルート維持）', () => {
  KEY('閉じちゃった', 'reopen-tab');    // accident report stays
  KEY('消えちゃった', 'reopen-tab');
  KEY('閉じちゃうわ', 'close-tab');     // うわ tail stays
  KEY('閉じてや', 'close-tab');
  KEY('閉じなさいよ', 'close-tab');
  KEY('閉じろよ', 'close-tab');
  KEY('閉じてる', 'describe-tab');
  KEY('読んでる', 'speaking-status');
  KEY('閉じろ', 'close-tab');
  KEY('読み上げろ', 'read-aloud');
  KEY('読み終わった', 'reader-progress'); // past report ≠ 終わって request
  KEY('quit', 'vr-exit');
  KEY('enough', 'stop-everything');
  KEY('take it back', 'reopen-tab');
  KEY('leave it alone', 'negate');
  KEY('cut it out', 'stop-everything');
  KEY('shut it down', 'vr-exit');
  KEY('shut it', 'close-tab');
  KEY('close up this tab', 'close-tab-by-name'); // by-name stays
  KEY('close all tabs', 'close-all-tabs');
  KEY('stop it', 'stop-reading');
  KEY('go on', 'resume-reading');
  KEY('how about it', null);            // vague — stays unmatched
  KEY('閉じるらしい', null);             // hearsay — not a request
  KEY('閉じくさい', null);               // adjective — not a request
});

// ===== R115 (Session 189): residual tail & judgment-frame atoms =====
// て敬語残置VII / ても許可残置 / 不能依頼質問 / dict 条件残置 / 判定残置 /
// べき質問→help / EN modal-we・possibility・wonder・gotta-way・possible-for-you.

describe('て敬語残置VII（くださいますかな/まいか・もらおう系）', () => {
  KEY('閉じてくださいますかな', 'close-tab');
  KEY('閉じてくださいますね', 'close-tab');
  KEY('閉じてくださいまいか', 'close-tab');  // negate 奪取から実行へ
  KEY('戻ってくださいますかな', 'back');
  KEY('読んでくださいますね', 'read-aloud');
  KEY('戻ってくださいまいか', 'back');
  KEY('閉じてもらおう', 'close-tab');
  KEY('閉じてもらいましょう', 'close-tab');
  KEY('閉じてもらうか', 'close-tab');
  KEY('戻ってもらおう', 'back');
  KEY('読んでもらいましょう', 'read-aloud');
  KEY('戻ってもらうか', 'back');
});

describe('ても許可残置（もいいっすか・ちゃってもいい）', () => {
  KEY('閉じてもいいっすか', 'close-tab');
  KEY('閉じてもええですか', 'close-tab');
  KEY('戻ってもいいっすか', 'back');
  KEY('読んでもええですか', 'read-aloud');
  KEY('閉じちゃってもいいですか', 'close-tab');
  KEY('閉じちゃってもよいですか', 'close-tab');
  KEY('閉じちゃってもいいっすか', 'close-tab');
  KEY('閉じちゃってもええですか', 'close-tab');
  KEY('戻っちゃってもいいですか', 'back');
  KEY('読んじゃってもいいですか', 'read-aloud');
});

describe('不能依頼質問（られませんか→て）', () => {
  KEY('閉じられませんかね', 'close-tab');
  KEY('閉じられませんかな', 'close-tab');
  KEY('閉じられませんか', 'close-tab');
  KEY('戻られませんかね', 'back');   // godan+られ融合: 戻り→戻って
  KEY('戻られませんか', 'back');
  KEY('読めませんかね', 'read-aloud'); // 読め→E_TE→読んで
  KEY('読めませんか', 'read-aloud');
});

describe('dict 条件残置・判定残置', () => {
  KEY('閉じるなら今', 'close-tab');
  KEY('閉じるならここ', 'close-tab');
  KEY('閉じるんなら', 'close-tab');
  KEY('閉じるんであれば', 'close-tab');
  KEY('閉じるのであれば早めに', 'close-tab');
  KEY('戻るなら今', 'back');
  KEY('戻るんなら', 'back');
  KEY('読むんであれば', 'read-aloud');
  KEY('閉じたほうがいいかもしれない', 'close-tab');
  KEY('戻ったほうがいいかもしれない', 'back');
  KEY('読んだほうがいいかもしれない', 'read-aloud');
  KEY('閉じるほうがいいかもしれない', 'close-tab');
});

describe('べき質問→help（判断質問・非実行）', () => {
  KEY('閉じるべきかな', 'help');
  KEY('閉じるべきですかね', 'help');
  KEY('閉じるべきでしょうか', 'help');
  KEY('戻るべきですかね', 'help');   // 戻る regex に べ lookahead 追加
  KEY('読むべきかな', 'help');
});

describe('EN modal-we / possibility / wonder frames', () => {
  KEY('should we close it', 'close-tab');
  KEY('ought we close it', 'close-tab');
  KEY('might we close it', 'close-tab');
  KEY('would we close it', 'close-tab');
  KEY('should we go back', 'back');
  KEY('might we read it', 'read-aloud');
  KEY('would you possibly close it', 'close-tab');
  KEY('might you possibly close it', 'close-tab');
  KEY('would you possibly go back', 'back');
  KEY('might you possibly read it', 'read-aloud');
  KEY('i wonder if you could close it', 'close-tab');
  KEY('i wonder if youd close it', 'close-tab');
  KEY("i wonder if you'd close it", 'close-tab');
  KEY('wondering if you could close it', 'close-tab');
  KEY('i wonder if you could go back', 'back');
  KEY('wondering if you could read it', 'read-aloud');
  KEY('i wonder if youd mind closing it', 'close-tab');
});

describe('EN gotta-way / possible-for-you frames', () => {
  KEY('theres gotta be a way to close it', 'close-tab');
  KEY("there's gotta be a way to close it", 'close-tab');
  KEY('theres gotta be a way to go back', 'back');
  KEY("there's gotta be a way to read it", 'read-aloud');
  KEY('is it possible for you to close it', 'close-tab');
  KEY('would it be possible for you to close it', 'close-tab');
  KEY('is it possible for you to go back', 'back');
  KEY('would it be possible for you to read it', 'read-aloud');
  KEY('is there any way to close it', 'help');   // capability → help
  KEY('is there any way to go back', 'help');
});

describe('R115 回帰不変条件', () => {
  KEY('first tab', 'first-tab');
  KEY('tab 3', 'tab-select');
  KEY('it reopened', 'reopen-tab');
  KEY('i want my money back', null);
  KEY('閉じるべきではないか', 'negate');
  KEY('閉じるべきかと思います', 'help');
  KEY('is it possible to close it', 'help');
  KEY('it would help a lot', 'scoped-help');
  KEY('あとで閉じて', 'defer');
  KEY('元に戻して', 'reopen-tab');
  KEY('あとどのくらい', 'remaining-time');
});
