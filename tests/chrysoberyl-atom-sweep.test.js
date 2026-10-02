const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ id: 1 }),
    closeTab: () => {},
    tabs: () => [],
  });
  return vc;
}
const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

const closeTab = [
  // that's-a-wrap family
  'that is a wrap', 'its a wrap', 'wrapped', 'we wrapped',
  'wrapped production', 'wrap party done', 'wrap party over',
  'principal photography done', 'shooting done', 'shoot over',
  'scene in the can', 'final take', 'last shot',
  'shot the last scene', 'martini shot done', 'last shot of the day',
  'called it a wrap', 'wrapped for the day', 'company move done',
  'strike the set', 'set closed', 'onion wrapped', 'picture wrapped',
  'cameras stopped', 'rolling cut',
  // set strike / departments wrapped
  'gate checked', 'checked the gate', 'sound speed off', 'boom down',
  'lights out on set', 'grip struck', 'dolly struck', 'tracks pulled',
  'trailer emptied', 'honeywagon gone', 'crafty packed',
  'wardrobe returned', 'props locked', 'continuity logged',
  'script locked', 'shot list done', 'storyboards done',
  'coverage complete', 'scene coverage done',
  // post-production
  'dailies watched', 'dailies done', 'rushes reviewed',
  'rough cut done', 'assembly done', 'edit locked', 'picture locked',
  'final cut', 'final cut locked', 'locked cut', 'color graded',
  'grade locked', 'conform done', 'online edit done', 'mix done',
  'final mix', 'sound mix done', 'adr done', 'foley done',
  'score recorded', 'score mixed', 'music spotted', 'titles added',
  'credits added', 'subs done', 'subtitles done', 'dubbing done',
  'localization done', 'qc passed', 'qc done', 'package delivered',
  'masters delivered', 'deliverables sent', 'final delivery',
  'show delivered', 'film delivered', 'in the vault', 'shelved',
  'in the can for real',
  // release & press
  'festival cut done', 'premiere done', 'premiered', 'screening done',
  'screened', 'press junket done', 'junket over', 'press tour done',
  'press day done', 'junket wrapped', 'red carpet done',
  'q and a done', 'panel done', 'screening q and a done',
  'fest run over', 'festival circuit done', 'distribution deal done',
  'sold the film', 'pickup done', 'netflix picked it up', 'streamed',
  'released on vod', 'vod release done', 'theatrical run over',
  'run ended', 'box office run done', 'oscar campaign done',
  'awards season over',
  // season / series wrap
  'season finale shot', 'series wrapped', 'pilot done',
  'pilot in the can', 'episode done', 'block shot',
  'two eps blocked', 'reshoots done', 'pickups done',
  'additional photography done', 'splinter unit done',
  'second unit done', 'stunt unit done',
  // vfx / specialty units
  'vfx shots finaled', 'vfx done', 'cg done', 'render farm done',
  'renders done', 'comp done', 'compositing done',
  'wire removal done', 'clean plate shot', 'plates shot',
  'mocap done', 'performance capture done', 'volume shoot done',
  'led wall shoot done', 'green screen done',
  // location & safety release
  'location wrapped', 'location released', 'permit closed',
  'set medic released', 'covid compliance done', 'safety briefing done',
  'stunts done', 'sfx done', 'pyro done', 'rain bars off',
  'snow machines off', 'wind machines off', 'fog cleared on set',
  'blood cleaned up', 'squibs removed', 'breakaways reset',
  // cast & crew dismissed
  'standins released', 'extras released', 'background wrapped',
  'background dismissed', 'day players wrapped',
  'child actors wrapped', 'union hours hit', 'turnaround hit',
  // media & materials
  'out of tape', 'memory card full', 'cards offloaded',
  'footage backed up', 'dailies uploaded', 'editorial done',
  'post done', 'post wrapped', 'online done', 'offline done',
  'finishing done', 'mastering done', 'dcp made', 'dcp delivered',
  'kdm issued', 'screener sent', 'links sent',
  // bonus content
  'elegant ending', 'fade to black done', 'end credits done',
  'post credits shot', 'tag scene shot', 'blooper reel cut',
  'gag reel done', 'behind the scenes done', 'bts wrapped',
  'epk done', 'making of done', 'doc wrap', 'documentary done',
  'interviews done', 'b roll done', 'broll done', 'archive cleared',
  'releases signed', 'release forms signed', 'contracts signed',
  'insurance wrapped', 'claims closed', 'wrap report filed',
  'production report filed', 'camera report done',
  'sound report done', 'script supervisor notes done',
  'continuity photos taken', 'polaroids taken',
  'reference photos done', 'network approved',
  'studio notes addressed', 'notes addressed', 'resolves done',
  'execs signed off', 'producers signed off', 'network signed off',
  // misroute fixes (call-sheet -> device-apps, print-shipped -> print,
  // step-and-repeat -> say-again; all narrowed)
  'call sheet done', 'final call sheet', 'print shipped',
  'step and repeat done',
];
const closeTabJa = [
  // 撮了/クランクアップ
  '撮了', '撮影完了', '収録が終わって', 'ロケ終了', 'ロケを終えて',
  'スタジオ収録終了', '本番終了', 'リハーサル終了', 'テスト終わって',
  '本撮り終了', 'ラストカット', '最終テイク', '全カット終了',
  'セットを畳んで', 'セット撤収', '美術セットを解体して',
  '撮影所を出て', '衣装を返して', '機材を片付けて',
  'カメラを下ろして', '音声さんが帰って', 'メイクを落として',
  '出演者が帰って', 'エキストラ解散', 'スタッフ解散',
  // ポスプロ
  'ポスプロ終了', '編集が終わって', '編集作業終了', 'ラフカット',
  '本編集終了', '完パケ', '完パケ納品', 'ma終了', 'maが終わって',
  'カラグレ終了', 'グレーディング終了', 'vfx終了', 'cg終了',
  '合成終了', 'ワイヤー消し終了', 'モーションキャプチャ終了',
  '吹き替え終了', 'アフレコ終了', 'ナレーション収録終了',
  'maルームを出て', '編集室を出て',
  // 上映/宣伝
  'デイリーズ確認', 'ラッシュを見て', '試写終了', '試写会終了',
  '初日舞台挨拶終了', '舞台挨拶終了', 'プレミア終了',
  'ジャンケット終了', '取材対応終了', '宣伝ツアー終了',
  '公開初日', '上映期間終了', '配信開始', 'レンタル開始',
  '放送済み', 'オンエア終了', '本放送終了',
  // シーズン/追加撮影
  '最終話収録', 'シーズン撮了', '全話撮了', 'パイロット撮了',
  '追加撮影終了', 'リシュート終了', 'ピックアップ撮影終了',
  '第二班終了', 'スタント撮影終了', '特撮終了', 'グリーンバック終了',
  '撮影許可を返して', 'スタッフロールを回して', 'ng集完成',
  'メイキング完成', 'ドキュメンタリー完成', 'インタビュー収録終了',
  // 素材/納品
  '素材をバックアップして', 'カードを吸い出して',
  'フィルムを現像して', '現像が上がって', 'マスターを納品して',
  '検収が通って', '局のokが出て', 'プロデューサー承認',
  'スポンサー承認', 'リリース署名済み', '契約書を締結して',
  '撮影日誌を書いて', '香盤表を回して', '出番が終わって',
];
const negate = [
  'keep shooting', 'keep rolling', 'still shooting', 'one more take',
  'still editing', 'keep editing', 'stay in post', 'まだ撮影中か',
  '撮影を続けて', 'もう一本撮って', 'もう一本いって',
  '追加撮影を続けて', 'まだ編集中', '編集を続けて',
];
const nullPins = [
  // in-progress / scheduled / bare nouns — nothing ends
  'on set', 'still on set', 'in post',
  'pre production', 'filming now', 'on location', 'at the studio',
  'call time', 'lunch called', 'crafty break', 'golden time',
  'meal penalty', 'company lunch', 'martini shot', 'abby singer',
  '撮影中', '収録中', '編集中', 'ポスプロ中', '撮影予定',
  'クランクイン前', 'スタンバイ中', 'ロケハン中', '打ち合わせ中',
  '来週収録',
];
const establishedPins = [
  // close-tab pins
  ['in the can', 'close-tab'], ['set struck', 'close-tab'],
  ['green room emptied', 'close-tab'], ['smoke cleared', 'close-tab'],
  ['season wrapped', 'close-tab'], ['out of film', 'close-tab'],
  ['delivered', 'close-tab'], ['in production', 'close-tab'],
  ['クランクアップ', 'close-tab'],
  ['撮影終了', 'close-tab'], ['収録終了', 'close-tab'],
  ['オールアップ', 'close-tab'], ['スタジオを出て', 'close-tab'],
  ['小道具をしまって', 'close-tab'], ['照明を落として', 'close-tab'],
  ['打ち上げ終了', 'close-tab'], ['編集終了', 'close-tab'],
  ['最終回', 'close-tab'], ['エンドロール', 'close-tab'],
  ['納品完了', 'close-tab'], ['出番終わり', 'close-tab'],
  // other established atoms win
  ['thats a wrap', 'stop-everything'],
  ['cut and print', 'print'], ['print it', 'print'],
  ['ロケ地を開放して', 'go-to'], ['字幕をつけて', 'captions-toggle'],
  ['明日撮影', 'defer'],
];

describe('pass CCCXXXIII: film/TV wrap idioms (chrysoberyl)', () => {
  let vc;
  beforeEach(() => { vc = makeVC(); });

  test.each(closeTab)('"%s" -> close-tab', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(closeTabJa)('"%s" -> close-tab (ja)', (p) => {
    expect(key(vc, p)).toBe('close-tab');
  });
  test.each(negate)('"%s" -> negate', (p) => {
    expect(key(vc, p)).toBe('negate');
  });
  test.each(nullPins)('"%s" -> null', (p) => {
    expect(key(vc, p)).toBeNull();
  });
  test.each(establishedPins)('"%s" keeps pin -> %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected);
  });
});
