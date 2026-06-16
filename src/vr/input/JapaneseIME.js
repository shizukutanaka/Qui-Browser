/**
 * Japanese IME for VR
 * Enables Japanese text input in VR - unlocks 100M+ market
 *
 * John Carmack principle: Solve real problems for real users
 */

import * as THREE from 'three';
import { computeKeyLayout, keyboardBounds } from './keyboardLayout.js';

export class JapaneseIME {
  constructor() {
    this.isActive = false;
    this.inputMode = 'hiragana'; // hiragana, katakana, kanji
    this.compositionBuffer = '';
    this.candidates = [];
    this.selectedIndex = 0;

    // Conversion maps
    this.romajiToHiragana = this.buildRomajiMap();
    this.hiraganaToKatakana = this.buildKatakanaMap();

    // Google Transliteration API endpoint
    this.apiEndpoint = 'https://www.google.co.jp/transliterate';

    // Statistics
    this.stats = {
      conversions: 0,
      charactersTyped: 0,
      averageConversionTime: 0
    };
  }

  /**
   * Build romaji to hiragana conversion map
   */
  buildRomajiMap() {
    return {
      // Vowels
      'a': 'あ', 'i': 'い', 'u': 'う', 'e': 'え', 'o': 'お',

      // K series
      'ka': 'か', 'ki': 'き', 'ku': 'く', 'ke': 'け', 'ko': 'こ',
      'kya': 'きゃ', 'kyu': 'きゅ', 'kyo': 'きょ',

      // G series
      'ga': 'が', 'gi': 'ぎ', 'gu': 'ぐ', 'ge': 'げ', 'go': 'ご',
      'gya': 'ぎゃ', 'gyu': 'ぎゅ', 'gyo': 'ぎょ',

      // S series
      'sa': 'さ', 'shi': 'し', 'su': 'す', 'se': 'せ', 'so': 'そ',
      'sha': 'しゃ', 'shu': 'しゅ', 'sho': 'しょ',

      // Z series
      'za': 'ざ', 'ji': 'じ', 'zu': 'ず', 'ze': 'ぜ', 'zo': 'ぞ',
      'ja': 'じゃ', 'ju': 'じゅ', 'jo': 'じょ',

      // T series
      'ta': 'た', 'chi': 'ち', 'tsu': 'つ', 'te': 'て', 'to': 'と',
      'cha': 'ちゃ', 'chu': 'ちゅ', 'cho': 'ちょ',

      // D series
      'da': 'だ', 'di': 'ぢ', 'du': 'づ', 'de': 'で', 'do': 'ど',

      // N series
      'na': 'な', 'ni': 'に', 'nu': 'ぬ', 'ne': 'ね', 'no': 'の',
      'nya': 'にゃ', 'nyu': 'にゅ', 'nyo': 'にょ',

      // H series
      'ha': 'は', 'hi': 'ひ', 'fu': 'ふ', 'he': 'へ', 'ho': 'ほ',
      'hya': 'ひゃ', 'hyu': 'ひゅ', 'hyo': 'ひょ',

      // B series
      'ba': 'ば', 'bi': 'び', 'bu': 'ぶ', 'be': 'べ', 'bo': 'ぼ',
      'bya': 'びゃ', 'byu': 'びゅ', 'byo': 'びょ',

      // P series
      'pa': 'ぱ', 'pi': 'ぴ', 'pu': 'ぷ', 'pe': 'ぺ', 'po': 'ぽ',
      'pya': 'ぴゃ', 'pyu': 'ぴゅ', 'pyo': 'ぴょ',

      // M series
      'ma': 'ま', 'mi': 'み', 'mu': 'む', 'me': 'め', 'mo': 'も',
      'mya': 'みゃ', 'myu': 'みゅ', 'myo': 'みょ',

      // Y series
      'ya': 'や', 'yu': 'ゆ', 'yo': 'よ',

      // R series
      'ra': 'ら', 'ri': 'り', 'ru': 'る', 're': 'れ', 'ro': 'ろ',
      'rya': 'りゃ', 'ryu': 'りゅ', 'ryo': 'りょ',

      // W series
      'wa': 'わ', 'wi': 'ゐ', 'we': 'ゑ', 'wo': 'を', 'n': 'ん',

      // Small characters
      'xa': 'ぁ', 'xi': 'ぃ', 'xu': 'ぅ', 'xe': 'ぇ', 'xo': 'ぉ',
      'xya': 'ゃ', 'xyu': 'ゅ', 'xyo': 'ょ', 'xtu': 'っ', 'xtsu': 'っ',

      // Special combinations
      'nn': 'ん',
      '-': 'ー'
    };
  }

  /**
   * Build hiragana to katakana conversion map
   */
  buildKatakanaMap() {
    const map = {};
    const hiraganaStart = 0x3041;
    const katakanaStart = 0x30A1;

    for (let i = 0; i < 96; i++) {
      const hiragana = String.fromCharCode(hiraganaStart + i);
      const katakana = String.fromCharCode(katakanaStart + i);
      map[hiragana] = katakana;
    }

    return map;
  }

  /**
   * Convert romaji input to hiragana
   */
  convertRomajiToHiragana(romaji) {
    let result = '';
    let buffer = '';

    for (let i = 0; i < romaji.length; i++) {
      buffer += romaji[i].toLowerCase();

      // Check for double consonants (sokuon)
      if (buffer.length === 2 && buffer[0] === buffer[1] &&
          'kgsztdhbpmyr'.includes(buffer[0])) {
        result += 'っ';
        buffer = buffer[1];
        continue;
      }

      // Try to match the longest possible combination
      let matched = false;
      for (let len = Math.min(buffer.length, 3); len > 0; len--) {
        const substr = buffer.slice(0, len);
        if (this.romajiToHiragana[substr]) {
          result += this.romajiToHiragana[substr];
          buffer = buffer.slice(len);
          matched = true;
          break;
        }
      }

      // If no match and buffer is getting long, output first char as-is
      if (!matched && buffer.length > 3) {
        result += buffer[0];
        buffer = buffer.slice(1);
      }
    }

    // Append remaining buffer
    result += buffer;

    return result;
  }

  /**
   * Convert hiragana to katakana
   */
  convertHiraganaToKatakana(hiragana) {
    let result = '';
    for (const char of hiragana) {
      result += this.hiraganaToKatakana[char] || char;
    }
    return result;
  }

  /**
   * Get kanji candidates from Google Transliteration API
   */
  async getKanjiCandidates(hiragana) {
    const startTime = performance.now();

    try {
      const params = new URLSearchParams({
        client: 'handwriting',
        inputtype: 'hiragana',
        text: hiragana
      });

      // Bound the request so a slow/stalled network can't block IME conversion
      // indefinitely; on timeout we fall through to the offline candidates.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      let response;
      try {
        response = await fetch(`${this.apiEndpoint}?${params}`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          },
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      // Parse response format: [["hiragana", ["kanji1", "kanji2", ...]]]
      if (data && data[0] && data[0][1]) {
        const candidates = data[0][1];

        // Update statistics
        const conversionTime = performance.now() - startTime;
        this.stats.conversions++;
        this.stats.averageConversionTime =
          (this.stats.averageConversionTime * (this.stats.conversions - 1) + conversionTime) /
          this.stats.conversions;

        return candidates.slice(0, 10); // Return top 10 candidates
      }

      return [hiragana]; // Return original if no candidates

    } catch (error) {
      console.error('JapaneseIME: Kanji conversion failed', error);

      // Fallback: return common kanji based on hiragana patterns
      return this.getOfflineKanjiCandidates(hiragana);
    }
  }

  /**
   * Offline kanji candidates (fallback)
   */
  getOfflineKanjiCandidates(hiragana) {
    // Common word dictionary for offline use (~200 entries)
    const commonWords = {
      // Greetings & phrases
      'こんにちは': ['今日は', 'こんにちは'],
      'こんばんは': ['今晩は'],
      'おはよう': ['お早う', 'おはよう'],
      'おはようございます': ['お早うございます'],
      'ありがとう': ['有り難う', 'ありがとう'],
      'ありがとうございます': ['有り難うございます'],
      'すみません': ['済みません', 'すみません'],
      'ごめんなさい': ['御免なさい'],
      'はい': ['はい', '灰', '肺'],
      'いいえ': ['いいえ'],
      'よろしく': ['宜しく'],
      'おねがいします': ['お願いします'],
      'さようなら': ['さようなら'],
      'またね': ['また、ね', '又ね'],
      'おやすみ': ['お休み'],
      // Pronouns & common nouns
      'わたし': ['私', '渡し'],
      'わたしたち': ['私たち'],
      'あなた': ['あなた', '貴方'],
      'かれ': ['彼', '彼れ'],
      'かのじょ': ['彼女'],
      'みんな': ['皆', '皆な'],
      'ひと': ['人', '一'],
      'こども': ['子供', '子ども'],
      'おとな': ['大人'],
      'ともだち': ['友達', '友人'],
      'かぞく': ['家族'],
      'ちち': ['父', '乳'],
      'はは': ['母', '波波'],
      'おとうさん': ['お父さん'],
      'おかあさん': ['お母さん'],
      // Time
      'きょう': ['今日', '京', '強'],
      'あした': ['明日', '明日'],
      'きのう': ['昨日'],
      'いま': ['今', '居ま'],
      'じかん': ['時間'],
      'ねん': ['年', '念', '燃'],
      'つき': ['月', '付き', '槻'],
      'ひ': ['日', '火', '費', '妃'],
      'あさ': ['朝', '麻', '浅'],
      'よる': ['夜', '寄る'],
      'ごご': ['午後'],
      'ごぜん': ['午前'],
      // Places
      'にほん': ['日本', '二本'],
      'とうきょう': ['東京'],
      'おおさか': ['大阪'],
      'がっこう': ['学校'],
      'うち': ['家', '内', '打ち'],
      'みせ': ['店', '見せ'],
      'えき': ['駅', '液', '易'],
      'びょういん': ['病院'],
      'ぎんこう': ['銀行'],
      'としょかん': ['図書館'],
      'こうえん': ['公園', '講演', '公演'],
      'かいしゃ': ['会社'],
      // Actions (verbs — plain / て-form common roots)
      'いる': ['要る', '居る', '入る'],
      'ある': ['有る', '在る', '或る'],
      'する': ['する', '刷る'],
      'くる': ['来る', '繰る'],
      'いく': ['行く', '逝く'],
      'みる': ['見る', '観る'],
      'きく': ['聞く', '聴く', '効く'],
      'はなす': ['話す', '放す'],
      'よむ': ['読む'],
      'かく': ['書く', '描く', '欠く'],
      'たべる': ['食べる'],
      'のむ': ['飲む', '呑む'],
      'かう': ['買う', '飼う', '交う'],
      'うる': ['売る', '得る'],
      'くれる': ['呉れる'],
      'あげる': ['上げる', '揚げる'],
      'もらう': ['貰う'],
      'おもう': ['思う'],
      'しる': ['知る'],
      'わかる': ['分かる', '解る'],
      'できる': ['出来る'],
      'なる': ['成る', '鳴る', '慣る'],
      'みえる': ['見える'],
      'きこえる': ['聞こえる'],
      // Adjectives
      'おおきい': ['大きい'],
      'ちいさい': ['小さい'],
      'たかい': ['高い', '貴い'],
      'やすい': ['安い', '易い'],
      'あたらしい': ['新しい'],
      'ふるい': ['古い'],
      'いい': ['良い', '好い'],
      'わるい': ['悪い'],
      'おもしろい': ['面白い'],
      'たのしい': ['楽しい'],
      'かわいい': ['可愛い'],
      'きれい': ['綺麗', 'きれい'],
      'むずかしい': ['難しい'],
      'やさしい': ['優しい', '易しい'],
      'はやい': ['速い', '早い'],
      'おそい': ['遅い'],
      'おおい': ['多い'],
      'すくない': ['少ない'],
      'あかい': ['赤い'],
      'あおい': ['青い', '蒼い'],
      'しろい': ['白い'],
      'くろい': ['黒い'],
      // Tech / internet vocabulary
      'いんたーねっと': ['インターネット'],
      'すまーとふぉん': ['スマートフォン'],
      'ぱそこん': ['パソコン'],
      'でんわ': ['電話', '伝話'],
      'めーる': ['メール'],
      'うぇぶ': ['ウェブ'],
      'あぷり': ['アプリ'],
      'でーた': ['データ'],
      'ふぁいる': ['ファイル'],
      'ぱすわーど': ['パスワード'],
      'めにゅー': ['メニュー'],
      'せってい': ['設定'],
      'かくにん': ['確認'],
      'とうろく': ['登録'],
      'ろぐいん': ['ログイン'],
      'ろぐあうと': ['ログアウト'],
      'けんさく': ['検索'],
      'ほーむぺーじ': ['ホームページ'],
      // VR / 3D
      'ばーちゃるりありてぃ': ['バーチャルリアリティ'],
      'VR': ['VR'],
      'がぞう': ['画像', '画像'],
      'どうが': ['動画'],
      'さんじげん': ['三次元', '3次元'],
      'あばたー': ['アバター'],
      // Common kanji combos
      'あり': ['有り', '在り', '蟻'],
      'かい': ['会', '回', '階', '海', '界'],
      'きかい': ['機会', '機械', '器械'],
      'さくら': ['桜', '佐倉', 'さくら'],
      'せんせい': ['先生', '専制', '宣誓'],
      'べんきょう': ['勉強'],
      'みず': ['水', '見ず'],
      'やま': ['山'],
      'りんご': ['林檎', 'りんご', 'リンゴ'],
      'ねこ': ['猫', 'ネコ'],
      'いぬ': ['犬', 'イヌ'],
      'さかな': ['魚', '肴'],
      'くるま': ['車', '来るま'],
      'でんしゃ': ['電車'],
      'ひこうき': ['飛行機'],
      'たべもの': ['食べ物'],
      'のみもの': ['飲み物'],
      'おちゃ': ['お茶'],
      'みち': ['道', '未知'],
      'そら': ['空', '宙'],
      'うみ': ['海', '生み'],
      'かわ': ['川', '河', '革', '皮'],
      'はな': ['花', '鼻', '話'],
      'き': ['木', '気', '機', '期', '記'],
      'いえ': ['家', '言え'],
      'かね': ['金', '鐘'],
      'こと': ['事', '言', '琴'],
      'もの': ['物', '者', '門'],
      'とき': ['時', '溶き'],
      'ところ': ['所', '処'],
      'なまえ': ['名前'],
      'ことば': ['言葉', '言語'],
      'こえ': ['声', '越え'],
      'め': ['目', '芽', '女'],
      'て': ['手', '照'],
      'あし': ['足', '脚', '葦'],
      'かみ': ['神', '紙', '髪', '上'],
      'こころ': ['心', '核'],
      'ちから': ['力'],
      'いのち': ['命']
    };

    return commonWords[hiragana] || [hiragana];
  }

  /**
   * Remove the last character from the composition buffer (backspace).
   * Returns the same shape as processInput so callers can refresh the display.
   */
  deleteLast() {
    this.compositionBuffer = this.compositionBuffer.slice(0, -1);
    let converted = this.compositionBuffer;
    if (this.inputMode === 'hiragana') {
      converted = this.convertRomajiToHiragana(this.compositionBuffer);
    } else if (this.inputMode === 'katakana') {
      const hiragana = this.convertRomajiToHiragana(this.compositionBuffer);
      converted = this.convertHiraganaToKatakana(hiragana);
    }
    return { raw: this.compositionBuffer, converted, mode: this.inputMode };
  }

  /**
   * Process keyboard input
   */
  async processInput(input) {
    this.stats.charactersTyped++;

    // Add to composition buffer
    this.compositionBuffer += input;

    // Convert based on current mode
    let converted = this.compositionBuffer;

    if (this.inputMode === 'hiragana') {
      converted = this.convertRomajiToHiragana(this.compositionBuffer);
    } else if (this.inputMode === 'katakana') {
      const hiragana = this.convertRomajiToHiragana(this.compositionBuffer);
      converted = this.convertHiraganaToKatakana(hiragana);
    }

    return {
      raw: this.compositionBuffer,
      converted: converted,
      mode: this.inputMode
    };
  }

  /**
   * Trigger kanji conversion
   */
  async convertToKanji() {
    if (this.inputMode !== 'hiragana' || !this.compositionBuffer) {
      return null;
    }

    const hiragana = this.convertRomajiToHiragana(this.compositionBuffer);
    this.candidates = await this.getKanjiCandidates(hiragana);
    this.selectedIndex = 0;

    return {
      candidates: this.candidates,
      selected: this.candidates[0]
    };
  }

  /**
   * Select candidate
   */
  selectCandidate(index) {
    if (index >= 0 && index < this.candidates.length) {
      this.selectedIndex = index;
      return this.candidates[index];
    }
    return null;
  }

  /**
   * Confirm selection
   */
  confirmSelection() {
    const selected = this.candidates[this.selectedIndex] || this.compositionBuffer;
    this.clear();
    return selected;
  }

  /**
   * Clear composition
   */
  clear() {
    this.compositionBuffer = '';
    this.candidates = [];
    this.selectedIndex = 0;
  }

  /**
   * Switch input mode
   */
  switchMode(mode) {
    if (['hiragana', 'katakana', 'kanji'].includes(mode)) {
      this.inputMode = mode;
      return true;
    }
    return false;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      isActive: this.isActive,
      mode: this.inputMode,
      buffer: this.compositionBuffer,
      candidates: this.candidates,
      selectedIndex: this.selectedIndex,
      stats: this.stats
    };
  }

  /**
   * Activate IME
   */
  activate() {
    this.isActive = true;
    this.clear();
    console.debug('JapaneseIME: Activated');
  }

  /**
   * Deactivate IME
   */
  deactivate() {
    this.isActive = false;
    this.clear();
    console.debug('JapaneseIME: Deactivated');
  }

  /**
   * Release all resources held by this instance.
   * Any in-flight fetch (getKanjiCandidates) will complete but its result
   * is discarded because candidates/compositionBuffer are cleared here.
   */
  dispose() {
    this.clear();
    this.isActive = false;
  }
}

/**
 * VR Keyboard Integration for Japanese IME
 */
/**
 * Visual cues for a conversion candidate at a given list position. The primary
 * (default) candidate must not be signalled by colour alone (WCAG 1.4.1), so it
 * also carries a heavier border (a shape cue) and every candidate gets a 1-based
 * order number — the universal Japanese-IME convention — which conveys primacy
 * and order independently of colour vision. Pure / unit-testable.
 *
 * @param {number} index  0-based position in the candidate list
 * @returns {{bg:string, border:string, lineWidth:number, number:string}}
 */
export function candidateStyle(index) {
  const primary = index === 0;
  return {
    bg: primary ? '#2a4a22' : '#1c2438',
    border: primary ? '#44cc88' : '#4466aa',
    lineWidth: primary ? 9 : 5,   // primary stands out by border WEIGHT, not hue alone
    number: String(index + 1)      // 1-based order label
  };
}

export class VRJapaneseKeyboard {
  /**
   * @param {THREE.Scene} scene
   * @param {JapaneseIME} ime
   * @param {object} [opts]
   * @param {Function} [opts.registerInteractable]   — (mesh, handlers) from VRApp
   * @param {Function} [opts.unregisterInteractable] — (mesh) from VRApp
   * @param {number}   [opts.scale=1] — uniform key-size multiplier (motor /
   *   low-vision: larger targets reduce mis-taps; WCAG 2.5.5)
   */
  constructor(scene, ime, opts = {}) {
    this.scene = scene;
    this.ime = ime;
    this.keyboard = null;
    this.candidatePanel = null;
    this._onConfirmCallback = null;

    this.registerInteractable = opts.registerInteractable || null;
    this.unregisterInteractable = opts.unregisterInteractable || null;
    this.scale = opts.scale || 1;

    // 3D objects (created lazily by createKeyboard()).
    this.group = null;          // THREE.Group holding panel + keys + display
    this.keyMeshes = [];        // [{ mesh, label }]
    this._displayCanvas = null;
    this._displayTex = null;
    this._candidateMeshes = []; // live candidate button meshes (rebuilt on each showCandidates call)
    this._candidatesGroup = null; // THREE.Group added to this.group for easy show/hide
  }

  /**
   * Register a one-shot callback invoked when the user presses Enter.
   * The callback receives the confirmed text.  It is automatically cleared
   * after firing so it doesn't leak into the next input session.
   */
  setOnConfirm(callback) {
    this._onConfirmCallback = typeof callback === 'function' ? callback : null;
  }

  clearOnConfirm() {
    this._onConfirmCallback = null;
  }

  /**
   * Build the 3D VR keyboard: a backing panel, a composition-text display, and
   * one selectable mesh per key. Idempotent — returns the existing group if
   * already built. Keys are registered as interactables so controller rays can
   * select them; selection routes to onKeyPress().
   */
  createKeyboard() {
    if (this.group) {
      return this.keyboard;
    }

    const keys = computeKeyLayout(undefined, this.scale);
    const { width, height } = keyboardBounds(undefined, this.scale);
    const DISPLAY_H = 0.09 * this.scale; // composition-text strip above the keys

    const group = new THREE.Group();
    group.name = 'vrKeyboard';

    // Backing panel (sits slightly behind the keys).
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.04, height + DISPLAY_H + 0.06),
      new THREE.MeshBasicMaterial({ color: 0x0a0d18, transparent: true, opacity: 0.92 })
    );
    panel.position.set(0, (DISPLAY_H + 0.06) / 2 - 0.02, -0.005);
    group.add(panel);

    // Composition-text display strip.
    this._displayCanvas = document.createElement('canvas');
    this._displayCanvas.width = 1024;
    this._displayCanvas.height = 96;
    this._displayTex = new THREE.CanvasTexture(this._displayCanvas);
    this._displayTex.colorSpace = THREE.SRGBColorSpace;
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(width, DISPLAY_H),
      new THREE.MeshBasicMaterial({ map: this._displayTex, transparent: true })
    );
    display.position.set(0, height / 2 + DISPLAY_H / 2 + 0.01, 0);
    group.add(display);
    this._displayMesh = display;

    // One mesh per key.
    this.keyMeshes = [];
    for (const k of keys) {
      const tex = this._makeKeyTexture(k.glyph || k.label, false);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(k.w, k.h),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      mesh.position.set(k.x, k.y, 0);
      mesh.userData.keyLabel = k.label;
      mesh.userData.keyTex = tex;
      mesh.userData.keyGlyph = k.glyph || k.label;
      group.add(mesh);
      this.keyMeshes.push({ mesh, label: k.label });

      if (this.registerInteractable) {
        this.registerInteractable(mesh, {
          onSelect: () => this.onKeyPress(k.label),
          onHover: () => this._setKeyHover(mesh, true),
          onHoverEnd: () => this._setKeyHover(mesh, false)
        });
      }
    }

    // Default placement: in front of and below eye level, angled up slightly.
    group.position.set(0, 1.0, -0.6);
    group.rotation.x = -Math.PI / 9;
    group.visible = false;

    this.scene.add(group);
    this.group = group;
    this._refreshDisplay();

    // Keep a small descriptor for back-compat with callers checking .keyboard.
    this.keyboard = { keys, group };
    return this.keyboard;
  }

  /** Draw a single key's label onto a CanvasTexture. */
  /**
   * @param {string}  glyph
   * @param {boolean} hover   pointer is over this key
   * @param {boolean} active  key is in a latched-on state (e.g. shift/katakana)
   */
  _makeKeyTexture(glyph, hover, active = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    // Active (latched) keys get a warm amber tint; hover overrides to blue.
    if (hover) {
      ctx.fillStyle = '#2d3a66';
    } else if (active) {
      ctx.fillStyle = '#5a3a10';
    } else {
      ctx.fillStyle = '#1c2438';
    }
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = active ? '#ffaa44' : '#3a4666';
    ctx.lineWidth = 5;
    ctx.strokeRect(3, 3, 122, 122);
    ctx.fillStyle = active ? '#ffcc88' : '#ffffff';
    ctx.font = (glyph && glyph.length > 1) ? 'bold 40px sans-serif' : 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, 64, 70);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** Repaint a key to show/clear the hover highlight. */
  _setKeyHover(mesh, hover) {
    const old = mesh.userData.keyTex;
    const active = mesh.userData.keyActive || false;
    const tex = this._makeKeyTexture(mesh.userData.keyGlyph, hover, active);
    mesh.material.map = tex;
    mesh.material.needsUpdate = true;
    mesh.userData.keyTex = tex;
    if (old) {
      old.dispose();
    }
  }

  /**
   * Update the visual active state of mode-toggle keys (shift) to reflect the
   * current input mode.  Called whenever the mode changes.
   */
  _refreshKeyStates() {
    if (!this.keyMeshes || !this.ime) {
      return;
    }
    const katakanaActive = this.ime.inputMode === 'katakana';
    for (const { mesh, label } of this.keyMeshes) {
      if (label === 'shift') {
        const wasActive = !!mesh.userData.keyActive;
        if (wasActive !== katakanaActive) {
          mesh.userData.keyActive = katakanaActive;
          this._setKeyHover(mesh, false); // repaint at rest state
        }
      }
    }
  }

  /**
   * Remove all live candidate button meshes and hide the candidates group.
   * Safe to call even if no candidates are showing.
   */
  _clearCandidates() {
    if (!this._candidatesGroup) {
      return;
    }
    for (const { mesh } of this._candidateMeshes) {
      if (this.unregisterInteractable) {
        this.unregisterInteractable(mesh);
      }
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        if (mesh.material.map) {
          mesh.material.map.dispose();
        }
        mesh.material.dispose();
      }
      this._candidatesGroup.remove(mesh);
    }
    this._candidateMeshes = [];
    this._candidatesGroup.visible = false;
  }

  /** Render the current composition buffer into the display strip. */
  _refreshDisplay() {
    if (!this._displayCanvas) {
      return;
    }
    const ctx = this._displayCanvas.getContext('2d');
    const w = this._displayCanvas.width;
    const h = this._displayCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#111726';
    ctx.fillRect(0, 0, w, h);

    // Mode badge — top-right corner shows the current input mode so the user
    // always knows whether they're typing hiragana, katakana, or kanji.
    const mode = this.ime ? this.ime.inputMode : 'hiragana';
    const BADGE = { hiragana: 'ひ', katakana: 'カ', kanji: '漢' };
    const badge = BADGE[mode] || '?';
    const badgeColors = { hiragana: '#4488ff', katakana: '#ff8844', kanji: '#44cc88' };
    const badgeBg = badgeColors[mode] || '#558';
    const badgeW = 80;
    ctx.fillStyle = badgeBg;
    ctx.fillRect(w - badgeW - 4, 4, badgeW, h - 8);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, w - badgeW / 2 - 4, h / 2);

    // Composition text
    const text = this.ime ? (this.ime.compositionBuffer || '') : '';
    ctx.fillStyle = text ? '#e8ecff' : '#667788';
    ctx.font = '40px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text || 'type a URL or search…', 24, h / 2);

    if (this._displayTex) {
      this._displayTex.needsUpdate = true;
    }
    // Keep key active-state (e.g. shift/katakana tint) in sync with mode.
    this._refreshKeyStates();
  }

  /** Show the keyboard (builds it on first use). */
  show() {
    if (!this.group) {
      this.createKeyboard();
    }
    if (this.group) {
      this.group.visible = true;
    }
    this._refreshDisplay();
  }

  /** Hide the keyboard. */
  hide() {
    if (this.group) {
      this.group.visible = false;
    }
  }

  /**
   * Handle key press
   */
  async onKeyPress(key) {
    if (!this.ime.isActive) {
      this.ime.activate();
    }

    switch (key) {
    case 'space': {
      // Convert to kanji
      const result = await this.ime.convertToKanji();
      if (result) {
        this.showCandidates(result.candidates);
      }
      break;
    }

    case '変換':
      // Henkan key - convert to kanji
      await this.ime.convertToKanji();
      break;

    case 'かな':
      // Kana key - switch to hiragana
      this.ime.switchMode('hiragana');
      break;

    case 'enter': {
      // Confirm selection
      const text = this.ime.confirmSelection();
      this.onTextConfirmed(text);
      break;
    }

    case 'shift': {
      // Toggle katakana mode; refresh display so the mode badge updates and
      // retint the shift key to show its latched-on state.
      const currentMode = this.ime.inputMode;
      this.ime.switchMode(currentMode === 'katakana' ? 'hiragana' : 'katakana');
      this._refreshKeyStates();
      this._refreshDisplay();
      break;
    }

    case 'esc':
      // Dismiss the keyboard without confirming — clears the buffer and
      // any candidate row silently.
      this.ime.compositionBuffer = '';
      this._clearCandidates();
      this.hide();
      break;

    case 'back':
      // Backspace — remove the last composed character.
      this.updateDisplay(this.ime.deleteLast());
      break;

    default:
      // Regular character input
      if (key.length === 1) {
        const processed = await this.ime.processInput(key);
        this.updateDisplay(processed);
      }
      break;
    }
  }

  /**
   * Display a row of selectable kanji candidate buttons above the keyboard.
   * Each button shows one candidate; selecting it commits that candidate.
   * Previously-shown candidates are cleared first (idempotent).
   *
   * @param {string[]} candidates
   */
  showCandidates(candidates) {
    if (!this.group || !candidates || candidates.length === 0) {
      return;
    }

    this._clearCandidates();

    // Lazily create the candidates group on first use.
    if (!this._candidatesGroup) {
      this._candidatesGroup = new THREE.Group();
      this._candidatesGroup.name = 'candidatesRow';
      this.group.add(this._candidatesGroup);
    }

    const MAX = 8;
    const shown = candidates.slice(0, MAX);
    const BTN_W = 0.09;
    const BTN_H = 0.07;
    const GAP_C = 0.008;
    const rowWidth = shown.length * BTN_W + (shown.length - 1) * GAP_C;

    // Position the strip above the display.  The display sits at
    //   group-local y = height/2 + DISPLAY_H/2 + 0.01
    // so the candidate row goes above that by another DISPLAY_H.
    const { height } = keyboardBounds(undefined, this.scale);
    const DISPLAY_H = 0.09 * this.scale;
    const stripY = height / 2 + DISPLAY_H + DISPLAY_H / 2 + 0.02;

    shown.forEach((kanji, i) => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const style = candidateStyle(i);
      ctx.fillStyle = style.bg;
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = style.border;
      ctx.lineWidth = style.lineWidth;
      ctx.strokeRect(3, 3, 122, 122);
      // Order number (top-left): conveys primacy/order without relying on colour.
      ctx.fillStyle = '#cceeff';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(style.number, 10, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 60px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(kanji, 64, 70);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;

      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(BTN_W, BTN_H),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true })
      );
      const x = -rowWidth / 2 + i * (BTN_W + GAP_C) + BTN_W / 2;
      mesh.position.set(x, stripY, 0);
      this._candidatesGroup.add(mesh);
      this._candidateMeshes.push({ mesh });

      if (this.registerInteractable) {
        this.registerInteractable(mesh, {
          onSelect: () => {
            const text = this.ime.selectCandidate
              ? this.ime.selectCandidate(i)
              : kanji;
            this._clearCandidates();
            this.onTextConfirmed(text || kanji);
          },
          onHover: () => {
            // Lighten the selected candidate on hover.
            ctx.fillStyle = '#3a5a32';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = '#66ee99';
            ctx.lineWidth = 5;
            ctx.strokeRect(3, 3, 122, 122);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(kanji, 64, 70);
            tex.needsUpdate = true;
          },
          onHoverEnd: () => {
            ctx.fillStyle = i === 0 ? '#2a4a22' : '#1c2438';
            ctx.fillRect(0, 0, 128, 128);
            ctx.strokeStyle = i === 0 ? '#44cc88' : '#4466aa';
            ctx.lineWidth = 5;
            ctx.strokeRect(3, 3, 122, 122);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(kanji, 64, 70);
            tex.needsUpdate = true;
          }
        });
      }
    });

    this._candidatesGroup.visible = true;
  }

  /**
   * Update display with current composition — repaints the 3D display strip
   * and clears any candidate row (new input supersedes conversion candidates).
   */
  updateDisplay(processed) {
    console.debug(`Input: ${processed.raw} → ${processed.converted} [${processed.mode}]`);
    this._clearCandidates();
    this._refreshDisplay();
  }

  /**
   * Called when the user commits a text entry (Enter key).
   * Fires the registered one-shot callback, then clears it, and hides the
   * keyboard so it doesn't linger after input completes.
   */
  onTextConfirmed(text) {
    console.debug('Confirmed:', text);
    this.hide();
    if (this._onConfirmCallback) {
      const cb = this._onConfirmCallback;
      this._onConfirmCallback = null; // clear before calling to prevent re-entrancy
      cb(text);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return this.ime.getState().stats;
  }

  dispose() {
    this.clearOnConfirm();

    // Tear down 3D resources: unregister interactables, dispose geometry/
    // materials/textures, and remove the group from the scene.
    for (const { mesh } of this.keyMeshes) {
      this.unregisterInteractable?.(mesh);
      if (mesh.geometry) {
        mesh.geometry.dispose();
      }
      if (mesh.material) {
        mesh.material.dispose();
      }
      if (mesh.userData.keyTex) {
        mesh.userData.keyTex.dispose();
      }
    }
    this.keyMeshes = [];

    if (this._displayMesh) {
      if (this._displayMesh.geometry) {
        this._displayMesh.geometry.dispose();
      }
      if (this._displayMesh.material) {
        this._displayMesh.material.dispose();
      }
      this._displayMesh = null;
    }
    if (this._displayTex) {
      this._displayTex.dispose(); this._displayTex = null;
    }
    this._displayCanvas = null;

    if (this.group) {
      // Dispose any remaining children (panel) and detach from scene.
      this.group.traverse?.((o) => {
        if (o.geometry) {
          o.geometry.dispose?.();
        }
        if (o.material && o.material.dispose) {
          o.material.dispose();
        }
      });
      if (this.scene) {
        this.scene.remove(this.group);
      }
      this.group = null;
    }

    // Candidate meshes are children of this.group which is traversed above,
    // but we still need to unregister them as interactables.
    this._clearCandidates();
    this._candidatesGroup = null;

    this.keyboard = null;
    this.candidatePanel = null;
    if (this.ime) {
      this.ime.dispose();
    }
  }
}

/**
 * Usage Example:
 *
 * const ime = new JapaneseIME();
 * const vrKeyboard = new VRJapaneseKeyboard(scene, ime);
 * vrKeyboard.createKeyboard();
 *
 * // Type "konnichiha" → "こんにちは"
 * await ime.processInput('k');
 * await ime.processInput('o');
 * await ime.processInput('n');
 * await ime.processInput('n');
 * await ime.processInput('i');
 * await ime.processInput('c');
 * await ime.processInput('h');
 * await ime.processInput('i');
 * await ime.processInput('h');
 * await ime.processInput('a');
 *
 * // Convert to kanji
 * const result = await ime.convertToKanji();
 * console.debug(result.candidates); // ['今日は', 'こんにちは']
 *
 * // Select first candidate
 * const confirmed = ime.confirmSelection();
 * console.debug(confirmed); // '今日は'
 */
