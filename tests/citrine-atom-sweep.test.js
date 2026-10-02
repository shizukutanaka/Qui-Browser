const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  return new VoiceCommands({ speak: () => {}, onCommand: () => {} });
}
const key = (vc, p) => vc._matchCommand(p).key;

const closeTab = [
  // shipped / released
  'shipped it', 'its shipped', 'ship it', 'released', 'release done',
  'release complete', 'went live', 'gone live', 'live in prod',
  'in production', 'pushed to prod', 'deployed', 'deploy done',
  'rolled out', 'rollout done', 'rollout complete', 'tagged the release',
  'rc tagged', 'went gold', 'gold master', 'release cut',
  'changelog updated',
  // merged / code complete
  'merged the pr', 'pr merged', 'merged', 'merged to main',
  'code complete', 'feature complete', 'implementation done',
  'all checks green', 'ci green', 'tests passing', 'qa passed',
  'code review done', 'approved and merged', 'signed off on it',
  'submitted for review', 'review complete',
  // deadline / delivery
  'deadline met', 'met the deadline', 'made the deadline',
  'delivered', 'handed it in', 'turned it in', 'submission in',
  'demo done', 'demo complete', 'sprint done', 'sprint ended',
  'sprint closed', 'milestone hit', 'milestone reached',
  // JA
];

const closeTabJa = [
  // リリース/出荷/納品
  'リリース完了', 'リリースしました', 'リリース済み', '出荷',
  '出荷しました', '出荷完了', '納品しました', '納品完了', '本番適用',
  '本番反映', 'デプロイ完了', 'デプロイしました', '本番環境に反映',
  'タグを打って', 'リリースタグ', 'ゴールドマスター', 'パッケージ化完了',
  '更新履歴を書いて', 'チェンジログ更新',
  // 実装/レビュー完了
  '実装完了', '実装が終わって', 'コードフリーズ', 'レビュー完了',
  'レビューが通って', 'マージしました', 'prをマージして',
  'プルリクをマージして', 'mainにマージ', 'ci緑', 'テスト全部通って',
  'qa合格', '検品済み', '受入テスト完了', '受け入れテスト完了',
  // 締切/納期
  '締切に間に合って', '締め切りをクリア', '納期を守って', '期日に納めて',
  'デモ終了', 'スプリント終了', 'スプリントレビュー終了',
  'マイルストーン達成', '成果物を提出して', '提出完了',
];

const negate = [
  'keep it in staging', 'stay in development', 'dont ship yet',
  'keep working on the branch', 'まだ開発中', 'まだ実装中',
  'リリースを待って', 'スプリントを続けて',
];

const nullPins = [
  // in progress / not yet shipped
  'in development', 'still coding', 'work in progress', 'mid sprint',
  'in review', 'under review', 'awaiting review', 'pr open',
  'deploying now', 'release scheduled', 'deadline approaching',
  '開発中', '実装中', 'レビュー中', 'デプロイ中', '検証中',
  'スプリント中', '締切前', '納期が迫って', '作業中',
];

const establishedPins = [
  ['out the door', 'close-tab'],
  ['検収', 'close-tab'],
  ['version bumped', 'about'],
  ['go live', 'screen-record'],
];

describe('Voice atoms CCCXXX — ship/release & deadline-clear', () => {
  test.each(closeTab)('"%s" -> close-tab', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => ({ pinned: false }), closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each(closeTabJa)('"%s" -> close-tab (JA)', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => ({ pinned: false }), closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('close-tab');
  });

  test.each(negate)('"%s" -> negate', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe('negate');
  });

  test.each(nullPins)('"%s" -> null (in progress)', (p) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(vc._matchCommand(p)).toBeNull();
  });

  test.each(establishedPins)('"%s" -> %s (pre-existing)', (p, k) => {
    const vc = makeVC();
    vc.connectBrowser({ getActiveTab: () => null, closeTab: () => {}, tabs: () => [] });
    expect(key(vc, p)).toBe(k);
  });
});
