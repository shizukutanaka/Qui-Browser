// pass DCCXXVI: IT & office-skill certifications -> close-tab
const { VoiceCommands } = require('../src/vr/input/VoiceCommands.js');

function makeVC() {
  const t1 = { id: 1, url: 'https://a.example', title: 'Tab A', loading: false };
  const t2 = { id: 2, url: 'https://b.example', title: 'Tab B', loading: false };
  const vc = new VoiceCommands({
    speak: () => {},
    onCommand: () => {}
  });
  vc.connectBrowser({
    getActiveTab: () => t1,
    closeTab: () => {},
    tabs: () => [t1, t2]
  });
  return vc;
}

const key = (vc, p) => vc._matchCommand(p)?.key ?? null;

describe('pass DCCXXVI: IT & office-skill certifications (cornu)', () => {
  const closeTab = ['engineer licensed', 'technician registered', 'systems analyst certified'];
  const closeTabJa = [
    '情報処理技術者試験',
    '情報処理技術者',
    'itパスポート',
    '基本情報技術者',
    '基本情報技術者試験',
    '応用情報技術者',
    '応用情報技術者試験',
    '高度情報技術者',
    'ネットワークスペシャリスト',
    'ネスペ',
    'データベーススペシャリスト',
    'エンベデッドスペシャリスト',
    'システムアーキテクト',
    'プロジェクトマネージャ試験',
    'pm試験',
    'itサービスマネージャ',
    'システム監査技術者',
    '情報処理安全確保支援士',
    '情報セキュリティスペシャリスト',
    'デジタル人材',
    '情報処理学会',
    '情報処理推進機構',
    'ipa試験',
    'ipa',
    '個人情報保護士',
    '情報検定',
    '情報活用試験',
    '情報セキュリティマネジメント試験',
    'コンピュータ資格',
    'it資格',
    'エンジニア資格',
    'プログラマ認定',
    'システムエンジニア',
    'プログラマ',
    'se試験',
    'コーディング検定',
    'ai検定',
    '人工知能検定',
    'ディープラーニング検定',
    'データサイエンス検定',
    '統計検定',
    '統計検定一級',
    '統計検定二級',
    '統計検定三級',
    '数学検定',
    '数検',
    '数検一級',
    '数検二級',
    '実用数学技能検定',
    '会計ソフト検定',
    '簿記検定',
    '日商簿記',
    '簿記一級',
    '簿記二級',
    '簿記三級',
    '会計検定',
    'ビジネス会計検定',
    'ファイナンシャル検定',
    '建設業経理士',
    '経理検定',
    '給与計算検定',
    '社会保険検定',
    '税務会計検定',
    '事務検定',
    'ビジネス検定',
    'ワープロ検定',
    'パソコン検定',
    'パソコン技能検定',
    'パソコンインストラクター',
    'パソコン整備士',
    'it検定',
    '情報処理検定',
    'excel検定',
    'word検定',
    'powerpoint検定',
    'オフィス検定',
    'mos試験',
    'mos',
    'パソコン検定試験',
    'キーボード検定',
    '電子メール検定',
    'インターネット検定',
    'ドットコムマスター',
    'ネットワーク試験',
    '情報セキュリティ試験',
    'セキュリティ検定',
    '情報倫理検定',
    'ict検定',
    'プログラミング能力検定',
    'ジュニアプログラミング検定',
    'プログラミング検定',
    '情報リテラシー',
    'メディアリテラシー',
    'デジタルリテラシー',
    'webデザイン検定',
    'ウェブデザイン技能検定',
    'web解析士',
    'ウェブ解析士',
    'ネットショップ検定',
    'ec検定',
    '販売士',
    '販売士検定',
    'リテールマーケティング',
    '流通検定',
    '色彩検定',
    '色彩士',
    'カラーコーディネーター',
    'カラー検定',
    'インテリア検定',
    '空間デザイン検定',
    'cad検定',
    'cad利用技術者試験',
    '製図検定',
    '建築cad検定',
    '機械cad検定',
    '3dcad検定',
    '電気cad検定'
  ];
  const negate = [
    'still awaiting the engineer license',
    'still awaiting the certification exam',
    'まだ申込前',
    'まだ合否前',
    'これから登録',
    'まだ試験日が先'
  ];
  const nullPins = ['about to visit the exam hall', 'about to file the certification report'];
  const establishedPins = [
    ['質流れ', 'close-tab'],
    ['骨董品', 'close-tab'],
    ['close this tab', 'close-tab'],
    ['keep it', 'negate'],
    ['leave it alone', 'negate']
  ];

  let vc;
  beforeEach(() => {
    vc = makeVC();
  });

  closeTab.forEach((p) => test(`close-tab: "${p}"`, () => expect(key(vc, p)).toBe('close-tab')));
  closeTabJa.forEach((p) => test(`close-tab JA: ${p}`, () => expect(key(vc, p)).toBe('close-tab')));
  negate.forEach((p) => test(`negate: "${p}"`, () => expect(key(vc, p)).toBe('negate')));
  nullPins.forEach((p) => test(`still null: "${p}"`, () => expect(key(vc, p)).toBeNull()));
  establishedPins.forEach(([p, k]) => test(`pin: "${p}" still -> ${k}`, () => expect(key(vc, p)).toBe(k)));
});
