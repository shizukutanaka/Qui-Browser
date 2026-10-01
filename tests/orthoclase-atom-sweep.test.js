// Voice atoms CCXCVII: EN garden/pruning/harvest idioms + JA 剪定/草取り/収穫/耕す chains (pass CCXCVII)
const { VoiceCommands } = require('../src/vr/input/VoiceCommands');

function makeVC() {
  const vc = new VoiceCommands({ speak: () => {}, onCommand: () => {} });
  vc.connectBrowser({
    getActiveTab: () => ({ title: 'Example Page', url: 'https://example.com' }),
    closeTab: () => {},
    tabs: [{ title: 'Example Page' }],
  });
  return vc;
}

function key(vc, phrase) {
  vc.lastCommand = null;
  vc.processCommand(phrase, 0.9);
  return vc.lastCommand ? vc.lastCommand.key : null;
}

const closeTab = [
  // --- pruning / clipping / shearing ---
  'prune it away', 'prune it back', 'prune the branches', 'snip it away',
  'trim it back', 'trim it away', 'trim the hedge', 'hedge trimmed',
  'shear it', 'shear it off', 'clip it', 'clip it off', 'clip it away',
  'clip the wings', 'lop it', 'lopped off', 'scythe it', 'scythe it down',
  'sickle it', 'dead-head it', 'deadhead the flowers',
  // --- mowing / weeding / raking ---
  'mow the lawn', 'lawn mowed', 'weed it', 'pull the weeds',
  'pull it up by the roots', 'by the roots', 'tear it up by the roots',
  'uproot and discard', 'rake it up', 'rake it away', 'rake the leaves',
  'leaf blown', 'blow the leaves', 'leaf it behind', 'clear the brush',
  'clear-cut it', 'brush it away', 'bushwhack it',
  // --- digging / tilling / shovel ---
  'dig it out', 'till it back', 'plow it back', 'mulch it', 'mulched',
  'shovel it out', 'shovel it away', 'spade it under',
  // --- garden / soil disposal ---
  'garden done', 'garden over', 'bed it down', 'garden burial',
  'plant it deep', 'bury it in the garden', 'back to the soil',
  'soil it under', 'earth it over', 'toss it in the compost',
  'compost heap it', 'feed it to the garden', 'pot it away',
  'repot it out', 'transplant it out', 'graft it away',
  // --- harvest / culling / logging ---
  'harvest done', 'harvest over', 'harvest time', 'gather the harvest',
  'reap what it sowed', 'thin the herd', 'thin the ranks', 'cull the herd',
  'pick it bare', 'stump it out', 'grind the stump', 'fell it',
  'fell the tree', 'timber for it', 'log it away',
  // --- pesticide / decay / burn ---
  'pesticide it', 'spray the pests', 'spray it with pesticide', 'herbicide it',
  'roundup it', 'defoliate it', 'defoliation', 'let it die on the vine',
  'die on the vine', 'left to rot', 'rot on the vine', 'let it dry out',
  'parch it', 'scorch the earth', 'salt the ground', 'burn the field',
  'slash and burn it', 'controlled burn it',
];

const closeTabJa = [
  // --- 剪定/枝処理 ---
  '剪定して', '剪定だ', '枝を剪定', '枝を切って', '枝切り', '枝を落として',
  '剪定ばさみで', '大胆に剪定', '枯れ枝を切って',
  // --- 草刈り/草取り ---
  '芝刈りして', '芝を刈って', '草を刈って', '草刈りして', '草むしりして',
  '草取りして', '雑草を抜いて', '雑草抜き', '草をむしって', '除草して',
  '除草剤まいて', '根っこから抜いて', '根こそぎ抜いて', '根元から切って',
  // --- 耕起/掘り ---
  '掘り起こして', '掘り返して', '耕して', '耕起して', '鋤き返して',
  '鍬で耕して', '土起こし',
  // --- 落ち葉/枯死 ---
  '落ち葉を掃いて', '落ち葉掃き', '枯れ葉を捨てて', '枯らして',
  '枯れ木にして', 'しおらせて',
  // --- 収穫/摘み/間引き ---
  '収穫して', '収穫だ', '収穫時期', '刈り入れして', '刈り入れだ',
  '刈り取って', '稲刈りして', 'もぎ取って', '摘み取って', '摘んで捨てて',
  '間引きして', '間引いて', '摘心して', '摘芽して', '芽を摘んで',
  '摘果して', '選果して',
  // --- 伐採 ---
  '伐採して', '伐倒して', '切り倒して', '伐って', '皆伐して', '間伐して',
  '株を抜いて', '切り株を掘って', '切り株処理', '庭木を伐って',
  '園芸鋏で切って', 'ナタで切って', '鉈で切って', '斧で伐って',
  'ノコギリで切って', '鎌で刈って', '刈払機で刈って', 'バッサリ切って',
  'バッサリいって', '思い切って切って',
  // --- 植え替え/園芸処分 ---
  '植え替えて', '植え直して', '鉢を替えて', '鉢替え', '移植して',
  '定植して', '庭仕舞い', '園芸処分',
  // --- 堆肥/土還し/焼却 ---
  '肥料にして', '肥料だ', '腐葉土にして', '落ち葉堆肥', '堆肥化して',
  '緑肥にして', '鋤き込んで', 'すき込んで', '自然に還して',
  '畑に埋めて', '畑に返して', '草を焼いて', '野焼きして', '焼畑して',
  '枯れ草を燃やして',
];

describe('Voice atoms CCXCVII — garden/pruning/harvest idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('established pins kept', () => {
  test('"dig it up" -> reopen-tab (unearth = revive, not disposal)', () => {
    expect(key(makeVC(), 'dig it up')).toBe('reopen-tab');
  });
  test('"keep it watered" -> negate (keep- phrasing)', () => {
    expect(key(makeVC(), 'keep it watered')).toBe('negate');
  });
});

describe('null pins (nurturing, not disposal)', () => {
  test.each([['water it'], ['fertilize it'], ['let it grow'], ['let it bloom'],
    ['tend the garden'], ['watch it grow'], ['replant it'], ['reseed it'],
    ['水をやって'], ['水やりして'], ['肥料をあげて'], ['日当たりに置いて'],
    ['植えておいて'], ['育てておいて'],
  ])('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});
