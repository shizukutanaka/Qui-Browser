/**
 * Japanese IME for VR
 * Enables Japanese text input in VR - unlocks 100M+ market
 *
 * John Carmack principle: Solve real problems for real users
 */

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
      'いのち': ['命'],
    };

    return commonWords[hiragana] || [hiragana];
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
export class VRJapaneseKeyboard {
  constructor(scene, ime) {
    this.scene = scene;
    this.ime = ime;
    this.keyboard = null;
    this.candidatePanel = null;
    this._onConfirmCallback = null;
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
   * Create VR keyboard with Japanese layout
   */
  createKeyboard() {
    // This would create a 3D keyboard in the VR scene
    // Simplified for demonstration

    const keyboard = {
      keys: [],
      position: { x: 0, y: 1, z: -0.5 },
      scale: 0.02
    };

    // Japanese keyboard layout (JIS)
    const layout = [
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '^', '¥'],
      ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '@', '['],
      ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', ':', ']'],
      ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '\\'],
      ['shift', 'ctrl', 'alt', 'space', '変換', 'かな', 'enter']
    ];

    // Create keys (simplified - would be 3D meshes in production)
    layout.forEach((row, rowIndex) => {
      row.forEach((key, colIndex) => {
        keyboard.keys.push({
          label: key,
          position: {
            x: (colIndex - 6) * 0.05,
            y: -rowIndex * 0.05,
            z: 0
          },
          action: () => this.onKeyPress(key)
        });
      });
    });

    this.keyboard = keyboard;
    return keyboard;
  }

  /**
   * Handle key press
   */
  async onKeyPress(key) {
    if (!this.ime.isActive) {
      this.ime.activate();
    }

    switch(key) {
      case 'space':
        // Convert to kanji
        const result = await this.ime.convertToKanji();
        if (result) {
          this.showCandidates(result.candidates);
        }
        break;

      case '変換':
        // Henkan key - convert to kanji
        await this.ime.convertToKanji();
        break;

      case 'かな':
        // Kana key - switch to hiragana
        this.ime.switchMode('hiragana');
        break;

      case 'enter':
        // Confirm selection
        const text = this.ime.confirmSelection();
        this.onTextConfirmed(text);
        break;

      case 'shift':
        // Toggle katakana mode
        const currentMode = this.ime.inputMode;
        this.ime.switchMode(currentMode === 'katakana' ? 'hiragana' : 'katakana');
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
   * Show kanji candidates
   */
  showCandidates(candidates) {
    // Create candidate selection panel in VR
    console.debug('Candidates:', candidates);

    // Would create 3D UI panel in production
    this.candidatePanel = {
      candidates: candidates,
      visible: true
    };
  }

  /**
   * Update display with current composition
   */
  updateDisplay(processed) {
    console.debug(`Input: ${processed.raw} → ${processed.converted} [${processed.mode}]`);
    // Would update 3D text display in production
  }

  /**
   * Called when the user commits a text entry (Enter key).
   * Fires the registered one-shot callback, then clears it.
   */
  onTextConfirmed(text) {
    console.debug('Confirmed:', text);
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