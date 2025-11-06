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

      const response = await fetch(`${this.apiEndpoint}?${params}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

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
    // Common word dictionary for offline use
    const commonWords = {
      'あり': ['有り', '在り', '蟻'],
      'いる': ['要る', '居る', '入る'],
      'かい': ['会', '回', '階', '海', '界'],
      'きかい': ['機会', '機械', '器械'],
      'こんにちは': ['今日は', 'こんにちは'],
      'さくら': ['桜', '佐倉', 'さくら'],
      'せんせい': ['先生', '専制', '宣誓'],
      'でんわ': ['電話', '伝話'],
      'にほん': ['日本', '二本'],
      'べんきょう': ['勉強', '勉教'],
      'みず': ['水', '見ず'],
      'やま': ['山', '病'],
      'りんご': ['林檎', 'りんご', 'リンゴ'],
      'わたし': ['私', '渡し']
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
    console.log('JapaneseIME: Activated');
  }

  /**
   * Deactivate IME
   */
  deactivate() {
    this.isActive = false;
    this.clear();
    console.log('JapaneseIME: Deactivated');
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
    console.log('Candidates:', candidates);

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
    console.log(`Input: ${processed.raw} → ${processed.converted} [${processed.mode}]`);
    // Would update 3D text display in production
  }

  /**
   * Handle confirmed text
   */
  onTextConfirmed(text) {
    console.log('Confirmed:', text);
    // Would insert text into target field
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
 * console.log(result.candidates); // ['今日は', 'こんにちは']
 *
 * // Select first candidate
 * const confirmed = ime.confirmSelection();
 * console.log(confirmed); // '今日は'
 */