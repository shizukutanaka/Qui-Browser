/**
 * Voice atoms CCCXIII — worship service & ceremony-close idioms (EN)
 * + 礼拝/法要/式典終了 (JA). Service concluding closes the tab.
 * Service openings stay null; 'go in peace' keeps its go-to pin.
 */
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  const tabs = [{ id: 1, url: 'https://a.example', title: 'A' }];
  vc.connectBrowser({
    getActiveTab: () => tabs[0],
    closeTab: () => {},
    tabs: () => tabs,
  });
  return vc;
}

function key(vc, phrase) {
  const r = vc._matchCommand(phrase);
  return r && r.key;
}

const closeTab = [
  // --- service concluded ---
  'service concluded', 'service is over', 'service has ended',
  'mass ended', 'mass is over', 'the mass has ended',
  'go forth', 'dismissal given', 'congregation dismissed',
  'amen said', 'final amen', 'benediction given', 'benediction done',
  'blessing given', 'closing prayer done', 'prayers finished',
  'sermon done', 'sermon is over', 'sermon ended',
  'homily over', 'lection done', 'scripture closed',
  'bible closed', 'hymnbook closed', 'last hymn sung',
  'recessional hymn', 'recessional played', 'postlude played',
  'organ stopped', 'choir dismissed', 'choir recessional done',
  'candles extinguished', 'altar candles out', 'sanctuary emptied',
  'nave emptied', 'pews emptied', 'collection taken',
  'offertory done', 'communion ended', 'eucharist over',
  // --- daily offices / seasons ---
  'vespers done', 'evensong over', 'compline done',
  'matins done', 'sabbath over', 'shabbat ended',
  'havdalah done', 'sundown prayers done', 'maghrib done',
  'iftar done', 'ramadan ended', 'eid prayers done',
  'lent ended', 'vigil ended', 'rosary finished',
  'novena done', 'procession returned', 'relics stored',
  'thurible put away', 'incense burned out', 'incense extinguished',
  // --- secular ceremonies ---
  'ceremony concluded', 'ceremony over', 'ceremony ended',
  'commencement over', 'commencement ended', 'graduation over',
  'graduation ended', 'diploma in hand', 'diplomas handed out',
  'caps thrown', 'tassels turned', 'pomp and circumstance done',
  'convocation ended', 'convocation over', 'awards ceremony over',
  'medals handed out', 'vows exchanged', 'ceremony recessional',
  'officiant left', 'processional reversed', 'folded the program',
  'ushered everyone out', 'ushers cleared the hall',
];

const closeTabJa = [
  // --- 礼拝/ミサ/説教 ---
  '礼拝終了', '礼拝が終わって', '礼拝を終えて', 'ミサ終了',
  'ミサが終わって', '説教終了', '説教が終わって', '説教を終えて',
  '説法終了', '講話終了', '賛美歌終了', '賛美歌を歌い終えて',
  '聖歌終了', '讃美歌終了', '祈りを終えて', '祈りが終わって',
  '拝礼終了', '礼拝堂を出て', '教会を出て', '聖堂を出て',
  '聖書を閉じて', '賛美歌集を閉じて', '燭火を消して',
  'キャンドルを消して', 'ロウソクを消して', '香炉を下げて',
  '会堂が空いて', '解散しました', '平安のうちに',
  // --- 法要/仏事 ---
  '法要終了', '法要が終わって', '法事終了', '法事が終わって',
  '読経終了', '読経が終わって', 'お経を唱え終えて',
  'お勤め終了', 'お勤めが終わって', '焼香終了', '焼香を終えて',
  '回向終了', '回向を終えて', '数珠をしまって', '木魚が止まって',
  '鐘を撞き終えて', '梵鐘が鳴り止んで', '法要を終えて',
  '戒名を授かって', 'お墓参りを済ませて', '参拝終了',
  'お参りを済ませて', '神事終了', '祝詞終了', '祓いを終えて',
  // --- 式典終了 ---
  '式終了', '式が終わって', '式典終了', '式典が終わって',
  '卒業式終了', '卒業式が終わって', '修了式終了', '終業式終了',
  '閉校式終了', '学位授与式終了', '授賞式終了', '表彰式終了',
  '入社式終了', '成人式終了', '記念式典終了', '国歌斉唱終了',
  '国旗掲揚終了', '退場開始', '退場を始めて', '学帽を投げて',
  '学位記を受け取って', '卒業証書を受け取って',
];

const negate = [
  'stay for the service', 'keep praying', 'still in church',
  '礼拝を続けて', 'まだ礼拝中', '祈りを続けて',
];

const nullPins = [
  // service openings / ongoing
  'service begins', 'going to church', 'sunday service', 'mass begins',
  '礼拝中', '説教中', '二年参り', 'amen',
];

const establishedPins = [
  ['go in peace', 'go-to'],
  ['礼拝に行く', 'go-to'],
  ['ミサに行く', 'go-to'],
  ['教会に行く', 'go-to'],
  ['お葬式に行く', 'go-to'],
  ['結婚式に行く', 'go-to'],
  ['参拝に行く', 'go-to'],
  ['school is out', 'close-tab'],
  ['thats the bell', 'close-tab'],
];

describe('Voice atoms CCCXIII — worship service & ceremony-close idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(negate.map((p) => [p]))('"%s" -> negate', (p) => {
    expect(key(makeVC(), p)).toBe('negate');
  });
  test.each(nullPins.map((p) => [p]))('"%s" -> null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
  test.each(establishedPins.map(([p, k]) => [p, k]))('"%s" -> %s', (p, k) => {
    expect(key(makeVC(), p)).toBe(k);
  });
});
