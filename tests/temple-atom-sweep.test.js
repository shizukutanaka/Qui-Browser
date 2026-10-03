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
  'temple registered', 'shrine licensed',
];
const closeTabJa = [
  // 宗教法人・団体
  '宗教法人', '宗教団体',
  '宗教活動', '教団',
  '教義', '宗派',
  // 神社寺院
  '神社', '寺院',
  '仏教', '神道',
  '本山', '末寺',
  // 宗派
  '天台宗', '真言宗',
  '浄土宗', '禅宗',
  '日蓮宗', '浄土真宗',
  '臨済宗', '曹洞宗',
  // 神宮・宗務
  '神宮', '神社本庁',
  '宗務所', '管長',
  '座主', '貫主',
  // 法要修行
  '法要', '法事',
  '回向', '供養',
  '読経', '祈祷',
  // 出家僧籍
  '僧侶', '僧階',
  '得度', '出家',
  '還俗', '戒名',
  // 社殿神職
  '境内', '社殿',
  '拝殿', '本殿',
  '神職', '禰宜',
  // 儀礼
  '参拝', '初詣',
  '例祭', '大祭',
  'お祓い',
];
const negate = [
  'still awaiting the shrine registration',
  'still awaiting the temple charter',
  'まだ建立前', 'まだ開山前',
  'まだ落慶前', 'まだ改宗前',
];
const nullPins = [
  'about to visit the shrine',
  'about to join the temple congregation',
];
const establishedPins = [
  ['檀家', 'close-tab'],
  ['塔婆', 'close-tab'],
  ['卒塔婆', 'close-tab'],
  ['お布施', 'close-tab'],
];

describe('pass DCXCII: religious corporations & temple administration (temple)', () => {
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
  test.each(establishedPins)('established pin "%s" stays %s', (p, expected) => {
    expect(key(vc, p)).toBe(expected ?? null);
  });
});
