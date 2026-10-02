/**
 * Voice atoms CCCXIV — workshop/studio shutdown & piece-finished
 * idioms (EN) + 工房/制作終了/窯出し (JA). The piece is done and
 * the studio is closing: close the tab. Setup/practice stay out.
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
  // --- forge/kiln shutdown ---
  'kiln cooled', 'kiln cooled down', 'kiln unloaded', 'kiln opened',
  'fired the last piece', 'glaze fired', 'bisque done',
  'forge went cold', 'banked the coals', 'coals banked',
  'anvil cooled', 'quench bucket stilled', 'bellows put away',
  'last weld cooled', 'welder powered off', 'torch shut off',
  'lathe powered off', 'sawdust swept', 'workbench cleared',
  'vise released', 'clamps came off', 'clamps removed',
  'soldering iron off', 'fume hood off', 'exhaust fan off',
  // --- piece finished ---
  'piece is done', 'piece finished', 'project shipped',
  'signed the piece', 'signed the canvas', 'signed the work',
  'signature on', 'makers mark stamped', 'hallmark stamped',
  'varnish dried', 'final coat', 'last coat applied',
  'topcoat dried', 'lacquer cured', 'resin cured', 'epoxy cured',
  'paint dried', 'paint fully dried', 'glaze dried',
  'frame hung', 'piece framed', 'mounted and hung',
  'gallery closed', 'show came down', 'exhibition over',
  'piece sold', 'sold the piece', 'commission delivered',
  'commission shipped', 'piece delivered', 'project delivered',
  // --- studio shutdown ---
  'studio cleaned', 'studio closed', 'brushes washed',
  'brushes cleaned', 'palette scraped', 'palette cleaned',
  'easel folded', 'canvas covered', 'canvas wrapped',
  'covered the canvas', 'paints put away', 'pigments shelved',
  'turpentine capped', 'rags disposed', 'apron hung',
  'clay bagged', 'wheel stopped', 'potters wheel off',
  'loom covered', 'last stitch in', 'pattern done',
];

const closeTabJa = [
  // --- 窯/鍛冶仕舞い ---
  '窯出し', '窯が冷えて', '窯を開けて', '窯焚き終了',
  '窯を閉めて', '窯元を閉めて', '釉薬が乾いて', '焼き上がって',
  '焼き物完成', '素焼き終了', '本焼き終了', '窯の火を落として',
  '火床を鎮めて', '炭火を消して', 'ふいごをしまって',
  '金床が冷えて', '鍛冶場を閉めて', '溶接が冷えて',
  'トーチを消して', 'バーナーを消して', '旋盤を止めて',
  '作業台を片付けて', 'バイスを緩めて', 'クランプを外して',
  // --- 作品完成 ---
  '作品完成', '作品が完成', '制作終了', '制作を終えて',
  '署名して', 'サインを入れて', '落款を押して', '銘を入れて',
  'ニスが乾いて', '最終コート', '上塗り終了', '漆が乾いて',
  '絵の具が乾いて', '額装', '額に入れて', '額縁に入れて',
  '飾って', '作品を飾って', '展示終了', '展覧会終了',
  '個展終了', '作品が売れて', '受注品を納品して', '納品完了',
  '作品を発送して', '梱包して', '作品を梱包して',
  // --- アトリエ仕舞い ---
  'アトリエを閉めて', '工房を閉めて', '工房を片付けて',
  '筆を洗って', '絵筆を洗って', 'パレットを洗って',
  '画用紙をしまって', 'キャンバスを覆って', '絵の具をしまって',
  'エプロンを掛けて', '粘土を片付けて', '轆轤を止めて',
  '機を畳んで', '最後の一針', '編み物完成', '仕立て終了',
  '型紙をしまって', 'ミシンを止めて', '工具を元に戻して',
];

const negate = [
  'keep creating', 'stay in the studio', 'still painting',
  'keep the kiln going', '制作を続けて', 'まだ制作中', '工房に残って',
];

const nullPins = [
  // setup / practice / in-progress
  'start the kiln', 'new canvas', 'fresh clay',
  'practice piece', 'sketch it out', 'underpainting',
  '窯に火を入れて', '窯焚き', '素焼き中', '練習作品',
  '制作中', '下絵', 'デッサン', '新しいキャンバス',
];

const establishedPins = [
  ['down tools', 'close-tab'],
  ['fire up the forge', 'go-to'],
];

describe('Voice atoms CCCXIV — workshop/studio shutdown & piece-finished', () => {
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
