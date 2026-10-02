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
  // household-budget optimization done
  'switched sims', 'plan downgraded',
  'subscriptions cancelled', 'bundle reviewed',
  'fixed costs cut', 'bills audited',
  'autopay switched', 'gym cancelled',
  'streaming paused',
];
const closeTabJa = [
  '格安simに乗り換えて', 'プランを下げて',
  'サブスクを解約して', 'セット割を見直して',
  '固定費を削って', '請求を見直して',
  '引き落としを変えて', '通信費を下げて',
  'ジムを退会して', '動画配信を止めて',
];
const negate = [
  'still comparing plans', 'still on the old plan',
  'まだプラン比較中', 'まだ旧プラン中',
];
const nullPins = [
  'about to switch', 'mid switch',
  'budget review', 'phone plan',
  'これから乗り換える', '切り替え中',
  '家計見直し', '料金プラン',
];
const establishedPins = [];

describe('pass CDXXXIX: household-budget optimization idioms (zonka)', () => {
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
});
