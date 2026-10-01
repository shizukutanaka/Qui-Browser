// Voice atoms CCXCIX: EN sewing/fabric-dismantle idioms + JA 裁断/裂き/千切り chains (pass CCXCIX)
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
  // --- unweave / unstitch / seams ---
  'unravel it all', 'unstitch it', 'unstitch it all', 'unsew it',
  'rip out the seams', 'tear out the seams', 'pick out the stitches',
  'snip the stitches', 'snip the threads', 'unpick it', 'unpick the seams',
  'seam rip it', 'seam ripper it',
  // --- fray / ribbons / tatters ---
  'fray it', 'fray it out', 'let it fray', 'cut it to ribbons',
  'slice it to ribbons', 'tatter it', 'tattered and done',
  'shred it to shreds', 'shred the fabric', 'tear the fabric',
  'rip the cloth', 'slash the fabric',
  // --- rags / scraps / remnants ---
  'cut it up into rags', 'cut it into rags', 'rags for it', 'rag pile it',
  'toss it in the rag bin', 'rag bin it', 'lint bin it', 'scraps for it',
  'offcuts for it', 'selvage it away', 'baste it away', 'hem it out',
  'pinking shears it', 'rotary cutter it', 'die cut it',
  'cut it off the bolt', 'off the bolt', 'bolt end it', 'remnant it',
  'remnant bin it', 'scrap bag it', 'knot it off',
];

const closeTabJa = [
  // --- 解き/ほどき ---
  'ほぐして', '解いてしまって', '解きほぐして', 'ほどいて',
  '糸をほどいて', '糸を解いて', '糸を抜いて', '糸を切って',
  '縫い目を解いて', '縫い目をほどいて', '縫い目を切って',
  '縫い目から外して', '解き明かして捨てて',
  '織りほぐして', '織りを解いて', '編みほぐして', '編み目を解いて',
  '毛糸をほどいて', '編み物を解いて',
  // --- 裂き/切り刻み ---
  'ずたずたに切って', 'ズタボロにして', 'ボロ布にして', '布切れにして',
  '刻んで捨てて', '切れ端にして', '裂け目を入れて', '破れ布にして',
  'ほつれさせて', 'ほつれにして', '裁ち切って',
  // --- 裁断道具 ---
  'はさみで切って', 'ハサミで切り刻んで', '鋏で裁断', 'カッターで切って',
  '試し切りして', '見本切り', '裾を切って',
  // --- 残布/古布/ウェス ---
  '端切れにして', '残布にして', '反物ごと捨てて', '裂き布にして',
  '古布にして', '雑巾にして', 'ぞうきんにして', 'ウェスにして',
  'ウエスにして', 'ハギレにして', '切れっぱしにして',
];

describe('Voice atoms CCXCIX — sewing/fabric-dismantle idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('established pins kept', () => {
  test('"undo the seams" -> reopen-tab (undo reads as restore)', () => {
    expect(key(makeVC(), 'undo the seams')).toBe('reopen-tab');
  });
});

describe('null pins (mending/alteration, not disposal)', () => {
  test.each([['mend it'], ['darn it'], ['sew it back'], ['patch it up'],
    ['sew it up tight'], ['knit it back'], ['weave it back'], ['裾上げして'],
  ])('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});
