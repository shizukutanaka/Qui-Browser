// Voice atoms CCXCVI: EN chore/spring-cleaning idioms + JA 大掃除/ゴミ分別/片付け chains (pass CCXCVI)
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
  // --- EN cleaning/wiping ---
  'wipe the slate', 'wipe the slate clean', 'clean the slate', 'wipe it out', 'wipe it away',
  'clean it up', 'cleanup time', 'house cleaning', 'deep clean it', 'give it a wipe',
  'give it a scrub', 'run it under water', 'soak it in bleach', 'squeegee it',
  'squeegee the screen', 'air it out', 'air out the room', 'let some air in',
  // --- EN pest control / chores ---
  'exterminator', 'call the exterminator', 'call pest control', 'pest control',
  'bug bomb it', 'deodorize it', 'scrubbing bubbles', 'chore time', 'chores done',
  'cleaning day', 'on chore duty',
  // --- EN laundry / hamper ---
  'put it in the hamper', 'hamper it', 'laundry day', 'wash day', 'iron it out',
  'fold the laundry',
  // --- EN curb / dump / bin day ---
  'off to the landfill', 'landfill bound', 'to the tip', 'tip it', 'tip run',
  'to the dump', 'dump run', 'skip it in the skip', 'throw it in the skip', 'skip hire',
  'bulk pickup day', 'bulk trash day', 'trash day', 'garbage day', 'bin day',
  'trash pickup', 'rubbish collection', 'muscle it out', 'heave-ho', 'wheelie bin it',
  'dustbin it', 'toss it in the bin', 'scrap heap it', 'rubbish heap', 'yard waste it',
  'scheduled pickup', 'garbage truck',
  // --- EN space/memory reclaim ---
  'free the memory', 'reclaim the space', 'free up space', 'make room', 'clear space',
  'make space', 'delete forever it', 'evict it from memory',
  // --- EN farewell / release ---
  'gone for good this one', 'see it nevermore', 'adieu to it', 'sayonara to it',
  'auf wiedersehen it', 'never see it again', 'never want to see it again',
  'dont want to see it again', 'youre free now', 'be free now', 'set it free',
  'free at last', 'rest easy now tab', 'send it packing', 'packing it off',
  'ship it away', 'crate it up', 'box it and ship it', 'curbside it',
  'leave it curbside', 'on the curb with it', 'to the incinerator', 'burn pile it',
  'onto the bonfire', 'bonfire it', 'compost bin it', 'worm food', 'feed the worms',
];

const closeTabJa = [
  // --- 処分/回収/ゴミ出し ---
  '不要品処分', '不用品回収', '不用品を処分', '廃棄物処理', '粗大ゴミに出して',
  'ゴミ屋敷掃除', '清掃員に頼んで', '清掃日', '収集日', 'ゴミ収集日', '朝のゴミ出し',
  '集積所に出して', 'ゴミ置き場に出して', '燃えるゴミに出して', '燃えるゴミ',
  '溜まったゴミ捨てて', '食べ残し捨てて', '要らない物捨てて', '生ゴミにして',
  '残飯にして', '残飯処理', 'ゴミに出そう', 'ゴミにして', '分別して捨てて',
  '分別しよう', '回収してもらって', '回収業者に頼んで', 'ネット回収', 'リサイクル回収',
  'クリーンセンターに持ち込んで', '持ち込み処分', '処分場に持って行って', '廃棄場へ',
  '焼却処分', 'ポイ捨てして', '捨て置いて',
  // --- 譲渡/売却/寄付 ---
  'リユースに出して', 'フリマに出して', 'メルカリに出して', 'リサイクルショップに売って',
  '買取に出して', '下取りに出して', '譲ってしまおう', '譲渡して', '寄付して',
  '寄付に回して', '寄付箱へ',
  // --- 大掃除/掃き捨て ---
  '大掃除して', '大掃除だ', '大掃除の時間', '年末大掃除', '掃除機かけて',
  '掃除機をかけて', 'ホウキで掃いて', '箒で払って', 'ほうきにて', '掃いて捨てて',
  'はき捨てて', 'ちりとりで捨てて', '塵取りに入れて',
  // --- 賞味期限/腐敗 ---
  '賞味期限切れ捨てて', '消費期限切れ', '腐らせる前に', 'カビる前に捨てて',
  // --- 駆除/衛生 ---
  '虫除けして', '害虫駆除して', '駆除業者を呼んで', '殺虫剤まいて', '燻して',
  '殺菌して', '消毒して', '除菌して',
  // --- 収納/仕舞い/断捨離 ---
  'しまい込んで', '奥にしまって', '仕舞い込んで', '仕舞ってしまって', '収納して',
  '収拾して', '收拾して', 'かたづけおわり', '納戸にしまって', '物置に入れて',
  '物置にしまって', '蔵に入れて', 'クローゼットにしまって', '押入れにしまって',
  '押し入れに入れて', '屋根裏にしまって', '床下にしまって', '段ボールに入れて',
  '箱詰めして', '梱包して', 'ガムテープで封して', '密封して',
  '断捨離しよう', '断捨離して', '断捨離だ', '整理整頓して', '捨て活しよう',
  'こんまりして', 'ときめかない', 'ときめかないから捨てて',
  // --- 洗い流し/埋却 ---
  '洗濯物にして', '洗濯して', '水洗して', '水洗いして', '流してしまって',
  '排水溝に流して', 'トイレに流して', '下水に流して', '浄化槽に入れて',
  '土に埋めて', '堆肥にして', '土に還して', '地中に埋めて', '穴を掘って埋めて',
  '古井戸に落として', '沼に沈めて', '海に捨てよう', '川に捨てて',
  '水に流そう', '水に流してしまえ', 'お流れにして',
  // --- 処理/見納め/別れ/換気 ---
  '尻拭いして', '処理して', 'もう見ないことにして', '見納めにして',
  'さよならを言って', 'お別れを告げて', 'バイバイして', 'あばよと言って',
  '風通しして', '換気して', '空気を入れ替えて',
];

describe('Voice atoms CCXCVI — chore/spring-cleaning idioms', () => {
  test.each(closeTab.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
  test.each(closeTabJa.map((p) => [p]))('"%s" -> close-tab', (p) => {
    expect(key(makeVC(), p)).toBe('close-tab');
  });
});

describe('misroute fixes', () => {
  test('"call pest control" no longer -> device-apps', () => {
    expect(key(makeVC(), 'call pest control')).toBe('close-tab');
  });
  test('"uncall mom" stays null (un-call pin intact)', () => {
    expect(key(makeVC(), 'uncall mom')).toBeNull();
  });
  test('"call mom" still -> device-apps', () => {
    expect(key(makeVC(), 'call mom')).toBe('device-apps');
  });
  test('negate rescues: never-see-it phrasing -> close-tab', () => {
    const vc = makeVC();
    for (const p of ['never see it again', 'never want to see it again',
      'dont want to see it again', 'もう見ないことにして']) {
      expect(key(vc, p)).toBe('close-tab');
    }
  });
});

describe('established pins kept', () => {
  test('tidy-collection verbs -> sort-tabs', () => {
    const vc = makeVC();
    expect(key(vc, '片付けて')).toBe('sort-tabs');
    expect(key(vc, '片付けよう')).toBe('sort-tabs');
    expect(key(vc, '整理しよう')).toBe('sort-tabs');
  });
  test('"wipe it clean" + "clean slate" -> settings-reset (honest atom)', () => {
    const vc = makeVC();
    expect(key(vc, 'wipe it clean')).toBe('settings-reset');
    expect(key(vc, 'clean slate')).toBe('settings-reset');
  });
  test('"out of storage" -> storage-status', () => {
    expect(key(makeVC(), 'out of storage')).toBe('storage-status');
  });
});

describe('null pins (no clear disposal intent)', () => {
  test.each([['磨いて'], ['ピカピカに磨いて'], ['タワシで磨いて'], ['ブラシでこすって'],
    ['デッキブラシでこすって'], ['高圧洗浄して'], ['掃き掃除して'], ['拭き掃除して'],
    ['雑巾がけして'], ['燻製にして'], ['片づけて'], ['お片付け'], ['後片付けして'],
  ])('"%s" stays null', (p) => {
    expect(key(makeVC(), p)).toBeNull();
  });
});
