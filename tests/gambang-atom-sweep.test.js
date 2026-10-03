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
  // race-day entries closed & offtrack payout done
  'race-day entries closed', 'offtrack payout done',
];
const closeTabJa = [
  '公営競技', '競艇',
  'ボートレース', '競輪',
  'オートレース', '地方競馬',
  '場外発売', '場外勝馬投票券発売所',
  '投票券', '勝馬投票券',
  '払戻金', 'ギャンブル依存',
  'ギャンブル依存症', '依存対策',
  '入場制限', '入場料',
  'ナイター競走', '競走場',
  '検量', '枠番',
  '出走表', '競技場管理',
  '地方競馬全国協会', '競馬法',
  '自転車競技法', 'モーターボート競走法',
];
const negate = [
  'still awaiting the race entry',
  'まだ投票前', 'まだ場外発売前',
];
const nullPins = [
  'about to place the bet ticket',
  'about to enter the race venue',
  // 'これから投票' — saxifrage pins it null
  'これから投票',
];

describe('pass DCXX: public-gambling & addiction-countermeasure idioms (gambang)', () => {
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
