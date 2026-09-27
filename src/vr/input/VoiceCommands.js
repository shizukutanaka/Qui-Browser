/**
 * Voice Command System for VR
 * Hands-free control with natural language processing
 *
 * John Carmack principle: Voice is the ultimate VR input
 */

export class VoiceCommands {
  constructor() {
    this.recognition = null;
    this.synthesis = null;
    this.isListening = false;
    this.isEnabled = false;

    // Command registry
    this.commands = new Map();
    this.aliases = new Map();
    this._startedAt = Date.now();

    // Optional volume-change handler (0..1 gain delta). The volume-up/down
    // commands are registered unconditionally (they exist regardless of a
    // browser surface), but they only move a real control once the host wires
    // this via connectBrowser({ onVolume }).
    this._onVolume = null;
    // Same wiring for the settings/status commands — set in connectBrowser.
    this._onCaptionScale = null;
    this._onDwellTime = null;
    this._onVolumeStatus = null;
    this._onReaderScale = null;
    this._onHighContrast = null;
    this._onSearchEngine = null;
    this._onRestoreSession = null;
    this._onSettingToggle = null;
    this._onSettingStatus = null; // (key) => value — read-only twin of onSettingToggle
    this._onPanelDistance = null;
    this._onMute = null;
    this._onStepper = null;
    this._onVideoSeek = null;
    this._onSettingsPanel = null;
    this._onBookmarkOpen = null;
    this._onHistoryOpen = null;
    this._onBookmarkOpenNamed = null;
    this._onHistoryOpenNamed = null;
    this._onReaderLine = null;
    this._onBookmarkList = null;
    this._onHistoryList = null;
    this._onCopyTitle = null;
    this._onReadHere = null;
    this._onTopSiteOpen = null;
    this._onHistorySearch = null;
    this._onReaderScroll = null;
    this._onReaderProgress = null;
    this._onBookmarkSearch = null;
    this._onFindMatch = null;
    this._onRemainingTime = null;
    this._onHeadingSelect = null;
    this._onFindStatus = null;
    this._onFindLast = null;
    this._onReadLine = null;
    this._onParagraphStep = null;
    this._onParagraphSelect = null;
    this._onParagraphStatus = null;
    this._onCharCount = null;
    this._onReadParagraph = null;
    this._onLineStatus = null;
    this._onTabStatus = null;
    this._onPrivacyStatus = null;
    this._onPinStatus = null;
    this._onJumpBack = null;
    this._onClearFind = null;
    this._onCopyLine = null;
    this._onCopyArticle = null;
    this._onReaderPercent = null;
    this._onReaderScaleStatus = null;
    this._onContrastStatus = null;
    this._onDwellTimeStatus = null;
    this._onSessionSave = null;
    this._onPasteGo = null;
    this._onReadClipboard = null;
    this._onRecenter = null;
    this._onVideoStatus = null;
    this._onMuteStatus = null;
    this._onFindQuery = null;
    this._onReadFromLine = null;
    this._onHalfPage = null;
    this._onSentenceStep = null;
    this._onSentence = null;
    this._onSentenceStatus = null;
    this._onLastParagraph = null;
    this._onReadParagraphAt = null;
    this._onSearchEngineStatus = null;
    this._onCharStep = null;
    this._onWord = null;
    this._onSpellWord = null;
    this._onHeadingHere = null;
    this._onArticleSummary = null;
    this._onShare = null;
    this._onDismissNotify = null; // () => truthy — clears pending captions/toasts
    this._onReadNotify = null; // () => string|null — newest caption line
    this._onSessionClear = null;

    // Language settings
    this.language = 'ja-JP'; // Japanese default
    this.fallbackLanguage = 'en-US';

    // Recognition settings
    this.settings = {
      continuous: true,
      interimResults: true,
      maxAlternatives: 3,
      sensitivity: 0.7, // 0-1
      wakeWord: 'キューブラウザ', // "Qui Browser"
      requireWakeWord: false
    };

    // State
    this.lastCommand = null;
    this._lastSpoken = null; // last text passed to speak() — say-again replays it
    this._speechRate = 1.0; // 0.5–3.0, applied to every utterance (NVDA rate parity)
    this._speechPitch = 1.0; // 0.5–2.0, applied to every utterance (NVDA pitch parity)
    this._voice = null; // picked SpeechSynthesisVoice — select-voice cycles the engine list
    this.lastTranscript = '';
    this._prevTranscript = ''; // transcript before the current one — 'what did I say' echo
    this._repeatableTranscript = ''; // last non-repeat transcript — Vim '.' parity
    this.confidence = 0;
    this.isAwake = !this.settings.requireWakeWord;
    // late-bound at connectBrowser — hoisted status queries read it, never capture it
    this._tabManager = null;

    // Statistics
    this.stats = {
      commandsRecognized: 0,
      commandsExecuted: 0,
      commandsFailed: 0,
      averageConfidence: 0,
      totalListenTime: 0
    };

    // Callbacks
    this.callbacks = {
      onCommand: null,       // (key, result)  — command executed successfully
      onCommandFailed: null, // ({reason, transcript}) — no match or action threw
      onTranscript: null,
      onError: null,
      onStart: null,
      onEnd: null,
      onSpeak: null // mirror of spoken feedback for a visual channel (captions)
    };

    this.registerDefaultCommands();
  }

  /**
   * Initialize voice recognition
   */
  async initialize() {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const SpeechSynthesis = window.speechSynthesis;

    if (!SpeechRecognition) {
      console.error('VoiceCommands: Speech recognition not supported');
      return false;
    }

    try {
      // Setup recognition
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = this.settings.continuous;
      this.recognition.interimResults = this.settings.interimResults;
      this.recognition.maxAlternatives = this.settings.maxAlternatives;
      this.recognition.lang = this.language;

      // Setup synthesis
      this.synthesis = SpeechSynthesis;

      // Setup event handlers
      this.setupRecognitionHandlers();

      this.isEnabled = true;
      console.debug('VoiceCommands: Initialized successfully');
      return true;

    } catch (error) {
      console.error('VoiceCommands: Initialization failed', error);
      return false;
    }
  }

  /**
   * Setup recognition event handlers
   */
  setupRecognitionHandlers() {
    this.recognition.onstart = () => {
      this.isListening = true;
      console.debug('VoiceCommands: Listening started');

      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.debug('VoiceCommands: Listening ended');

      if (this.callbacks.onEnd) {
        this.callbacks.onEnd();
      }

      // Restart if continuous mode
      if (this.settings.continuous && this.isEnabled) {
        setTimeout(() => {
          if (this.isEnabled) {
            this.start();
          }
        }, 100);
      }
    };

    this.recognition.onresult = (event) => {
      this.handleRecognitionResult(event);
    };

    this.recognition.onerror = (event) => {
      console.error('VoiceCommands: Recognition error', event.error);

      // Permission/service errors are fatal: recognition ends immediately and
      // onend's continuous-mode restart would spin in a tight loop (restart →
      // error → restart). Disable so onend stops restarting.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.isEnabled = false;
      }

      if (this.callbacks.onError) {
        this.callbacks.onError(event.error);
      }
    };
  }

  /**
   * Handle recognition result
   */
  handleRecognitionResult(event) {
    const result = event.results[event.results.length - 1];
    const transcript = result[0].transcript.trim();
    const confidence = result[0].confidence;
    const isFinal = result.isFinal;

    this._prevTranscript = this.lastTranscript;
    this.lastTranscript = transcript;
    this.confidence = confidence;

    console.debug(`VoiceCommands: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

    // Callback for transcript
    if (this.callbacks.onTranscript) {
      this.callbacks.onTranscript(transcript, confidence, isFinal);
    }

    // Confidence threshold — but skip it when the engine reports exactly 0.
    // Android Chrome (the Meta Quest browser's engine) routinely returns
    // confidence === 0 even for correctly recognized FINAL results, especially
    // with lang='ja-JP' (this app's default). A literal 0.7 cutoff would then
    // silently drop EVERY Japanese command on the primary target device — the
    // headset. A 0 means "no score provided", not "zero confidence", so we let
    // it through and rely on command-pattern matching to reject true garbage.
    // (Qiita: Web Speech API stability — confidence is unreliable on Android.)
    if (confidence > 0 && confidence < this.settings.sensitivity) {
      console.debug('VoiceCommands: Low confidence, ignoring');
      return;
    }

    // Check for wake word
    if (this.settings.requireWakeWord && !this.isAwake) {
      if (this.containsWakeWord(transcript)) {
        this.isAwake = true;
        this.speak('はい、聞いています'); // "Yes, I'm listening"
        console.debug('VoiceCommands: Wake word detected');
      }
      return;
    }

    // Process command if final
    if (isFinal) {
      this.processCommand(transcript, confidence);

      // Reset wake state after command
      if (this.settings.requireWakeWord) {
        setTimeout(() => {
          this.isAwake = false;
        }, 5000); // 5 second timeout
      }
    }
  }

  /**
   * First-match dispatch against the command map, then the alias map.
   * Returns { command, key } or null.
   */
  _matchCommand(normalized) {
    for (const [key, command] of this.commands) {
      if (command.patterns.some(pattern => {
        if (typeof pattern === 'string') {
          return normalized === pattern.toLowerCase();
        } else if (pattern instanceof RegExp) {
          return pattern.test(normalized);
        }
        return false;
      })) {
        return { command, key };
      }
    }
    for (const [alias, commandKey] of this.aliases) {
      if (normalized.includes(alias.toLowerCase())) {
        return { command: this.commands.get(commandKey), key: commandKey };
      }
    }
    return null;
  }

  /**
   * Casual-form variants of a polite utterance, tried in order when the raw
   * transcript matched nothing. Japanese:
   *   閉じてください/頂戴/ほしい/くれ/もらえますか → 閉じて   (て/で + request suffix)
   *   戻ります/閉じます/探します/止めなさい → 戻って/閉じて/探して/止めて (ます形→て形)
   *   今何時ですか → 今何時                        (です/でしょう ending)
   * English:
   *   'please scroll down' / 'can you go back' / 'close the tab please'
   */
  _politeVariants(normalized) {
    const variants = [];
    const seen = new Set([normalized]);
    const push = (s) => {
      if (s && !seen.has(s)) {
        seen.add(s);
        variants.push(s);
      }
    };

    // て/で-form + request suffix → bare て/で-form. Longest suffixes first.
    push(normalized.replace(/(て|で)(?:いただけますか|いただけませんか|いただいて|もらえますか|もらえませんか|もらって|くれますか|くれませんか|ください|下さい|ちょうだい|頂戴|ほしいです|ほしい|くれない|くれ)[。！？!?]?$/u, '$1'));
    // Particle-tailed request suffixes: '閉じてくださいよ/ね', '閉じてくれよ/くれい'
    push(normalized.replace(/(て|で)(?:ください|下さい|ちょうだい|くれない|くれい?|くれ)(?:よ|ね|な)?[。！？!?]?$/u, '$1'));

    // ます形 → て形: godan stem-final kana map (行きます → 行って is the one
    // common exception); anything else takes stem + て (ichidan).
    // (Past/negative forms ました/ません are NOT stripped — '閉じました'
    // means "I closed it", not a request.)
    const m = normalized.match(/^(.*?)(?:ましょう|ませんか|ますか|ます|なさい)[。！？!?]?$/u);
    if (m && m[1]) {
      const stem = m[1];
      const GODAN_TE = { う: 'って', つ: 'って', る: 'って', い: 'って', ち: 'って', り: 'って',
        き: 'いて', く: 'いて', ぎ: 'いで', ぐ: 'いで',
        し: 'して', す: 'して',
        ぬ: 'んで', ぶ: 'んで', む: 'んで', び: 'んで', み: 'んで' };
      if (stem === '行き') {
        push('行って');
      }
      const last = stem.slice(-1);
      push(GODAN_TE[last] ? stem.slice(0, -1) + GODAN_TE[last] : stem + 'て');
    }

    // masu-stem → て-form map for honorific/imperative variants
    const MASU_TE = { い:'って', ち:'って', り:'って', き:'いて', ぎ:'いで',
      し:'して', み:'んで', び:'んで', に:'んで' };
    // Honorific request: 'お読みください' → '読んで'; extended tails:
    // 'お読みいただけますか'/'お読みなさい'/'お読みくださいませ'/'お読みおくれ'
    push(normalized.replace(/^(お|ご)(.{1,10}?)(?:くださいませ|ください|下さい|いただけ(?:ますか|ます|る|るか)|なさい|おくれ)[。！？!?]?$/u,
      (m, p, stem) => MASU_TE[stem.slice(-1)] ? stem.slice(0,-1) + MASU_TE[stem.slice(-1)] : stem + 'て'));
    // Casual imperative masu-stem+な: '閉じな'→'閉じて', '読みな'→'読んで'
    push(normalized.replace(/^(.{1,10}?)な[。！？!?]?$/u,
      (m, stem) => MASU_TE[stem.slice(-1)] ? stem.slice(0,-1) + MASU_TE[stem.slice(-1)] : stem + 'て'));
    // 'なさい' with trailing particle: '読みなさいよ'→'読んで'
    push(normalized.replace(/^(.{1,10}?)(?:なさい|なされ)(?:よ|な)?[。！？!?]?$/u,
      (m, stem) => MASU_TE[stem.slice(-1)] ? stem.slice(0,-1) + MASU_TE[stem.slice(-1)] : stem + 'て'));
    // ておいて 'do in advance', てごらん 'try doing', てして dialect double-te
    push(normalized.replace(/(て|で)(?:おいて|といて|ごらん|して)[。！？!?]?$/u, '$1'));
    // Casual request questions: '閉じてくれるか' → '閉じて', '読んでもらえるか' → '読んで'
    push(normalized.replace(/(て|で)(?:くれる|もらえる|くれへん|くれん|くれない|もらえない)(?:か|かな|ん)?[。！？!?]?$/u, '$1'));
    // Negative-invitation 'んじゃない': '閉じるんじゃない'→'閉じて', '読むんじゃない'→'読んで'
    const NJA = normalized.match(/^(.{1,10}?)(んじゃない|んじゃね|んじゃん|んじゃ)[。！？!?]?$/u);
    if (NJA) {
      const w = NJA[1];
      const DICT_TE = { う:'って', つ:'って', る:'って', く:'いて', ぐ:'いで', す:'して',
        ぬ:'んで', ぶ:'んで', む:'んで', き:'いて', ぎ:'いで', し:'して', ち:'って', に:'んで', み:'んで', び:'んで' };
      push(w.endsWith('る') ? w.slice(0,-1) + 'て' : w);
      push(w.replace(/[うつるくぐすぬぶむいきぎしちにびみ]$/u, (ch) => DICT_TE[ch] || ch));
    }
    // Causative request: '閉じさせて'→'閉じて', '読ませて'→'読んで' (あ-row godan)
    const A_SE_TE = { ま: 'んで', ら: 'って', わ: 'って', か: 'いて', が: 'いで',
      さ: 'して', た: 'って', な: 'んで', ば: 'んで', ぱ: 'んで' };
    push(normalized.replace(/させて[。！？!?]?$/u, 'て'));
    push(normalized.replace(/([まらわかがさたなばぱ])せて[。！？!?]?$/u, (m, ch) => A_SE_TE[ch] || ch));
    // Causative imperative: '閉じさせろ'→'閉じて', '読ませろ'→'読んで'
    push(normalized.replace(/させ(?:ろ|よ)[。！？!?]?$/u, 'て'));
    push(normalized.replace(/([まらわかがさたなばぱ])せ(?:ろ|よ)[。！？!?]?$/u, (m, ch) => A_SE_TE[ch] || ch));
    // Suggestion/conditional tails → て-form retry
    const stemTe = (w) => {
      if (!w || w === normalized) {
        return;
      }
      push(w + 'て'); push(w + 'で');
      const c = w.slice(-1);
      if (MASU_TE[c]) {
        push(w.slice(0, -1) + MASU_TE[c]);
      }
    };
    const DTE = { う:'って', つ:'って', る:'って', く:'いて', ぐ:'いで', す:'して',
      ぬ:'んで', ぶ:'んで', む:'んで', き:'いて', ぎ:'いで', し:'して', ち:'って',
      に:'んで', み:'んで', び:'んで' };
    const dictTe = (w) => {
      if (!w) {
        return;
      }
      push(w.endsWith('る') ? w.slice(0, -1) + 'て' : w);
      push(w.replace(/[うつるくぐすぬぶむいきぎしちにびみ]$/u, (ch) => DTE[ch] || ch));
    };
    // 'べき/ほうがいい' suggestion: '閉じるべき'→'閉じて', '読むべき'→'読んで'
    const BK = normalized.match(/^(.{1,10}?)(べき|べきだ|ほうがいい|ほうがええ|ほうがよい|るほうがいい)[。！？!?]?$/u);
    if (BK) {
      dictTe(BK[1]);
    }
    // 'たほうがいい' past-form suggestion: '閉じたほうがいい'→'閉じて'
    const TK = normalized.match(/^(.{1,10}?)[ただ]ほうが(?:いい|ええ|よい)[。！？!?]?$/u);
    if (TK) {
      stemTe(TK[1]);
    }
    // 'んか(い)' dialect request: '閉じるんか'→'閉じて', '読むんか'→'読んで'
    const NK = normalized.match(/^(.{1,10}?[うつるくぐすぬぶむきぎしちにみび])んかい?[。！？!?]?$/u);
    if (NK) {
      dictTe(NK[1]);
    }
    // 'たら/だら' conditional: '閉じたら'→'閉じて', '戻ったら'→'戻って', '読んだら'→'読んで'
    stemTe(normalized.replace(/(?:たらいい|だらいい|たらどう|だらどう|たらあ?|だらあ?|たら|だら)[。！？!?]?$/u, ''));
    // 'ば' conditional: '閉じれば'→'閉じて' (いち段), '戻れば'→'戻って' (五段え段)
    stemTe(normalized.replace(/れば(?:(?:いい|ええ|よい)(?:のに|んだけど|んやけど)?)?[。！？!?]?$/u, ''));
    stemTe(normalized.replace(/りゃあ?(?:(?:いい|ええ|よい)(?:のに)?)?[。！？!?]?$/u, ''));
    const E_TE = { え:'って', け:'いて', せ:'して', て:'って', ね:'んで', へ:'んで',
      べ:'んで', め:'んで', れ:'って', げ:'いで', ぺ:'んで' };
    push(normalized.replace(/([えけせてねへべめれげぺ])ば(?:(?:いい|ええ|よい)(?:のに|んだけど|んやけど)?)?[。！？!?]?$/u, (m, ch) => E_TE[ch] || ch));
    // 'ましょ(う)' hortative: '閉じましょう'→'閉じて', '読みましょう'→'読んで'
    stemTe(normalized.replace(/ましょう?かな?[。！？!?]?$/u, ''));
    // よ/よう/おう volitional: '閉じよ'→'閉じて', '読もう'→'読んで', '戻ろう'→'戻って'
    const O_TE = { お:'って', こ:'いて', ご:'いで', そ:'して', と:'って', の:'んで',
      ぼ:'んで', も:'んで', ろ:'って', ほ:'んで' };
    const VOL = normalized.match(/^(.{1,10}?)(よう|おう)(?:かな)?[。！？!?]?$/u);
    if (VOL) {
      stemTe(VOL[1]); const c = VOL[1].slice(-1); if (O_TE[c]) {
        push(VOL[1].slice(0, -1) + O_TE[c]);
      }
    }
    const VOL2 = normalized.match(/^(.{1,10}?)([おこごそとのぼもろほ])う$/u);
    if (VOL2) {
      push(VOL2[1] + (O_TE[VOL2[2]] || ''));
    }
    push(normalized.replace(/([おこごそとのぼもろほ])$/u, (m, ch) => O_TE[ch] || ch));
    stemTe(normalized.replace(/よ$/u, ''));
    // 九州 んさい / 名古屋 みゃあ imperative: '閉じんさい'→'閉じて', '読みゃあ'→'読んで'
    stemTe(normalized.replace(/(?:んさい|んしゃい)$/u, ''));
    stemTe(normalized.replace(/っち[ぃい]?$/u, ''));
    stemTe(normalized.replace(/みゃあ$/u, ''));
    stemTe(normalized.replace(/ゃあ$/u, ''));
    // volitional とこ/んどこ: '閉じとこ'→'閉じて', '読んどこ'→'読んで'
    push(normalized.replace(/んどこ(?:う)?$/u, 'んで'));
    stemTe(normalized.replace(/とこ(?:う)?(?:かな|か)?$/u, ''));
    // 東北 だ/だべ imperative: '閉じだ'→'閉じて', '読みだ'→'読んで'
    stemTe(normalized.replace(/だべ?$/u, ''));
    // 'つつ/ながら' while-doing: '読みつつ'→'読んで', '読みながら'→'読んで'
    stemTe(normalized.replace(/(?:つつ|ながら)[。！？!?]?$/u, ''));
    // Apology/hedge openers + benefactive-tail escalations → bare て-form
    const HP = normalized.replace(
      /^(?:恐れ入りますが|恐縮です(?:が)?|申し訳ありませんが|申し訳ない(?:んですが)?|ついでに|まず|さあ|ほら|やっぱり|やっぱ|できれば|可能なら|よかったら|もしよければ|よろしければ|良ければ|すみませんが|すみません|悪いんだけど|悪いんだが|悪いけど|お手数ですが|差し支えなければ|お手すきの際に|できたら|もし可能なら|もし|よければ|ぜひ|どうぞ|とにかく|ともかく|とっとと|さっさと|直ちに|早急に|急いで|いそいで)[、,]?/u, '');
    if (HP !== normalized) {
      push(HP);
      for (const v of this._politeVariants(HP)) {
        push(v);
      }
    }
    const TAIL_TE = new RegExp('(て|で)(?:くれると.*|くれたら.*|もらえると.*|もらえたら.*|' +
      'いただきたい.*|いただけ.*|くだされ|くださいませ|くださいませんか|もらいたい.*|' +
      'ほしいんです(?:が)?|ほしいのです(?:が)?|ほしかった.*)[。！？!?]?$', 'u');
    push(normalized.replace(TAIL_TE, '$1'));
    // 'んです/のです' copula tail: '読んでほしいんです' tail via TAIL_TE; bare 'んですが' drops
    push(normalized.replace(/(?:んですが|のですが|んです|のです)[。！？!?]?$/u, ''));
    // 'だけ' limiter on dict form: '閉じるだけ'→'閉じて', '読むだけ'→'読んで'
    const DK = normalized.match(/^(.{1,10}?[うつるくぐすぬぶむきぎしちにみび])だけ[。！？!?]?$/u);
    if (DK) {
      dictTe(DK[1]);
    }
    // 'べし' archaic imperative: '読むべし'→'読んで', '閉じるべし'→'閉じて'
    const BS = normalized.match(/^(.{1,10}?[うつるくぐすぬぶむきぎしちにみび])べし[。！？!?]?$/u);
    if (BS) {
      dictTe(BS[1]);
    }
    // dict形+接続尾（か/けど/し/から/の/んや/んだ/じゃ）→ て形:
    // '閉じるけど'→'閉じて', '読むか'→'読んで'. まい is negative intent → negate.
    const QC_TAIL = 'か|かな|かしら|けど|し|から|の|のよ|のね|んや|んだ|' +
      'んだって|んだな|じゃ|んか|わ|わよ|わね|さ|って|ってば|ってよ|' +
      'よな|べ|のう|やろか|やろ|がいい|に限る|んちゃう|んちゃ|といい|と|' +
      'ぞい|ぞ|ぜ|ねん|ねえ|なあ';
    const QC = normalized.match(new RegExp(
      '^(.{1,10}?[うつるくぐすぬぶむきぎしちにみびい])(?:' + QC_TAIL + ')[。！？!?]?$', 'u'));
    if (QC) {
      dictTe(QC[1]);
    }
    // させて-依頼尾: '閉じさせてくれ'→'閉じて', '読ませてもらう'→'読んで'.
    const SE_TAIL = '(?:くれ|くれる|もらう|もらえる|もらえますか|もらえたら' +
      '|いただけないか|いただきたい|いただきます|いただけますか|ください|ほしい)';
    push(normalized.replace(new RegExp('させて' + SE_TAIL + '[。！？!?]?$', 'u'), 'て'));
    push(normalized.replace(new RegExp('([まらわかがさたなばぱ])せて' + SE_TAIL + '[。！？!?]?$', 'u'),
      (m, ch) => A_SE_TE[ch] || ch));
    // Bare dict-form last resort: 'ついでに読む' strips to '読む' → '読んで'.
    dictTe(normalized);
    // Stem imperatives: '読みたまえ'→'読んで', '閉じ給え'→'閉じて', '閉じやがれ'→'閉じて',
    // '閉じやす'→'閉じて', '閉じなよ'→'閉じて'.
    stemTe(normalized.replace(/(?:たまえよ?|給えよ?|やがれ|やす|なよ|なはれ|やれ|がてら|ろや|たれ|や)[。！？!?]?$/u, ''));
    // Contracted てしまう: '閉じちまえ/ちまう/ちまった'→'閉じて'.
    push(normalized.replace(/ちま(?:う|え|った|ったわ|うわ)[。！？!?]?$/u, 'て'));
    push(normalized.replace(/じま(?:う|え|った)[。！？!?]?$/u, 'で'));
    push(normalized.replace(/(て|で)しまえ[。！？!?]?$/u, '$1'));
    // ておく contraction: '閉じとくわ'→'閉じて'.
    push(normalized.replace(/(?:とく|どく)(?:わ|よ|ね|な)?[。！？!?]?$/u, 'て'));
    stemTe(normalized.replace(/(?:とけば|ときゃ|ときな|とき|とけ)(?:(?:いい|ええ|よい))?[。！？!?]?$/u, ''));
    stemTe(normalized.replace(/(?:どけば|どきゃ|どきな|どき|どけ)(?:(?:いい|ええ|よい))?[。！？!?]?$/u, ''));
    // とく側縮約命令 '読んどいて'→'読んで'（両性 push: で+て）
    push(normalized.replace(/どいて(?:ね|よ|な|なあ|や)?[。！？!?]?$/u, 'で'));
    push(normalized.replace(/どいて(?:ね|よ|な|なあ|や)?[。！？!?]?$/u, 'て'));
    // Kansai volitional/copula tails: '閉じませう' (ましょう) → stem,
    // '閉じますんやで/読みますんで' (ます+んで|んやで) → stem.
    stemTe(normalized.replace(/ませう[。！？!?]?$/u, ''));
    stemTe(normalized.replace(/ます(?:んで|んやで?|だわ)[。！？!?]?$/u, ''));
    // Dialect progressive tails: '閉じとるよ/とった/ちょる/ちゅう/より' → てる/て.
    push(normalized.replace(/(?:とる|どる|とった|どった|ちょる|ちょった)(?:よ|わ|ね|な)?[。！？!?]?$/u, 'てる'));
    const CY = normalized.match(/^(.{1,10}?)(?:ちゅう|ちゅー|より)$/u);
    if (CY) {
      const c = CY[1].slice(-1);
      if (MASU_TE[c]) {
        push(CY[1].slice(0, -1) + MASU_TE[c] + 'る');
      }
      push(CY[1] + 'てる');
    }
    // ておる progressive (九州/関西 'ておる'='ている') / ておれ imperative /
    // ておこう volitional: '閉じておる'→'閉じてる', '閉じておれ'→'閉じて'
    push(normalized.replace(/(て|で)おる(?:よ|わ|ね|な)?[。！？!?]?$/u, '$1る'));
    push(normalized.replace(/(て|で)(?:おれ|おこう)[。！？!?]?$/u, '$1'));
    // 関西 てまう系 + たげて九州受益: '閉じてまえ'→'閉じて', '閉じたげて'→'閉じて'
    push(normalized.replace(/(て|で)ま(?:え|う)[。！？!?]?$/u, '$1'));
    push(normalized.replace(/たげて[。！？!?]?$/u, 'て'));
    push(normalized.replace(/だげて[。！？!?]?$/u, 'で'));
    // たろ/だろ volitional: '閉じたろ'→'閉じて', '読んだろ'→'読んで'
    push(normalized.replace(/たろ[。！？!?]?$/u, 'て'));
    push(normalized.replace(/だろ[。！？!?]?$/u, 'で'));
    // 語幹+のう softened imperative: '閉じのう'→'閉じて'
    stemTe(normalized.replace(/のう[。！？!?]?$/u, ''));
    // Compound-verb tails: '読み終わって'→'読んで', '閉じ切って'→'閉じて',
    // '読みまくって'→'読んで'; 関西 'はって' (てはる): '閉じはって'→'閉じて'
    stemTe(normalized.replace(/(?:終わって|終えて|切って|まくって|はって)[。！？!?]?$/u, ''));
    // て+ぇ elongation / てやあ dialect / てくれや
    push(normalized.replace(/([てで])ぇ+[。！？!?]?$/u, '$1'));
    push(normalized.replace(/([てで])やあ?[。！？!?]?$/u, '$1'));
    push(normalized.replace(/([てで])くれや[。！？!?]?$/u, '$1'));
    // Imperative + って quotative: '閉じろって(ば)'→'閉じろ'
    push(normalized.replace(/([ろれ])って[ばよ]?[。！？!?]?$/u, '$1'));
    // ちゃえば conditional: '閉じちゃえば'→'閉じて'
    push(normalized.replace(/ちゃえば[。！？!?]?$/u, 'て'));
    push(normalized.replace(/じゃえば[。！？!?]?$/u, 'で'));
    // ずには obligation: '閉じずには'→'閉じて'
    push(normalized.replace(/ずには(?:いられない|おれない|いない)?[。！？!?]?$/u, 'て'));
    // Past + んです/んだ: '読んだんです'→'読んで', '閉じたんだ'→'閉じて'.
    push(normalized.replace(/たんですが?|たんだ[。！？!?]?$/u, 'て'));
    push(normalized.replace(/だんですが?|だんだ[。！？!?]?$/u, 'で'));
    // て+って: '閉じてって'→'閉じて'.
    push(normalized.replace(/(て|で)って[。！？!?]?$/u, '$1'));
    // 博多 'よる' progressive: '読みよる'→'読んでる', '閉じよる'→'閉じてる'
    const YR = normalized.match(/^(.{1,10}?)よる$/u);
    if (YR) {
      push(YR[1] + 'てる');
      const c = YR[1].slice(-1);
      if (MASU_TE[c]) {
        push(YR[1].slice(0, -1) + MASU_TE[c] + 'る');
      }
    }
    // です/でしょう question ending → bare stem: '今何時ですか' → '今何時'
    push(normalized.replace(/(?:ですかね|でしょうか|ですか|でしょう|です)[。！？!?]?$/u, ''));

    // Sentence-final particles (口語/方言): '閉じてよ' → '閉じて',
    // '読んでね' → '読んで', '待ってな' → '待って'. Terminal-only strip —
    // a stripped variant that matches nothing is simply skipped.
    push(normalized.replace(/(?:よね|なあ|ねえ|かいな|かい|よ|ね|な|ぞ|ぜ|わ|とも|さ)[。！？!?]?$/u, ''));

    // Colloquial/dialect suffixes: permissive 'てもいい(かな)'/'ていいかな' →
    // bare て; volitional 'たい(んだけど)' → て; Kansai 'といて' → て;
    // 'ちゃって' → 'てしまって'; archaic 'たまえ'/'なさい' → て; question tails
    // 'かな'/'かしら' and concessive 'けど/んだけど' drop cleanly.
    push(normalized.replace(/(て|で)も?いい(?:かなー?|ですか|です|か|よ|ね)?[。！？!?]?$/u, '$1'));
    push(normalized.replace(/たい(?:んだけど|んですが|んだが|んですけど|んです|けど|です)?[。！？!?]?$/u, 'て'));
    push(normalized.replace(/といて(?:ね|よ|な|や)?[。！？!?]?$/u, 'て'));
    // Trial/complete/humble request suffixes: '読んでみる'→'読んで',
    // '閉じてしまう'→'閉じて', '閉じちゃう'→'閉じて', '読んであげて'→'読んで',
    // '読んでもらえる'→'読んで'. Raw phrase still wins first — variants retry.
    push(normalized.replace(/(て|で)み(?:る|た|よう|ます|ましょう|ろ|な|なさい)?[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)しま(?:う|った|います|いました)?[。！？!?]?$/u, '$1'));
    push(normalized.replace(/ちゃ(?:う[よねかな]?|った|って|います|うわ)[。！？!?]?$/u, 'て'));
    push(normalized.replace(/じゃ(?:う[よねかな]?|った|って|います|うわ)[。！？!?]?$/u, 'で'));
    // ちゃい/じゃい (ちゃう縮約の命令・勧誘): '閉じちゃい'→'閉じて', '読んじゃい'→'読んで'
    push(normalized.replace(/ちゃい(?:な|よ|ね|なあ)?[。！？!?]?$/u, 'て'));
    push(normalized.replace(/じゃい(?:な|よ|ね|なあ)?[。！？!?]?$/u, 'で'));
    push(normalized.replace(/(て|で)(?:あげて|あげ(?:る|ます)[ねよわか]?|くれる|くださる|くださいます)[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)(?:くれ|くださ)ちゃう[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)もら(?:う|える|った|います|えます|ってもいい|っていい)[。！？!?]?$/u, '$1'));
    // Double-suffix requests: '読んであげてください' → '読んで'.
    push(normalized.replace(/(て|で)あげて(?:ください|下さい)[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)くださると[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)いただければ[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)ほしいん(?:だけど|ですけど|ですが)[。！？!?]?$/u, '$1'));
    push(normalized.replace(/(て|で)ほしい(?:な|ね|わ)?[。！？!?]?$/u, '$1'));
    // Volitional contraction: '閉じちゃお' → '閉じて'.
    push(normalized.replace(/ちゃおう?(?:かな|か|よ)?[。！？!?]?$/u, 'て'));
    push(normalized.replace(/じゃおう?(?:かな|か|よ)?[。！？!?]?$/u, 'で'));
    // Obligation: '読まなきゃ' → '読んで' (あ-row godan) / '閉じなきゃ' → '閉じて'.
    const NAKYA = {
      'ま': 'んで', 'ら': 'って', 'わ': 'って', 'か': 'いて', 'が': 'いで',
      'さ': 'して', 'た': 'って', 'な': 'んで', 'ば': 'んで', 'ぱ': 'んで' };
    push(normalized.replace(/([まらわかがさたなばぱ])(?:なきゃ|なきゃあ|なくちゃ|なくっちゃ|なければ|ないと|ねば|ならん|んと|なあかん|んとあかん)[。！？!?]?$/u,
      (m, ch) => NAKYA[ch] || ch));
    push(normalized.replace(/(?:なきゃ|なきゃあ|なくちゃ|なくっちゃ|なければ|ないと(?:ね)?|ねば|ならん|んと|なあかん|んとあかん)[。！？!?]?$/u, 'て'));
    // Double-negation / obligation: '閉じなくはない'/'閉じないわけにはいかない'/
    // '閉じざるを得ない' → execute (tentative affirmative). あ-row godan via
    // NAKYA map; ichidan stems take て directly.
    push(normalized.replace(/([まらわかがさたなばぱ])(?:なくはない|ないわけにはいかない|ざるを(?:得|え)ない)[。！？!?]?$/u,
      (m, ch) => NAKYA[ch] || ch));
    push(normalized.replace(/(?:なくはない|ないわけにはいかない|ざるを(?:得|え)ない)[。！？!?]?$/u, 'て'));
    // '閉じんといい(かも)' is a wish that it NOT close — left unmatched so
    // the negate patterns answer it instead (Devin Review #383).
    // 義務・方言尾II: '閉じるしかない'/'閉じるっきゃない'/'閉じるほかない'→'閉じて',
    // '閉じるんしゃ'/'閉じるやい'/'閉じるがよ'/'閉じるだす'/'閉じるんだってば'→'閉じて'.
    const NEC = normalized.replace(/(?:しかない|ほかない|っきゃない|っきゃあ?|しかねえ|んだってば|んしゃ|やい|がよ|だす)[。！？!?]?$/u, '');
    push(NEC);
    dictTe(NEC);
    // '閉じておこか'→'閉じて'（意向+か）、'読んどこか'→'読んで'.
    push(normalized.replace(/([てで])おこか[。！？!?]?$/u, '$1'));
    push(normalized.replace(/んどこか[。！？!?]?$/u, 'んで'));
    // Intent report '閉じようと思って'/'読もうと思う' — strip と思って and
    // re-run the volitional/て rules on the remainder.
    const OM = normalized.replace(/と思っ?て[。！？!?]?$|と思う[。！？!?]?$/u, '');
    if (OM !== normalized) {
      push(OM);
      for (const v of this._politeVariants(OM)) {
        push(v);
      }
    }
    // Suggestion frames: '閉じてはどう/いかが'→'閉じて', '閉じたらどうかな'→'閉じて'.
    const SUG = normalized.replace(/([てで])は(?:どう|いかが|どうですか|どうかな|どうです)[。！？!?]?$/u, '$1');
    if (SUG !== normalized) {
      push(SUG);
      for (const v of this._politeVariants(SUG)) {
        push(v);
      }
    }
    stemTe(normalized.replace(/たら(?:どう|いかが|どうかな|どうです|いいか)[。！？!?]?$/u, ''));
    // 'てみて' preview-form tail: '読んでみて'→'読んで'.
    push(normalized.replace(/([てで])みて[。！？!?]?$/u, '$1'));
    // Dialect request ておくれ (九州): '閉じておくれよ'→'閉じて'.
    push(normalized.replace(/([てで])おくれ[よな]?[。！？!?]?$/u, '$1'));
    // たり representative action: '閉じたり(して)'→'閉じて', '読んだり'→'読んで'.
    push(normalized.replace(/たり(?:して|する)?[。！？!?]?$/u, 'て'));
    push(normalized.replace(/だり(?:して|する)?[。！？!?]?$/u, 'で'));
    // てきて/てくる (close-and-return) & ていく (keep doing): '閉じてきて'→'閉じて',
    // '戻ってくる'→'戻って', '読んでいって'→'読んで'.
    push(normalized.replace(/([てで])(?:きて|きた|きます|きました|くる|来る|来た|来ました|こい)[。！？!?]?$/u, '$1'));
    push(normalized.replace(/([てで])い(?:って|った|く|くよ|こう|きます)[。！？!?]?$/u, '$1'));
    // ておいた (resultative, 'went ahead and'): '閉じておいた'→'閉じて'.
    push(normalized.replace(/([てで])おいた[よね]?[。！？!?]?$/u, '$1'));
    // Permission-yield: '閉じてもいい/よい/ええ(かな)' → '閉じて'.
    push(normalized.replace(/([てで])も(?:いい|よい|よか|ええ)(?:かな|かしら|か)?[。！？!?]?$/u, '$1'));
    // 頂戴 request: '閉じてちょうだい' → '閉じて'.
    push(normalized.replace(/([てで])(?:ちょうだい|頂戴)[。！？!?]?$/u, '$1'));
    // '閉じなさいませ'/'戻りまして'/'閉じまして' — ます語幹謙譲・敬語命令.
    stemTe(normalized.replace(/(?:なさいませ|ましたら|まして)[。！？!?]?$/u, ''));
    // '閉じますねえ/なあ' ます+終助詞 → 語幹て形.
    stemTe(normalized.replace(/ます(?:ねえ|なあ)[。！？!?]?$/u, ''));
    // Dialect progressives: '戻ってん'→'戻って', '読んでん'→'読んで',
    // '読んでんか'→'読んでる' (question → status owners), '読んどる'→'読んでる',
    // '読んでへん'→'読んでる' (negative progressive is a status complaint).
    push(normalized.replace(/(て|で)ん(?:か|の|な)[。！？!?]?$/u, '$1る'));
    push(normalized.replace(/とる[。！？!?]?$/u, 'てる'));
    push(normalized.replace(/どる[。！？!?]?$/u, 'でる'));
    push(normalized.replace(/てん[。！？!?]?$/u, 'て'));
    push(normalized.replace(/でん[。！？!?]?$/u, 'で'));
    push(normalized.replace(/(て|で)(?:はる|はって|もろて|くれはるか|くれはる|くれへん|くれん|くれない|もらっといて|もらっとく|へんの|へん|ひん|やって|やれ|よか|おくれ|らっしゃい|ちょ|や)[。！？!?]?$/u, '$1'));
    // っす casual: 'わかったっす' → 'わかった'.
    push(normalized.replace(/っす[。！？!?]?$/u, ''));
    push(normalized.replace(/ちゃって[。！？!?]?$/u, 'てしまって'));
    push(normalized.replace(/(?:たまえ|なさい)[。！？!?]?$/u, 'て'));
    push(normalized.replace(/(?:かなー?|かしら)[。！？!?]?$/u, ''));
    push(normalized.replace(new RegExp('(?:んだけど|んですけど|んですが|だけど|' +
      'けれども|けれど|けど)[。！？!?]?$', 'u'), ''));
    // Discourse/urgency prefixes: 'えっと閉じて'→'閉じて', 'すぐ止めて'→'止めて'.
    const prefixRe = new RegExp('^(?:今すぐ|すぐさま|すぐに|すぐ|さっそく|早速|ちょっと|' +
      'ちょいと|とりあえず|とりま|一応|いったん|かたがた|えっと|えーっと|えーと|あのー|' +
      'あの|まあ|なんか|ところで|もう一度|もう一回|もういちど|何度も|もっかい|もいっかい|もういっかい)[、\\s]*', 'u');
    push(normalized.replace(prefixRe, ''));

    // EN wrappers: leading 'please', 'can/could/would you (please)', trailing
    // 'please' — applied cumulatively so 'could you please go back' works.
    const en = normalized
      .replace(/^please[,\s]+/i, '')
      .replace(new RegExp("^(?:i (?:want|need) you to|i'?d like you to|" +
        "i'?d appreciate it if you|i (?:want|wanna|need)(?: na| to)?|i'm gonna|" +
        "gonna|wanna|gotta|gimme|lemme|imma|let me|let's|may i|i said|i meant|" +
        'i was wondering if|i was hoping|do you think you could|is there any chance|' +
        'any chance you could|if you would be so kind|would you be so kind|' +
        'if you wouldnt mind|how about we|why dont we|shall we|suppose we|lets|' +
        'supposed to|fixing to|about to|feel like|in the mood to|how bout|' +
        'what about|wouldja|couldja|wontcha|needa|hafta|tryna|finna|please kindly|' +
        'shoulda|coulda|woulda|oughta|mighta|musta|trying to|tryin to|if you could|if you would|' +
        'if you can|if you will|can we|could we|why dont you|why dont we|' +
        'might you|wont you|care to|fancy|please and thank you|uh|um|er|erm|' +
        'if you\'?d be so kind|why not|hows about|do (?:us|me) a favor and|do a favor and|help me|i need you to|' +
        'i want you to|i\'?d like you to|i\'?d appreciate it if you|don\'?t forget to|' +
        'make sure to|be sure to|remember to|try to|try and|just|simply|' +
        'while you(?:\'?re| are) at it|since you(?:\'?re| are) (?:here|there|at it)|when you get a (?:sec|second|minute|chance|moment)|' +
        'if you have a (?:sec|second|minute|moment|chance)|if it\'?s not too much trouble|' +
        'before (?:you go|i (?:leave|go))|whenever you (?:can|get a chance)|at your (?:earliest )?convenience|no rush but|' +
        'go ahead and|feel free to|do|oh|well|say|listen|look|alright|thanks|' +
        'anyways?|by the way|btw|yes please|see if you can|see about|try|' +
        'have a go at|get to|up and|might i trouble you to|be a lamb and|' +
        'have the goodness to|' +
        'cheers|mate|first|next|also|once more|again)[,\\s]+', 'i'), '')
      .replace(/^(?:can|could|would|will|may) you[,\s]+(?:please[,\s]+)?/i, '')
      .replace(/^(?:be so kind(?: as to)?|be a dear|kindly)[,\s]+(?:and[,\s]+)?/i, '')
      .replace(/^(?:you (?:have|need|got) to|you gotta|you shoulda|you coulda|you oughta|you ought to|you should|you could|you might)[,\s]+/i, '')
      .replace(/^(?:(?:and|then|thank you|thanks)[,\s]+)+/i, '')
      .replace(/^(?:hey|ok|okay|so|now)[,\s]+/i, '')
      .replace(/[,\s]+please[.!?]?$/i, '')
      .replace(/[,\s]+for (?:me|us)[.!?]?$/i, '')
      .replace(/[,\s]+(?:would|will|wont|cant|could|can) (?:you|ya)(?: kindly)?[.!?]?$/i, '')
      .replace(/[,\s]+(?:eh|hey|mate|yeah|ok|okay)[.!?]?$/i, '')
      .replace(/[,\s]+(?:please )?thanks[.!?]?$/i, '')
      .replace(/[,\s]+(?:real )?(?:quick|fast|quickly)[.!?]?$/i, '')
      .replace(/[,\s]+(?:right now|asap|pronto|stat|at your leisure|when you have a moment|whenever you get around to it|if you don'?t mind)[.!?]?$/i, '')
      .replace(/[,\s]+(?:now|then|first|next|also|too|again|yet|already|once more|one more time)[.!?]?$/i, '')
      .replace(/[,\s]+and[.!?]?$/i, '')
      .replace(/[,\s]+(?:whenever|if you (?:would|could|will|wont|want))[.!?]?$/i, '')
      .replace(/\b(it|this) (?:up|off|out|through|down)\b/i, '$1')
      .replace(/\bthe (?:damn|damned|stupid|bloody|fucking|freakin[g']?|goddamn)\b/gi, 'the')
      .replace(/\b(\w+)in'(?=\s|$)/g, '$1ing')
      .replace(/\b(\w+)in\b/g, '$1ing')
      .replace(/\b(closed|muted|pinned|saved|opened|paused|stopped|deleted|reopened)\b/g,
        (m) => ({ closed: 'close', muted: 'mute', pinned: 'pin', saved: 'save',
          opened: 'open', paused: 'pause', stopped: 'stop', deleted: 'delete',
          reopened: 'reopen' })[m.toLowerCase()])
      .replace(/\b(?:get|have|need|want) it (closed|close|muted|mute|pinned|pin|saved|save|reopened|reopen)\b/i,
        (m, v) => ({ closed: 'close it', close: 'close it', muted: 'mute it',
          mute: 'mute it', pinned: 'pin it', pin: 'pin it', saved: 'save it',
          save: 'save it', reopened: 'reopen it', reopen: 'reopen it' })[v.toLowerCase()]);
    push(en);
    push(normalized.replace(/^please[,\s]+/i, ''));
    push(normalized.replace(/[,\s]+please[.!?]?$/i, ''));
    // 'would/do you mind (closing|going back)' → gerund-to-stem: 'mind closing this' → 'close this'
    const GERUND_STEM = new RegExp('\\b(clos|read|speak|stopp|open|find|mut|paus|go|show' +
      '|scroll|search|turn|mak|tak|tell|giv|listen|help)ing\\b', 'gi');
    const gerundToStem = (m, stem) => ({ clos: 'close', stopp: 'stop', mut: 'mute',
      paus: 'pause', mak: 'make', tak: 'take', giv: 'give' })[stem.toLowerCase()] || stem;
    push(normalized.replace(/^(?:(?:would|do|could) you )?mind[,\s]+(?!if\b)/i, '')
      .replace(GERUND_STEM, gerundToStem));
    push(normalized.replace(/^(?:how about|what about|why not)[,\s]+/i, '')
      .replace(GERUND_STEM, gerundToStem));
    push(en.replace(GERUND_STEM, gerundToStem));
    // hyper-polite wraps: 'be so kind as to X' / 'X, if you please' / 'X, pretty please'
    push(normalized.replace(/^(?:be so kind as to|be a dear and|kindly|if you please|pretty please)[,\s]+/i, ''));
    push(normalized.replace(/[,\s]+(?:if you please|pretty please(?: with sugar on top)?|be a dear)[.!?]?$/i, ''));

    return variants;
  }

  /**
   * Check if transcript contains wake word
   */
  containsWakeWord(transcript) {
    const normalized = transcript.toLowerCase().replace(/\s+/g, '');
    const wakeWord = this.settings.wakeWord.toLowerCase().replace(/\s+/g, '');
    return normalized.includes(wakeWord);
  }

  /**
   * Process voice command
   */
  processCommand(transcript, confidence) {
    this.stats.commandsRecognized++;
    this.stats.averageConfidence = (this.stats.averageConfidence * (this.stats.commandsRecognized - 1) + confidence) / this.stats.commandsRecognized;

    // Normalize transcript
    const normalized = transcript.toLowerCase().trim();

    // Find matching command (first-match wins in registration order)
    let found = this._matchCommand(normalized);
    let dispatchText = transcript;

    // Polite-speech retry — ONLY on a miss, so the raw transcript's
    // first-match semantics are untouched: '閉じてください' → '閉じて',
    // '戻ります' → '戻って', 'can you go back' → 'go back'.
    if (!found) {
      for (const variant of this._politeVariants(normalized)) {
        found = this._matchCommand(variant);
        if (found) {
          dispatchText = variant;
          break;
        }
      }
    }
    const matchedCommand = found ? found.command : null;
    const matchedKey = found ? found.key : null;

    // Execute command if found
    if (matchedCommand) {
      console.debug(`VoiceCommands: Executing command "${matchedKey}"`);

      try {
        const result = matchedCommand.action(dispatchText, confidence);
        this.lastCommand = { key: matchedKey, transcript, confidence, result, timestamp: Date.now() };
        if (matchedKey !== 'repeat-command') {
          this._repeatableTranscript = transcript;
        }
        this.stats.commandsExecuted++;

        // Callback
        if (this.callbacks.onCommand) {
          this.callbacks.onCommand(matchedKey, result);
        }

        // Speak confirmation if enabled
        if (matchedCommand.confirmationText) {
          this.speak(matchedCommand.confirmationText);
        }

      } catch (error) {
        console.error('VoiceCommands: Command execution failed', error);
        this.stats.commandsFailed++;
        this.speak('コマンドの実行に失敗しました'); // "Command execution failed"
        if (this.callbacks.onCommandFailed) {
          this.callbacks.onCommandFailed({ reason: 'execution_error', transcript });
        }
      }

    } else {
      console.debug(`VoiceCommands: No matching command for "${transcript}"`);
      this.stats.commandsFailed++;
      this.speak('コマンドが認識できませんでした'); // "Command not recognized"
      if (this.callbacks.onCommandFailed) {
        this.callbacks.onCommandFailed({ reason: 'no_match', transcript });
      }
    }
  }

  /**
   * Register default commands
   */
  registerDefaultCommands() {
    // defer — honest absence for scheduling: there is no timer/reminder
    // engine, so '後で閉じて'/'do it later' announce the limit instead of
    // silently running the embedded command now. Registered first: any
    // loose /戻る|閉じて/ owner would otherwise execute the embedded verb.
    this.registerCommand('defer', {
      patterns: [/^(あと|後)で(?!読|見)/, /^のちほど/, /^のちに/, /^後ほど/,
        /[0-9一二三四五六七八九十]+分後/, /[0-9一二三四五六七八九十]+時間後/,
        /^do it later$/i, /^do that later$/i, /^in a bit$/i, /^in a minute$/i,
        /^in a min$/i, /^in a sec(?:ond)?$/i, /^in a moment$/i, /^later on$/i,
        /^remind me later$/i, /^remind me in/i, /^for later$/i,
        /^come back later$/i,
        /(?:do |leave |finish )?(?:it|this|that|them|all) later$/i],
      action: () => {
        this.speak('あとでの実行はできません。今すぐなら「閉じて」などと命令してください');
        return { action: 'defer' };
      },
      description: 'Honest answer for deferred/scheduled requests'
    });

    // Seek the immersive video — YouTube's J/L keys (±10s) for a user who
    // can't reach the HUD while watching. Registered before navigate/back:
    // their loose /戻|進/ regexes would otherwise swallow '10秒戻る'. Seconds
    // are captured when spoken ('30秒戻る'), else the 10-second step applies.
    this.registerCommand('video-seek', {
      patterns: [/(\d+)\s*秒\s*(戻|進|スキップ)/, /(\d+)\s*分\s*(戻|進)/,
        /(\d+)\s*(秒|分)\s*スキップ/,
        '動画を戻して', '動画を進めて', '巻き戻して',
        '巻き戻し', '巻き戻す', '早送り', '早送りして', '動画を早送り',
        '少し戻して', '動画をスキップ', '動画を早送りして',
        '頭から再生', '最初から再生', '最初から再生して', '動画を最初から',
        'もう一回再生', 'もう一度再生', 'もう一回最初から再生', 'リプレイ', /play (it )?again/i,
        'play it one more time', 'play it once more', 'play it over',
        /(skip|jump|go|fast) (ahead|forward) \d+\s*(seconds?|minutes?|secs?|mins?)/i,
        'ビデオを早送り', 'ビデオを巻き戻し', 'ビデオを進めて', 'ビデオを戻して',
        /seek\s+(forward|back)/i, /rewind/i, /fast ?forward/i],
      action: (transcript) => {
        const restart = /頭から|最初から|もう一?回|もう一度|リプレイ|play (it )?(again|one more time|once more|over)/i.test(transcript);
        const mMin = transcript.match(/(\d+)\s*(?:分|minutes?\b|mins?\b)/i);
        const m = transcript.match(/(\d+)/);
        const secs = mMin ? Number(mMin[1]) * 60 : m ? Number(m[1]) : 10;
        const back = restart || /戻|巻き戻|rewind|back/i.test(transcript);
        const delta = restart ? -1e9 : back ? -secs : secs;
        const pos = this._onVideoSeek ? this._onVideoSeek(delta) : null;
        if (pos === null) {
          this.speak('再生中の動画がありません');
        } else if (restart) {
          this.speak('最初から再生します');
        } else {
          this.speak(`${secs}秒${back ? '戻り' : '進み'}ました`);
        }
        return { action: 'video-seek', delta, pos };
      },
      description: 'Seek the immersive video'
    });

    // Settings panel open/close — the faceB/menu button's voice equivalent.
    // Registered before the go-to catch-all, whose 'Xを開いて' patterns would
    // otherwise treat '設定を開いて' as a navigation request. Explicit phrases
    // pin the direction; the bare panel phrase toggles.
    this.registerCommand('settings-toggle', {
      patterns: ['設定を開いて', '設定を開く', '設定を閉じて', '設定を閉じる', '設定パネル',
        '設定を見せて', '設定を表示', '設定画面', '設定画面を開いて', '環境設定',
        'オプション', 'オプションを開いて', 'プリファレンス',
        'メニュー', 'メニューを開いて', 'メニューを表示', 'メニューを見せて',
        'メニュー画面', '設定を表示して', '設定を見せて', '設定を出して',
        '通知設定', '設定を変更', '設定を変えて',
        'open the menu', 'show menu', /^menu$/i,
        'open up settings', 'bring up the settings', 'bring up settings', 'open settings',
        /open\s+settings/i, /close\s+settings/i, /show\s+settings/i,
        /^settings$/i, /open (my |the )?settings/i, /settings please/i,
        /^options$/i, /^preferences$/i],
      action: (transcript) => {
        let want;
        if (/閉じ|close/i.test(transcript)) {
          want = false;
        } else if (/開|open|見せ|show/i.test(transcript)) {
          want = true;
        }
        const visible = this._onSettingsPanel ? this._onSettingsPanel(want) : null;
        this.speak(visible === null ? '設定を切り替えられません'
          : visible ? '設定を開きます' : '設定を閉じます');
        return { action: 'settings-toggle', visible };
      },
      description: 'Open, close or toggle the settings panel'
    });

    // Read aloud starting at line N — VoiceOver read-from-line parity, the
    // indexed variant of read-here. Hoisted before reader-goto-line: its
    // /(\d+)\s*行目/ and /line (\d+)/ would otherwise swallow '30行目から読み上げ'
    // and 'read from line 30'.
    this.registerCommand('read-from-line', {
      patterns: [/(\d+)\s*行目から読み上げて?/, /(\d+)\s*行目から読んで/,
        /read\s+(?:aloud\s+)?from\s+line\s+(\d+)/i],
      action: (transcript) => {
        const n = Number(transcript.match(/(\d+)/)[1]);
        const chunks = this._onReadFromLine ? this._onReadFromLine(n - 1) : undefined;
        if (chunks === null) {
          this.speak(`${n}行目はありません`);
          return { action: 'read-from-line', line: n, res: 'out' };
        }
        if (!chunks || !chunks.length) {
          this.speak('記事を開いていません');
          return { action: 'read-from-line', line: n, res: 'no-article' };
        }
        this.speak(`${n}行目から読み上げます`);
        this.readAloud(chunks);
        return { action: 'read-from-line', line: n, res: 'ok' };
      },
      description: 'Read aloud starting at line N'
    });

    // Read the TEXT of line N — read-line's indexed twin. Hoisted before
    // reader-goto-line: its /(\d+)\s*行目/ and /line (\d+)/ own '3行目を
    // 読んで' and 'read line 5' (dispatch-verified).
    this.registerCommand('read-line-n', {
      patterns: [/([0-9一二三四五六七八九十]+)\s*行目を読んで/, /read line (\d+)/i],
      action: (transcript) => {
        const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const m = transcript.match(/([0-9一二三四五六七八九十]+)/);
        const n = m ? (KANJI[m[1]] || Number(m[1]) || 0) : 0;
        const panel = this._tabManager?.getActiveTab?.();
        const st = panel?.lineStatus?.() || null;
        if (!st) {
          this.speak('記事を開いていません');
          return { action: 'read-line-n' };
        }
        if (n < 1 || n > st.total) {
          this.speak(`${n}行目はありません`);
          return { action: 'read-line-n', line: null };
        }
        panel.scrollContentTo?.(n - 1);
        const text = panel.currentLine?.() || '';
        this.speak(`${n}行目。${text}`);
        return { action: 'read-line-n', line: n };
      },
      description: 'Read the text of line N'
    });

    // First/last reader line — first-heading/last-heading's line siblings.
    // Hoisted beside read-line-n: the same /N行目/-style catch-alls could
    // otherwise swallow '最初の行'/'last line' once they gain loose variants.
    this.registerCommand('first-line', {
      patterns: ['最初の行', '最初の行へ', '最初の行を読んで', '先頭の行',
        /first line/i, /read the first line/i],
      action: () => {
        const res = this._onReaderLine ? this._onReaderLine(1) : null;
        if (res === 'out' || res === null) {
          this.speak(res === null ? '記事を開いていません' : '1行目はありません');
          return { action: 'first-line', res };
        }
        const line = this._tabManager?.getActiveTab?.()?.currentLine?.() || '';
        this.speak(line ? `1行目。${line}` : '1行目に移動しました');
        return { action: 'first-line', res };
      },
      description: 'Read the first reader line'
    });
    this.registerCommand('last-line', {
      patterns: ['最後の行', '最後の行へ', '最後の行を読んで', '末尾の行',
        '最終行', '最後の行目',
        /last line/i, /read the last line/i],
      action: () => {
        const panel = this._tabManager?.getActiveTab?.();
        const st = panel?.lineStatus?.() || null;
        if (!st) {
          this.speak('記事を開いていません');
          return { action: 'last-line' };
        }
        const res = this._onReaderLine ? this._onReaderLine(st.total) : null;
        if (res === 'out' || res === null) {
          this.speak(res === null ? '記事を開いていません'
            : `${st.total}行目はありません`);
          return { action: 'last-line', res };
        }
        const line = panel.currentLine?.() || '';
        this.speak(line ? `${st.total}行目。${line}` : '最後の行に移動しました');
        return { action: 'last-line', res };
      },
      description: 'Read the last reader line'
    });

    // Peek the adjacent tab — announce its title without switching
    // (screen-reader "what's next" parity). Hoisted: next-tab's loose
    // /next\s+tab/i would otherwise own 'read next tab' and switch.
    this.registerCommand('peek-tab', {
      patterns: ['次のタブを読んで', '次のタブは', '次のタブを教えて',
        '前のタブを読んで', '前のタブは', '前のタブを教えて',
        /read (the )?(next|prev(?:ious)?) tab/i,
        /what('s| is) (the )?(next|prev(?:ious)?) tab/i],
      action: (transcript) => {
        const dir = /次|next/i.test(transcript) ? 1 : -1;
        const tabs = this._tabManager?.tabs || [];
        if (tabs.length < 2) {
          this.speak('他のタブはありません');
          return { action: 'peek-tab' };
        }
        const i = this._tabManager?.activeIndex ?? 0;
        const j = (i + dir + tabs.length) % tabs.length;
        const t = tabs[j];
        const name = t.currentTitle || t.currentUrl || 'タイトルなし';
        this.speak(`タブ${j + 1}: ${name}`);
        return { action: 'peek-tab', index: j };
      },
      description: 'Announce the adjacent tab title'
    });

    // Indexed peek — 'タブNを読んで' announces N's title without switching
    // (peek-tab's numbered twin). Hoisted: tab-select's /タブ(\d+)/ owns it.
    this.registerCommand('peek-tab-n', {
      patterns: [/タブ([0-9]+)(?:を読んで|を教えて|は何)/, /read tab ([0-9]+)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const t = (this._tabManager?.tabs || [])[n - 1];
        if (!t) {
          this.speak(`タブ${n}はありません`);
          return { action: 'peek-tab-n', index: -1 };
        }
        this.speak(`タブ${n}: ${t.currentTitle || t.currentUrl || 'タイトルなし'}`);
        return { action: 'peek-tab-n', index: n - 1 };
      },
      description: 'Announce tab N\'s title without switching'
    });

    // Japanese ordinal select — '一番目のタブ'. Hoisted: tab-by-name's
    // (.+)のタブ capture would otherwise treat '一番目' as a title query.
    this.registerCommand('tab-select-ordinal', {
      patterns: [/([0-9一二三四五六七八九十]+)\s*番目のタブ(?!を閉じ)/,
        /([0-9一二三四五六七八九十]+)\s*番のタブ(?!を閉じ)/,
        /^([0-9一二三四五六七八九十]+)\s*番目?$/,
        /(ひと|ふた|み|よ|いつ|む|なな|や|ここの|とお)っ?つ?めのタブ(?!を閉じ)/,
        /^(ひと|ふた|み|よ|いつ|む|なな|や|ここの|とお)っ?つ?め$/],
      action: (transcript) => {
        const ORD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
        const TUME = { ひと: 1, ふた: 2, み: 3, よ: 4, いつ: 5, む: 6, なな: 7, や: 8, ここの: 9, とお: 10 };
        const m = transcript.match(/([0-9一二三四五六七八九十]+)\s*番/) ||
          transcript.match(/(ひと|ふた|み|よ|いつ|む|なな|や|ここの|とお)っ?つ?め/);
        const n = m ? (ORD[m[1]] || TUME[m[1]] || parseInt(m[1], 10) || 0) : 0;
        const t = (this._tabManager?.tabs || [])[n - 1];
        if (!t) {
          this.speak(`タブ${n}はありません`);
          return { action: 'tab-select-ordinal', index: -1 };
        }
        this._tabManager.setActive(n - 1);
        this.speak(t.currentTitle || t.currentUrl || `タブ${n}`);
        return { action: 'tab-select-ordinal', index: n - 1 };
      },
      description: 'Activate the tab at a Japanese ordinal position'
    });

    // Go to reader line N — VoiceOver's go-to-line for the laid-out
    // article. Hoisted like the commands above: the go-to catch-all would
    // otherwise route 'go to line 30' as a navigation request.
    this.registerCommand('reader-goto-line', {
      patterns: [/([0-9一二三四五六七八九]+)\s*行目/, /line\s+(\d+)/i],
      action: (transcript) => {
        const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const m = transcript.match(/([0-9一二三四五六七八九]+)/);
        const n = m ? (KANJI[m[1]] || Number(m[1]) || 0) : 0;
        const res = this._onReaderLine ? this._onReaderLine(n) : null;
        this.speak(res === 'out' ? `${n}行目はありません`
          : res === null ? '記事を開いていません'
            : `${n}行目に移動しました`);
        return { action: 'reader-goto-line', line: n, res };
      },
      description: 'Jump to a line in the reader'
    });

    // Numbered top-site open — the new-tab tile grid, voice-reachable
    // (bookmark-select / history-select parity). Registered before navigate:
    // the loose /トップ?サイト/ open command would otherwise swallow
    // 'トップサイト2'.
    this.registerCommand('top-site-select', {
      patterns: [/トップサイト\s*(\d+)/, /top\s*site\s*(\d+)/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
        const title = this._onTopSiteOpen ? this._onTopSiteOpen(n) : null;
        this.speak(title || `トップサイト${n}はありません`);
        return { action: 'top-site-select', index: n, title: title || null };
      },
      description: 'Open the Nth top site'
    });

    // Vim Ctrl+D/Ctrl+U parity — half a visible page instead of the arrow
    // zones' full page-jump. Hoisted: navigate owns '進む' and back owns
    // '戻る', so '半ページ進む/戻る' would never reach a connectBrowser slot.
    this.registerCommand('half-page-forward', {
      patterns: ['半ページ進む', '半ページ進め', '半ページ下へ',
        '半分進んで', '半分進む', '半分下', '半分下へ', '半ページ下',
        'halfway down', 'half way down', 'halfway', '半分くらい下へ',
        /half page (down|forward)/i],
      action: () => {
        const moved = this._onHalfPage ? !!this._onHalfPage(1) : false;
        this.speak(moved ? '半ページ進みました' : 'これ以上進めません');
        return { action: 'half-page-forward', moved };
      },
      description: 'Scroll the reader half a page down'
    });
    this.registerCommand('half-page-back', {
      patterns: ['半ページ戻る', '半ページ戻して', '半ページ上へ',
        '半分戻って', '半分戻る', '半分上', '半分上へ', '半ページ上',
        'halfway up', 'half way up',
        /half page (up|back)/i],
      action: () => {
        const moved = this._onHalfPage ? !!this._onHalfPage(-1) : false;
        this.speak(moved ? '半ページ戻りました' : 'これ以上戻れません');
        return { action: 'half-page-back', moved };
      },
      description: 'Scroll the reader half a page up'
    });

    // Scroll the reader by N lines — go-to-line's relative pair. Registered
    // before navigate/back: their loose /進|戻/ regexes would otherwise
    // swallow '30行進む'.
    this.registerCommand('reader-scroll-lines', {
      patterns: [/(\d+)\s*行\s*(進|戻)/,
        /(\d+)\s*行\s*(?:下|上)(?:に|へ)?/,
        /(\d+)\s*lines?\s+(forward|back)/i,
        /scroll\s+(?:forward|down|back|up)\s+(\d+)\s*lines?/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
        const back = /戻|back|up|上/i.test(transcript);
        const delta = back ? -n : n;
        const moved = this._onReaderScroll ? this._onReaderScroll(delta) : false;
        this.speak(moved ? `${n}行${back ? '戻り' : '進み'}ました`
          : `これ以上${back ? '戻れません' : '進めません'}`);
        return { action: 'reader-scroll-lines', delta, moved };
      },
      description: 'Scroll the reader by N lines'
    });

    // Muted-state query — 'is it muted' contains 'mute', which the toggle's
    // /(un)?mute/ would swallow, so this lives in the loose-regex hoisted
    // block. JA phrases are distinct strings and could register anywhere.
    this.registerCommand('mute-status', {
      patterns: ['ミュートかどうか', 'ミュートですか', 'ミュート中ですか',
        '消音中ですか', 'ミュートしてる', 'ミュートされてる', 'ミュート中',
        'ミュートになってる', 'ミュートされている', 'ミュートしてます',
        '音は出てる', '音が出てる',
        /is (it |this |the )?muted/i, /mute status/i, /am i muted/i,
        /are we muted/i, /is it quiet/i,
        /did it (go )?mute/i, /did it get muted/i, /was (it|this|the tab) muted/i],

      action: () => {
        const v = this._onMuteStatus ? this._onMuteStatus() : null;
        this.speak(v === null ? '確認できません'
          : v ? 'ミュートされています' : 'ミュートされていません');
        return { action: 'mute-status', muted: v };
      },
      description: 'Announce the muted state'
    });

    // Speak the active find query — the Ctrl+F bar's text field, read back.
    // Hoisted: 'find query' contains 'find', which find-in-page's /find (.+)/
    // would claim as a real search term.
    this.registerCommand('find-query', {
      patterns: ['検索語は', '何を検索している', '何を検索中', '検索語を教えて',
        '最後の検索', '前の検索', '前に検索した言葉', '検索した言葉',
        '最後に検索した言葉', '検索している言葉',
        /what (am i |are we )?searching for/i, /find query/i, /search query/i],
      action: () => {
        const q = this._onFindQuery ? this._onFindQuery() : null;
        this.speak(q ? `「${q}」を検索中です` : '検索していません');
        return { action: 'find-query', query: q };
      },
      description: 'Announce the active find-in-page query'
    });

    // back/forward STATUS — the query twin of the nav commands: a question
    // ('戻れますか'/'can we go back') must not trigger navigation, so these
    // register BEFORE navigate/back below (their loose /進//戻/ patterns own
    // the question phrases otherwise — verified by dispatch check).
    this.registerCommand('back-status', {
      patterns: ['戻れますか', '戻れる', '戻ることができますか', 'もっと戻れる',
        '戻れます', '戻れない', '戻れません', '戻らない',
        'もう戻れない', 'これ以上戻れない', '戻れるページは', '戻れるかな',
        '戻られへん', '戻れへん', '戻れひん', '戻ってる', '戻っている', '戻ったか',
        '前に戻れますか', 'can we go back', 'can i go back',
        /can (we|i) go back/i],
      action: () => {
        const p = this._tabManager?.getActiveTab?.();
        const can = !!p && (p.historyIdx || 0) > 0;
        this.speak(can ? '戻れます' : '戻れません');
        return { action: 'back-status', can };
      },
      description: 'Announce whether back is possible'
    });
    this.registerCommand('forward-status', {
      patterns: ['進めますか', '進める', '進むことができますか', '前に進めますか',
        '進めない', '進めません', '進まない',
        'もう進めない', 'これ以上進めない', '進めるページは', '進めるかな',
        'can we go forward', 'can i go forward',
        /can (we|i) go forward/i],
      action: () => {
        const p = this._tabManager?.getActiveTab?.();
        const can = !!p && (p.historyIdx || 0) < (p.history?.length || 0) - 1;
        this.speak(can ? '進めます' : '進めません');
        return { action: 'forward-status', can };
      },
      description: 'Announce whether forward is possible'
    });

    // history DEPTH status — how many pages remain in each direction, not
    // just can/can't. 'あと何ページ戻れる' otherwise hits back's /戻[るれ]/
    // regex (a question EXECUTING navigation — probe-verified) and
    // 'あと何ページ進める' hits navigate's /進[むめ]/. Register here, ahead
    // of both.
    this.registerCommand('history-depth', {
      patterns: ['あと何ページ戻れる', '何ページ戻れる', 'どこまで戻れる',
        'どのくらい戻れる', 'どれだけ戻れる', 'どれくらい戻れる',
        '履歴はあといくつ', '履歴はあと何ページ', '履歴はいくつ',
        'あと何ページ進める', '何ページ進める', 'どこまで進める',
        'どのくらい進める', 'どれだけ進める', 'どれくらい進める',
        /how (far|many pages) (back|forward)/i,
        /how many pages (can |do )?(we|i) (go )?(back|forward)/i],
      action: (transcript) => {
        const p = this._tabManager?.getActiveTab?.();
        if (!p) {
          this.speak('タブがありません');
          return { action: 'history-depth', direction: null, pages: null };
        }
        const fwd = /進|forward/i.test(transcript);
        const n = fwd
          ? Math.max(0, (p.history?.length || 0) - 1 - (p.historyIdx || 0))
          : Math.max(0, p.historyIdx || 0);
        this.speak(n === 0
          ? (fwd ? '進める履歴はありません' : '戻れる履歴はありません')
          : `あと${n}ページ${fwd ? '進めます' : '戻れます'}`);
        return {
          action: 'history-depth',
          direction: fwd ? 'forward' : 'back',
          pages: n
        };
      },
      description: 'Announce how many pages of history remain in each direction'
    });

    // Multi-step back/forward — Chrome's repeated Alt+←/→ and Voice Access
    // 'go back N pages'. Bare '一つ戻って' stays `back`; digits, kanji
    // numerals, and the 'history start' forms land here and loop the panel's
    // own goBack/goForward — stopping early announces the shortfall honestly.
    // Registered BEFORE `back`: its /戻[るれ]/ regex owns '…に戻る' endings
    // ('最初まで戻る' was probe-verified to execute a single back step).
    // The 'start' regexes require ページ/履歴/まで context so '最初のタブに
    // 戻る' still falls through to `back`.
    this.registerCommand('nav-steps', {
      patterns: [
        /([0-9]+)\s*(?:ページ|つ|回|コ)\s*(?:分)?\s*(?:戻って|戻る|戻り)/,
        /([二三四五六七八九]+)\s*(?:ページ|つ|回|コ)\s*(?:分)?\s*(?:戻って|戻る|戻り)/,
        '一番最初に戻って', '一番最初に戻る', '最初のページに戻って',
        '最初のページに戻る', '履歴の最初に戻って', '履歴の最初に戻る',
        '履歴の最初まで戻って', '履歴の最初まで戻る', '最初まで戻って',
        '履歴の最初', '履歴の一番最初',
        '最初まで戻る', '一番最初まで戻る', '一番最初まで戻って',
        /履歴の最初[^進]{0,4}戻/, /(?:一番)?最初のページ[^進]{0,4}戻/,
        /(?:一番)?最初に戻/, /(?:一番)?最初まで戻/,
        /([0-9]+)\s*(?:ページ|つ|回|コ)\s*(?:分)?\s*(?:進んで|進む|進み)/,
        /([二三四五六七八九]+)\s*(?:ページ|つ|回|コ)\s*(?:分)?\s*(?:進んで|進む|進み)/,
        /(?:go )?back (\d+|two|three|four|five) pages?/i,
        /(?:go )?forward (\d+|two|three|four|five) pages?/i,
        /back to the (start|beginning)/i],
      action: (transcript) => {
        const p = this._tabManager?.getActiveTab?.();
        if (!p) {
          this.speak('タブがありません');
          return { action: 'nav-steps', moved: 0 };
        }
        const fwd = /進|forward/i.test(transcript);
        const toStart = !fwd && /最初|start|beginning/i.test(transcript);
        const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const EN = { two: 2, three: 3, four: 4, five: 5 };
        const m = transcript.match(/([0-9]+)/);
        const km = transcript.match(/([一二三四五六七八九])/);
        const em = transcript.match(/(two|three|four|five)/i);
        // '履歴の最初' asks for unbounded back-steps; cap the loop so a
        // goBack implementation that never reports exhaustion cannot hang
        // the recognizer thread.
        const requested = toStart
          ? 50
          : m
            ? parseInt(m[1], 10)
            : km
              ? KANJI[km[1]]
              : em
                ? EN[em[1].toLowerCase()]
                : 1;
        const step = fwd
          ? () => p.goForward?.() || false
          : () => p.goBack?.() || false;
        let moved = 0;
        while (moved < requested && step()) {
          moved++;
        }
        if (moved === 0) {
          this.speak(fwd ? '進める履歴がありません' : '戻れる履歴がありません');
        } else if (moved < requested) {
          this.speak(`${moved}ページ${fwd ? '進み' : '戻り'}ました（これ以上${fwd ? '進め' : '戻れ'}ません）`);
        } else {
          this.speak(`${moved}ページ${fwd ? '進み' : '戻り'}ました`);
        }
        return {
          action: 'nav-steps',
          direction: fwd ? 'forward' : 'back',
          requested: toStart ? 'start' : requested,
          moved
        };
      },
      description: 'Navigate several history steps at once'
    });

    // Home — Chrome's Home button. There is no homepage URL: the new-tab
    // surface (top sites) is home, so it opens a fresh tab like the button's
    // 'open in new tab' variant. Hoisted before `back`: its /戻[るれ]/ regex
    // owns 'ホームに戻る'.
    this.registerCommand('home', {
      patterns: ['ホームに戻る', 'ホームへ', 'ホーム', 'ホームページ',
        'トップページ', '開始ページ', 'トップページに戻る',
        /^go (to )?home$/i, /^home( page)?$/i, /^go to the home$/i,
        /take me home/i, /bring me home/i, /send me home/i,
        /^go to (the )?home ?page$/i],
      action: () => {
        const p = this._tabManager?.newTab?.();
        this.speak(p ? 'ホームに戻りました' : 'タブをこれ以上開けません');
        return { action: 'home', opened: !!p };
      },
      description: 'Open the new-tab home surface'
    });

    // Navigation commands
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', '次に進んで',
        /(?<!(?:どうやって|一文字|ひと文字|一単語|ひと単語))進む(?!な)|(?<!読み|上げを|行を)進め(?!る|な|ま)/,
        '進んで', '進みたい', '次のページに進んで', '一つ進んで', 'ひとつ進んで',
        '先に進んで', '先へ進んで', '先に進む', '先へ進む', '先に進みたい',
        'forward', /go forward(?! \d)/i, /forward (a|one|the) page/i,
        'お進みなさい',
        'head forward', 'go on forward',
        /one page forward/i],
      action: () => {
        window.history.forward();
        return { action: 'navigate', direction: 'forward' };
      },
      confirmationText: '進みます',
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる',
        /(?<!(?:先頭に|一番上に|トップに|モードに|どうやって|一文字|ひと文字|一単語|ひと単語|単語を|行頭に|頭に|一つ|ひとつ|頭まで))(?:戻る(?!な|まい)|戻れ(?!る|な|ま))/,
        '戻って', '戻ってきて', '戻りたい', '一つ戻って', 'ひとつ戻って',
        '帰ってきて', '帰ってくる',
        '一つ戻る', 'ひとつ戻る', 'ひとつ前に戻る',
        '前のページに戻って', 'さっきのページ', 'さっきのページに戻って',
        '一つ前に戻って', 'もっと戻って', 'もっと前に戻って',
        'さっき見たページ', 'さっき見てたページ', 'もう一個戻って',
        'さっきのサイト', 'さっきのサイトに戻って', 'さっき見たサイト',
        /(take|send|bring) me back/i, /going back/i, /back it up/i],
      action: () => {
        window.history.back();
        return { action: 'navigate', direction: 'back' };
      },
      confirmationText: '戻ります',
      description: 'Navigate back'
    });

    this.registerCommand('refresh', {
      patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん'],
      action: () => {
        window.location.reload();
        return { action: 'refresh' };
      },
      confirmationText: '更新します',
      description: 'Refresh page'
    });

    // Search command
    this.registerCommand('search', {
      patterns: [/検索[：:]\s*(.+)/, /さが[すせ][：:]\s*(.+)/, /サーチ[：:]\s*(.+)/],
      action: (transcript) => {
        const match = transcript.match(/[：:]\s*(.+)/);
        if (match && match[1]) {
          const query = match[1];
          window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
          return { action: 'search', query };
        }
      },
      confirmationText: '検索します',
      description: 'Search web',
      example: '検索：てんき'
    });

    // VR mode control
    this.registerCommand('vr-enter', {
      patterns: ['VRモード', 'VR開始', 'ブイアール', 'バーチャルリアリティ',
        'VRを始める', 'VRモードに入る', 'VRモードで', '没入モード',
        '没入モードに入る', 'VRを開始', '全画面', 'フルスクリーン',
        '全画面にして', 'フルスクリーンにして', '全画面モード', 'フルスクリーンモード',
        'フルスクリーンで見たい', '全画面表示して', 'フルスクリーンで',
        '全画面で見たい', 'フルスクリーンにしたい',
        /vr mode/i, /immersive mode/i, /(?<!exit )full ?screen/i],
      action: () => {
        // Would trigger VR mode
        return { action: 'vr', enabled: true };
      },
      confirmationText: 'VRモードを開始します',
      description: 'Enter VR mode'
    });

    this.registerCommand('vr-exit', {
      patterns: ['VR終了', 'VRやめる', '通常モード', 'ブラウザを終了', 'アプリを終了',
        '終了して', 'VRを終了', 'VRをやめる', 'VRを終わる', 'VRを出る',
        '終了', 'アプリを閉じて', 'ブラウザを閉じて', 'ブラウザを終了して',
        'アプリを終了して', 'アプリを閉じる', 'ブラウザを閉じる',
        '全画面をやめて', 'フルスクリーンをやめて', '全画面解除', 'フルスクリーン解除',
        '全画面を閉じて', '全画面を解除して', 'フルスクリーンを閉じて',
        'quit the app', 'quit the browser', 'アプリを落とす',
        'close app', 'close browser', 'close the browser', /close the app/i,
        /^quit$/i, /^exit$/i, 'shut down', 'shutdown', 'close the app',
        'shut it down', 'turn it off', 'switch it off',
        'じゃあね', 'ばいばい', 'さようなら', 'またね', 'また後で', 'お疲れさま',
        '終わり', '終わります', 'おしまい', 'しゅうりょう',
        'see ya', 'later', 'see you later', 'see ya later', 'catch you later',
        'peace', 'peace out', 'bye bye', 'adios', 'ciao',
        'ta ta', 'toodles', 'catch you later', 'im out', "i'm out", 'signing off',
        'leave the browser', 'shut it all down', 'shut everything down',
        'before i go', 'before i leave', 'im off', 'im heading out', 'gotta go',
        'i gotta go', 'i gotta run', 'gotta run', 'heading out',
        'shut this down', 'shut that down', 'shut the whole thing down',
        /quit (the )?(app|browser)/i, /exit (the )?(app|browser|vr)/i,
        /get me out( of here)?/i, /get outta here/i, /get out of here/i,
        /exit full ?screen/i],
      action: () => {
        // Would exit VR mode
        return { action: 'vr', enabled: false };
      },
      confirmationText: 'VRモードを終了します',
      description: 'Exit VR mode'
    });

    // NOTE: scroll-down / scroll-up are registered in connectBrowser() instead.
    // A duplicate pair used to live here calling `window.scrollBy`, which
    // scrolls the host page — meaningless inside an immersive session — and was
    // overwritten anyway (registerCommand is a Map.set, so the later
    // connectBrowser registration always won once it ran).

    // Volume control — drives the host's onVolume handler once wired
    // (master-volume stepper); without a handler the commands still confirm
    // but move nothing, same as before.
    this.registerCommand('volume-up', {
      patterns: ['音量上げる', '音量アップ', 'ボリュームアップ', '音量を上げて',
        '音を大きく', '音量を大きく', '音を上げて',
        '音が小さすぎる', '声が小さい', '声が小さすぎる',
        '声を大きく', '大きな声で', '大きい声で', '声を出して', '音を出して',
        '音量を大きくして', '音を大きくして',
        '声を上げて', '声を大きくして', 'ボリュームを上げて',
        '音量をあげる', 'ボリュームを上げる', '音量を上げる', '音を上げる', '声を上げる',
        'ボリュームアップ', 'ボリュームを大きく', '音を上げて',
        'louder', 'speak up', 'turn it up', 'crank it up', 'bump it up',
        'turn up the volume', 'pump it up', 'make it louder',
        'more volume', 'up the volume', 'raise the volume', 'much louder',
        'way louder', 'a lot louder', 'lot louder', 'a bit louder', 'a little louder',
        'little louder', 'pump up the volume', 'turn it way up',
        'turn it all the way up', 'blast it', 'speak louder',
        'too quiet', 'its too quiet', 'its so quiet', 'way too quiet',
        'really quiet', 'pretty quiet', 'kinda quiet', 'too soft',
        '声をあげて', '音をあげて',
        '静かすぎる', '静かすぎ', '静かすぎるよ', '小さすぎる', '声が小さすぎるよ',
        'speak up a bit', 'bit louder', 'louder still',
        'louder please', 'volume up', 'volume up please',
        /volume (up|raise|increase|louder)/i],
      action: () => {
        if (this._onVolume) {
          this._onVolume(0.1);
        }
        return { action: 'volume', change: 0.1 };
      },
      confirmationText: '音量を上げます',
      description: 'Increase volume'
    });

    this.registerCommand('volume-down', {
      patterns: ['音量下げる', '音量ダウン', 'ボリュームダウン', '音量を下げて',
        '音を小さく', '音量を小さく', '音を下げて',
        'うるさい', '音が大きい', '音がうるさい',
        'うるさすぎる', '声が大きい', '声を小さく', '声を小さくして',
        '音量を小さくして', '音を小さくして',
        '静かにしろ', '音を小さくしろ',
        '声を下げて', '声を小さくして', 'ボリュームを下げて',
        'less volume', 'lower the volume', 'lower your voice',
        'turn it down a notch', 'a bit quieter', 'bit quieter', 'quieter',
        'volume down', 'turn the volume down', 'lower it a bit',
        '音量をさげる', '音量を下げる', 'ボリュームを下げる', '音を下げる', '声を下げる',
        'ボリュームを小さく', 'ボリュームダウン', '音を下げて',
        'quieter', 'turn it down', 'speak softer', 'tone it down', 'bump it down',
        'quiet down', 'quieten', 'quieten down', 'keep it down', 'keep it quiet',
        'keep the noise down', 'not so loud', 'too loud', 'its too loud',
        'うるさすぎ', 'うるさすぎるよ', 'softer', 'softer please',
        'way too loud', 'so loud', 'pretty loud', 'kinda loud', 'a bit loud',
        'really loud', '音をさげて', '声をさげて',
        '小さい声で', '小さな声で', '声をおさえて', '声を抑えて',
        'whisper', 'deafening', 'painfully loud', 'ear splitting', 'too loud for me',
        'too much volume', 'blaring', 'blasting',
        'turn down the volume', 'crank it down', 'make it quieter',
        /volume (down|lower|decrease|quieter)/i],
      action: () => {
        if (this._onVolume) {
          this._onVolume(-0.1);
        }
        return { action: 'volume', change: -0.1 };
      },
      confirmationText: '音量を下げます',
      description: 'Decrease volume'
    });

    // Volume status — "what's the volume" atom. onVolume(0) returns
    // undefined (no change), so the host exposes a dedicated getter.
    this.registerCommand('volume-status', {
      patterns: ['音量は', '今の音量', '音量を教えて', '音量いくつ', '音量はいくつ',
        '今の音量を教えて', '音量を確認して', '音量を確認', '声の大きさ', '音量はどのくらい',
        'ボリューム',
        '音量を変えて', '音量を変更して', '音量を変更', '音量を上げ下げ',
        /^volume$/i, 'how loud', 'what volume', 'is it loud',
        'how loud is it', 'how much volume', 'how loud is the volume',
        /current volume/i, /volume (status|level)/i, /what'?s? (?:the )?volume|what is (?:the )?volume/i],
      action: () => {
        const v = this._onVolumeStatus ? this._onVolumeStatus() : null;
        this.speak(v === null ? '音量を取得できません' : `音量は${v}%です`);
        return { action: 'volume-status', volume: v };
      },
      description: 'Announce the current volume'
    });
    // volume-set — the numeric twin of volume-up/down ('volume to 50'):
    // same hook, delta computed from the status surface so the result is
    // exact. Honest without a host hook.
    this.registerCommand('volume-set', {
      patterns: [/音量を?(\d+)(%|パーセント)?に?/, /volume (to |at )?(\d+)/i,
        '半分の音量', '音量を半分', '音量を半分に', '音量半分', '音量を半分にして',
        '音量ゼロにして', '音量をゼロに', '音量ゼロ', 'ゼロパーセント',
        '最大音量', '最大音量で', '音量を最大に', '音量を最大にして',
        '音量を最大', '音量最大', '音量を最小', '音量を最小に',
        '音量を最小にして', '最小音量', '音量をゼロ', '音量をゼロにして',
        'volume zero', /half volume/i, /volume (to |at )?half/i,
        /max(?:imum)? volume/i, /full volume/i, /volume (to )?zero/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        let target = Math.min(100, Math.max(0, m ? parseInt(m[1], 10) : 0));
        if (/最大|max(?:imum)?|full/i.test(transcript)) {
          target = 100;
        } else if (/半分|half/i.test(transcript)) {
          target = 50;
        } else if (/ゼロ|zero/i.test(transcript)) {
          target = 0;
        }
        const cur = this._onVolumeStatus ? this._onVolumeStatus() : null;
        if (cur === null || cur === undefined) {
          this.speak('音量を変更できません');
          return { action: 'volume-set', volume: null };
        }
        if (this._onVolume) {
          this._onVolume((target - cur) / 100);
        }
        this.speak(`音量を${target}%にしました`);
        return { action: 'volume-set', volume: target };
      },
      description: 'Set the volume to an absolute percent'
    });

    // Settings-by-voice: the caption-size and gaze-dwell steppers are the
    // flagship a11y knobs and a voice-only user cannot reach the settings
    // panel mid-immersion. Same clamp/apply/persist path as the steppers,
    // hosted by the app via onCaptionScale/onDwellTime.
    this.registerCommand('caption-size-up', {
      patterns: ['キャプションを大きく', '字幕を大きく', 'キャプションを大きくして',
        '字幕を大きくして', '字幕のサイズを大きくして', '字幕のサイズを大きく',
        'キャプションサイズを大きくして', 'キャプションサイズを大きく',
        /larger captions/i, /bigger captions/i, /increase caption( size)?/i, /caption (size )?up/i],
      action: () => {
        const v = this._onCaptionScale ? this._onCaptionScale(0.25) : null;
        this.speak(v === null ? 'キャプションサイズはこれ以上大きくできません' : `キャプションサイズ ${v}倍`);
        return { action: 'caption-size-up', scale: v };
      },
      description: 'Increase caption text size'
    });

    this.registerCommand('caption-size-down', {
      patterns: ['キャプションを小さく', '字幕を小さく', 'キャプションを小さくして',
        '字幕を小さくして', '字幕のサイズを小さくして', '字幕のサイズを小さく',
        'キャプションサイズを小さくして', 'キャプションサイズを小さく',
        /smaller captions/i, /decrease caption( size)?/i, /caption (size )?down/i],
      action: () => {
        const v = this._onCaptionScale ? this._onCaptionScale(-0.25) : null;
        this.speak(v === null ? 'キャプションサイズはこれ以上小さくできません' : `キャプションサイズ ${v}倍`);
        return { action: 'caption-size-down', scale: v };
      },
      description: 'Decrease caption text size'
    });

    this.registerCommand('dwell-time-up', {
      patterns: ['注視時間を長く', '注視を長く', '注視時間を延ばして',
        /longer dwell/i, /dwell longer/i, /increase dwell/i],
      action: () => {
        const v = this._onDwellTime ? this._onDwellTime(250) : null;
        this.speak(v === null ? '注視時間はこれ以上長くできません' : `注視時間 ${v}ms`);
        return { action: 'dwell-time-up', ms: v };
      },
      description: 'Increase gaze-dwell activation time'
    });

    this.registerCommand('dwell-time-down', {
      patterns: ['注視時間を短く', '注視を短く', '注視時間を短くして',
        /shorter dwell/i, /dwell shorter/i, /decrease dwell/i],
      action: () => {
        const v = this._onDwellTime ? this._onDwellTime(-250) : null;
        this.speak(v === null ? '注視時間はこれ以上短くできません' : `注視時間 ${v}ms`);
        return { action: 'dwell-time-down', ms: v };
      },
      description: 'Decrease gaze-dwell activation time'
    });

    // Article text size — the readerTextScale stepper's voice surface
    // (WCAG 1.4.4): voice-only users can resize the article without
    // leaving immersion for the settings panel.
    this.registerCommand('reader-size-up', {
      patterns: ['記事の文字を大きく', '記事を大きく', 'リーダーの文字を大きく', '記事の文字を大きくして',
        'ズームイン', '文字を大きく', '文字を大きくして', '拡大して', 'もっと大きく',
        'フォントを大きく', 'フォントサイズを上げて', '文字サイズを上げて',
        'ズームインして', '文字を拡大', 'ページを拡大', 'ページを大きく',
        '拡大', 'ページを拡大して', 'ページを拡大してほしい',
        'フォントを大きくして', 'フォントを拡大', 'フォントサイズを上げる',
        '文字が小さい', '字が小さい', '読みやすくして', '見やすくして', '読みやすく', '見やすく', '文字が読めない', '読みにくい',
        '文字が見にくい', '字が見にくい', '字が見えにくい', '大きくして',
        '字が見えない', '字を大きく', '字を大きくして', 'ズームアップ',
        /larger (article|reader) text/i, /bigger (article|reader) text/i,
        /^too small$/i, /^make it bigger$/i, /text is too small/i, /make (the )?text bigger/i,
        /increase (article|reader) text size/i, /zoom( way)? in/i, /^magnify$/i],
      action: () => {
        const v = this._onReaderScale ? this._onReaderScale(0.25) : null;
        this.speak(v === null ? '記事の文字はこれ以上大きくできません' : `記事の文字サイズ ${v.toFixed(2)}倍`);
        return { action: 'reader-size-up', scale: v };
      },
      description: 'Increase reader article text size'
    });

    this.registerCommand('reader-size-down', {
      patterns: ['記事の文字を小さく', '記事を小さく', 'リーダーの文字を小さく', '記事の文字を小さくして',
        'ズームアウト', '文字を小さく', '文字を小さくして', '縮小して', 'もっと小さく',
        'フォントを小さく', 'フォントサイズを下げて', '文字サイズを下げて',
        'ズームアウトして', 'ページを縮小', '文字を縮小',
        '縮小',
        'フォントを小さくして', 'フォントを縮小', 'フォントサイズを下げる',
        'too big', 'make it smaller', /text is too big/i, /make (the )?text smaller/i,
        '文字が大きい', '字が大きい',
        /smaller (article|reader) text/i, /decrease (article|reader) text size/i,
        /zoom( way)? out/i],
      action: () => {
        const v = this._onReaderScale ? this._onReaderScale(-0.25) : null;
        this.speak(v === null ? '記事の文字はこれ以上小さくできません' : `記事の文字サイズ ${v.toFixed(2)}倍`);
        return { action: 'reader-size-down', scale: v };
      },
      description: 'Decrease reader article text size'
    });

    // Explicit speech rate — the numeric complement of faster/slower
    // (NVDA rate step vs. value setting): '読み上げ速度2倍' lands the
    // rate directly instead of repeating ±0.25 steps.
    this.registerCommand('speech-rate-set', {
      patterns: [/読み上げ速度([0-9.]+)倍/, /([0-9一二三四五六七八九.]+)倍速/,
        '半分の速さ', '半分の速度', '倍速で',
        /(speech|talk|reading) (rate|speed) (to )?([0-9.]+)/i],
      action: (transcript) => {
        // JA multiplier idioms: '2倍速' lands directly; kanji numerals and
        // '半分の速さ' are folded to their decimal equivalent.
        const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const km = transcript.match(/([一二三四五六七八九])倍速/);
        const m = transcript.match(/[0-9.]+/);
        const rate = /半分/.test(transcript)
          ? this.setSpeechRate(0.5)
          : km
            ? this.setSpeechRate(KANJI[km[1]])
            : /倍速/.test(transcript) && !m
              ? this.setSpeechRate(2)
              : m ? this.setSpeechRate(parseFloat(m[0])) : this._speechRate;
        this.speak(`読み上げ速度 ${rate.toFixed(2)}倍`);
        return { action: 'speech-rate-set', rate };
      },
      description: 'Set speech rate to a numeric multiplier'
    });

    // Current time — the NVDA Insert+F12 atom. Announce hour/minute
    // naturally ('15時04分'); no host hook needed.
    this.registerCommand('time', {
      patterns: ['今何時', '現在の時刻', '時刻を教えて', '何時ですか', '時間を教えて',
        '何時', '時計', '時計は',
        /what time/i, /current time/i, /tell me (the )?time/i,
        'whats the time', 'time is it', 'got the time'],
      action: () => {
        const now = new Date();
        const mm = String(now.getMinutes()).padStart(2, '0');
        this.speak(`現在時刻は${now.getHours()}時${mm}分です`);
        return { action: 'time' };
      },
      description: 'Announce the current time'
    });

    // Session elapsed time — digital-wellbeing 'screen time' parity. A
    // headset hides OS clocks; asking how long you've been inside should
    // answer honestly from the constructor timestamp.
    this.registerCommand('session-time', {
      patterns: ['どれくらい使ってる', '使い始めてから', '起動してから',
        '使用時間', '経過時間', 'セッション時間', 'セッション時間は',
        '使ってからどれくらい', 'どれくらい経った', '使い始めてどれくらい',
        /screen time/i, /how long (have i been|has it been|since)/i,
        /session time/i, /uptime/i],
      action: () => {
        const mins = Math.floor((Date.now() - this._startedAt) / 60000);
        this.speak(mins < 1
          ? '起動してから1分未満です'
          : `起動してから約${mins}分です`);
        return { action: 'session-time', minutes: mins };
      },
      description: 'Announce elapsed session time'
    });

    // About — Chrome's About page by voice. No version string is exposed to
    // this layer, so the honest answer names the product.
    this.registerCommand('about', {
      patterns: ['バージョンは', 'バージョンを教えて', 'バージョン情報',
        'ブラウザの名前', '何のブラウザ', 'このアプリは何', 'アプリの名前',
        'このブラウザは何', 'ブラウザ名', 'アプリ名',
        'バージョン番号', 'ブラウザのバージョン', '開発者は', '誰が作った',
        /what browser/i, /browser version/i, /what version/i,
        /about( this)? browser/i, /version( number)?/i, /who (made|built) (this|it)/i],
      action: () => {
        this.speak('このブラウザはQui-Browserです');
        return { action: 'about' };
      },
      description: 'Name the browser'
    });

    // Voice picker — NVDA's voice-selection atom. SpeechSynthesis engines ship
    // several voices; cycling lands on the next one and announces its name so
    // the user can keep cycling until a voice they can parse comes up. Keeps
    // working without a browser connection (synthesis only).
    this.registerCommand('select-voice', {
      patterns: ['声を変えて', '読み上げ音声を変えて', '声を変える',
        '音声を変えて', '別の声', '別の声にして', '違う声にして',
        '別の声で', '女性の声で', '男性の声で', '高い声で', '低い声で',
        '別の声に変更', '声を変えてほしい',
        '男の声で', '女の声で', '男性の声', '女性の声', '女の声にして', '男の声にして',
        /change (the )?voice/i, /next voice/i],
      action: () => {
        const voices = this.synthesis?.getVoices?.() || [];
        if (!voices.length) {
          this.speak('読み上げ音声が利用できません');
          return { action: 'select-voice', voice: null };
        }
        this._voiceIndex = ((this._voiceIndex ?? -1) + 1) % voices.length;
        this._voice = voices[this._voiceIndex];
        this.speak(`声を${this._voice.name}にしました`);
        return { action: 'select-voice', voice: this._voice.name };
      },
      description: 'Cycle the narration voice'
    });

    // voice-list — select-voice's list twin (NVDA voice list parity): hear
    // the available voices without cycling through them blindly.
    this.registerCommand('voice-list', {
      patterns: ['声一覧', '声の一覧', '利用可能な声',
        /voice list|list voices|available voices/i],
      action: () => {
        const voices = this.synthesis?.getVoices?.() || [];
        if (!voices.length) {
          this.speak('読み上げ音声が利用できません');
          return { action: 'voice-list', count: 0 };
        }
        const shown = voices.slice(0, 5).map((v) => v.name).join('、');
        const more = voices.length > 5 ? `、他${voices.length - 5}件` : '';
        this.speak(`${voices.length}個の声。${shown}${more}`);
        return { action: 'voice-list', count: voices.length };
      },
      description: 'List the available narration voices'
    });

    // Japanese IME
    this.registerCommand('ime-toggle', {
      patterns: ['日本語入力', '日本語モード', '入力切り替え'],
      action: () => {
        // Would toggle IME
        return { action: 'ime', enabled: true };
      },
      confirmationText: '日本語入力モードです',
      description: 'Toggle Japanese IME'
    });

    // Help — read back the actual spoken phrases, not just a count. A voice-
    // command user (often relying on voice because gaze/controller input is
    // difficult) has no other way to discover what to say; announcing "12
    // commands available" with no list defeats the purpose of a help command.
    this.registerCommand('help', {
      patterns: ['ヘルプ', '助けて', '使い方', '何ができる',
        '困った', 'わからない', 'ヘルプミー', '使い方を教えて',
        'コマンド一覧を読み上げて', 'ヘルプを読み上げて', 'ヘルプを見せて',
        'コマンド一覧を表示', 'コマンドを表示',
        '操作方法', 'できること', 'コマンドを教えて', 'コマンドを読み上げて',
        'コマンド一覧を読んで', 'ヘルプを読んで', '聞き方を教えて', '音声ガイド',
        '使い方は', '何ができますか', 'コマンド一覧',
        'コマンドは', 'どんなコマンド', '操作方法は', 'ヘルプは', '命令一覧', '命令を教えて',
        '教えて', '教えてほしい',
        'どうすればいい', 'どうすれば', 'なんとかして',
        '使い方がわからない', '操作方法がわからない', 'やり方がわからない',
        'わからん', '使い方がわからん', '使い方教えて', 'どうするの', 'これどうする',
        '操作がわからない', 'どうする', 'どうすればいいの', '何をすればいい',
        'できる', 'できない', 'できますか', '可能ですか', '対応してる', '対応してない',
        'お願い', 'おねがい', '頼む', '頼みます', 'please do', 'pls help', 'help me out',
        'わかるかな', '忘れた', '忘れちゃった', 'ど忘れ', '思い出せない', '覚えてない',
        'わすれた', '忘れたんだけど', '忘れちゃったんだけど',
        'now what', 'then what', 'what now', 'what next',
        'what can i say', 'what are my options', 'show commands', 'all commands',
        'commands', 'quick question', 'quick favor', 'do me a favor', 'do me a solid',
        'be a doll', 'work your magic', 'do the thing', 'just do it',
        'できること教えて', 'できることを教えて', '何が言える', 'なにができる',
        'コマンド教えて', '命令を教えて',
        'お願いします', 'お願いしますよ', 'よろしく', 'よろしくお願いします',
        'どうぞ', 'どうぞよろしく', 'わかんない', 'わかりません',
        'わかりませんでした', 'どうしたら',
        'やって', 'やってくれ', 'やってくれる', 'やってほしい', 'やってください',
        '知らん', 'しらん', 'できひん', 'でけへん',
        '対応してますか', 'できません', 'これできる',
        /what can i do/i, /what do i say/i, /how does this work/i, /^can i /i,
        /^do (i|we)\b/i, /^do (you|they)(?! mind| hear| think)\b/i, /^mind if i\b/i,
        /^any way you can/i, /^is there a way to/i, /かね(?:る|ます|ません)$/,
        '困ってる', '困りました', '困ってます', '困ってるんだけど',
        /what(?:'s| is)? the command/i, /what command/i,
        /what should i say/i, /how do i use/i,
        'チュートリアル', 'チュートリアルを開いて', 'チュートリアルを見せて',
        '音声ガイドを読んで', 'ガイドを開いて', '使い方を見せて',
        'ガイドを見せて', '使い方ガイド',
        'ヘルプを開いて', 'ヘルプを出して', 'サポート', 'サポートを開いて',
        '問い合わせ', 'やり方は', 'やり方を教えて', '使い方はどこ',
        /^どうやって/,
        /^help( me)?$/i,
        '何を聞けばいい', '何が聞ける', '何を頼めば',
        /^how (do|can|to) i/i, /^how do (we|you)\b(?!.*\bspell)/i,
        'what do i press', 'which button', 'which do i press', 'what button',
        'what do i do', 'what should i do', 'how does this work',
        'どう閉じる', '閉じ方は', '閉じかたは', '戻り方は', '戻りかたは', '進み方は', '読み方は',
        '開き方は', '消し方は', '探し方は', '閉じ方', '戻り方', '進み方', '読み方', '開き方', '消し方',
        /(閉じ|戻り|進み|読み|使い|開き|消し|探し|送り|止め)(方|かた)(は|って|の)?$/,
        /what can you do/i, /show me (the )?commands/i, /command list/i,
        /list (the )?commands/i, /what commands/i, /voice commands/i,
        /read commands/i],
      action: () => {
        const phrases = Array.from(this.commands.values())
          .map((cmd) => this._spokenExample(cmd))
          .filter(Boolean);
        const commandList = phrases.join('、');

        this.speak(`使用可能なコマンドは、${phrases.length}個です。${commandList}`);
        return { action: 'help', commands: commandList };
      },
      description: 'Show help'
    });

    // scoped-help — Voice Access 'what can I say about X' parity: filter the
    // registry by a topic term instead of reading every phrase. Matches the
    // term against each command's name, description and literal patterns.
    this.registerCommand('scoped-help', {
      // 'help me'/'help me please' are cries for help itself, not a topic
      // query — the (?!me) lookahead passes them to the 'help' command.
      patterns: [/(.+)について教えて/, /help (?!me\b|please\b)(?:with |about )?(.+?)(?:\s+please)?$/i],
      action: (transcript) => {
        const m = transcript.match(/(.+)について教えて/) ||
          transcript.match(/help (?!me\b|please\b)(?:with |about )?(.+?)(?:\s+please)?$/i);
        const term = (m ? m[1] : '').toLowerCase();
        const hits = [];
        for (const [name, cmd] of this.commands) {
          const literals = (cmd.patterns || [])
            .filter((p) => typeof p === 'string').join(' ');
          const hay = `${name} ${cmd.description || ''} ${literals}`.toLowerCase();
          if (term && hay.includes(term)) {
            const ex = this._spokenExample(cmd);
            if (ex) {
              hits.push(ex);
            }
          }
        }
        this.speak(hits.length
          ? `「${term}」のコマンドは${hits.length}個です。${hits.slice(0, 8).join('、')}`
          : `「${term}」のコマンドはありません`);
        return { action: 'scoped-help', term, count: hits.length };
      },
      description: 'Describe commands matching a topic'
    });

    // repeat-n — Vim 'N.' parity: run the last repeatable command N times
    // (capped at 5 — a voice misfire shouldn't loop forever). Self-contained:
    // re-dispatches _repeatableTranscript, which processCommand only stores
    // for non-repeat transcripts, so 'repeat 3 times' itself never loops.
    this.registerCommand('repeat-n', {
      patterns: [/(\d+)回(繰り返し|実行|リピート)/, /(\d+) times/i,
        /do it (\d+) times/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = Math.min(5, Math.max(1, m ? parseInt(m[1], 10) : 1));
        if (!this._repeatableTranscript) {
          this.speak('繰り返すコマンドがありません');
          return { action: 'repeat-n', count: 0 };
        }
        for (let i = 0; i < n; i++) {
          this.processCommand(this._repeatableTranscript);
        }
        this.speak(`${n}回実行しました`);
        return { action: 'repeat-n', count: n };
      },
      description: 'Repeat the last command N times'
    });

    // Battery status — OS/battery-status parity (Quest headsets report via
    // navigator.getBattery; async so the announce lands on resolution,
    // honest when the API is absent).
    this.registerCommand('battery-status', {
      patterns: ['バッテリーは', 'バッテリー残量', '電池は',
        '充電は', '充電中ですか', '充電してる',
        '電池残量', '充電残量', '残量は', '電源は', 'バッテリーの残り', '電池残り',
        '充電がない', '電池が切れそう', '電池がない', 'バッテリーがない',
        'バッテリー切れ', 'バッテリーが切れそう',
        /battery (level|status|percentage)/i, /battery left/i,
        /(whats|what'?s|how'?s|hows)( my| the| is)? battery/i,
        /charging|charge status/i],
      action: () => {
        const get = navigator?.getBattery?.bind(navigator);
        if (!get) {
          this.speak('バッテリー状態を確認できません');
          return { action: 'battery-status', level: null };
        }
        get().then((b) => {
          const pct = Math.round(b.level * 100);
          const charging = b.charging ? '（充電中）' : '';
          this.speak(`バッテリーは${pct}%です${charging}`);
        }).catch(() => {
          this.speak('バッテリー状態を確認できません');
        });
        return { action: 'battery-status' };
      },
      description: 'Announce the battery level'
    });

    // percent-jump — Kindle 'go to N%' parity: '50%へ'/'percent 50' jumps
    // the reader to that fraction of the article. Hoisted: go-to's
    // 'go to X' catch-all owns the EN phrase otherwise.
    this.registerCommand('percent-jump', {
      patterns: [/(\d+)%\s*(へ|に)/, /(\d+)\s*(?:パーセント|%)\s*(?:の位置|へ|に)/,
        /^(\d+)%(に)?$/, /(\d+)割(?!る|り)/, '半分まで', '真ん中まで', '中間まで',
        '半分のところ', '中間のところ', '真ん中に移動', '中央に移動',
        '中間に移動', 'ページの真ん中', '真ん中へ', '中間地点', '真ん中',
        /(?:go to |jump to )?(\d+)\s*percent/i,
        /^(?:a )?(third|quarter|half|three quarters) of the way/i,
        '半分くらい', '半分ぐらい', '半分くらい下', '半分ぐらい下', '半分くらいまで', '半分ぐらいまで',
        'middle of the page', 'middle of the article', 'middle of it', 'the midpoint',
        'halfway point', 'half way point', 'three quarters down', 'three quarters through',
        'a third down', 'a third of the way down', 'ページの中間', '記事の真ん中',
        '四分の三', '三分の一', '三分の二', '四分の三くらい', '三分の一くらい'],
      action: (transcript) => {
        // '半分/真ん中/中間' carry no digits — they mean the midpoint (50%).
        const wari = transcript.match(/(\d+)割(?!る|り)/);
        const m = transcript.match(/(\d+)/);
        const frac = transcript.match(
          /(third|quarter|half|three quarters)(?:\s+of the way)?(?:\s+(?:down|through|in))?/i);
        const jaFrac = transcript.match(/四分の三|三分の二|三分の一/);
        const FRAC = { third: 33, quarter: 25, half: 50, 'three quarters': 75,
          '四分の三': 75, '三分の二': 66, '三分の一': 33 };
        let pct = 0;
        if (frac) {
          pct = FRAC[frac[1].toLowerCase()];
        } else if (jaFrac) {
          pct = FRAC[jaFrac[0]];
        } else if (/半分|真ん中|中間|中央|middle|midpoint/.test(transcript)) {
          pct = 50;
        } else if (m) {
          pct = Math.min(100, Math.max(0, parseInt(m[1], 10) * (wari ? 10 : 1)));
        }
        const done = this._onReaderPercent ? this._onReaderPercent(pct) : null;
        this.speak(done
          ? `${pct}%に移動しました`
          : '記事を開いていません');
        return { action: 'percent-jump', percent: pct, done };
      },
      description: 'Jump to a percent of the article'
    });

    // speech-reset — NVDA 'restore defaults' parity: one phrase returns
    // rate AND pitch to 1.0 (resetting each via steppers is 8+ commands).
    this.registerCommand('speech-reset', {
      patterns: ['速度をリセット', '声をリセット', '読み上げをリセット',
        '元の速度に戻して', '通常の速度', '標準速度', '元の速さに戻して',
        '普通に読んで', '普通の速度', 'いつもの速度', 'デフォルトの速度',
        '標準の速さで', '普通の速さで', 'いつもの速さで', 'もとの速さに',
        'もとの速さに戻して', '速さを戻して', '速度リセット',
        '読み上げ速度を戻して', '読み上げをもとに戻して', 'スピードを戻して',
        /reset speech/i, /speech reset/i, /normal speed/i, /normal voice/i],
      action: () => {
        this._speechRate = 1.0;
        this._speechPitch = 1.0;
        this.speak('読み上げをリセットしました');
        return { action: 'speech-reset' };
      },
      description: 'Reset speech rate and pitch'
    });
    // confidence-status — the ASR self-report atom: '認識の信頼度は' answers
    // the last recognition's confidence (deaf/HoH users gauge whether the
    // mic is hearing them).
    this.registerCommand('confidence-status', {
      patterns: ['認識の信頼度は', '信頼度は', '認識精度は',
        /confidence (level|score)/i, /recognition confidence/i],
      action: () => {
        const pct = Math.round((this.confidence || 0) * 100);
        this.speak(`認識の信頼度は${pct}%です`);
        return { action: 'confidence-status', confidence: pct };
      },
      description: 'Announce the last recognition confidence'
    });
    // wake-word-status — the query twin of wake-word-toggle: announces the
    // word (or that it's off) rather than flipping it.
    this.registerCommand('wake-word-status', {
      patterns: ['ウェイクワードは', 'ウェイクワードの状態',
        /wake word(?! (on|off))/i],
      action: () => {
        const on = !!this.settings.requireWakeWord;
        this.speak(on
          ? `ウェイクワードは「${this.settings.wakeWord}」です`
          : 'ウェイクワードはオフです');
        return { action: 'wake-word-status', on };
      },
      description: 'Announce the wake word'
    });
    // reader-scale-reset — the 'reset zoom' twin (Chrome Ctrl+0 parity):
    // jump straight back to 1.0 via the delta hook instead of stepping down.
    this.registerCommand('reader-scale-reset', {
      patterns: ['ズームをリセット', 'ズームリセット', '拡大を戻して', '拡大を元に戻して',
        '文字サイズを元に戻して', '文字サイズをリセット', 'フォントサイズを元に戻して',
        'フォントサイズをリセット', '元の大きさに戻して',
        /reset (zoom|text size|font size)/i, /zoom reset/i,
        /^unzoom$/i, /^dezoom$/i, /zoom back/i, /zoom (back )?to normal/i, /zoom normal/i,
        /back to normal size/i],
      action: () => {
        const cur = this._onReaderScaleStatus ? this._onReaderScaleStatus() : null;
        if (typeof cur !== 'number' || !this._onReaderScale) {
          this.speak('文字サイズを確認できません');
          return { action: 'reader-scale-reset', scale: null };
        }
        const v = this._onReaderScale(1.0 - cur);
        this.speak(cur === 1.0
          ? '文字サイズは標準です'
          : '文字サイズを標準に戻しました');
        return { action: 'reader-scale-reset', scale: v };
      },
      description: 'Reset reader text scale to 1.0'
    });

    // reader-scale-status — the query twin of onReaderScale (delta-0
    // returns null there, so a dedicated getter reports the scale).
    this.registerCommand('reader-scale-status', {
      patterns: ['拡大率', '倍率', '倍率は', '拡大率は','記事の文字サイズは', '文字サイズは', '記事の文字は',
        'フォントサイズ', 'フォントサイズは', '文字サイズ', 'フォントサイズはいくつ',
        'ズーム率は', 'ズーム率',
        'ズームレベルは', 'ズームは何倍', '今のズーム', 'ズーム倍率', 'ズーム倍率は',
        'ズーム', 'ズームして', /^zoom$/i,
        /reader (text )?(size|scale)/i, /text size/i,
        /what(?:'?s| is)? (the )?(current )?zoom( level)?/i, /zoom level/i, /magnification/i],
      action: () => {
        const v = this._onReaderScaleStatus ? this._onReaderScaleStatus() : null;
        this.speak(v
          ? `記事の文字サイズは${v}倍です`
          : '文字サイズを確認できません');
        return { action: 'reader-scale-status', value: v };
      },
      description: 'Announce the reader text scale'
    });

    // Online status — the connectivity atom (navigator.onLine; offline pages
    // still answer honestly).
    // device-settings — toggles a web page cannot reach (radios,
    // passthrough, guardian, camera, power modes). Registered BEFORE
    // online-status so 'Wi-Fiを切って' is not mistaken for a status query.
    this.registerCommand('device-settings', {
      patterns: ['Wi-Fiを切って', 'Wi-Fiをつけて', 'Wi-Fiをオン', 'Wi-Fiをオフ',
        'WiFiを切って', 'WiFiをつけて', 'ワイファイを切って', 'ワイファイをつけて',
        'Bluetoothをつけて', 'Bluetoothを切って', 'Bluetooth',
        '機内モード', '機内モードにして', 'モバイルデータ', 'テザリング',
        'go offline', /go (offline|online)/i,
        'パススルー', 'パススルーにして', '周りが見えるようにして',
        'ガーディアン', 'ガーディアンを設定', '境界を設定', 'プレイエリア',
        'カメラを起動', 'カメラを使って', 'カメラ',
        'バッテリーを節約', '節電', '節電モード',
        'ヘッドセットを再起動', 'システムを再起動',
        /turn (on|off) (the )?(wi-?fi|bluetooth)/i, /airplane mode/i,
        /passthrough/i, /set up (the )?guardian/i,
        /restart (the )?(app|browser|headset|system)/i, /reboot/i],
      action: () => {
        this.speak('本体の設定はブラウザから変更できません。ヘッドセットの設定で操作してください');
        return { action: 'device-settings' };
      },
      description: 'Explain device-level settings live in the headset OS'
    });

    this.registerCommand('online-status', {
      patterns: ['オンラインか', 'オフラインか', 'ネットに繋がっている',
        'Wi-Fiは', '接続状態', 'ネットワーク状態',
        'つながらない', '繋がらない', 'ネットが切れた', '圏外',
        'ネットにつながらない', 'つながってる', '繋がってる',
        /are we online/i, /are we offline/i, /am i online/i, /am i offline/i,
        /are we connected/i, /is the internet working/i, /online status/i, /internet status/i,
        /wi-?fi/i],
      action: () => {
        const on = navigator?.onLine !== false; // undefined → assume online
        this.speak(on ? 'オンラインです' : 'オフラインです');
        return { action: 'online-status', online: on };
      },
      description: 'Announce the connectivity state'
    });

    // Firefox's about:storage as a spoken atom — the async estimate follows
    // the paste-go pattern.
    this.registerCommand('storage-status', {
      patterns: ['ストレージ', '容量は', '空き容量', 'ストレージはいくつ',
        /storage/i, /how much storage/i],
      action: () => {
        const est = typeof navigator !== 'undefined' && navigator.storage?.estimate?.bind(navigator.storage);
        if (!est) {
          this.speak('ストレージ情報を取得できません');
          return { action: 'storage-status', available: false };
        }
        est().then(({ usage, quota }) => {
          const mb = (b) => Math.round((b || 0) / 1048576);
          this.speak(`ストレージは約${mb(usage)}MB使用中です（上限${mb(quota)}MB）`);
        }).catch(() => this.speak('ストレージ情報を取得できません'));
        return { action: 'storage-status', available: true };
      },
      description: 'Announce storage usage and quota'
    });

    // Stop listening
    this.registerCommand('stop', {
      patterns: ['停止', 'ストップ', 'やめて', '聞くな',
        'マイクをミュート', 'マイクオフ', 'マイクを止めて',
        'マイクを切って', 'マイクをオフにして', 'マイク停止', '聞き取りをやめて',
        '聞き取り停止', '聞くのをやめて', '音声認識を止めて', '音声認識を終了',
        '聞かないで', '聞かない', '聞くなよ',
        /\bmute (the )?mic(rophone)?/i, /mic off/i, /stop listening/i,
        /turn (off )?(the )?mic(rophone)?( off)?/i],
      action: () => {
        this.stop();
        return { action: 'stop' };
      },
      confirmationText: '音声認識を停止します',
      description: 'Stop listening (mic off)'
    });

    // mic-on — stop's counterpart. 'unmute mic' previously hit stop's loose
    // /mute mic/ (the 'mute' inside 'unmute') and switched the mic OFF.
    this.registerCommand('mic-on', {
      patterns: ['マイクをオン', 'マイクをつけて', 'マイクをオンにして',
        'マイクを付けて', '聞き取りを再開', '音声認識を再開', '音声認識を始めて',
        '音声認識を再開して', 'マイクを始めて', 'マイクオン',
        /(?<!the )mic(rophone)? on/i, /unmute (the )?mic/i, /start listening/i,
        /turn on (the )?mic/i, /unmute mic/i],
      action: () => {
        this.start();
        this.speak('音声認識を再開します');
        return { action: 'mic-on' };
      },
      description: 'Resume listening (mic on)'
    });

    // Trouble report — a voice-only user whose panels vanished can't see the
    // reset affordance; answer with the two spoken escape hatches.
    this.registerCommand('trouble', {
      patterns: ['反応しない', '反応がない', '応答しない', '真っ暗', '画面が見えない',
        'なにも表示されない', '動かない', '動作が遅い', 'ページが重い', '重い', '遅い',
        '遅すぎる', '動作が重い', '遅すぎ', '重すぎる',
        '見えない', '見えません', '動いてない', '使えない',
        'なんにも見えない', '画面が出ない',
        'カクカクする', 'フリーズした', '固まった', '画面が固まった',
        '真っ暗だ', '真っ黒', '画面が真っ暗', '真っ暗です',
        '反応が遅い', '重たい', 'もたつく', '反応が悪い', '動作がもたつく',
        'kinda slow', 'kinda laggy', 'a bit slow', 'little slow', 'bit laggy',
        'really slow', 'super slow', 'pretty slow', 'very slow', 'way slow',
        'boring', 'ugh', 'argh',
        '開けん', '開かん', '開けへん', 'あかん',
        'cant reach it', 'cant reach that', 'cant reach the panel',
        'おかしい', 'なんか変', 'へんだ', 'おかしくない', '変じゃない', 'おかしいな',
        'エラーが出た', 'エラーが出る', 'エラーが起きた', '止まった', 'とまった',
        '勝手に閉じた', '勝手に動いた', '開けない', 'タブが開けない',
        "i'm stuck", 'im stuck', 'i am stuck', 'something is wrong', 'it froze', 'it crashed',
        /did it fail/i, /did it (crash|freeze)/i,
        '何も見えない', '真っ白', '画面が白い', '映らない', '固まる', '落ちた',
        'クラッシュした', 'クラッシュ', '画面が落ちた', 'アプリが落ちた',
        '耳が痛い', '酔った', '気分が悪い', '目が疲れた', '滑らかじゃない',
        '眠い', '頭痛い', '頭が痛い', 'めまい', 'めまいがする', 'ふらつく', '目が疲れる',
        'ヘッドセットが暑い', 'ネットが遅い', '見えにくい', '見にくい', '画面が見にくい',
        '目が痛い', '頭が痛い', '疲れた', '休みたい', '吐き気がする', '乗り物酔い',
        '休憩したい', '一休みしたい', '気持ち悪い', 'クラクラする',
        '頭がクラクラする', 'めまいがする', '目眩がする', '気分が悪くなった',
        '詰まった', 'バグった', 'バグってる', 'こりゃだめ', 'ダメだ',
        'お手上げ', 'おてあげ', '参った', 'まいった', 'くそ', '最悪', 'あーもう',
        '落ちがち', '固まりがち', 'フリーズしがち', 'クラッシュしがち',
        '目を休めたい', '目を休める', '少し休みたい', '疲れてきた',
        '押せない', '押せません', '選べない', '選べません', '触れない',
        'クリックできない', 'タップできない', '押しても反応しない', '動きません',
        '動かなくなった', 'なんで動かない', 'なぜ動かない',
        'コントローラーが効かない', 'コントローラーが反応しない',
        'コントローラーが動かない', 'ボタンが効かない', 'ボタンが反応しない',
        '操作が効かない', 'コントローラーがきかない',
        '暗い', '画面が暗い', '見えない', '画面が暗くて見えない',
        '画面がちらつく', 'ちらつく', '点滅してる', '画面が揺れる',
        '画面が乱れる', '文字化け', '文字化けしてる', 'フォントがおかしい',
        '表示がおかしい', '崩れてる', '酔いそう',
        /not responding/i, /screen is (dark|black|blank)/i,
        /^nothing (happens|works)/i, /i can'?t see/i,
        /it'?s not working/i, /doesn'?t work/i, /can'?t see/i,
        /cant see/i, /nothing (is )?working/i, /frozen/i],
      action: () => {
        this.speak('音声は動作中です。「リセンター」で正面に戻せます。「ヘルプ」でコマンド一覧を聞けます');
        return { action: 'trouble' };
      },
      description: 'Spoken recovery guidance when the user reports trouble'
    });

    // audio-trouble — the hearing side of 'trouble': voice-only users who
    // cannot hear output get spoken pointers to the audio commands instead
    // of the visual recenter hint.
    this.registerCommand('audio-trouble', {
      patterns: ['聞こえない', '聞こえません', 'よく聞こえない', '音が出ない',
        '音が小さい', '音が聞こえない', '声が聞こえない', '音量が小さい',
        '声が出ない', '音がしない', '無音になった', '何も聞こえない',
        '聞こえにくい', '聞きにくい',
        /can'?t hear/i, /^no sound/i, /cant hear/i],
      action: () => {
        this.speak('「音量」で今の音量を確認できます。「音量を上げて」「ミュートを解除」「もう一回聞いて」を試してください');
        return { action: 'audio-trouble' };
      },
      description: 'Spoken recovery guidance when the user cannot hear audio'
    });

    // Honest-absence cluster II: surfaces a web-layer browser cannot reach.
    // A spoken refusal (with a pointer at what IS possible) beats NO-MATCH,
    // where 'command not recognised' is indistinguishable from a bad phrase.
    // `links` registers before go-to so 'リンクに移動' cannot literal-navigate.
    this.registerCommand('links', {
      patterns: ['リンクを開いて', 'リンクを開く', 'リンクに移動', 'リンク一覧',
        'リンクの一覧', '最初のリンク', '最後のリンク', '次のリンク',
        'リンクを選んで', 'リンクを教えて', 'どんなリンクがある',
        'ボタン一覧', 'ボタンを押して', 'リンクをクリック', 'ボタンをクリック',
        'リンクが開けない', 'リンクを開けない',
        '前のリンク', 'リンクに進んで', 'リンクに戻って', 'リンクを読んで',
        /list (the )?links/i, /open (the |a )?link/i, /click (the |a )?(link|button)/i,
        /^(next|previous|prev) link$/i, /links? list/i, /next (link|button)/i,
        /previous (link|button)/i],
      action: () => {
        this.speak('リンクやボタンの直接選択はまだできません。「読み上げ」で内容を聞けます');
        return { action: 'links' };
      },
      description: 'Explain link/button selection is unavailable'
    });
    this.registerCommand('input-methods', {
      patterns: ['音声入力', '音声で入力', '手で操作', 'ジェスチャーで操作',
        'ジェスチャー', 'ハンドトラッキング', '視線で選択', '目で選ぶ',
        '目で操作して', 'コントローラーで操作', 'ポインターはどこ',
        'マウスカーソル', 'カーソルはどこ', 'カーソル',
        '入力して', '文字を入力', 'テキストを入力', '書き込んで',
        '入力欄', 'フォーカスして', 'カーソルを置いて', 'カーソルを当てて',
        'クリックして', '押して', 'タップして', '選択して',
        /^click( here| it)?$/i, /^tap( it)?$/i,
        '次の入力欄', '前の入力欄', 'フォーム', 'テキストボックス',
        'フォームに入力', '入力フォーム', 'フォームを入力',
        /^controllers?$/i, /use (the )?controller/i, /hand tracking/i,
        /^(next|previous|prev) field$/i, /form (controls|fields)/i,
        /edit box/i, /fill (out )?(the )?form/i, /text box/i,
        /press (enter|ok|return)/i, /hit enter/i, /return key/i,
        /press (the )?escape/i, /hit (the )?escape/i, /^esc(ape)? key$/i, /press esc/i,
        /press (the )?space ?bar/i, /hit (the )?space ?bar/i, /^space ?bar$/i,
        /press (the )?tab key/i, /^tab key$/i, /hit (the )?enter key/i,
        /press (the )?enter key/i,
        'エスケープキー', 'スペースキー', 'タブキー',
        'エンターを押して', 'エンターキー', '決定キー', 'エンターを押す'],
      action: () => {
        this.speak('視線と音声、コントローラーで操作できます。見つめて選ぶこともできます');
        return { action: 'input-methods' };
      },
      description: 'Explain the available input methods'
    });
    this.registerCommand('text-style', {
      patterns: ['フォントを変えて', '文字を変えて', 'フォントを変更', '書体を変更', '書体を変えて', '明朝体にして',
        '明朝体', 'ゴシック体にして', '行間を広げて', '行間を狭めて', '行間',
        '余白を広げて', '余白を増やして', '字間を広げて',
        '大文字にして', '小文字にして', '太字にして', '斜体にして', '下線を引いて',
        /change (the )?font/i, /different font/i,
        /all caps/i, /upper ?case/i, /lower ?case/i, /capitali[sz]e/i,
        /^(bold|italic|italics)$/i],
      action: () => {
        this.speak('フォントや行間の変更はまだできません。「文字を大きく」でサイズは変えられます');
        return { action: 'text-style' };
      },
      description: 'Explain font/leading changes are unavailable'
    });
    this.registerCommand('heading-level', {
      patterns: [/^h[1-6]$/i, /^h[1-6]を?探して/, /レベル\s*[一二三四五六\d]+\s*の?見出し/,
        '見出しレベル', 'レベルの見出し',
        /level (\d+|one|two|three|four|five|six) heading/i,
        /heading level (\d+|one|two|three|four|five|six)/i],
      action: () => {
        this.speak('見出しレベルでのジャンプはまだできません。「2番目の見出し」で順番に選べます');
        return { action: 'heading-level' };
      },
      description: 'Honest no-op: heading-level jumps not supported'
    });

    this.registerCommand('landmarks', {
      patterns: ['ランドマーク', 'ランドマーク一覧', 'メインに飛んで',
        'メインコンテンツ', 'ナビゲーションに飛んで', 'ページの領域',
        /landmarks?/i, /next landmark/i, /main region/i,
        /(go to|jump to) (the )?main( content)?\b/i,
        /(go to|jump to) (the )?(content|navigation|nav)\b/i],
      action: () => {
        this.speak('ページの領域ジャンプはまだできません。「目次」で見出しを確認できます');
        return { action: 'landmarks' };
      },
      description: 'Explain landmark navigation is unavailable'
    });
    this.registerCommand('redo', {
      patterns: ['やり直して', 'やり直し', /^redo$/i, /redo (it|that|the last)/i,
        /ctrl\s*y/i],
      action: () => {
        this.speak('やり直しはまだできません。「元に戻して」で閉じたタブを開き直せます');
        return { action: 'redo' };
      },
      description: 'Explain redo is unavailable'
    });
    this.registerCommand('settings-reset', {
      patterns: ['設定をリセット', '設定を初期化', '設定を元に戻して',
        '初期設定に戻して', '設定を全部元に戻して', '工場出荷', '音量を元に戻して',
        /reset (the |all |my )?settings/i, /factory reset/i,
        'reset it all', 'fresh start', 'clean slate', 'wipe it clean', 'start fresh'],
      action: () => {
        this.speak('設定の一括リセットはまだできません。各項目は設定パネルで変更できます');
        return { action: 'settings-reset' };
      },
      description: 'Explain settings cannot be reset in bulk'
    });
    this.registerCommand('privacy-clean', {
      patterns: ['キャッシュを消して', 'キャッシュをクリア', 'キャッシュを削除',
        'キャッシュクリア', 'キャッシュ', 'Cookieを消して', 'Cookieを削除',
        'Cookieをクリア', 'クッキーを消して', 'クッキーを削除',
        'クッキー削除', 'キャッシュ削除', 'データを消して', 'ブラウザデータを消して',
        'フォームデータを消して', 'パスワードを消して', 'パスワードを削除して',
        '自動入力を消して', 'オートフィルを消して', 'ダウンロードを消して',
        'サイトデータを消して', '保存データを消して',
        /clear (the )?cache/i, /(clear|delete) (the )?cookies?/i,
        /clear (browser|browsing) data/i],
      action: () => {
        this.speak('キャッシュとCookieの削除はまだできません。「履歴を消して」で履歴は消せます');
        return { action: 'privacy-clean' };
      },
      description: 'Explain cache/cookie clearing is unavailable, point at history'
    });
    this.registerCommand('download', {
      patterns: ['ダウンロードして', 'ダウンロードしたい', 'ダウンロードはどこ',
        'ダウンロード', 'アップロードして', 'アップロード',
        'ファイルをダウンロード', 'ファイルを保存',
        'ダウンロード履歴', 'ダウンロードしたファイル', 'ダウンロード一覧',
        /^downloads?$/i, /download (this|it|the file)/i, /^upload/i],
      action: () => {
        this.speak('ダウンロードはまだできません。「ページを保存」でブックマークはできます');
        return { action: 'download' };
      },
      description: 'Explain downloading is unavailable'
    });
    // other-history — playback/purchase histories belong to other apps; say
    // so and point at the only history this shell keeps.
    this.registerCommand('other-history', {
      patterns: ['再生履歴', '視聴履歴', '購入履歴',
        '再生履歴を見せて', '視聴履歴を見せて', '購入履歴を見せて',
        /(watch|purchase|play) history/i],
      action: () => {
        this.speak('その履歴はこのブラウザにありません。「履歴を読んで」で閲覧履歴を聞けます');
        return { action: 'other-history' };
      },
      description: 'Explain playback/purchase histories are unavailable'
    });
    // account — login/profile/password management belongs to the site or
    // the headset account, not this shell. Registered in
    // registerDefaultCommands so it wins over web-search's 'Xを教えて'.
    this.registerCommand('account', {
      patterns: ['ログインして', 'ログアウトして', 'サインイン', 'サインアウト',
        'ログイン', 'ログアウト', 'アカウント', 'アカウント設定',
        'プロフィール', 'プロフィールを開いて', 'プロフィールを見せて',
        'パスワード', 'パスワードを教えて', 'パスワードを変えて',
        'パスワードを変更', 'パスワード管理', 'ユーザー名', 'ユーザ名',
        /log ?in/i, /sign ?in/i, /log ?out/i, /sign ?out/i,
        /my (account|profile|password)/i],
      action: () => {
        this.speak('アカウントやログインの管理はこのブラウザにありません。サイト内で操作してください');
        return { action: 'account' };
      },
      description: 'Explain account features are unavailable'
    });
    // orientation / split-view — panel layout is fixed; desktop-style
    // rotate/split has no surface. Honest pointer beats a silent noop.
    this.registerCommand('orientation', {
      patterns: ['縦にして', '横にして', '横向きにして', '縦向きにして',
        '回転して', '画面を回転', '画面を横向き', '画面を縦向き',
        '向きを変えて', '画面の向き',
        /rotate (the )?screen/i, /landscape mode/i, /portrait mode/i],
      action: () => {
        this.speak('パネルの回転や向きの変更はありません');
        return { action: 'orientation' };
      },
      description: 'Explain panels cannot be rotated'
    });
    this.registerCommand('split-view', {
      patterns: ['ウィンドウを2つ', '分割して', '2画面にして', '画面を分割',
        '画面を2つに', '2つに分けて', 'マルチウィンドウ', '分割表示',
        '画面を二つに', '二画面にして',
        /split (the )?screen/i, /two windows/i, /split view/i],
      action: () => {
        this.speak('パネルの分割表示はありません。「新しいタブ」で別のパネルを開けます');
        return { action: 'split-view' };
      },
      description: 'Explain split view is unavailable'
    });
    this.registerCommand('clear-bookmarks', {
      patterns: ['お気に入りを全部消して', 'ブックマークを全部削除',
        'ブックマークを全部消して', 'お気に入りを全部削除',
        'お気に入りをすべて消して', 'ブックマークをすべて削除',
        /delete all (bookmarks|favo?rites)/i, /clear (all )?(bookmarks|favo?rites)/i],
      action: () => {
        this.speak('ブックマークの一括削除はできません。「ブックマークを外して」で個別に外せます');
        return { action: 'clear-bookmarks' };
      },
      description: 'Explain bulk bookmark deletion is unavailable'
    });
    this.registerCommand('sleep-mode', {
      patterns: ['スリープして', 'スリープモード', '省電力モード', '省エネモード',
        '電源を切って', '電源を落として', '本体を休ませて',
        'おやすみ', 'おやすみなさい', '寝る', '寝かせて', '寝ます',
        'スタンバイ', 'スリープ', '起きて', '起きてよ', 'ウェイクアップ',
        'sleep', 'wake', 'wake up', 'lock', 'standby', 'put it to sleep',
        'good night', 'go to sleep', 'wake me up',
        /sleep mode/i, /power (saving|saver|off)/i],
      action: () => {
        this.speak('スリープや電源はヘッドセット本体のボタンで操作してください');
        return { action: 'sleep-mode' };
      },
      description: 'Explain sleep/power lives on the headset'
    });

    // scroll-horizontal — panels scroll vertically only; say so instead of
    // silently scrolling down or falling to 認識できませんでした.
    this.registerCommand('scroll-horizontal', {
      patterns: ['左にスクロール', '右にスクロール', '左へスクロール', '右へスクロール',
        '横にスクロール', '横スクロール',
        /scroll (left|right)/i, /scroll horizontally/i],
      action: () => {
        this.speak('左右のスクロールはできません。「上」「下」または「3行下」で縦に動けます');
        return { action: 'scroll-horizontal' };
      },
      description: 'Explain panels scroll vertically only'
    });

    // panel-move — lateral/vertical panel repositioning has no voice surface
    // (panels are dragged by gaze); say what IS possible instead of
    // navigating or pretending.
    this.registerCommand('panel-move', {
      patterns: ['パネルを動かして', 'パネルを移動', 'パネルの場所',
        '右に寄せて', '左に寄せて', '上に上げて', '下に下げて',
        '少し上げて', '少し下げて', '目の高さ', '高さを合わせて',
        'パネルを右に', 'パネルを左に', 'パネルを上げて', 'パネルを下げて',
        'パネルを横に', 'パネルの位置を変えて', '位置を変えて',
        /move (the )?(panel|window)/i],
      action: () => {
        this.speak('パネルは視線でつかんで動かせます。「パネルを近づけて」で距離を変えられます');
        return { action: 'panel-move' };
      },
      description: 'Explain panels move by gaze-drag'
    });

    // caret-edge — jumping to a line/sentence/word/char boundary inside the
    // reader has no surface (only stepping commands do). Say so honestly and
    // point at the steppers instead of letting '行頭に戻る' navigate back.
    this.registerCommand('caret-edge', {
      patterns: ['行頭', '行末', '行の先頭', '行の最後', '行頭に戻る',
        '行の頭から', '行の途中', '行の始まり', '行の終わり',
        '文の先頭', '文の末尾', '文頭', '文末', '文の頭', '文の終わり',
        '段落の先頭', '段落の最後', '段落の頭', '段落の終わり',
        '単語の先頭', '単語の最後', '語頭', '語尾',
        '最初の文字', '最後の文字', '最初の単語', '最後の単語',
        '文字の前', '一文字ずつ',
        /beginning of (the )?line/i, /end of (the )?line/i,
        /word by word/i, /character by character/i, /caret to start/i],
      action: () => {
        this.speak('行や文の端へのジャンプはありません。「一文字戻る」「次の単語」で細かく動けます');
        return { action: 'caret-edge' };
      },
      description: 'Explain caret-edge jumps are unavailable, point at steppers'
    });

    // window-state — desktop minimize/maximize has no panel equivalent; the
    // panel-size twin is the distance commands.
    this.registerCommand('window-state', {
      patterns: ['最小化', '最大化', 'ウィンドウを最小化', 'ウィンドウを最大化',
        'パネルを最小化', 'パネルを最大化', '元のサイズに戻して',
        '最大化して', '最小化して', '画面を最大化', '画面を最小化',
        'minimize', 'maximize', 'minimize the window', 'maximize the window',
        'guest window', 'a guest window', 'open a guest window',
        'open a window', 'a new window please',
        /restore (the )?window/i],
      action: () => {
        this.speak('パネルの最小化や最大化はありません。「パネルを大きく」「パネルを小さく」で距離を変えられます');
        return { action: 'window-state' };
      },
      description: 'Explain panels have no minimize/maximize state'
    });

    // device-apps / media-search: phones and TVs have these apps — a web
    // browser shell does not. Answer honestly and point at go-to/search.
    // Registered before go-to so 'メモを開いて' cannot literal-navigate.
    this.registerCommand('device-apps', {
      patterns: ['メモして', 'メモを取って', 'メモを開いて', 'メモを見せて',
        'メモをして', 'メモする', 'タイマー', 'タイマーをセット', 'タイマーをかけて',
        /\d+分タイマー/, 'アラーム', 'アラームをかけて', '目覚まし', '目覚ましをかけて',
        'アラームをセット', 'ストップウォッチ', 'カレンダー',
        'カレンダーを開いて', '予定を教えて', 'リマインダー', '電話',
        '電話をかけて', '電話して', '連絡先', 'メール', 'メールを開いて',
        'メールをチェック', 'メールを見て', '受信トレイ', '計算機', '電卓',
        '音楽を再生', '音楽を聴きたい', '音楽をかけて', 'ラジオ',
        'テレビを見て', 'ラジオをつけて',
        /^(set|start) (a )?timer/i, /^(open|check) (my )?(email|mail|calendar)(?!.*\btab\b)/i,
        /call (?!it\b)\w+/i],
      action: () => {
        this.speak('そのアプリはこのブラウザにはありません。サイトを開くか検索はできます');
        return { action: 'device-apps' };
      },
      description: 'Explain phone-style apps are unavailable'
    });
    // calc — unlike the apps above, simple arithmetic IS answerable by voice
    // ('1足す2は' → '3です'); '計算して' alone prompts for the expression.
    this.registerCommand('calc', {
      patterns: [/(\d+(?:\.\d+)?)\s*(足す|たす|プラス|\+)\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*(引く|ひく|マイナス|-)\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*(掛ける|かける|×|\*)\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*(割る|わる|÷|\/)\s*(\d+(?:\.\d+)?)/,
        /(\d+(?:\.\d+)?)\s*(plus|minus|times|divided by)\s*(\d+(?:\.\d+)?)/i,
        '計算して', '計算', '足し算', '引き算', '掛け算', '割り算'],
      action: (transcript) => {
        const m = transcript.match(
          /(\d+(?:\.\d+)?)\s*(足す|たす|プラス|引く|ひく|マイナス|掛ける|かける|割る|わる)\s*(\d+(?:\.\d+)?)/i)
          || transcript.match(
            /(\d+(?:\.\d+)?)\s*(plus|minus|times|divided by|\+|-|×|\*|÷|\/)\s*(\d+(?:\.\d+)?)/i);
        if (!m) {
          this.speak('「3足す2は」のように式を言ってください');
          return { action: 'calc', result: null };
        }
        const a = Number(m[1]);
        const b = Number(m[3]);
        let r;
        if (/足す|たす|プラス|plus|\+/i.test(m[2])) {
          r = a + b;
        } else if (/引く|ひく|マイナス|minus|-/i.test(m[2])) {
          r = a - b;
        } else if (/掛ける|かける|×|times|\*/i.test(m[2])) {
          r = a * b;
        } else {
          r = b === 0 ? null : a / b;
        }
        if (r === null || !Number.isFinite(r)) {
          this.speak('ゼロでは割れません');
          return { action: 'calc', result: null };
        }
        const out = Math.round(r * 1e6) / 1e6;
        this.speak(`${out}です`);
        return { action: 'calc', result: out };
      },
      description: 'Calculate simple spoken arithmetic'
    });
    this.registerCommand('media-search', {
      patterns: ['画像検索', '動画検索', '画像を検索', '動画を検索',
        '画像検索して', '動画検索して', '地図を検索', '画像を探して',
        '動画を探して',
        /image search/i, /video search/i, /search (for )?(images|videos)/i],
      action: () => {
        this.speak('画像検索や動画検索の専用モードはまだできません。通常の検索はできます');
        return { action: 'media-search' };
      },
      description: 'Explain there is no image/video search mode'
    });

    // ack — 'ありがとう'/'わかった'/'got it' are social acknowledgements, not
    // commands: answer politely instead of the 認識できませんでした error.
    // Thanks get どういたしまして; plain confirmations get 承知しました.
    this.registerCommand('working-status', {
      patterns: ['動いてる', '動いてますか', '動作してる', 'ちゃんと動いてる',
        '止まってる', '止まってますか', '今止まってる', '固まってる',
        'is it working', 'is it on', 'is it done', 'did it work',
        'did it stop', 'is it frozen', 'is it stuck',
        'whatcha doing', 'whatcha up to', 'what are you doing', 'whats happening',
        'whatcha reading', '使ってる', '使っている', 'is it ready', 'is it paused',
        'are you there', 'you there', 'are you on',
        'still there', 'are you still there', 'still listening', 'you still here',
        'still with me', 'still awake', '動きっぱなし', '動き続けてる',
        'working', 'still working', 'still working on it', 'still at it',
        '生きてる', 'いきてる', '動作してます', '動いてます', '働いてる',
        'whats going on', 'whats the status', 'whats the state',
        'hows it looking', 'how are things',
        '何してる', '何やってる', '何してるの', '何をしてる'],
      action: () => {
        this.speak('音声認識は動作中です。「ヘルプ」でコマンド一覧を聞けます');
        return { action: 'working-status' };
      },
      description: 'Reassure the voice system is running'
    });

    this.registerCommand('ack', {
      patterns: ['ありがとう', 'ありがとうございます', 'ありがと', 'さんきゅー', 'サンキュー',
        'わかった', 'わかりました', '了解', 'りょうかい', 'OK', 'オーケー', 'おけ',
        'thank you', 'thanks', 'thank you very much', 'got it', 'understood', 'roger',
        'thank you so much', 'thanks a lot', 'thx', 'ty',
        '助かった', 'たすかった', '助かる', 'かっこいい', 'すごい', 'いいね',
        '素晴らしい', '最高', 'すばらしい', 'awesome', 'great', 'perfect', 'nice',
        'なるほど', 'へー', 'ほんと', '本当ですか', 'まじか', 'うそ', 'そうなんだ', '確かに',
        'cheers', 'appreciate it', 'nice one', 'good job',
        'well done', 'excellent', 'love it', 'sup', 'yo', 'hey you',
        'wow', 'amazing', 'incredible', 'unbelievable',
        'yeah', 'yep', 'yup', 'yes', 'uh huh', 'mm hmm', 'hmm', 'alright', 'aight',
        'okay then', 'sure thing', 'you got it', 'no problem', 'welcome', 'cool',
        'sweet', 'neat', 'interesting', 'fine by me', 'correct', 'exactly', 'thats right',
        'who cares', 'come on', 'cmon', 'lets go', 'leggo', 'lets do this', 'go ahead',
        'go right ahead', 'go for it', 'no rush', 'take your time', 'whenever you are ready',
        'when you get a chance', 'much appreciated', 'thanks a bunch', 'bless you',
        'and then', 'well then', 'どうも', 'すみません', 'すいません', 'すまん', 'ごめん',
        'ごめんね', 'お疲れ', 'おつかれ', 'ご苦労さま', 'はい', 'うん', 'ええ', 'そう',
        'そうだね', 'そうですね', 'そっか', 'そうか', 'ふーん', 'うーん', 'えーと', 'あのー',
        'hows it going', 'how are ya', 'whats up', 'wassup', 'wazzup',
        'roger that', 'copy that', 'aye aye', 'ten four', 'wilco', 'aye', 'yessir',
        'yessiree', 'okie', 'okie dokie', 'okie doke', 'rightio', 'right then',
        'roger dodger', 'i appreciate it', 'on it', 'gotcha', 'noted', 'sounds good',
        'fair enough', 'cool cool',
        'not sure', 'kinda not', 'dunno', 'beats me', 'who knows', 'hard to say',
        'cant tell', 'cant say', 'no idea', 'not a clue', 'search me',
        'かも', 'かもね', 'かなあ', 'かな', 'だっけ', 'だっけな', 'だったかな',
        'どうだっけ', '何だったっけ', 'どうだったかな', '何だったかな',
        '承知', '承知しました', 'かしこまり', '畏まりました', '合点', '合点承知',
        '御意', 'よろしい', 'そうだ', 'そうだよ', 'そうなの', 'そうなんですね',
        'そのとおり', 'その通り', 'ほんそれ', 'ほんまそれ', 'まさに', '正に',
        'そうそう', 'うんうん', 'へえ', 'ほう', 'さすが', 'やった', 'いい感じ',
        'いいじゃん', 'あざます', 'あざっす', 'どうもありがとう', 'めっちゃありがとう',
        '感謝', '感謝します',
        'ふぅ', 'ほっ', 'ぴったり', '完璧', '楽しい', '面白い', 'おもしろい',
        'すてき', '素敵', 'かわいい', 'きれい', '暇だ', '暇', '退屈', 'つまらない',
        'easy does it', 'slow and steady', 'hurry up', 'chop chop', 'snap to it',
        'lovely', 'impressive', 'yikes', 'oof', 'dang', 'darn', 'shoot', 'gah',
        'whatever you say', 'if you say so', 'just saying', 'just sayin', 'fyi',
        'ya got it', 'yer good', 'gotcha covered', 'right on', 'rock on',
        'way to go', 'attaboy', 'bravo', 'umm', 'um', 'err', 'uhh', 'uh',
        'ah', 'oh', 'ahh',
        'そのついでに', 'そのついで', 'while you are at it', 'while youre at it',
        'since youre here', 'okey dokey', 'okee doke', 'okee dokie', 'alrighty', 'alrighty then',
        'sure sure', 'yep yep', 'mmkay', 'mkay', 'meh', 'phew', 'whew',
        'already closed it', 'already did it', 'already done', 'already did',
        'i did it already', 'its done already', 'been there', 'did that already',
        /るわけ$/, /わけだ$/],
      action: (t) => {
        const thanks = /ありがと|さんきゅ|サンキュ|thank/i.test(t);
        const praise = /助か|かっこ|すご|いいね|素晴ら|最高|すばら|awesome|great|perfect|nice/i.test(t);
        this.speak(thanks ? 'どういたしまして' : praise ? 'ありがとうございます' : '承知しました');
        return { action: 'ack' };
      },
      description: 'Acknowledge thanks/confirmation'
    });

  }

  /**
   * Register custom command
   */
  registerCommand(name, config) {
    this.commands.set(name, {
      patterns: config.patterns || [],
      action: config.action,
      confirmationText: config.confirmationText || null,
      description: config.description || '',
      // Spoken example for the 'help' command, used only when every pattern
      // is a RegExp (no literal phrase to read aloud) — e.g. 'search'/'go-to'
      // accept a free-form spoken argument, so there's no single fixed string.
      example: config.example || null,
      metadata: config.metadata || {}
    });

    // Register aliases if provided
    if (config.aliases) {
      config.aliases.forEach(alias => {
        this.aliases.set(alias, name);
      });
    }

    console.debug(`VoiceCommands: Registered command "${name}"`);
  }

  /**
   * The literal phrase to read aloud for a command in the 'help' listing:
   * the first plain-string pattern (what a user can say verbatim), or the
   * registered example when every pattern is a RegExp (free-form arguments
   * like search/go-to have no single fixed phrase to quote).
   */
  _spokenExample(cmd) {
    return cmd.patterns.find((p) => typeof p === 'string') || cmd.example || null;
  }

  /**
   * Unregister command
   */
  unregisterCommand(name) {
    this.commands.delete(name);

    // Remove aliases
    for (const [alias, commandName] of this.aliases) {
      if (commandName === name) {
        this.aliases.delete(alias);
      }
    }
  }

  /**
   * Replace the default window.* navigation commands with VR-aware versions
   * that use the live TabManager / BookmarkPanel / keyboard references.
   *
   * Call this after initialize() and after the VR scene is built.
   *
   * @param {object} opts
   * @param {object}   [opts.tabManager]    TabManager instance
   * @param {object}   [opts.bookmarkPanel] BookmarkPanel instance
   * @param {object}   [opts.vrKeyboard]    VRJapaneseKeyboard instance
   * @param {Function} [opts.onSearch]      (query: string) => void — called for web search
   * @param {Function} [opts.onGoTo]        (query: string) => void — called with the
   *                                         extracted site name; host looks it up in
   *                                         history/bookmarks and navigates or falls back
   *                                         to search (decoupled like onTopSites/onSearch)
   * @param {Function} [opts.onClearHistory] () => void — called to clear browsing
   *                                         history (privacy); host runs the clear +
   *                                         cross-modal confirmation (decoupled like onGoTo)
   * @param {Function} [opts.onScrollContent] (deltaLines: number) => void — scroll
   *                                         the active panel's reader viewport
   * @param {Function} [opts.onTogglePrivateMode] () => void — toggle private mode;
   *                                         host flips the persisted setting and
   *                                         applies it to TabManager (decoupled like onGoTo)
   * @param {Function} [opts.onVolume]     (delta: number) => void — ±0.1 master-volume
   *                                         change for the volume-up/down commands
   * @param {Function} [opts.onCaptionScale] (delta: number) => number|null — step the
   *                                         caption-size stepper (0.5–3.0x); null = at limit
   * @param {Function} [opts.onDwellTime]  (deltaMs: number) => number|null — step the
   *                                         gaze-dwell stepper (500–3000 ms); null = at limit
   * @param {Function} [opts.onVolumeStatus] () => number|null — current master volume %
   * @param {Function} [opts.onReaderScale] (delta: number) => number|null — step the
   *                                         reader-text-size stepper (0.5–2.0x);
   *                                         null = at limit
   * @param {Function} [opts.onHighContrast] (value?: boolean) => boolean — apply
   *                                         high-contrast (toggle when value omitted)
   * @param {Function} [opts.onSearchEngine] (name: string) => string|null — switch the
   *                                         search-engine cycle; null = unknown engine
   * @param {Function} [opts.onRestoreSession] () => number — restore the saved tab
   *                                         session; returns tabs restored
   * @param {Function} [opts.onSettingToggle] (key: string, value?) => —
   *                                         toggle a boolean setting key or set the
   *                                         comfort preset; null = unknown key/value
   * @param {Function} [opts.onPanelDistance] (delta: number) => number|null — step the
   *                                         window-distance stepper (0.6–6.0 m);
   *                                         null = at limit
   * @param {Function} [opts.onMute] (want?: boolean) => boolean|null — toggle or set
   *                                         the muted state; returns the muted state
   * @param {Function} [opts.onStepper] (key: string, delta: number) => number|null —
   *                                         step a numeric setting by `delta` of its
   *                                         own step size; null = unknown key/bounds
   * @param {Function} [opts.onVideoSeek] (deltaSeconds: number) => number|null —
   *                                         seek the immersive video; null = no video
   * @param {Function} [opts.onSettingsPanel] (want?: boolean) => boolean|null —
   *                                         open/close/toggle the settings panel;
   *                                         returns its visibility; null = no panel
   * @param {Function} [opts.onBookmarkOpen] (index: number) => string|null —
   *                                         open the Nth bookmark; null = out of
   *                                         range or no active tab
   * @param {Function} [opts.onBookmarkOpenNamed] (term) => string|null —
   *                                         open first bookmark matching term
   * @param {Function} [opts.onHistoryOpenNamed] (term) => string|null —
   *                                         open first history hit matching term
   * @param {Function} [opts.onHistoryOpen] (index: number) => string|null —
   *                                         open the Nth history entry; same
   * @param {Function} [opts.onReaderLine] (line: number) => number|'out'|null —
   *                                         jump the reader to line N; null =
   *                                         no reader open, 'out' = past the end
   * @param {Function} [opts.onBookmarkList] () => string[] — bookmark titles
   * @param {Function} [opts.onHistoryList] () => string[] — history titles
   * @param {Function} [opts.onCopyTitle] () => string|null — copy the page
   *                                         title; null = nothing to copy
   * @param {Function} [opts.onReadHere] () => string[]|null — narration
   *                                         chunks from the reader's scroll
   *                                         position (read-aloud's pair)
   * @param {Function} [opts.onTopSiteOpen] (n: number) => string|null — open
   *                                         the Nth top site; null = absent
   * @param {Function} [opts.onHistorySearch] (term: string) =>
   *                                         {count:number, title:string}|null —
   *                                         history hits; null = no match
   * @param {Function} [opts.onReaderScroll] (delta: number) => boolean —
   *                                         scroll the reader by N lines
   * @param {Function} [opts.onReaderProgress] () => number|null —
   *                                         percent of the article read
   * @param {Function} [opts.onBookmarkSearch] (term: string) =>
   *                                         {count:number, title:string}|null —
   *                                         bookmark hits; null = no match
   * @param {Function} [opts.onFindMatch] (n: number) =>
   *                                         {index:number,total:number}|'out'|null —
   *                                         jump to the Nth find hit
   * @param {Function} [opts.onRemainingTime] () => number|null —
   *                                         minutes left in the article
   * @param {Function} [opts.onHeadingSelect] (n: number) =>
   *                                         {index:number,total:number}|'out'|null —
   *                                         jump to the Nth heading
   * @param {Function} [opts.onFindStatus] () => {index:number,total:number}|null —
   *                                         current find position
   * @param {Function} [opts.onFindLast] () => {index:number,total:number}|null —
   *                                         jump to the last find hit
   * @param {Function} [opts.onReadLine] () => string|null —
   *                                         text of the line under the scroll
   * @param {Function} [opts.onParagraphStep] (dir: number) =>
   *                                         {index:number,total:number}|null —
   *                                         next/previous paragraph (wraps)
   * @param {Function} [opts.onParagraphSelect] (n: number) =>
   *                                         {index:number,total:number}|'out'|null
   * @param {Function} [opts.onParagraphStatus] () =>
   *                                         {index:number,total:number}|null
   * @param {Function} [opts.onCharCount] () => number|null —
   *                                         total article character count
   * @param {Function} [opts.onReadParagraph] () => string[] — narration chunks
   *                                         for the paragraph under the scroll
   * @param {Function} [opts.onLineStatus] () => {index:number,total:number}|null
   * @param {Function} [opts.onTabStatus] () => {index:number,total:number}|null —
   *                                         strip position
   * @param {Function} [opts.onPrivacyStatus] () => boolean|null —
   *                                         active tab private?
   * @param {Function} [opts.onPinStatus] () => boolean|null —
   *                                         active tab pinned?
   * @param {Function} [opts.onJumpBack] () => boolean — Vim `` mark toggle
   * @param {Function} [opts.onClearFind] () => boolean — dismiss find hits
   * @param {Function} [opts.onCopyLine] () => string|null — write the
   *                                         current reader line to the
   *                                         clipboard and return it
   * @param {Function} [opts.onCopyArticle] () => number|null — write the
   *                                         article text, return char count
   * @param {Function} [opts.onReaderPercent] (pct) => {percent}|null —
   *                                         jump the reader to pct %
   * @param {Function} [opts.onReaderScaleStatus] () => number — the current
   *                                         reader text-scale
   * @param {Function} [opts.onPasteGo] () => Promise<string> — clipboard
   *                                         URL → navigate; announce text
   * @param {Function} [opts.onReadClipboard] () => Promise<string> — clipboard
   *                                         text → announce (NVDA read-clipboard)
   * @param {Function} [opts.onRecenter] () => boolean — reset player to origin
   * @param {Function} [opts.onVideoStatus] () => {t,d}|null — video position
   * @param {Function} [opts.onMuteStatus] () => boolean|null — muted?
   * @param {Function} [opts.onFindQuery] () => string|null — active find query
   * @param {Function} [opts.onReadFromLine] (line)=>chunks[]|null|[] — narration
   * @param {Function} [opts.onHalfPage] (dir)=>bool — Vim Ctrl+D/U half-page
   * @param {Function} [opts.onSentenceStep] (dir)=>{sentence,line}|null —
   *                                         NVDA Alt+Down/Up sentence nav
   * @param {Function} [opts.onSentence] () => {sentence,index,total}|null —
   *                                         sentence under the scroll
   * @param {Function} [opts.onSentenceStatus] () => {index,total}|null —
   *                                         article-wide sentence position
   * @param {Function} [opts.onLastParagraph] () => {index,total}|null
   * @param {Function} [opts.onReadParagraphAt] (n)=>string[]|'out'|[] —
   *                                         narration chunks for paragraph N
   * @param {Function} [opts.onSearchEngineStatus] () => string|null —
   *                                         current search engine name
   * @param {Function} [opts.onCharStep] (dir)=>{char,line}|null —
   *                                         NVDA Left/Right char caret
   * @param {Function} [opts.onWord] () => {word,line}|null — word at caret
   * @param {Function} [opts.onSpellWord] () => {spelled,word}|null
   * @param {Function} [opts.onHeadingHere] () => {index,total,text}|null —
   *                                         heading covering the scroll
   * @param {Function} [opts.onArticleSummary] () =>
   *                                         {title,headings,paragraphs,chars}|null
   * @param {Function} [opts.onReadAloud] () => string[]|null — narration
   *   chunks for the active panel's reader content; null/empty = nothing to
   *   read (the command announces that itself).
   * @param {Function} [opts.onVideoToggle] () => 'playing'|'paused'|null —
   *   toggle immersive-video playback; null = no video is active.
   * @param {Function} [opts.onVideoStop] () => boolean — stop the immersive
   *   video; false = nothing was playing.
   * @param {Function} [opts.onCopyUrl] () => string|null — write the active
   *   tab's URL to the clipboard and return it; null = nothing to copy.
   * @param {Function} [opts.onBookmarkPage] () => void — bookmark/unbookmark the
   *                                         active page (Ctrl+D); host toggles the
   *                                         store + announces cross-modally
   */
  connectBrowser({ tabManager, bookmarkPanel, vrKeyboard, onSearch, onTopSites, onGoTo,
    onClearHistory, onScrollContent, onTogglePrivateMode, onVolume, onBookmarkPage, onReadAloud, onSettingStatus,
    onVideoToggle, onVideoStop, onCopyUrl, onCaptionScale, onDwellTime, onVolumeStatus, onReaderScale,
    onHighContrast, onSearchEngine, onRestoreSession, onSettingToggle, onPanelDistance, onMute, onStepper,
    onVideoSeek, onSettingsPanel, onBookmarkOpen, onHistoryOpen,
    onBookmarkOpenNamed, onHistoryOpenNamed, onReaderLine,
    onBookmarkList, onHistoryList, onCopyTitle,
    onReadHere, onTopSiteOpen, onHistorySearch,
    onReaderScroll, onReaderProgress,
    onBookmarkSearch, onFindMatch, onRemainingTime,
    onHeadingSelect, onFindStatus, onFindLast, onReadLine,
    onParagraphStep, onParagraphSelect, onParagraphStatus, onCharCount,
    onReadParagraph, onLineStatus, onTabStatus, onPrivacyStatus, onPinStatus,
    onJumpBack, onClearFind, onCopyLine, onCopyArticle, onReaderPercent,
    onReaderScaleStatus,
    onPasteGo, onReadClipboard, onRecenter, onVideoStatus,
    onMuteStatus, onFindQuery, onReadFromLine, onHalfPage, onSentenceStep,
    onSentence, onSentenceStatus, onLastParagraph, onReadParagraphAt,
    onSearchEngineStatus, onCharStep, onWord, onSpellWord,
    onHeadingHere, onArticleSummary, onShare, onSessionClear,
    onContrastStatus, onDwellTimeStatus, onSessionSave, onDismissNotify, onReadNotify } = {}) {
    // EN ordinal + cardinal words shared by the positional tab commands
    // (select/close/pin/move/mute-by-position and their by-name exclusions).
    const EN_NUM = 'first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth' +
      '|last|one|two|three|four|five|six|seven|eight|nine|ten';
    this._tabManager = tabManager || null;
    if (onVolume) {
      this._onVolume = onVolume;
    }
    if (onCaptionScale) {
      this._onCaptionScale = onCaptionScale;
    }
    if (onDwellTime) {
      this._onDwellTime = onDwellTime;
    }
    if (onVolumeStatus) {
      this._onVolumeStatus = onVolumeStatus;
    }
    if (onReaderScale) {
      this._onReaderScale = onReaderScale;
    }
    if (onHighContrast) {
      this._onHighContrast = onHighContrast;
    }
    if (onSearchEngine) {
      this._onSearchEngine = onSearchEngine;
    }
    if (onRestoreSession) {
      this._onRestoreSession = onRestoreSession;
    }
    if (onSettingToggle) {
      this._onSettingToggle = onSettingToggle;
    }
    if (onSettingStatus) {
      this._onSettingStatus = onSettingStatus;
    }
    if (onPanelDistance) {
      this._onPanelDistance = onPanelDistance;
    }
    if (onMute) {
      this._onMute = onMute;
    }
    if (onStepper) {
      this._onStepper = onStepper;
    }
    if (onVideoSeek) {
      this._onVideoSeek = onVideoSeek;
    }
    if (onSettingsPanel) {
      this._onSettingsPanel = onSettingsPanel;
    }
    if (onBookmarkOpen) {
      this._onBookmarkOpen = onBookmarkOpen;
    }
    if (onHistoryOpen) {
      this._onHistoryOpen = onHistoryOpen;
    }
    if (onBookmarkOpenNamed) {
      this._onBookmarkOpenNamed = onBookmarkOpenNamed;
    }
    if (onHistoryOpenNamed) {
      this._onHistoryOpenNamed = onHistoryOpenNamed;
    }
    if (onReaderLine) {
      this._onReaderLine = onReaderLine;
    }
    if (onBookmarkList) {
      this._onBookmarkList = onBookmarkList;
    }
    if (onHistoryList) {
      this._onHistoryList = onHistoryList;
    }
    if (onCopyTitle) {
      this._onCopyTitle = onCopyTitle;
    }
    if (onReadHere) {
      this._onReadHere = onReadHere;
    }
    if (onTopSiteOpen) {
      this._onTopSiteOpen = onTopSiteOpen;
    }
    if (onHistorySearch) {
      this._onHistorySearch = onHistorySearch;
    }
    if (onReaderScroll) {
      this._onReaderScroll = onReaderScroll;
    }
    if (onReaderProgress) {
      this._onReaderProgress = onReaderProgress;
    }
    if (onBookmarkSearch) {
      this._onBookmarkSearch = onBookmarkSearch;
    }
    if (onFindMatch) {
      this._onFindMatch = onFindMatch;
    }
    if (onRemainingTime) {
      this._onRemainingTime = onRemainingTime;
    }
    if (onHeadingSelect) {
      this._onHeadingSelect = onHeadingSelect;
    }
    if (onFindStatus) {
      this._onFindStatus = onFindStatus;
    }
    if (onFindLast) {
      this._onFindLast = onFindLast;
    }
    if (onReadLine) {
      this._onReadLine = onReadLine;
    }
    if (onParagraphStep) {
      this._onParagraphStep = onParagraphStep;
    }
    if (onParagraphSelect) {
      this._onParagraphSelect = onParagraphSelect;
    }
    if (onParagraphStatus) {
      this._onParagraphStatus = onParagraphStatus;
    }
    if (onCharCount) {
      this._onCharCount = onCharCount;
    }
    if (onReadParagraph) {
      this._onReadParagraph = onReadParagraph;
    }
    if (onLineStatus) {
      this._onLineStatus = onLineStatus;
    }
    if (onTabStatus) {
      this._onTabStatus = onTabStatus;
    }
    if (onPrivacyStatus) {
      this._onPrivacyStatus = onPrivacyStatus;
    }
    if (onPinStatus) {
      this._onPinStatus = onPinStatus;
    }
    if (onJumpBack) {
      this._onJumpBack = onJumpBack;
    }
    if (onClearFind) {
      this._onClearFind = onClearFind;
    }
    if (onCopyLine) {
      this._onCopyLine = onCopyLine;
    }
    if (onCopyArticle) {
      this._onCopyArticle = onCopyArticle;
    }
    if (onReaderPercent) {
      this._onReaderPercent = onReaderPercent;
    }
    if (onReaderScaleStatus) {
      this._onReaderScaleStatus = onReaderScaleStatus;
    }
    if (onContrastStatus) {
      this._onContrastStatus = onContrastStatus;
    }
    if (onDwellTimeStatus) {
      this._onDwellTimeStatus = onDwellTimeStatus;
    }
    if (onSessionSave) {
      this._onSessionSave = onSessionSave;
    }
    if (onPasteGo) {
      this._onPasteGo = onPasteGo;
    }
    if (onReadClipboard) {
      this._onReadClipboard = onReadClipboard;
    }
    if (onShare) {
      this._onShare = onShare;
    }
    if (onDismissNotify) {
      this._onDismissNotify = onDismissNotify;
    }
    if (onReadNotify) {
      this._onReadNotify = onReadNotify;
    }
    if (onSessionClear) {
      this._onSessionClear = onSessionClear;
    }
    if (onRecenter) {
      this._onRecenter = onRecenter;
    }
    if (onVideoStatus) {
      this._onVideoStatus = onVideoStatus;
    }
    if (onMuteStatus) {
      this._onMuteStatus = onMuteStatus;
    }
    if (onFindQuery) {
      this._onFindQuery = onFindQuery;
    }
    if (onReadFromLine) {
      this._onReadFromLine = onReadFromLine;
    }
    if (onHalfPage) {
      this._onHalfPage = onHalfPage;
    }
    if (onSentenceStep) {
      this._onSentenceStep = onSentenceStep;
    }
    if (onSentence) {
      this._onSentence = onSentence;
    }
    if (onSentenceStatus) {
      this._onSentenceStatus = onSentenceStatus;
    }
    if (onLastParagraph) {
      this._onLastParagraph = onLastParagraph;
    }
    if (onReadParagraphAt) {
      this._onReadParagraphAt = onReadParagraphAt;
    }
    if (onSearchEngineStatus) {
      this._onSearchEngineStatus = onSearchEngineStatus;
    }
    if (onCharStep) {
      this._onCharStep = onCharStep;
    }
    if (onWord) {
      this._onWord = onWord;
    }
    if (onSpellWord) {
      this._onSpellWord = onSpellWord;
    }
    if (onHeadingHere) {
      this._onHeadingHere = onHeadingHere;
    }
    if (onArticleSummary) {
      this._onArticleSummary = onArticleSummary;
    }
    // close-tab-ordinal — the positional twin of tab-close-n ('2番目の
    // タブを閉じて'/'close the last tab'). Registered BEFORE
    // close-tab-by-name: its free-form name capture otherwise answers
    // '「2番目」のタブがありません' and 'close the first tab' searches for
    // a tab literally named 'first' (dispatch-verified).
    this.registerCommand('close-tab-ordinal', {
      patterns: [/([0-9一二三四五六七八九]+)番目のタブを閉じて/,
        '最初のタブを閉じて', '一番目のタブを閉じて', '最後のタブを閉じて',
        '先頭のタブを閉じて', '末尾のタブを閉じて',
        new RegExp('^close (?:the )?(?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)? tab$', 'i'),
        new RegExp('^close tab (?:number )?(?:' + EN_NUM + '|[0-9]+)$', 'i')],
      action: (transcript) => {
        const ORD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
          first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
          seventh: 7, eighth: 8, ninth: 9, tenth: 10,
          one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
        const tabs = tabManager?.tabs || [];
        const m = transcript.match(/([0-9一二三四五六七八九]+)番目/) ||
          transcript.match(new RegExp('(' + EN_NUM + '|[0-9]+)', 'i'));
        let n = 0;
        if (m) {
          n = /^[0-9]+$/.test(m[1]) ? parseInt(m[1], 10)
            : (m[1].toLowerCase() === 'last' ? tabs.length : (ORD[m[1].toLowerCase()] || 0));
        } else if (/最初|一番|先頭|first/i.test(transcript)) {
          n = 1;
        } else if (/最後|末尾|last/i.test(transcript)) {
          n = tabs.length;
        }
        const t = tabs[n - 1];
        if (!t) {
          this.speak(`タブ${n}はありません`);
          return { action: 'close-tab-ordinal', index: -1 };
        }
        const title = t.currentTitle || t.currentUrl || `タブ${n}`;
        if (!tabManager.closeTab(n - 1)) {
          this.speak('ピン留めされたタブは閉じられません');
          return { action: 'close-tab-ordinal', index: n - 1, closed: false };
        }
        this.speak(`${title}を閉じました`);
        return { action: 'close-tab-ordinal', index: n - 1, closed: true };
      },
      description: 'Close the tab at an ordinal position'
    });
    // close-tab-by-name — tab-by-name's destructive sibling ('Xのタブを
    // 閉じて'/'close the news tab'). Registered BEFORE close-tab: its
    // /close\s+tab/i prefix owns the EN phrase otherwise (dispatch-verified).
    this.registerCommand('close-tab-by-name', {
      patterns: [/^(?!(?:この|あの|その|さっき|最後|最初|前|次|ピン|すべて|全て|他|右|右側|左|左側|秘密|シークレット|残り|今|幾つ|何個|違う|[^の]*番目))(.+)のタブを閉じて/,
        new RegExp('^close (?:the )?(?!active\\b|current\\b|other\\b|all\\b|tabs\\b|this\\b|first\\b|last\\b' +
          '|the\\b|damn\\b|damned\\b|stupid\\b|bloody\\b|fucking\\b|freakin\\b|goddamn\\b|number\\b' +
          '|(?:' + EN_NUM + ')(?:st|nd|rd|th)?\\s+tab\\b)(.+) tab$', 'i'),
        /^close tab (?:named|called) (.+)$/i],
      action: (transcript) => {
        const enClose = new RegExp('^close (?:the )?(?!active\\b|current\\b|other\\b|all\\b|tabs\\b|this\\b|first\\b|last\\b' +
          '|the\\b|damn\\b|damned\\b|stupid\\b|bloody\\b|fucking\\b|freakin\\b|goddamn\\b|number\\b' +
          '|(?:' + EN_NUM + ')(?:st|nd|rd|th)?\\s+tab\\b)(.+) tab$', 'i');
        const m = transcript.match(/^(.+)のタブを閉じて/) ||
          transcript.match(enClose) ||
          transcript.match(/^close tab (?:named|called) (.+)$/i);
        const term = (m ? m[1] : '').toLowerCase().trim();
        const tabs = tabManager?.tabs || [];
        const i = tabs.findIndex((t) => {
          const hay = `${t.currentTitle || ''} ${t.currentUrl || ''}`.toLowerCase();
          return term && hay.includes(term);
        });
        if (i < 0) {
          this.speak(`「${term}」のタブがありません`);
          return { action: 'close-tab-by-name', index: -1 };
        }
        const closed = tabManager.closeTab ? tabManager.closeTab(i) : false;
        this.speak(closed === false
          ? 'ピン留めされたタブは閉じられません'
          : 'タブを閉じました');
        return { action: 'close-tab-by-name', index: i };
      },
      description: 'Close a tab by title or URL'
    });
    // pin-tab-by-name — the pin twin of close-by-name ('Xのタブをピン'/
    // 'pin the news tab'). Registered BEFORE pin-tab: its EN
    // `/pin (this |the )?tab(?!\s*\d)/` claims 'pin tab named X' and toggles
    // the WRONG tab otherwise (dispatch-verified).
    this.registerCommand('pin-tab-by-name', {
      patterns: [/^(?!(?:この|あの|その|すべて|全て|左|右|ピン))(.+)のタブをピン/,
        new RegExp('^pin (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)' +
          '(?:the )?(?!this\\b|active\\b|current\\b|number\\b|' +
          '(?:' + EN_NUM + ')(?:st|nd|rd|th)?\\s+tab\\b|[0-9]+\\b)(.+) tab$', 'i'),
        /^pin tab (?:named|called) (.+)$/i],
      action: (transcript) => {
        const pinRe = new RegExp('^pin (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)' +
          '(?:the )?(?!this\\b|active\\b|current\\b|number\\b|' +
          '(?:' + EN_NUM + ')(?:st|nd|rd|th)?\\s+tab\\b|[0-9]+\\b)(.+) tab$', 'i');
        const m = transcript.match(/^(.+)のタブをピン/) ||
          transcript.match(pinRe) ||
          transcript.match(/^pin tab (?:named|called) (.+)$/i);
        const term = (m ? m[1] : '').toLowerCase().trim();
        const tabs = tabManager?.tabs || [];
        const i = tabs.findIndex((t) => {
          const hay = `${t.currentTitle || ''} ${t.currentUrl || ''}`.toLowerCase();
          return term && hay.includes(term);
        });
        if (i < 0) {
          this.speak(`「${term}」のタブがありません`);
          return { action: 'pin-tab-by-name', index: -1 };
        }
        const state = tabManager.togglePin ? tabManager.togglePin(i) : null;
        this.speak(state === 'pinned' ? `タブ${i + 1}をピン留めしました`
          : state === 'unpinned' ? `タブ${i + 1}のピンを外しました`
            : 'タブをピン留めできません');
        return { action: 'pin-tab-by-name', index: i, state };
      },
      description: 'Pin or unpin a tab by title or URL'
    });
    // pin-active — unpin-active's one-direction twin: 'ピンして' always
    // pins, never accidentally unpins (pin-tab toggles).
    this.registerCommand('pin-active', {
      patterns: ['ピンして', 'ピン留めして', 'ピンを付けて', 'ピンを付ける',
        'ピンを付けてください', 'ピンを立てて', /^pin it$/i, /^pin this$/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        const i = tabManager?.activeIndex ?? -1;
        const p = i >= 0 ? tabs[i] : null;
        if (!p) {
          this.speak('タブがありません');
          return { action: 'pin-active' };
        }
        if (p.pinned) {
          this.speak('すでにピン留めされています');
          return { action: 'pin-active', pinned: true };
        }
        tabManager.togglePin(i);
        this.speak('ピン留めしました');
        return { action: 'pin-active', pinned: true };
      },
      description: 'Pin the active tab'
    });
    // unpin-active — the explicit one-direction twin: 'ピンを外して' never
    // accidentally pins (pin-tab toggles). Honest when nothing is pinned.
    this.registerCommand('unpin-active', {
      patterns: ['ピンを外して', 'ピン留めを外して', '固定を外して',
        'ピンを取って', 'ピンを取り外して', '固定解除', 'ピンを解除して',
        'ピンを外す', 'ピンを取る', 'ピンを解除', 'ピン解除',
        'ピン留めを解除', 'ピン留め解除して',
        /^unpin( (this|it|the tab|tab))?$/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        const i = tabManager?.activeIndex ?? -1;
        const p = i >= 0 ? tabs[i] : null;
        if (!p) {
          this.speak('タブがありません');
          return { action: 'unpin-active' };
        }
        if (!p.pinned) {
          this.speak('ピン留めされていません');
          return { action: 'unpin-active', pinned: false };
        }
        tabManager.togglePin(i);
        this.speak('ピン留めを外しました');
        return { action: 'unpin-active', pinned: false };
      },
      description: 'Unpin the active tab'
    });
    // unpin-all — the strip-wide sweep ('ピンを全部外して'). Iterates
    // togglePin so the strip redraw and any pin bookkeeping stay identical
    // to a per-tab unpin. Registered before pin-tab-by-name so '全部' is
    // never searched as a tab name.
    this.registerCommand('unpin-all', {
      patterns: ['ピンを全部外して', 'ピンをすべて外して', 'すべてのピンを外して',
        '全部のピンを外して', 'ピン留めを全部解除', 'ピン留めをすべて解除',
        'ピンを全部解除', 'ピンをすべて解除', '全ピン解除', 'ピンを全解除',
        'unpin everything', 'unpin them all', 'unpin em all', 'unpin all of them',
        /unpin all( tabs)?/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        let n = 0;
        tabs.forEach((t, i) => {
          if (t.pinned && tabManager.togglePin) {
            tabManager.togglePin(i);
            n++;
          }
        });
        this.speak(n ? `${n}個のタブのピンを外しました` : 'ピン留めされたタブはありません');
        return { action: 'unpin-all', count: n };
      },
      description: 'Unpin every pinned tab'
    });
    // pin-all — the 'unpin all' twin; pins every unpinned tab in one shot.
    this.registerCommand('pin-all', {
      patterns: ['タブを全部ピン留め', '全部ピン留め', '全部ピン留めして',
        '全タブピン留め', 'すべてのタブをピン留め', 'ピンを全部付けて',
        'タブをすべて固定', '全部固定して',
        'pin em all', 'pin them all', 'pin everything', 'pin all of them',
        /pin all( the)? tabs/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        let n = 0;
        tabs.forEach((t, i) => {
          if (!t.pinned && tabManager.togglePin) {
            tabManager.togglePin(i);
            n++;
          }
        });
        this.speak(n ? `${n}個のタブをピン留めしました` : 'ピン留めできるタブはありません');
        return { action: 'pin-all', count: n };
      },
      description: 'Pin every unpinned tab'
    });
    // reload-tab-n — reload-all's indexed sibling ('タブNをリロード').
    // Registered BEFORE tab-select: its /タブ(\d+)/ prefix-match owns the
    // phrase and would select instead of reloading (dispatch-verified).
    this.registerCommand('reload-tab-n', {
      patterns: [/タブ([0-9]+)をリロード/, /タブ([0-9]+)を再読み込み/,
        /reload tab ([0-9]+)/i, /refresh tab ([0-9]+)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const tabs = tabManager?.tabs || [];
        const t = tabs[n - 1];
        if (!t) {
          this.speak(`タブ${n}はありません`);
          return { action: 'reload-tab-n', index: -1 };
        }
        t.reload?.();
        this.speak(`タブ${n}を再読み込みしました`);
        return { action: 'reload-tab-n', index: n - 1 };
      },
      description: 'Reload the tab at a strip position'
    });

    // Top Sites — hands-free jump to the user's most-used destination
    // (frecency-ranked). The heavy lifting (ranking + navigation + caption) is
    // the host's via onTopSites, mirroring the onSearch decoupling.
    this.registerCommand('top-sites', {
      patterns: ['トップサイト', 'よく使うサイト', 'よくみるサイト', 'トップ',
        'スタートページ', 'よく見るサイト', 'おすすめサイト', 'よく行くサイト', /トップ?サイト/,
        'おすすめのサイト', '閲覧ランキング', '人気のサイト', '急上昇',
        'ランキング', '人気の記事', '注目の記事', '話題のニュース',
        'トップ記事', 'おすすめを読んで', 'おすすめ記事',
        '人気記事', 'トレンド', '今話題'],
      action: () => {
        if (onTopSites) {
          onTopSites();
        }
        return { action: 'top-sites' };
      },
      confirmationText: 'よく使うサイトを開きます',
      description: 'Open most-used site'
    });

    // Browser forward / back — goBack/goForward report whether the tab
    // actually moved (controller faceB/faceA parity); a static
    // confirmationText would claim '戻ります' even at the earliest entry.
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', '次に進んで',
        /(?<!(?:どうやって|一文字|ひと文字|一単語|ひと単語))進む(?!な)|(?<!読み|上げを|行を)進め(?!る|な|ま)/,
        '進んで', '進みたい', '次のページに進んで', '一つ進んで', 'ひとつ進んで',
        '先に進んで', '先へ進んで', '先に進む', '先へ進む', '先に進みたい',
        'forward', /go forward(?! \d)/i, /forward (a|one|the) page/i,
        'お進みなさい',
        'head forward', 'go on forward',
        /one page forward/i],
      action: () => {
        const moved = tabManager?.getActiveTab?.()?.goForward?.() || false;
        this.speak(moved ? '進みます' : '進めません');
        return { action: 'navigate', direction: 'forward', moved };
      },
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる',
        /(?<!(?:先頭に|一番上に|トップに|モードに|どうやって|一文字|ひと文字|一単語|ひと単語|単語を|行頭に|頭に|一つ|ひとつ|頭まで))(?:戻る(?!な|まい)|戻れ(?!る|な|ま))/,
        '戻って', '戻ってきて', '戻りたい', '一つ戻って', 'ひとつ戻って',
        '帰ってきて', '帰ってくる',
        '一つ戻る', 'ひとつ戻る', 'ひとつ前に戻る',
        '前のページに戻って', 'さっきのページ', 'さっきのページに戻って',
        '一つ前に戻って', 'もっと戻って', 'もっと前に戻って',
        'さっき見たページ', 'さっき見てたページ', 'もう一個戻って',
        'さっきのサイト', 'さっきのサイトに戻って', 'さっき見たサイト',
        'back', 'go back', 'backward', 'go backwards', 'step back',
        'お戻りなさい',
        'head back', 'walk it back', 'head on back', 'go on back',
        /(take|send|bring) me back/i, /going back/i, /back it up/i],
      action: () => {
        const moved = tabManager?.getActiveTab?.()?.goBack?.() || false;
        this.speak(moved ? '戻ります' : '戻れません');
        return { action: 'navigate', direction: 'back', moved };
      },
      description: 'Navigate back'
    });

    this.registerCommand('refresh', {
      // 'リロード'/'reload'/'reload the page' are aliases — the EN pattern is
      // end-anchored so 'reload tab 2' still reaches reload-tab-n first.
      patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん', 'リロード',
        'ページを更新', '更新して', 'ページを更新して',
        '再起動して', 'ブラウザを再起動', '再起動', 'ブラウザを再起動して',
        'ページを再読み込み', '読み込み直して', 'もう一度読み込んで',
        'リフレッシュして', '再読み込みして', 'リロードして',
        /reload(\s+(the|this)\s+page)?$/i, /^refresh(\s+the\s+page)?$/i,
        /^refresh\s+page$/i, /^restart(\s+the)?\s+(browser|page)$/i],
      action: () => {
        tabManager?.getActiveTab?.()?.reload?.();
        return { action: 'refresh' };
      },
      confirmationText: '更新します',
      description: 'Refresh page'
    });

    // Clear browsing history (privacy) — hands-free equivalent of the settings
    // panel "Clear History" action (Session 56). Registered before the greedy
    // go-to catch-all. The '履歴' patterns don't collide with go-to's 'を開く'
    // capture, but specific-before-catch-all is the rule (processCommand stops
    // at the first match in registration order).
    this.registerCommand('clear-history', {
      patterns: [
        '履歴を消去', '履歴を削除', '履歴クリア', '履歴を消す', 'りれきを消去',
        '閲覧履歴を消して', '検索履歴を消して',
        '履歴を消して', '履歴をリセット', '今日の履歴を消して',
        '閲覧履歴を全部消して', '履歴を全部消して', '履歴を全部消す',
        '履歴消して', '履歴を消去して', '履歴を削除して', '履歴をクリアして',
        'clear my history', 'clear history', 'delete history', 'erase history',
        'wipe my history', 'wipe the history', 'wipe history', 'purge history',
        'clear all my history',
        /履歴を?(消去|削除|クリア|消す)/,
        /clear\s+(browsing\s+)?history/i, /delete\s+history/i
      ],
      action: () => {
        if (onClearHistory) {
          onClearHistory();
        }
        return { action: 'clear-history' };
      },
      confirmationText: '履歴を消去します',
      description: 'Clear browsing history',
      example: '履歴を消去'
    });

    // Web search — route through VR address bar / tab navigation
    this.registerCommand('search', {
      patterns: [/検索[：:]\s*(.+)/, /さが[すせ][：:]\s*(.+)/, /サーチ[：:]\s*(.+)/],
      action: (transcript) => {
        const match = transcript.match(/[：:]\s*(.+)/);
        if (match && match[1]) {
          const query = match[1].trim();
          if (onSearch) {
            onSearch(query);
          } else {
            tabManager?.getActiveTab?.()?.navigate?.(query);
          }
          return { action: 'search', query };
        }
      },
      confirmationText: '検索します',
      description: 'Search web',
      example: '検索：てんき'
    });

    // Scroll the reader viewport.
    //
    // This previously called `iframe.contentWindow.scrollBy`, which threw on
    // every cross-origin page (swallowed) and, even same-origin, scrolled an
    // iframe that is never visible in VR — so the command did nothing at all.
    // It now drives the panel's own reader viewport via onScrollContent.
    const SCROLL_LINES = 8;
    this.registerCommand('scroll-down', {
      patterns: ['下にスクロール', '下', 'した', 'スクロールダウン',
        'ちょっと下', 'ちょっと下へ', '少し下', '少し下へ', 'もう少し下',
        'スクロール', 'スクロールして', 'ページをめくって', 'めくって',
        '次にめくって', 'ページをめくる', 'めくる',
        'keep scrolling', 'もうちょい下', 'もうちょい下へ', 'ぐいっと下',
        'もっと下に', '下に行って', '下に向かって',
        '少しスクロール', 'ちょっとスクロール', 'もっと下', 'さらに下',
        'ぐっと下', '一気に下', 'もっと下へ', 'さらに下へ',
        'もうちょっと下', 'もうちょっと下へ', 'ちょっとだけ下',
        '少しだけ下', 'ちょびっと下', 'もう少しだけ下', 'ほんの少し下', 'ほんの少しだけ下',
        'ほんのちょっと下', 'move down', 'down a bit', 'little scroll', 'scroll some', 'scroll a bit', 'a little more', 'bit more', 'tiny bit more', 'partway down', 'a bit more down',
        'scroll on down', 'keep on scrolling', 'ごく少し下',
        'scroll', /^down$/i,
        /scroll down/i, /scroll downwards?/i, /^go down$/i,
        /scroll (a )?little( bit)?( down)?/i, /tiny scroll/i, /a little bit down/i],
      action: () => {
        if (onScrollContent) {
          onScrollContent(SCROLL_LINES);
        }
        return { action: 'scroll', direction: 'down' };
      },
      description: 'Scroll down'
    });

    this.registerCommand('scroll-up', {
      patterns: ['上にスクロール', '上', 'うえ', 'スクロールアップ',
        'ちょっと上', 'ちょっと上へ', '少し上', '少し上へ', 'もう少し上',
        'もっと上', 'さらに上', 'ぐっと上', '一気に上', 'もっと上へ', 'さらに上へ',
        'もうちょっと上', 'もうちょっと上へ', 'ちょっとだけ上',
        '少しだけ上', 'ちょびっと上', 'もう少しだけ上', 'ごく少し上', 'ほんの少し上',
        'ほんのちょっと上', 'partway up',
        'move up', 'up a bit', 'go up a bit', 'もうちょい上', 'もうちょい上へ', 'ぐいっと上',
        'もっと上に', '上に行って', '上に向かって',
        'scroll on up', 'keep scrolling up',
        /scroll up/i, /scroll upwards?/i, /^go up$/i,
        /scroll up (a )?little( bit)?/i, /a little bit up/i, /^up$/i],
      action: () => {
        if (onScrollContent) {
          onScrollContent(-SCROLL_LINES);
        }
        return { action: 'scroll', direction: 'up' };
      },
      description: 'Scroll up'
    });

    // Tab control — hands-free equivalents of Ctrl+T (new tab), Ctrl+W
    // (close tab), Ctrl(+Shift)+Tab (cycle), Ctrl+Shift+T (reopen closed tab),
    // and the chrome strip's stop-loading and private-mode affordances.
    // Registered before the greedy go-to catch-all: its `を開く` capture would
    // otherwise claim utterances like "新しいタブを開く".
    // new-tab-with — the named-open twin: 'Xで新しいタブ'/'new tab with X'
    // opens a tab AND resolves the term through onGoTo (the go-to path:
    // URL → navigate, term → search). Registered BEFORE new-tab — its
    // /new\s+tab/i prefix-match owns the EN phrase and silently drops the
    // term (dispatch-verified).
    this.registerCommand('new-tab-with', {
      patterns: [/^(?!(?:プライベート|シークレット|空白|新しい))(.+)で新しいタブ/,
        /^new tab (?:with|for) (.+)$/i],
      action: (transcript) => {
        const m = transcript.match(/^(.+)で新しいタブ/) ||
          transcript.match(/^new tab (?:with|for) (.+)$/i);
        const term = (m ? m[1] : '').trim();
        if (!term) {
          this.speak('開くものを指定してください');
          return { action: 'new-tab-with', term: null };
        }
        const panel = tabManager?.newTab?.();
        if (!panel) {
          this.speak('タブをこれ以上開けません');
          return { action: 'new-tab-with', opened: false };
        }
        if (onGoTo) {
          onGoTo(term);
        }
        this.speak(`「${term}」で新しいタブを開きました`);
        return { action: 'new-tab-with', term };
      },
      description: 'Open a new tab on a term or URL'
    });
    this.registerCommand('new-tab', {
      patterns: ['新しいタブ', '新しいタブを開く', '新規タブ', '新しいウィンドウ',
        'ウィンドウを増やして', '新しいタブで開いて', '新しいウィンドウで開いて',
        'もう一個タブ', 'タブを増やして', 'もう一枚', 'タブ追加',
        'タブをもう一個', 'もう一つタブ', 'タブを一個増やして',
        '新しいタブを開いて', '新しいタブを開けて', '新しいタブを作って',
        'タブを開いて', 'タブを開けて', 'タブを作って', 'タブを開く',
        'タブを増やす', 'タブを追加して', 'タブを追加',
        'open up a tab', 'open up new tab', 'open a new tab', 'open a tab',
        '新しいページを開いて', '新しいページを開けて', '新しいページを開く',
        '新しいタブをもう一つ', '新しいタブをもう一個', 'もう一個新しいタブ',
        'open a new tab', 'open new tab', 'add a tab', 'create a tab',
        'make a tab', 'another tab', 'one more tab',
        'another window', 'one more window', 'open another window',
        /new\s+tab/i, /new\s+window/i],
      action: () => {
        tabManager?.newTab?.();
        return { action: 'new-tab' };
      },
      confirmationText: '新しいタブを開きます',
      description: 'Open a new tab'
    });

    this.registerCommand('close-tab', {
      patterns: ['タブを閉じる', 'タブを閉じて', 'このタブを閉じる', 'このタブを閉じて',
        '今のタブを閉じて', '今のタブを閉じる', 'いまのタブを閉じて',
        'ウィンドウを閉じて', 'このウィンドウを閉じて', 'ページを閉じて', 'サイトを閉じて',
        'このページを閉じて', 'このページを閉じる', 'このサイトを閉じて',
        'タブを消して', '閉じて', '閉じる', 'タブを消す', 'ページを消して',
        'パネルを閉じて', 'パネルを消して', 'ウィンドウを閉じる',
        '閉めて', 'タブを閉めて', 'ページを閉めて', 'このページを閉めて',
        'パネルを閉めて', 'タブを閉める', 'ページを閉める',
        'タブを減らして', 'タブを減らす',
        'ウインドウを閉じて', '画面を閉じて', 'この画面を閉じて',
        '見てる画面を閉じて', '見ている画面を閉じて',
        'パネルを減らして', 'ウィンドウを減らして', 'パネルを減らす',
        '閉じろ', '消えろ', 'とじろ', '閉じてしまって', '閉じれ',
        'close it', 'close this one', 'close the one', 'close', 'close this', 'shut it',
        'kill it', 'axe it', 'trash it', 'bin it', 'ditch it', 'dump it',
        'yeet it', 'off it', 'do away with it', 'be done with it',
        'done with it', 'over it', 'through with it', 'finished with it',
        'close this down', 'close this up', 'close that up', 'close that down',
        'get rid of it', 'get rid of this', 'ditch this', 'ditch that',
        /close\s+(?:this\s+|the\s+)?tab\b(?!\s*(?:\d|on\b|to\b|i\b))/i,
        /close\s+(?:this\s+|the\s+)?window/i],
      action: () => {
        if (tabManager && tabManager.activeIndex >= 0) {
          // Pinned tabs refuse closeTab (Chrome parity) — say so instead of
          // claiming the close happened.
          const closed = tabManager.closeTab(tabManager.activeIndex);
          if (!closed) {
            this.speak('ピン留めされたタブは閉じられません');
            return { action: 'close-tab', closed: false };
          }
          this.speak('タブを閉じます');
          return { action: 'close-tab' };
        }
        this.speak('タブがありません');
        return { action: 'close-tab', closed: false };
      },
      description: 'Close the active tab'
    });

    // Pin tab — Chrome "Pin tab" parity. Pinned tabs cluster at the strip's
    // left edge and refuse every close path until unpinned.
    this.registerCommand('pin-tab', {
      patterns: ['タブをピン留め', 'ピン留め', 'このタブを固定', 'タブを固定',
        'ピン留め解除', '固定を解除',
        'ピンを付けて', 'ピンを刺して', 'ピンを立てて', 'タブを固定して',
        'このタブをピン留め', 'ピン留めして', '固定して',
        /(?<!un)pin (this |the )?tab(?!\s*\d)/i],
      action: () => {
        const state = tabManager?.togglePin?.(tabManager.activeIndex) || null;
        if (state === null) {
          this.speak('タブがありません');
          return { action: 'pin-tab', state: null };
        }
        this.speak(state === 'pinned' ? 'タブをピン留めしました' : 'ピン留めを解除しました');
        return { action: 'pin-tab', state };
      },
      description: 'Pin or unpin the active tab'
    });

    // Move tab — Chrome Ctrl+Shift+PageUp/PageDown. A move that would cross
    // the pinned/unpinned boundary is refused (Chrome keeps the regions
    // separate) and the command says so honestly.
    this.registerCommand('move-tab-left', {
      patterns: ['タブを左に移動', 'タブを左へ', 'タブを左に動かして',
        'このタブを左へ', 'このタブを左に移動', '左に移動', '左に移動して', 'タブを左に',
        '左に動かして',
        'タブを左に移動して', 'このタブを左に移動して', 'タブを左に送って',
        '左に送って', '左にずらして',
        /move (the |this )?tab left/i, /move it left/i],
      action: () => {
        const moved = tabManager?.moveTab?.(tabManager.activeIndex, -1) || false;
        this.speak(moved ? 'タブを移動しました' : 'タブをこれ以上移動できません');
        return { action: 'move-tab-left', moved };
      },
      description: 'Move the active tab left'
    });

    this.registerCommand('move-tab-right', {
      patterns: ['タブを右に移動', 'タブを右へ', 'タブを右に動かして',
        'このタブを右へ', 'このタブを右に移動', '右に移動', '右に移動して', 'タブを右に',
        '右に動かして',
        'タブを右に移動して', 'このタブを右に移動して', 'タブを右に送って',
        '右に送って', '右にずらして',
        /move (the |this )?tab right/i, /move it right/i],
      action: () => {
        const moved = tabManager?.moveTab?.(tabManager.activeIndex, 1) || false;
        this.speak(moved ? 'タブを移動しました' : 'タブをこれ以上移動できません');
        return { action: 'move-tab-right', moved };
      },
      description: 'Move the active tab right'
    });

    this.registerCommand('next-tab', {
      patterns: ['次のタブ', '右のタブ', '次のタブに移動', '右のタブに移動',
        '右のタブに', '右隣のタブ', '隣のタブ', '一つ右のタブ', 'ひとつ右のタブ',
        '右側のタブ', 'もっと右のタブ', '右側のタブに',
        /next\s+tab/i, /right\s+tab/i, /^switch tabs$/i, /^change tabs?$/i,
        /^swap tabs$/i, /^(the )?other tab$/i, /^(the )?other one$/i, 'タブを切り替え', 'タブ切り替え',
        'タブを変えて', '違うタブ', 'タブを切り替えて',
        'the tab next to this one', 'the one after this', 'the one after this one',
        'the one on the right', 'the tab to the right'],
      action: () => {
        tabManager?.nextTab?.();
        return { action: 'next-tab' };
      },
      confirmationText: '次のタブに切り替えます',
      description: 'Activate next tab'
    });

    this.registerCommand('prev-tab', {
      patterns: ['前のタブ', '左のタブ', '前のタブに移動', '左のタブに移動',
        '左のタブに', '左隣のタブ', '一つ左のタブ', 'ひとつ左のタブ',
        '左側のタブ', 'もっと左のタブ', '左側のタブに',
        /previous\s+tab|prev\s+tab/i, /left\s+tab/i,
        'the tab before this', 'the one before this', 'the one on the left',
        'the tab to the left'],
      action: () => {
        tabManager?.prevTab?.();
        return { action: 'prev-tab' };
      },
      confirmationText: '前のタブに切り替えます',
      description: 'Activate previous tab'
    });

    this.registerCommand('reopen-tab', {
      patterns: [
        'タブを開き直す', '閉じたタブを開き直す', '開き直す',
        '閉じたタブを開き直して', '開き直して', 'タブを開き直して',
        '閉じたタブをもう一度開いて', '閉じたタブを元に戻して',
        'さっき閉じたタブを開いて',
        '元に戻して', '取り消して', '閉じたタブをもう一度', '閉じたタブを開いて',
        'もとに戻して', '取り消し', '取り消して',
        'タブを消しちゃった', '消しちゃった', '閉じちゃった', '消えちゃった',
        '閉じちゃったで', '閉じちゃったんで', '閉じちゃったわ',
        '閉じちゃったもん', '閉じちゃったんだけど', '消えちゃったで', '消えちゃったんで',
        '間違えて閉じた', '間違えて消した', '間違えて閉じちゃった',
        'さっき閉じたやつ', '閉じたばっかり', '間違って閉じた',
        '間違って閉じちゃった', '閉じる前のタブ',
        'さっき閉じたタブ', 'さっき閉じたページ', '復活させて', '戻して',
        'タブを復元して', '復元して',
        /reopen(?!.*\ball\b).*\btab\b/i, /restore\s+tab/i, /^undo/i,
        /bring (it|that) back( up)?/i,
        /ctrl\s*\+?\s*z/i, /bring back (my |the )?tab/i,
        /(the )?tab i (just )?closed/i, /reopen (it|that)/i,
        /^(put|bring) it back$/i,
        /^take it back$/i, /^take that back$/i
      ],
      action: () => {
        const url = tabManager?.reopenClosedTab?.() || null;
        return { action: 'reopen-tab', url };
      },
      confirmationText: '閉じたタブを開き直します',
      description: 'Reopen the most recently closed tab'
    });

    // Patterns avoid '停止'/'ストップ' alone — those exact strings already
    // belong to the 'stop' command (stop *listening*), and exact-match strings
    // elsewhere never collide since matching is normalized ===, not substring.
    this.registerCommand('stop-loading', {
      patterns: [
        '読み込み中止', '読み込みを中止', '読み込みを止めて', '読み込みをやめて',
        /読み込み.*(止め|停止|中止|やめ)/, /stop\s+loading/i, /abort\s+loading/i,
        /stop (the )?page/i
      ],
      action: () => {
        tabManager?.getActiveTab?.()?.stop?.();
        return { action: 'stop-loading' };
      },
      confirmationText: '読み込みを中止します',
      description: 'Stop loading the active page'
    });

    // Chrome's Ctrl+Shift+N atom: one private tab now, without flipping the
    // manager-wide private-mode toggle. Registered before private-mode so
    // 'new incognito tab' lands here (specific beats generic — bare
    // 'incognito'/'プライベートモード' still reach the mode toggle). JA
    // phrases avoid 'を開く' — that suffix already belongs to go-to.
    this.registerCommand('private-new-tab', {
      patterns: ['プライベートタブ', 'シークレットタブ', 'プライベートな新しいタブ',
        '新しいプライベートタブ', 'プライベートタブを開いて', '新しいシークレットタブ',
        '秘密のタブ', 'シークレットのタブ', 'プライベートのタブ', 'シークレットモード', 'シークレットモードで開いて',
        /new (private|incognito) tab/i,
        'private window', 'new private window', 'open a private window',
        'incognito window', 'new incognito window', 'open incognito window'],
      action: () => {
        const panel = tabManager?.newPrivateTab?.();
        this.speak(panel ? 'プライベートタブを開きました' : 'タブをこれ以上開けません');
        return { action: 'private-new-tab', opened: !!panel };
      },
      description: 'Open a new private (incognito) tab'
    });

    this.registerCommand('private-mode', {
      patterns: [
        'プライベートモード', 'プライベートモードにして',
        /(?<!exit )private\s+mode(?!\s+off)/i, /(?<!exit )incognito(?!\s+tabs?)/i
      ],
      action: () => {
        if (onTogglePrivateMode) {
          onTogglePrivateMode();
        }
        return { action: 'private-mode' };
      },
      confirmationText: 'プライベートモードを切り替えます',
      description: 'Toggle private mode'
    });

    // private-mode-off — the one-direction twin: 'を終了' must never turn
    // private mode ON when it was already off. Reads the manager's flag
    // (newTab's privateMode default) and only toggles when actually on.
    this.registerCommand('private-mode-off', {
      patterns: ['プライベートモードを終了', 'プライベートモードをやめて',
        'シークレットモードを終了', 'シークレットモードをやめて',
        'プライベートをやめて', 'プライベートモードを終わって',
        'シークレットモードを終わって', 'プライベートを終了',
        'シークレットを終了', '通常モードに戻して', '通常モードに戻る',
        /private mode (off|end|exit)/i, /exit (private|incognito)/i],
      action: () => {
        if (!tabManager?._privateMode) {
          this.speak('プライベートモードはオフです');
          return { action: 'private-mode-off', off: true };
        }
        if (onTogglePrivateMode) {
          onTogglePrivateMode();
        }
        this.speak('プライベートモードをオフにします');
        return { action: 'private-mode-off', off: false };
      },
      description: 'Leave private mode'
    });

    // Reader Home/End atoms — the reader viewport is the only scrollable
    // surface in VR, so top/bottom jump commands target it directly.
    this.registerCommand('scroll-top', {
      patterns: ['先頭へ', '最初に戻る', 'ページの先頭', '一番上', '一番上へ',
        'ページの先頭へ', '最初のページ', 'トップへ',
        '先頭に戻る', '先頭に戻って', '一番上に戻る', '一番上に戻って',
        'トップに戻る', 'トップに戻って', 'ページの先頭に戻る',
        '頭に戻る', '先頭に飛んで', '頭まで戻る', 'トップに飛んで',
        /scroll (to( the)? )?top/i, /top of (the )?page/i, /^first page$/i, /^jump to (the )?top$/i,
        /^go to (the )?top$/i, /^all the way (up|to the top)$/i,
        /^(?:scroll )?way up$/i, /^scroll all the way up$/i, /^to the top$/i, /go back up/i, /scroll back up/i,
        /^top$/i],
      action: () => {
        tabManager?.getActiveTab?.()?.scrollToTop?.();
        return { action: 'scroll-top' };
      },
      confirmationText: '先頭へ移動します',
      description: 'Jump to the top of the article'
    });

    this.registerCommand('scroll-bottom', {
      patterns: ['末尾へ', '最後まで', 'ページの最後', '一番下', '一番下へ',
        'ページの最後へ', '最後のページ', 'ページの末尾', '末尾', '末尾まで',
        'ページの末尾へ', '終わりまで', 'ページの終わり',
        'どんどん下へ', 'ずっと下', '一番下まで一気に', '一気に最後まで',
        'ずっと下へ', 'ずっとスクロール',
        '末尾に飛んで', '末端まで', '末端に飛んで', '最後まで飛んで',
        /scroll (to( the)? )?bottom/i, /end of (the )?page/i, /^last page$/i, /^jump to (the )?bottom$/i,
        /^go to (the )?bottom$/i, /^go to (the )?end$/i, /^the end$/i,
        /^all the way (down|to the bottom)$/i, /^(?:scroll )?way down$/i,
        /^scroll all the way down$/i, /^to the bottom$/i, /^bottom$/i,
        'bottom of the page', 'the bottom of the page', 'bottom of this page',
        '最後まで行って', '最後まで行け', '末尾に行って', '末尾に行け'],
      action: () => {
        tabManager?.getActiveTab?.()?.scrollToBottom?.();
        return { action: 'scroll-bottom' };
      },
      confirmationText: '末尾へ移動します',
      description: 'Jump to the bottom of the article'
    });

    // Page-wise jumps — the reader arrows already implement the Page Up/Down
    // atom on the canvas; these give hands-free users the same jump.
    this.registerCommand('next-page', {
      patterns: ['次のページ', '次のページへ', '次ページ', 'ページダウン', '下のページ',
        '次のページを読んで', 'ページ送り', 'ページをめくれ',
        'ページ送りして', '記事をめくって', 'めくってみて',
        '次の記事', '次の記事へ', '次の記事を読んで',
        /next\s+page/i, /page\s+down/i,
        /next (article|post|part|section)/i,
        /flip (?:the |this )?page/i, /flip (?:the |this |it )?over/i,
        /turn (the|this) page/i, /turn it over/i],
      action: () => {
        tabManager?.getActiveTab?.()?.scrollContentPage?.(1);
        return { action: 'next-page' };
      },
      confirmationText: '次のページへ進みます',
      description: 'Scroll the article one page down'
    });

    this.registerCommand('prev-page', {
      patterns: ['前のページ', '前のページへ', '前ページ', 'ページアップ', '上のページ',
        '前のページを読んで', 'ページを戻して', 'ページを戻す',
        '前の記事', '前の記事へ', '前の記事を読んで',
        '記事を戻して', 'めくり戻して', 'ページをめくり戻して',
        /previous\s+page|prev\s+page|page\s+up/i,
        /previous (article|post|part|section)/i, /flip back/i],
      action: () => {
        tabManager?.getActiveTab?.()?.scrollContentPage?.(-1);
        return { action: 'prev-page' };
      },
      confirmationText: '前のページへ戻ります',
      description: 'Scroll the article one page up'
    });

    // Read-aloud — narrate the reader article through SpeechSynthesis
    // (Edge "Read Aloud" / Safari "Listen to Page"). The host returns the
    // chunk list; readAloud owns the start/nothing-to-read announcements, so
    // this command has no confirmationText (it would queue behind the chunks).
    this.registerCommand('read-aloud', {
      patterns: [
        '読み上げて', '読み上げてください', 'ページを読み上げ', '記事を読み上げ',
        'このページを読んで', 'ページを読み上げて', '記事を読み上げて',
        'このページを読み上げて', 'ページ全体を読み上げて',
        '最初から読み上げ', '最初から読み上げて', 'もう一回読んで',
        '全部読んで', '全て読んで', '最初から読んで', '読んで', '読んでね',
        '全部読み上げて', '全部を読み上げて', '全てを読み上げて',
        'すべて読んで', 'すべてを読んで',
        '読め', '読み上げろ', '読んでよ',
        '読み上げを開始', '読み上げを開始して', '音読を開始', '読み始めて',
        '音読して', '読み聞かせて', 'もう一回最初から', '最初からやり直し',
        '初めから', '最初から読み直して', '頭から読んで',
        '読み直して', 'もう一度読み直して', '頭から読み直して',
        '再読して', '再読', '再読みして', '読み返して', '読み返す',
        '一緒に読んで', '一緒に読もう', '伴って読んで', '一緒に読み上げて',
        'やり直して読んで', '読みたい', '読んでほしい', '読んでくれ', '読んでくれる', '読んでください',
        '読んでくれない', '読んでおいて',
        /read\s+aloud/i, /read\s+(this|the)\s+(page|article)/i, /^read this$/i,
        /^read (all|everything|it all)$/i, /from the (top|beginning|start)/i,
        /listen\s+to\s+(this|the)\s+(page|article)/i,
        'start over', 'start it over', 'one more read',
        'start reading', 'read page', /^read (the )?page$/i, /^read$/i, /^read (it|this)$/i,
        /^follow along$/i, /^read (with|along with) me$/i, /^read along$/i,
        /^keep up with me$/i,
        /what does (this|it) say/i, /what'?s it say/i,
        'read me the page', 'read me it', 'tell me what it says',
        /^read it$/i, /^start reading$/i,
        'read it out loud', 'read it aloud', 'read this out', 'read that out',
        'read that out loud', 'read it out', 'read the thing', 'read this thing',
        '最後まで読め', '最後まで読んでくれ', '読み終わりたい', '読み終えたい',
        '読み切りたい', '読み切って'
      ],
      action: () => {
        const chunks = onReadAloud ? onReadAloud() : null;
        this.readAloud(chunks);
        return { action: 'read-aloud' };
      },
      description: 'Read the article aloud'
    });

    this.registerCommand('stop-reading', {
      patterns: ['読み上げを止めて', '読み上げ停止', '読み上げ中止',
        '読み上げをやめる', '読み上げをやめて', '読むのをやめて',
        '声を止めて', '声を止めろ', '喋るのをやめて', '喋るな', '黙って',
        '読み上げを止める', '読み上げを終了',
        'おしゃべりを止めて', '喋らないで', 'しゃべらないで', 'しゃべるな',
        '読まないで', 'もう読まなくていい',
        '黙って', '黙れ', 'だまって', '黙りなさい', 'うるさいから止めて',
        'ナレーションを止めて', 'ナレーションをやめて', 'ナレーション停止',
        '読書をやめて', '読書を止めて', 'これを止めて', '読むのを止めて',
        'quit reading', 'quit reading it', 'stop talking',
        '止まってくれ',
        'stop the narration', 'quit narrating', 'stop narrating',
        /stop\s+reading/i, /stop\s+narrat/i, /^stop$/i, /^stop (it|this|that)$/i],
      action: () => {
        this.stopSpeaking();
        return { action: 'stop-reading' };
      },
      confirmationText: '読み上げを止めます',
      description: 'Stop reading the article aloud'
    });

    // Pause/resume narration — SpeechSynthesis.pause keeps the queue,
    // unlike stop-reading's cancel. Distinct phrases keep it clear of
    // stop-reading ('読み上げ停止') and video-toggle ('一時停止').
    this.registerCommand('pause-reading', {
      patterns: ['読み上げを一時停止', '読み上げを中断して', '読み上げ中断',
        '読み上げを中断', '中断して', '読み上げを中断する',
        '一旦停止', '一旦止めて', 'ちょっと止めて', '一旦中断',
        '待って', 'ちょっと待って', '少し待って', '待て', 'ちょっと待て', '待ってくれ',
        'hang on', 'hold up', 'wait up', 'wait a sec', 'one sec', 'gimme a sec',
        'hold on a sec', 'wait a moment', 'just a sec', 'hold on',
        'be right back', 'brb', 'hold that thought', 'one moment',
        'wait a minute', 'just a moment', 'hold on a minute', 'wait just a sec',
        '途中で止めて', '途中で止めておいて', '途中でとめて',
        'give me a minute', 'give me a sec',
        'hold on a moment', 'hang on a moment', 'one moment please', 'wait for it',
        'i will be back', 'ill be back', 'be back in a sec', 'be back in a minute',
        'give me a moment', 'give me a second',
        '途中でやめて', '途中でやめる', '途中でやめておいて', '一旦やめて', '一旦やめる',
        /pause\s+(the\s+)?(reading|narration|article)/i, /^pause$/i, /^pause (it|this)$/i],
      action: () => {
        this.pauseSpeaking();
        return { action: 'pause-reading' };
      },
      confirmationText: '読み上げを一時停止します',
      description: 'Pause the article narration'
    });

    this.registerCommand('resume-reading', {
      patterns: ['読み上げを再開', '読み上げを続けて', '読み上げ再開',
        '読み上げを再開して', '読書を再開', '読書を再開して', '読書を続けて',
        '読み上げを続けてください',
        /resume\s+(the\s+)?(reading|narration|article)/i, /^resume$/i,
        /^continue$/i, /^continue reading$/i,
        /^(read on|carry on|keep going|keep reading|go on)$/i,
        'keep it up', 'keep it going', 'keep it rolling', 'keep at it',
        'keep going with it', 'stick with it', 'stay on it', 'carry on',
        'as you were', 'press on', 'keep moving', 'keep on going',
        'keep on reading', 'keep it moving', 'keep it coming', 'continue as is',
        'このまま読んで', 'そのまま読んで', 'このまま続けて', 'そのまま続けて',
        'そのまま読み続けて', 'このまま読み続けて',
        'press on', 'move along', 'carry on with it', 'continue on',
        'どんどん進んで', 'どんどん読んで',
        '読みかけ', '読みかけを再開', 'さっきの続き', '中断したところから',
        '止めたところから', '読んでたところ', '前に読んでた',
        '読み進めて', '読み進め', '読み上げ続けて', '読み続けて', '読み続ける',
        '続けて読んで', '読み上げを進めて',
        '止めたところから読んで',
        '続きはどこ', '続きから読んで', '続きから',
        'continue from where i stopped', 'where i left off',
        'pick up where i left off', /where (did i|i left) (leave|stop|left)/i],
      action: () => {
        this.resumeSpeaking();
        return { action: 'resume-reading' };
      },
      confirmationText: '読み上げを再開します',
      description: 'Resume the paused narration'
    });

    // Speech rate — NVDA rate-control parity. Blind users run TTS fast;
    // steppers live in settings but a voice user adjusts by voice.
    this.registerCommand('speech-faster', {
      patterns: ['速くして', 'もっと速く', '読み上げを速く', '読み上げを早く',
        '早く読んで', '速く読んで',
        '読み上げ速度を上げて', '読み上げの速度を上げて', '話す速度を上げて',
        '話すスピードを上げて', '読み上げスピードを上げて', '速読して',
        '読み上げが遅い', '読み上げが遅すぎる', 'ナレーションが遅い',
        '読み上げが遅い', '読み上げが遅すぎる', '速く読み上げて',
        '読むのが遅い', '読むのが遅すぎる',
        '早口で', 'もっと早く', '早口にして', '早く', '速く',
        '早くしろ', '速くしろ', 'もっと早くしろ',
        'さっきより早く', 'さっきより速く', '今より早く', '今より速く',
        '急いで', '早くして', '速くして', 'さっさと', '急いで読んで',
        '読み上げを早送り', '読み上げ早送り', '読み上げを早送りして',
        '早口で読んで', '早口で', '速めで読んで', '速めに読んで',
        'faster faster', 'speed it up', 'double time',
        /speak faster|talk faster/i, /speed up (speech|reading|talk)/i, 'make it faster',
        'way faster', 'much faster', 'way quicker', 'a lot faster', 'faster please',
        'too slow', 'way too slow', 'so slow', 'its too slow', 'a bit too slow',
        'little too slow', 'faster still',
        /speed up (the )?reading/i,
        /increase (speech|talk|reading) (rate|speed)/i, /read faster/i, /^faster$/i, /^more quickly$/i, /read (this |it )?faster/i,
        /speed (it )?up/i, 'もっと早く読んで', '早く読んで', '速く読んで',
        'もっと速く', 'もっと早く'],
      action: () => {
        const rate = this.setSpeechRate(this._speechRate + 0.25);
        this.speak(`読み上げ速度 ${rate.toFixed(2)}倍`);
        return { action: 'speech-faster', rate };
      },
      description: 'Increase narration speed'
    });

    this.registerCommand('speech-slower', {
      patterns: ['遅くして', 'もっと遅く', '読み上げを遅く', '読み上げをゆっくり',
        'ゆっくり読んで', '遅く読んで',
        '読み上げ速度を下げて', '読み上げの速度を下げて', '話す速度を下げて',
        '話すスピードを下げて', '読み上げスピードを下げて', 'ゆっくり',
        '早すぎる', '早すぎ', 'ゆっくり言って', 'ゆっくり話して',
        'もっとゆっくり', 'もっとゆっくり話して', '聞き取れない', '聞き取りにくい',
        '読み上げが速い', '読み上げが速すぎる', '聞き取りやすくして',
        '遅く', 'ゆっくりめ',
        'はっきり読んで', 'ゆっくり読み上げて', 'ゆっくりめに読んで',
        'もっとゆっくり', 'もう少しゆっくり', 'ゆっくりめに',
        'ゆっくりと', '丁寧に', '丁寧に読んで', 'はっきりと', 'はっきり言って',
        '正確に読んで', 'ゆっくりと読んで',
        '遅くしろ', 'ゆっくりしろ', 'ゆっくりと読んで',
        /speak slower|talk slower/i, /slow down (speech|reading|talk)/i, 'make it slower',
        'slightly slower', 'a bit slower', 'bit slower', 'way slower', 'much slower',
        'too fast', 'way too fast', 'so fast', 'its too fast', 'a bit too fast',
        'little too fast', 'slower still',
        'slower please', 'slow down please',
        /slow down (the )?reading/i,
        /decrease (speech|talk|reading) (rate|speed)/i, /read slower/i, /^slower$/i, /^more slowly$/i, /slow (it )?down/i,
        /read (this |it )?slower/i],
      action: () => {
        const rate = this.setSpeechRate(this._speechRate - 0.25);
        this.speak(`読み上げ速度 ${rate.toFixed(2)}倍`);
        return { action: 'speech-slower', rate };
      },
      description: 'Decrease narration speed'
    });

    // Table of contents — VoiceOver rotor "headings" list / JAWS headings
    // dialog: speak every heading so the user hears the article's shape.
    this.registerCommand('toc', {
      patterns: ['目次', '目次を読み上げ', '見出し一覧', '章立て',
        '見出しを全部読んで', '全見出し', 'すべての見出し', '章一覧', '目次を読んで',
        '目次一覧', '目次を見せて', '見出しを一覧', 'アウトライン',
        'ページ構造', '構造を教えて', 'このページの構成', 'コンテンツ一覧',
        'ヘッダー一覧', '目次を読み上げて', '目次を教えて', 'ページの目次',
        '目次はどこ', '目次はどこにある', 'アウトラインは', '目次は',
        /table of contents/i, /read (the )?(contents|toc|outline)/i,
        /read (all )?(the )?headings/i, /chapter list/i],
      action: () => {
        const toc = tabManager?.getActiveTab?.()?.getReaderToc?.() || [];
        if (!toc.length) {
          this.speak('目次がありません');
          return { action: 'toc', count: 0 };
        }
        const list = toc.slice(0, 10);
        const more = toc.length > list.length ? `、他${toc.length - list.length}件` : '';
        this.speak(`${toc.length}個の見出し。${list.join('、')}${more}`);
        return { action: 'toc', count: toc.length };
      },
      description: 'Read the article outline aloud'
    });

    // Find-in-page — the Ctrl+F atom, scoped to the reader viewport (the
    // only searchable text surface). find-next/find-prev cycle matches like
    // Ctrl+G / Shift+Ctrl+G. The cycle commands are registered FIRST because
    // the query command's /(.+?)を探して/ would otherwise steal '次を探して'
    // and '前を探して' as queries.
    this.registerCommand('find-next', {
      patterns: ['次を探して', '次の候補', '次のマッチ', '次のヒット',
        '次の検索結果', 'マッチを進めて', 'ヒットを進めて',
        /find\s+next/i, /next\s+match/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.findNextMatch?.() || null;
        this.speak(r ? `${r.index}/${r.total}件目` : '見つかりませんでした');
        return { action: 'find-next', ...r };
      },
      description: 'Jump to the next find match'
    });

    this.registerCommand('find-prev', {
      patterns: ['前を探して', '前の候補', '前のヒット', '前のマッチ',
        '前の検索結果', 'マッチを戻して', 'ヒットを戻して', '前のヒットへ',
        /find\s+prev/i,
        /prev(?:ious)?\s+match/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.findPrevMatch?.() || null;
        this.speak(r ? `${r.index}/${r.total}件目` : '見つかりませんでした');
        return { action: 'find-prev', ...r };
      },
      description: 'Jump to the previous find match'
    });

    // Re-run the last find query — repeat-command's find twin (it replays
    // the transcript; this replays the active query itself). Hoisted before
    // find-in-page: its /find (.+)/ would otherwise search for 'again'.
    this.registerCommand('find-again', {
      patterns: ['もう一度検索', 'もう一回検索', '再検索', '同じ検索をもう一度',
        'もう一度調べて', /^find again$/i, /^search again$/i,
        /repeat (the )?(find|search)/i],
      action: () => {
        const q = this._onFindQuery ? this._onFindQuery() : null;
        if (!q) {
          this.speak('検索していません');
          return { action: 'find-again', count: 0 };
        }
        const count = tabManager?.getActiveTab?.()?.findInReader?.(q) || 0;
        this.speak(count ? `「${q}」を再検索：${count}件見つかりました`
          : '見つかりませんでした');
        return { action: 'find-again', count };
      },
      description: 'Repeat the last find-in-page query'
    });

    // tab-search — Chrome "Search tabs" parity ('タブを探して'/'find tab X').
    // Probe-verified misroutes fixed by registering before find-in-page:
    // 'タブを検索して' was searching the WEB for 'タブ' (web-search owned
    // /を検索/), and 'Xのタブを探して'/'find the news tab' were searching the
    // PAGE for the phrase via find-in-page's /を探して/ and /find (.+)/.
    // Bare forms prompt for a title; term forms switch to the match.
    this.registerCommand('tab-search', {
      patterns: ['タブを検索', 'タブを検索して', 'タブを探して', 'タブをさがして',
        'タブを調べて', 'タブを探す', 'タブサーチ',
        /(?!閉じた)(.+)のタブを(?:探して|さがして|探す|さがす|検索して|検索)/,
        /タブ(?:を|の中)(?:から|で)\s*(.+?)(?:を)?(?:探して|さがして|探す|検索して|検索)/,
        /^find (?:a |the |my )?tabs?$/i, /^tab search$/i, /^search (?:my |the )?tabs$/i,
        /find (?:the |a |my )?(.+?) tab/i,
        /search (?:my |the )?tabs? for (.+)/i],
      action: (transcript) => {
        const m = transcript.match(/(?!閉じた)(.+)のタブを(?:探して|さがして|探す|さがす|検索して|検索)/)
          || transcript.match(/タブ(?:を|の中)(?:から|で)\s*(.+?)(?:を)?(?:探して|さがして|探す|検索して|検索)/)
          || transcript.match(/find (?:the |a |my )?(.+?) tab/i)
          || transcript.match(/search (?:my |the )?tabs? for (.+)/i);
        const term = (m && m[1] ? m[1] : '').toLowerCase().trim();
        if (!term || /^(my|the|a)$/i.test(term)) {
          this.speak('タブの名前を言ってください');
          return { action: 'tab-search', index: -1 };
        }
        const tabs = tabManager?.tabs || [];
        const i = tabs.findIndex((t) => {
          const hay = `${t.currentTitle || ''} ${t.currentUrl || ''}`.toLowerCase();
          return hay.includes(term);
        });
        if (i < 0) {
          this.speak(`「${term}」のタブがありません`);
          return { action: 'tab-search', index: -1 };
        }
        tabManager.setActive(i);
        const p = tabs[i];
        this.speak(`タブ${i + 1}に切り替えました。${p.currentTitle || p.currentUrl}`);
        return { action: 'tab-search', index: i };
      },
      description: 'Search open tabs by title or URL'
    });

    this.registerCommand('find-in-page', {
      // 'find in page X' is a separate pattern so the optional prefix can't
      // backtrack into the query; the plain form only steps aside for the
      // two complete endpoint utterances ('find first'/'find last'), not
      // for multiword queries like 'find first aid'. The '…を開いて' forms
      // were literal-navigating via go-to's catch-all (probe-verified);
      // they land in the bare/no-term branch, which asks for a query.
      patterns: ['ページ内検索', 'ページ内を検索', 'ページ内で検索', '探せ', '探してみて',
        '探しろ', '検索しろ',
        /^find$/i, /^search$/i, /^search this page$/i,
        'ページ内検索を開いて', 'ページ内検索を開く', '検索を開いて',
        '検索を開く', '検索バーを開いて', '検索バーを開く', '検索バーを出して',
        '検索を始めて', '検索をはじめて', '検索モード',
        'この中から検索', '探して', '検索して',
        /find\s+in\s+(?:this\s+)?page\s+(.+)/i,
        /find\s+(?!in\s+(?:this\s+)?page\b)(?!first\s*$|last\s*$)(.+)/i,
        /search\s+(?:the\s+|this\s+)?page\s+for\s+(.+)/i,
        /look\s+for\s+(.+)/i,
        /(.+?)を探して/, /ページ内[をで](.+?)[をで]検索/],
      action: (transcript) => {
        const bare = transcript === 'ページ内検索';
        const m = transcript.match(/find\s+in\s+(?:this\s+)?page\s+(.+)/i)
          || transcript.match(/find\s+(?!in\s+(?:this\s+)?page\b)(?!first\s*$|last\s*$)(.+)/i)
          || transcript.match(/search\s+(?:the\s+|this\s+)?page\s+for\s+(.+)/i)
          || transcript.match(/look\s+for\s+(.+)/i)
          || transcript.match(/(.+?)を探して/)
          || transcript.match(/ページ内[をで](.+?)[をで]検索/);
        const term = m && m[1]
          ? m[1].replace(/^[「『"'']+|[」』"'']+$/g, '').trim()
          : '';
        if (bare || !m || !term) {
          this.speak('検索する語を言ってください');
          return { action: 'find-in-page', count: 0 };
        }
        const count = tabManager?.getActiveTab?.()?.findInReader?.(term) || 0;
        this.speak(count ? `${count}件見つかりました` : '見つかりませんでした');
        return { action: 'find-in-page', count };
      },
      description: 'Find text on the page'
    });

    // Heading navigation — the screen-reader H / Shift+H atom (NVDA, JAWS,
    // VoiceOver rotor). The article title counts as heading zero.
    this.registerCommand('next-heading', {
      patterns: ['次の見出し', '見出しへ', '次の見出しを読んで', '次のセクション',
        '次の章', '次のチャプター', '次の項目',
        /next\s+heading/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.nextHeading?.(1) || null;
        this.speak(r ? `${r.index}番目の見出し（全${r.total}）` : '見出しがありません');
        return { action: 'next-heading', ...r };
      },
      description: 'Jump to the next heading'
    });

    this.registerCommand('prev-heading', {
      patterns: ['前の見出し', '前のセクション', '前の章', '前のチャプター',
        '前の項目', /prev(?:ious)?\s+heading/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.prevHeading?.() || null;
        this.speak(r ? `${r.index}番目の見出し（全${r.total}）` : '見出しがありません');
        return { action: 'prev-heading', ...r };
      },
      description: 'Jump to the previous heading'
    });

    // Copy the active URL — the share-sheet atom (Quest browser's copy
    // action). Honest announce: nothing on screen → "nothing to copy".
    this.registerCommand('copy-url', {
      patterns: ['URLをコピー', 'リンクをコピー', 'アドレスをコピー',
        'このページのリンク', 'ページのリンク', 'ページのリンクをコピー',
        'コピーして', 'ページをコピー', 'このページをコピー',
        /copy\s+(the\s+)?(url|link|address)/i],
      action: () => {
        const url = onCopyUrl ? onCopyUrl() : null;
        this.speak(url ? 'URLをコピーしました' : 'コピーするURLがありません');
        return { action: 'copy-url', url };
      },
      description: 'Copy the active page URL to the clipboard'
    });

    // Open the bookmark panel at its history tab — '履歴' alone still
    // toggles the whole panel; these phrases mean "open history".
    this.registerCommand('history', {
      patterns: ['履歴を開いて', '履歴を見て', '履歴を表示', '履歴を見せて',
        '読んだ履歴', '読書履歴', '閲覧した履歴', '訪れたページ',
        '閲覧履歴を見せて', '履歴はどこ', '履歴はどこにある',
        /open\s+(?:the\s+)?history/i, /show\s+(?:the\s+)?history/i,
        /^history$/i, /my history/i, /browsing history/i,
        /pull up (the )?history/i],
      action: () => {
        if (bookmarkPanel) {
          bookmarkPanel.setMode?.('history');
          if (!bookmarkPanel.visible) {
            bookmarkPanel.show?.();
          }
        }
        return { action: 'history' };
      },
      confirmationText: '履歴を開きます',
      description: 'Open the browsing history'
    });

    // Orientation atoms — the screen-reader "say again" (NVDA Insert+T),
    // "where am I" and tab-list announces. No confirmationText: each
    // command's whole output is the announcement itself.
    this.registerCommand('say-again', {
      patterns: ['もう一度', 'もう一回', '聞き直し', 'もう一度言って', '再読み上げ',
        'もう一回聞いて', '聞き直して', 'もう一回言って', '今の行をもう一度',
        'もう一度再生',
        '繰り返して', 'もう一度お願い', '今のを繰り返して', 'リピート',
        'tell me again', 'show me again',
        '今の言葉', 'さっきの言葉',
        '聞き取れなかった', '聞き取れませんでした', 'もう一度聞かせて',
        '復唱して', '言い直し',
        '聞いて', '聞かせて',
        'えっ', '何て', 'なんて', '今何て', 'ん？', 'は？',
        '何って', '今何て言った', '何て言った', '今何て言いました',
        'say it again', 'what was that', 'what was it', 'say what', 'what was that again',
        /repeat( that)?/i, /say (that )?again/i, /read (it|that) again/i,
        /listen again/i, /^(huh|what|pardon|come again|excuse me)\??$/i,
        /repeat yourself/i, /what did (you|it) say/i,
        '意味がわからない', '言ってる意味がわからない', '何言ってるかわからない',
        '何を言ったかわからない', '何言ったか忘れた',
        'what do you mean', 'what did it say', 'what did that say'],
      action: () => {
        this.speak(this._lastSpoken || '直前の発話がありません');
        return { action: 'say-again' };
      },
      description: 'Repeat the last spoken message'
    });

    this.registerCommand('where-am-i', {
      patterns: ['どこ', 'どこにいる', '今どこ', '現在地', '現在のページ', 'このページは', '今どこにいる',
        'ここは', 'ここはどこ', 'フォーカスはどこ', 'どこにフォーカス',
        'フォーカスは', '選択中は', '選択中のもの', '選択されているもの',
        '今いる場所', 'この場所は', 'いまいる場所',
        'どこにいるの', '今どこにいるの', 'どこにいますか', 'どこだっけ',
        'どのタブを見てる', '今どのタブ', '今どのタブを見てる',
        /where\s+am\s+i/i, /what(?:'s| is) (?:this|the) (?:page|site)/i, /what is here/i,
        /which tab am i on/i, /which tab is (this|open)/i,
        /what has focus/i, /focused element/i,
        'what page is this', 'what page am i on', 'which page is this',
        'what site is this', 'which site is this',
        /where are we/i, /where is this/i, /whats? (this|the) (site|page|tab)(?! count)\b/i],
      action: () => {
        const tab = tabManager?.getActiveTab?.();
        this.speak(tab
          ? (tab.describeLocation?.() || tab.currentTitle || tab.currentUrl || 'タイトル不明')
          : 'タブがありません');
        return { action: 'where-am-i' };
      },
      description: 'Announce the current page and reading position'
    });

    this.registerCommand('tabs-list', {
      patterns: ['タブ一覧', 'タブを読み上げ', 'タブを教えて', 'タブはいくつ',
        'タブ一覧を読み上げて', 'タブ一覧を読んで', 'タブを一覧して',
        '開いてるタブ', '開いているタブ',
        'タブの一覧', 'タブリスト', 'タブ全部', '開いてるのは', '開いてるもの',
        'すべてのタブを教えて', 'タブを全部読んで', '一覧を読んで',
        'すべてのタブを読んで', '全部のタブ',
        '何が開いてる', '何が開いてますか', '今何が開いてる',
        '何を開いてる', '開いているもの', '開いてるものは', '開いてるやつ',
        '開いているものは', 'ぜんぶのタブ', 'すべてのタブは',
        '開いてるウィンドウ', '開いているウィンドウ',
        'タブを見せて', 'タブ一覧を見せて', 'タブを見せてほしい',
        'タブを表示して', '開いているものを読んで',
        '見せて', '一覧を見せて', '一覧を出して', '一覧を教えて', '一覧',
        'タブが多すぎる', 'タブが多い', 'タブが増えすぎた', 'タブがいっぱい',
        '開いたタブ全部', 'タブ全部見せて', 'タブを一覧', 'タブの一覧を出して',
        'タブの一覧を見せて',
        'ウィンドウが多い', 'パネルが多い', 'タブが重い', 'タブ多すぎ',
        'ウィンドウが多すぎ', 'タブ多い',
        'list all tabs', 'show all tabs', 'all tabs', 'my tabs',
        'tabs', 'the tabs', 'show me the tabs', 'show me my tabs',
        'give me the tabs', 'list em for me', 'count the tabs', 'how many are open',
        'how many do i have',
        'pull up the tabs', 'pull up tabs', 'bring up the tabs', 'bring up tabs',
        'every tab', 'all of the tabs', 'all of my tabs', 'each tab', 'each of the tabs',
        '全部タブ', 'タブ全部を読んで', 'タブの全部',
        /list\s+tabs/i, /how many tabs/i, /what tabs/i,
        /read (the )?tabs/i, /show (the |me )?(the )?tabs/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        if (!tabs.length) {
          this.speak('タブがありません');
          return { action: 'tabs-list', count: 0 };
        }
        const names = tabs.map((p, i) =>
          (p.currentTitle || p.currentUrl || `タブ${i + 1}`)
          + (i === tabManager.activeIndex ? '（表示中）' : ''));
        this.speak(`${tabs.length}個のタブ。${names.join('、')}`);
        return { action: 'tabs-list', count: tabs.length };
      },
      description: 'Read the open tab list aloud'
    });

    // Immersive video — voice equivalents of the HUD controls so a user
    // watching 360° media can pause/stop without removing the headset's
    // focus from the video. No confirmationText: the spoken line depends on
    // what the host reports.
    this.registerCommand('video-toggle', {
      patterns: ['一時停止', '動画を一時停止', '再生を再開', '再開して',
        '動画を再生', '再生して', 'ポーズ', '再生を再開して',
        'ビデオを再生', 'ビデオを一時停止', 'ビデオをポーズ', 'ビデオを再開',
        '動画をポーズ', 'ビデオを再生して',
        /pause\s+video/i, /resume\s+video/i, /play\s+video/i],
      action: () => {
        const state = onVideoToggle ? onVideoToggle() : null;
        const labels = { playing: '再生を再開します', paused: '一時停止します' };
        this.speak(labels[state] || '再生中の動画がありません');
        return { action: 'video-toggle', state };
      },
      description: 'Pause or resume the immersive video'
    });

    this.registerCommand('video-stop', {
      patterns: ['動画を止めて', '動画停止', 'ビデオを止めて', '再生を止めて',
        '動画を停止', '再生を停止', '曲を止めて', '音楽を止めて', 'メディアを止めて',
        '映像を止めて', /stop\s+(the\s+)?video/i],
      action: () => {
        const stopped = onVideoStop ? onVideoStop() : false;
        this.speak(stopped ? '動画を停止します' : '再生中の動画がありません');
        return { action: 'video-stop', stopped };
      },
      description: 'Stop the immersive video'
    });

    // Bulk close atoms (Chrome tab-strip menu). closeTab keeps the
    // closed-stack rules — private/blank tabs still aren't recorded.
    this.registerCommand('close-other-tabs', {
      patterns: ['他のタブを閉じて', '他のタブを閉じる',
        '他のタブを全部閉じて', 'ほかのタブを全部閉じて',
        'このタブだけ残して', 'このタブだけを残して',
        'このタブ以外を閉じて', 'このタブ以外を全部閉じて',
        'このタブ以外のタブを閉じて', 'このタブ以外をすべて閉じて',
        '残りのタブを閉じて', '残りのタブを全部閉じて',
        'このタブだけ', 'このタブだけ残す', '他を全部閉じて', '他のタブを全部閉めて',
        'close the rest', 'close everything else', 'close all but this',
        'close all except this', 'keep just this one', 'close the others',
        'close other tabs', 'close all the rest',
        'except this one', 'all but this one', 'all but this tab', 'all but one',
        'close all but one', 'close everything except this one', 'close everything but this',
        'このタブ以外', 'このタブ以外のタブ', 'これ以外のタブ', 'これだけ残して',
        /close\s+(the\s+|all\s+the\s+|all\s+)?other\s+tabs/i],
      action: () => {
        tabManager?.closeOtherTabs?.();
        return { action: 'close-other-tabs' };
      },
      confirmationText: '他のタブを閉じます',
      description: 'Close every tab except the active one'
    });

    this.registerCommand('close-tabs-right', {
      patterns: ['右のタブを閉じて', '右側のタブを閉じて', /close\s+tabs?\s+to\s+the\s+right/i],
      action: () => {
        tabManager?.closeTabsToRight?.();
        return { action: 'close-tabs-right' };
      },
      confirmationText: '右側のタブを閉じます',
      description: 'Close every tab to the right of the active one'
    });

    // The left twin (Chrome close-tabs-to-the-right parity). Registered
    // here, before tab-by-name, so '左のタブを閉じて' never searches for a
    // tab literally named '左'.
    this.registerCommand('close-tabs-left', {
      patterns: ['左側のタブを閉じて', '左のタブを閉じて', '左側を閉じて',
        /close\s+tabs?\s+to\s+the\s+left/i, /close\s+tabs?\s+on\s+the\s+left/i],
      action: () => {
        tabManager?.closeTabsToLeft?.();
        return { action: 'close-tabs-left' };
      },
      confirmationText: '左側のタブを閉じます',
      description: 'Close every tab to the left of the active one'
    });

    // Dedupe the strip — "close duplicate tabs" extension parity: tabs
    // showing the same URL as an earlier tab close; the first stays.
    this.registerCommand('close-duplicate-tabs', {
      patterns: ['重複タブを閉じて', '重複したタブを閉じて', '同じタブを閉じて',
        '同じページを閉じて', '重複を閉じて', '重複タブを消して',
        /close duplicate tabs/i, /close duplicated tabs/i],
      action: () => {
        const n = tabManager?.closeDuplicateTabs?.() ?? 0;
        this.speak(n ? `${n}個の重複タブを閉じました` : '重複するタブはありません');
        return { action: 'close-duplicate-tabs', closed: n };
      },
      description: 'Close tabs that duplicate an earlier tab'
    });

    // Inverse of close-all for pinned-app users (Chrome "close unpinned tabs"
    // extension parity): pinned tabs survive, the rest close.
    this.registerCommand('close-unpinned-tabs', {
      patterns: ['ピン留め以外を閉じて', 'ピン以外を閉じて', 'ピン留め以外のタブを閉じて',
        'ピンしていないタブを閉じて', 'ピン留めしていないタブを閉じて',
        '固定以外を閉じて', '固定していないタブを閉じて',
        /close unpinned tabs/i, /close (all )?unpinned/i],
      action: () => {
        const n = tabManager?.closeUnpinnedTabs?.() ?? 0;
        this.speak(n ? `${n}個のタブを閉じました` : 'ピン留め以外のタブはありません');
        return { action: 'close-unpinned-tabs', closed: n };
      },
      description: 'Close every unpinned tab'
    });

    // The normal-browsing twin of close-private-tabs.
    this.registerCommand('close-normal-tabs', {
      patterns: ['通常タブを全部閉じて', '通常のタブを閉じて', '通常タブを閉じて',
        'プライベート以外を閉じて', 'プライベート以外のタブを閉じて',
        'プライベートタブ以外を閉じて',
        /close (all )?(normal|non-?private) tabs/i],
      action: () => {
        const n = tabManager?.closeNormalTabs?.() ?? 0;
        this.speak(n ? `${n}個の通常タブを閉じました` : '通常タブはありません');
        return { action: 'close-normal-tabs', closed: n };
      },
      description: 'Close every non-private tab'
    });

    // Duplicate the active tab (Chrome's "Duplicate tab" context-menu atom).
    this.registerCommand('duplicate-tab', {
      patterns: ['タブを複製', 'タブを複製して', 'タブをコピー', '複製', '複製して',
        'このタブをもう一つ', '同じタブをもう一つ', 'もう一つ同じタブを',
        '今のタブをコピー', 'このタブをコピー',
        'このタブを複製', 'このタブを複製して', '同じタブを開いて',
        '同じタブをもう一つ開いて', 'もう一つ同じのを開いて', '同じのをもう一つ',
        'もうひとつ開いて', 'もう一つ開いて',
        /duplicate (this )?tab/i, /^duplicate$/i, /open (a |another )?copy/i,
        'clone it', 'clone this tab', 'copy this tab', 'duplicate this page', /open a duplicate/i],
      action: () => {
        tabManager?.duplicateTab?.();
        return { action: 'duplicate-tab' };
      },
      confirmationText: 'タブを複製します',
      description: 'Duplicate the active tab'
    });

    // Bookmark the active page — hands-free Ctrl+D. The host owns the store
    // toggle + cross-modal confirmation (decoupled like onClearHistory).
    this.registerCommand('bookmark-page', {
      patterns: [
        'このページをブックマーク', 'ブックマークに追加', 'ブックマークする',
        'ブックマークして', 'ページを保存', 'ページを保存して', 'このページを保存して',
        'お気に入りに追加', 'お気に入り登録', 'お気に入りに登録',
        'しおりを挟んで', '栞を挟んで', 'しおりを挟む',
        '後で読む', 'あとで読む', 'あとで読み直す', 'あとで読み返す', '読書リストに追加',
        '保存して', 'ブックマークに保存', '保存しておいて',
        /(?<!did i )bookmark (this|this page|the page|page)/i,
        /add (this|page) (to )?(bookmarks?|favo?rites)/i, /save (this|the) page/i,
        /add (this |it )?to (the )?reading list/i, /save (this |it )?for later/i,
        /^save it$/i
      ],
      action: () => {
        if (onBookmarkPage) {
          onBookmarkPage();
        }
        return { action: 'bookmark-page' };
      },
      confirmationText: 'ブックマークを切り替えます',
      description: 'Bookmark or unbookmark the active page'
    });

    // Bookmark panel toggle
    this.registerCommand('bookmarks', {
      patterns: ['ブックマーク', 'お気に入り', '履歴',
        'ブックマークを閉じて', 'ブックマークパネルを閉じて',
        'ブックマーク一覧を閉じて', 'お気に入りを閉じて'],
      action: () => {
        bookmarkPanel?.toggle?.();
        return { action: 'bookmarks' };
      },
      confirmationText: 'ブックマークパネルを開きます',
      description: 'Toggle bookmarks panel'
    });

    // Open bookmarks — symmetric with the history open command: forces the
    // bookmarks mode and only shows when not already visible (open≠toggle).
    this.registerCommand('bookmarks-open', {
      patterns: ['ブックマークを開いて', 'ブックマークを見て', 'ブックマークを表示',
        'ブックマークを見せて', 'お気に入りを見せて', 'お気に入りを開いて',
        'お気に入りはどこ', 'ブックマークはどこ', 'お気に入りはどこにある',
        'お気に入り一覧', 'お気に入り一覧を開いて',
        'ブックマーク一覧を開いて', 'ブックマークの一覧を開いて',
        '読書リスト', '読書リストを開いて',
        '保存した記事', '保存ページ', '読みたいリスト', 'リーディングリスト',
        '後で読むリスト', 'ウォッチリスト', '保存したページ', '保存したもの',
        '保存済み', 'お気に入りの記事', 'ブックマークした記事',
        /open (the )?bookmarks/i, /show (the )?bookmarks/i,
        /bring up (the )?bookmarks/i, /open bookmarks/i,
        /^bookmarks$/i, /^favorites$/i, /my (bookmarks|favorites)/i],
      action: () => {
        if (bookmarkPanel) {
          bookmarkPanel.setMode?.('bookmarks');
          if (!bookmarkPanel.visible) {
            bookmarkPanel.show?.();
          }
        }
        return { action: 'bookmarks-open' };
      },
      confirmationText: 'ブックマークを開きます',
      description: 'Open the bookmarks panel'
    });

    // Open ALL bookmarks as tabs — Chrome's "open all bookmarks" context
    // entry. Iterates onBookmarkList and stops at the tab cap honestly
    // ('上限のため残りは開けません'). Registered before go-to's 'を開いて'
    // catch-all.
    this.registerCommand('open-all-bookmarks', {
      patterns: ['お気に入りをすべて開いて', 'お気に入りを全部開いて',
        'ブックマークをすべて開いて', 'ブックマークを全部開いて',
        '全部のブックマークを開いて', 'すべてのブックマークを開いて',
        'ブックマークを全部ひらいて',
        /open all (the |my )?bookmarks/i, /open every bookmark/i],
      action: () => {
        const list = this._onBookmarkList ? this._onBookmarkList() : null;
        if (!list || !list.length) {
          this.speak(list ? 'ブックマークがありません' : 'ブックマーク一覧が利用できません');
          return { action: 'open-all-bookmarks', opened: 0 };
        }
        let opened = 0;
        for (const b of list) {
          const url = typeof b === 'string' ? b : (b && b.url);
          if (!url || !tabManager?.newTab?.(url)) {
            break;
          }
          opened++;
        }
        const left = list.length - opened;
        this.speak(opened
          ? (left ? `${opened}個のブックマークを開きました（上限で残り${left}件は開けません）`
            : `${opened}個のブックマークを開きました`)
          : 'タブを開けません');
        return { action: 'open-all-bookmarks', opened, remaining: left };
      },
      description: 'Open every bookmark as a tab'
    });

    // Keyboard toggle
    this.registerCommand('keyboard', {
      patterns: ['キーボード', 'キーボードを開く', 'キーボードを閉じる',
        'キーボードを出して', 'キーボードを閉じて', 'キーボードを表示',
        'キーボードを出す', 'キーボードをしまって', 'キーボードを隠して',
        'キーボードをしまう', 'キーボードを収納',
        /show keyboard/i, /hide keyboard/i, /^keyboard$/i],
      action: () => {
        if (vrKeyboard) {
          vrKeyboard.visible ? vrKeyboard.hide() : vrKeyboard.show();
        }
        return { action: 'keyboard' };
      },
      confirmationText: 'キーボードを切り替えます',
      description: 'Toggle VR keyboard'
    });

    // Go-to — open a named site from history/bookmarks; fall back to web search.
    // "githubを開く" / "go to github" extracts the site name and hands it to
    // onGoTo, which runs BookmarkStore.search() and navigates to the top hit —
    // or falls back to navigation/search if no frecency match exists. This
    // closes the loop on the autocomplete data layer: a user who has visited
    // github.com 50 times says "open github" and lands there directly instead
    // of at a search-results page.
    //
    // Move a background tab by strip position — Chrome drag-reorder parity,
    // the indexed variant of move-tab-left/right. Must precede go-to: its
    // /^(.+)(?:を開く?|に(?:行く|移動(?:する)?))/ claims 'タブNを左に移動'.
    this.registerCommand('move-tab-n', {
      patterns: [/タブ([0-9]+)を(左|右)に?移動/, /move tab ([0-9]+) (left|right)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+).*(左|右|left|right)/i);
        const n = m ? parseInt(m[1], 10) : 0;
        const left = m ? /左|left/i.test(m[2]) : true;
        const tabs = tabManager?.tabs || [];
        const idx = n - 1;
        if (idx < 0 || idx >= tabs.length) {
          this.speak(`タブ${n}はありません`);
          return { action: 'move-tab-n', index: -1 };
        }
        if (!tabManager.moveTab(idx, left ? -1 : 1)) {
          this.speak('これ以上移動できません');
          return { action: 'move-tab-n', index: idx, moved: false };
        }
        this.speak(`タブ${n}を${left ? '左' : '右'}に移動しました`);
        return { action: 'move-tab-n', index: idx, moved: true };
      },
      description: 'Move the tab at a strip position'
    });

    // Open a saved entry by NAME — the bookmark/history-select atoms'
    // natural-language sibling ('open bookmark news' / 'ブックマークのニュース
    // を開いて'). Registered BEFORE go-to: its `を開く`/`open X` catch-all
    // owns these shapes (verified by dispatch check).
    const openNamed = (name, kind, field, jpPattern, enPattern) =>
      this.registerCommand(name, {
        patterns: [jpPattern, enPattern],
        action: (transcript) => {
          const m = transcript.match(jpPattern) || transcript.match(enPattern);
          const term = m ? m[1].trim() : '';
          const title = this[field] ? this[field](term) : null;
          this.speak(title
            ? `「${title}」を開きます`
            : `「${term}」に一致する${kind}がありません`);
          return { action: name, term, title };
        },
        description: `Open a ${kind} entry by name`
      });
    openNamed('open-bookmark-named', 'ブックマーク', '_onBookmarkOpenNamed',
      /ブックマークの(.+)を開いて/, /open bookmark (.+)/i);
    openNamed('open-history-named', '履歴', '_onHistoryOpenNamed',
      /履歴の(.+)を開いて/, /open history (.+)/i);

    // REGISTERED LAST ON PURPOSE: its `を開く` / `open X` capture is greedy and
    // would otherwise swallow more specific commands (e.g. "キーボードを開く"
    // → keyboard toggle). processCommand matches in registration order and
    // stops at the first hit, so this generic catch-all must come after every
    // specific command to act only on utterances none of them claimed.
    // Open/select the Nth tab — 'open tab 3' and 'タブ3を開いて' read as
    // tab-select phrases but go-to's catch-all owns them (dispatch-verified:
    // the browser was navigating to the literal text 'open tab 3').
    // Registered before go-to so the specific shape wins.
    this.registerCommand('open-tab-n', {
      patterns: [/^(?:open|switch to)\s+tab\s+([0-9]+)/i, /タブ([0-9]+)を開(?:く|いて)/,
        /タブの?\s*([0-9]+)番目/, /タブ\s*([0-9]+)\s*に(?:移動|行って|行く)/],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const tabs = tabManager?.tabs || [];
        if (n < 1 || n > tabs.length) {
          this.speak(`タブ${n}はありません`);
          return { action: 'open-tab-n', index: -1 };
        }
        tabManager.setActive(n - 1);
        const p = tabs[n - 1];
        this.speak(`タブ${n}に切り替えました。${p.currentTitle || p.currentUrl}`);
        return { action: 'open-tab-n', index: n - 1 };
      },
      description: 'Switch to tab N by name'
    });

    // Move the active/indexed tab to a strip edge — Chrome drag-to-edge by
    // voice. Hoisted before go-to: its /に移動/ catch-all owns '右端に移動'
    // and would navigate to the literal phrase (misroute — probe-verified).
    this.registerCommand('move-tab-start', {
      patterns: ['先頭に移動', '左端に移動', '一番左に移動', '最初に移動',
        'タブを先頭に', 'タブを先頭に移動', 'タブを左端に', 'タブを左端に移動',
        'このタブを一番左へ', 'このタブを左端へ', 'このタブを先頭に',
        'タブを先頭に持ってきて', '先頭に持ってきて', '一番左に持ってきて',
        '先頭に移動して', '左端に移動して', '一番左に移動して', '最初に移動して',
        '先頭に送って', '左端に送って', '一番左に送って',
        'put this tab first', 'send this tab to the front', 'bring it to the front',
        'move it to the front',
        /move (this )?tab to (the )?(start|beginning|first|left)/i],
      action: (transcript) => {
        const m = transcript.match(/タブ(\d+)/);
        const idx = m ? Number(m[1]) - 1 : (tabManager?.activeIndex ?? -1);
        const moved = idx >= 0 && !!tabManager && tabManager.moveTabToStart(idx);
        this.speak(moved ? 'タブを先頭に移動しました' : '移動できませんでした');
        return { action: 'move-tab-start', moved };
      },
      description: 'Move the tab to the start of the strip'
    });

    this.registerCommand('move-tab-end', {
      patterns: ['最後に移動', '右端に移動', '一番右に移動', '末尾に移動',
        'タブを最後に', 'タブを最後に移動', 'タブを右端に', 'タブを右端に移動',
        'このタブを一番右へ', 'このタブを右端へ', 'このタブを最後に',
        'タブを最後に持ってきて', '最後に持ってきて', '一番右に持ってきて',
        '最後に移動して', '右端に移動して', '一番右に移動して', '末尾に移動して',
        '最後に送って', '右端に送って', '一番右に送って', '末尾に送って',
        'send this tab to the back', 'put this tab last', 'move it to the end',
        'put it at the end',
        /move (this )?tab to (the )?(end|last|right)/i],
      action: (transcript) => {
        const m = transcript.match(/タブ(\d+)/);
        const idx = m ? Number(m[1]) - 1 : (tabManager?.activeIndex ?? -1);
        const moved = idx >= 0 && !!tabManager && tabManager.moveTabToEnd(idx);
        this.speak(moved ? 'タブを最後に移動しました' : '移動できませんでした');
        return { action: 'move-tab-end', moved };
      },
      description: 'Move the tab to the end of the strip'
    });

    // Move the active tab to an ordinal strip position — the indexed twin of
    // move-tab-start/end (Voice Access 'move to position N' parity). Hoisted
    // before go-to: its /に移動/ catch-all owns '2番目に移動して' and would
    // navigate to the literal text (misroute — probe-verified).
    this.registerCommand('move-tab-to-n', {
      patterns: [/([0-9一二三四五六七八九]+)番目に(?:移動|動か|し)/,
        new RegExp('move (?:the |this )?tab to (?:position |number )?(' + EN_NUM + '|[0-9]+)', 'i')],
      action: (transcript) => {
        const ORD = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
          first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
          seventh: 7, eighth: 8, ninth: 9, tenth: 10,
          one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
        const m = transcript.match(/([0-9一二三四五六七八九]+)番目/)
          || transcript.match(new RegExp('([0-9]+|' + EN_NUM + ')', 'i'));
        const tabs1 = tabManager?.tabs || [];
        const n = m
          ? (/^[0-9]+$/.test(m[1]) ? parseInt(m[1], 10)
            : (m[1].toLowerCase() === 'last' ? tabs1.length : (ORD[m[1].toLowerCase()] || 0)))
          : 0;
        const tabs = tabManager?.tabs || [];
        const cur = tabManager?.activeIndex ?? -1;
        if (n < 1 || n > tabs.length || cur < 0) {
          this.speak(`タブ${n || ''}には移動できません`);
          return { action: 'move-tab-to-n', index: -1 };
        }
        if (n - 1 === cur) {
          this.speak(`すでにタブ${n}番目です`);
          return { action: 'move-tab-to-n', index: cur, moved: false };
        }
        const moved = tabManager.moveTab(cur, n - 1 - cur);
        this.speak(moved ? `タブを${n}番目に移動しました` : '移動できませんでした');
        return { action: 'move-tab-to-n', index: n - 1, moved };
      },
      description: 'Move the active tab to position N'
    });

    // '前回…を開いて'/'閉じたタブを開いて' are session-restore/reopen
    // intents, and 'タブ/メニュー/設定…を開いて' are UI opens, not literal
    // site names — both are passed through via lookaheads.
    const goToJp = new RegExp(
      '^(?!(?:前回|セッション|閉じた))' +
      '(?!.*(?:タブ|メニュー|設定|オプション|環境設定|キーボード|パネル|履歴|ブックマーク|お気に入り|チュートリアル|ガイド|ヘルプ|使い方|読み上げ|音読|プロフィール|アカウント|パスワード)を開)' +
      '(.+)(?:を開く?|に(?:行く|行って|いって|移動(?:する)?)|へ(?:行く|行って|いって))'
    );
    const goToEn = new RegExp('^(?:open|go(?:\\s+to)?|navigate to|fire up|pull up|bring up|open up)\\s+' +
      '(?!the (?:top|bottom|home|end|beginning)\\b|top\\b|bottom\\b|' +
      'home\\b|end\\b|beginning\\b|back\\b|settings\\b|to\\b|forward\\b|up\\b|down\\b|away\\b|off\\b|here\\b|there\\b|now\\b|ahead\\b|right\\b|for\\b|' +
      'inside\\b|outside\\b|tabs\\b)(?!.*\\swindows?$)(.+?)\\b(?<!\\btab)$', 'i');
    this.registerCommand('go-to', {
      patterns: [goToJp, goToEn],
      action: (transcript) => {
        const t = transcript.toLowerCase().trim();
        const jpMatch = t.match(goToJp);
        const enMatch = t.match(goToEn);
        const query = ((jpMatch && jpMatch[1]) || (enMatch && enMatch[1]) || '').trim();
        if (onGoTo && query) {
          onGoTo(query);
        }
        return { action: 'go-to', query: query || null };
      },
      // Immediate "command understood" cue, like search/navigate/top-sites.
      // Spoken via TTS (blind users) and mirrored to captions via onSpeak
      // (deaf/HoH) the moment the command matches — before navigation, and
      // independent of whether a frecency hit is found (WCAG 4.1.3).
      confirmationText: '開きます',
      description: 'Open site by name from history/bookmarks, fall back to search',
      example: 'githubを開く'
    });

    // High-contrast OS-toggle parity (Windows Shift+Alt+PrtSc / macOS
    // Increase Contrast): a voice-only user can't reach the settings switch
    // without leaving immersion. Bare 'ハイコントラスト' toggles; explicit
    // オン/オフ (EN on/off/enable/disable) sets directly.
    this.registerCommand('high-contrast', {
      // 'ハイコントラストは…'/'is high contrast on?' are questions — the
      // lookaheads keep them on contrast-status instead of toggling
      // (dispatch-verified).
      patterns: [/ハイコントラスト(?!は(?:$|どう|か|今|現在|です)|か(?:$|。|？|です))/, /高コントラスト/,
        /(?<!is )high contrast(?!.*(?:is (?:on|off|enabled)))\?*/i],
      action: (transcript) => {
        let want;
        if (/オフ|無効|off|disable/i.test(transcript)) {
          want = false;
        } else if (/オン|有効|on|enable/i.test(transcript)) {
          want = true;
        }
        const v = this._onHighContrast ? this._onHighContrast(want) : null;
        if (v === null) {
          this.speak('ハイコントラストを切り替えられません');
        } else {
          this.speak(v ? 'ハイコントラスト オンです' : 'ハイコントラスト オフです');
        }
        return { action: 'high-contrast', enabled: v };
      },
      description: 'Toggle or set high-contrast mode'
    });

    // Edge/Safari "reading time" parity — minutes estimate for the open
    // article (~500 chars/min, the standard JA silent-reading rate).
    this.registerCommand('reading-time', {
      patterns: ['読了時間', 'この記事の長さ', 'どのくらいで読める',
        '読書時間', '読んだ時間',
        /reading (time|length)/i, /how long (does it take )?to read/i,
        /time spent reading/i],
      action: () => {
        const active = tabManager?.getActiveTab?.();
        const m = active?.getReadingTimeMinutes?.() || null;
        this.speak(m === null ? '記事が開かれていません' : `この記事は約${m}分です`);
        return { action: 'reading-time', minutes: m };
      },
      description: 'Estimated reading time for the open article'
    });

    // Search-engine cycle by name — the settings cycle button's voice
    // surface. Aliases cover JA kana forms of every engine the host offers.
    this.registerCommand('search-engine', {
      // Require を or に — the bare '検索エンジンは' used to match `を?(.+)`
      // and eat the status query ('検索エンジンは' → 'その検索エンジンは使え
      // ません', a wrong-answer lie). The status twin owns the query form.
      patterns: [/検索エンジンを(.+)/, /検索エンジン(.+)に/,
        /(use|switch to|change to|set) (google|bing|duckduckgo|ecosia)/i,
        /(グーグル|google|ビング|bing|ヤフー|yahoo|ダックダックゴー|duckduckgo|エコシア|ecosia)(?:にして|に変更|を使って|で検索|で調べて)/i],
      action: (transcript) => {
        const ALIASES = {
          google: 'google', 'グーグル': 'google',
          bing: 'bing', 'ビング': 'bing',
          duckduckgo: 'duckduckgo', 'ダックダックゴー': 'duckduckgo', 'ダック': 'duckduckgo',
          ecosia: 'ecosia', 'エコシア': 'ecosia'
        };
        const m = transcript.match(/(duckduckgo|ダックダックゴー|ダック|ecosia|エコシア|google|グーグル|bing|ビング)/i);
        const canonical = m ? ALIASES[m[1].toLowerCase()] : null;
        const applied = canonical && this._onSearchEngine ? this._onSearchEngine(canonical) : null;
        this.speak(applied ? `検索エンジンを${applied}にしました` : 'その検索エンジンは使えません');
        return { action: 'search-engine', engine: applied };
      },
      description: 'Switch the search engine by name'
    });

    // Session restore by voice — the restoreTabs setting's on-demand twin
    // (Wolvic 1.9 restore-on-boot, but triggered mid-session).
    this.registerCommand('restore-session', {
      patterns: ['セッションを復元', '前のセッションを復元',
        '前回のタブを開いて', '前回のセッション', '前回のセッションを開いて',
        '最後のセッション', '前回のタブ',
        /restore (my )?(session|previous session|last session)/i],
      action: () => {
        const n = this._onRestoreSession ? this._onRestoreSession() : 0;
        this.speak(n ? `${n}個のタブを復元しました` : '復元するセッションがありません');
        return { action: 'restore-session', restored: n };
      },
      description: 'Restore the previous browsing session tabs'
    });

    // ── Settings toggles by voice ────────────────────────────────────────────
    // The boolean flags live behind the settings panel — out of reach for a
    // voice-only user without leaving immersion. Each command parses an
    // explicit オン/オフ (on/off/enable/disable) when given, and toggles bare.
    // Phrases stay off the 'を開く'/'に行く' suffixes that go-to owns.
    const onOff = (transcript) => {
      if (/オフ|無効|消して|消す|非表示|隠す|隠して|なし|off|disable|hide/i.test(transcript)) {
        return false;
      }
      if (/オン|有効|つけて|つける|見せて|出して|出す|表示|あり|on|enable|show/i.test(transcript)) {
        return true;
      }
      return undefined;
    };
    // Setting-status — the honest query twin of the toggleCmd family: a
    // question like '字幕はオン' must ANSWER, not toggle (Voice Access
    // 'is X on' parity). Read-only getter; unknown keys answer honestly.
    this.registerCommand('settings-status', {
      patterns: [
        '字幕はオン', 'キャプションはオン', '字幕ついてる', 'キャプションついてる',
        '字幕は有効', 'キャプションは有効', '字幕はどう', 'キャプションはどう',
        'ハプティックはオン', 'ハプティックはどう', '振動はオン', '触覚はオン',
        '注視選択はオン', '視線選択はオン', '凝視選択はオン', '注視選択はどう', '視線選択はどう',
        'カーブパネルはオン', '湾曲パネルはオン', 'ウィンドウ追従はオン', 'パネル追従はオン',
        'スナップターンはオン', 'テレポートはオン', 'コンフォートはオン',
        'サウスポーはオン', 'スムーズ移動はオン', 'スムーズ移動はどう',
        'パネルの距離', 'パネル距離は', 'パネルの距離は', 'パネルはどのくらい',
        'モーション感度は', 'モーション感度',
        /are (the )?(captions?|subtitles?) (on|off|enabled)/i,
        /is (the )?(haptics?|gaze( dwell)?|snap turn|teleport)( mode)? (on|off|enabled|active)/i,
        /is (the )?(curved panel|window follow|comfort|southpaw|smooth move|ffr)( mode)? (on|off|enabled|active)/i,
        /(panel|window) distance/i, /^motion sensitivity\??$/i],
      action: (transcript) => {
        const KEYMAP = [
          [/キャプション|字幕|caption|subtitle/i, 'enableCaptions'],
          [/ハプティック|振動|触覚|haptic|vibration/i, 'enableHaptics'],
          [/注視|ゲーズ|視線|凝視|gaze/i, 'enableGazeDwell'],
          [/カーブ|湾曲|曲面|curved/i, 'enableCurvedPanel'],
          [/追従|follow/i, 'enableWindowFollow'],
          [/スナップ|snap/i, 'enableSnapTurn'],
          [/テレポート|teleport/i, 'enableTeleport'],
          [/コンフォート|comfort/i, 'enableComfort'],
          [/ffr/i, 'enableFFR'],
          [/サウスポー|左手|southpaw/i, 'southpaw'],
          [/スムーズ|smooth/i, 'enableSmoothMove', 'スムーズ移動'],
          [/パネル(の)?(距離|はどのくらい)|ウィンドウ距離|panel distance|window distance/i, 'windowDistance', 'パネル距離', { unit: 'メートル' }],
          [/モーション感度|^motion sensitivity\?*$/i, 'motionSensitivity', 'モーション感度',
            { map: { sensitive: '敏感', moderate: '標準', tolerant: '寛容', disabled: '無効' } }]
        ];
        const hit = KEYMAP.find(([re]) => re.test(transcript));
        const key = hit ? hit[1] : null;
        const fmt = hit ? hit[3] : null;
        const LABELS = {
          enableCaptions: 'キャプション', enableHaptics: 'ハプティック',
          enableGazeDwell: '注視選択', enableCurvedPanel: 'カーブパネル',
          enableWindowFollow: 'ウィンドウ追従', enableSnapTurn: 'スナップターン',
          enableTeleport: 'テレポート', enableComfort: 'コンフォート',
          enableFFR: 'FFR', southpaw: 'サウスポー', enableSmoothMove: 'スムーズ移動'
        };
        const label = (hit && hit[2]) || (key ? LABELS[key] : '');
        const v = key && this._onSettingStatus ? this._onSettingStatus(key) : null;
        this.speak(v === null || v === undefined
          ? 'その設定の状態を確認できません'
          : fmt && fmt.unit
            ? `${label} ${v}${fmt.unit}です`
            : fmt && fmt.map
              ? `${label}は${fmt.map[v] || v}です`
              : `${label}は${v ? 'オン' : 'オフ'}です`);
        return { action: 'settings-status', key, enabled: v };
      },
      description: 'Announce a setting\'s current state without toggling it'
    });

    const toggleCmd = (name, key, label, patterns, desc) => this.registerCommand(name, {
      patterns,
      action: (transcript) => {
        const v = this._onSettingToggle ? this._onSettingToggle(key, onOff(transcript)) : null;
        if (v === null) {
          this.speak(`${label}を切り替えられません`);
        } else {
          this.speak(`${label} ${v ? 'オン' : 'オフ'}です`);
        }
        return { action: name, enabled: v };
      },
      description: desc
    });

    toggleCmd('captions-toggle', 'enableCaptions', 'キャプション',
      [/キャプションを(オン|オフ|つけて|消して|出して|見せて)/, /字幕を(つけて|消して|オン|オフ|出して|見せて)/,
        /字幕(?:を)?(?:オン|オフ)/, /キャプション(?:を)?(?:オン|オフ)にして/,
        /字幕(?:を)?消(?:して|す)/, /キャプション(?:を)?消(?:して|す)/,
        /字幕(?:を)?(?:出して|見せて|隠して)/, /キャプション(?:を)?(?:出して|見せて|隠して)/,
        /字幕(?:を)?(?:表示|非表示|出す|つける)/, /キャプション(?:を)?(?:表示|非表示|出す)/,
        '字幕あり', '字幕なし', 'キャプションあり', 'キャプションなし',
        /(captions|subtitles) (on|off)/i, /(enable|disable|turn on|turn off) captions/i,
        /show captions/i, /hide captions/i],
      'Toggle captions');
    toggleCmd('haptics-toggle', 'enableHaptics', 'ハプティック',
      [/ハプティックを(オン|オフ)/, /振動を(オン|オフ|つけて|消して)/, /触覚を(オン|オフ)/,
        /(haptics|vibration) (on|off)/i, /(enable|disable|turn on|turn off) haptics/i],
      'Toggle haptic feedback');
    toggleCmd('gaze-toggle', 'enableGazeDwell', '注視選択',
      [/注視選択を(オン|オフ)/, /ゲーズ選択を(オン|オフ)/,
        /gaze (select|dwell) (on|off)/i, /(enable|disable|turn on|turn off) gaze/i],
      'Toggle gaze-dwell selection');
    toggleCmd('curved-toggle', 'enableCurvedPanel', 'カーブパネル',
      [/カーブパネルを(オン|オフ)/, /湾曲パネルを(オン|オフ)/, /曲面パネルを(オン|オフ)/,
        /curved (panel|screen) (on|off)/i],
      'Toggle the curved panel');
    toggleCmd('follow-toggle', 'enableWindowFollow', 'ウィンドウ追従',
      [/ウィンドウ追従を(オン|オフ)/, /パネル追従を(オン|オフ)/,
        /window follow (on|off)/i, /follow (mode )?(on|off)/i],
      'Toggle head-follow window mode');
    toggleCmd('snapturn-toggle', 'enableSnapTurn', 'スナップターン',
      [/スナップターンを(オン|オフ)/, /snap turn (on|off)/i],
      'Toggle snap turn');

    // Comfort preset — the cycle button's voice surface. Bare 'コンフォート'
    // cycles forward; a named preset lands directly (JA aliases included).
    this.registerCommand('comfort-preset', {
      patterns: [/コンフォート/, /comfort (preset|mode)/i,
        /comfort (to |preset to |mode to )?(sensitive|moderate|tolerant|disabled|off)/i],
      action: (transcript) => {
        const PRESETS = {
          sensitive: 'sensitive', '敏感': 'sensitive',
          moderate: 'moderate', '標準': 'moderate',
          tolerant: 'tolerant', '寛容': 'tolerant',
          disabled: 'disabled', '無効': 'disabled', 'オフ': 'disabled'
        };
        const m = transcript.match(/(sensitive|moderate|tolerant|disabled|敏感|標準|寛容|無効|オフ)/i);
        const preset = m ? PRESETS[m[1]] || PRESETS[m[1].toLowerCase()] : undefined;
        const v = this._onSettingToggle ? this._onSettingToggle('motionSensitivity', preset) : null;
        this.speak(v === null ? 'そのコンフォート設定は使えません' : `コンフォート ${v}です`);
        return { action: 'comfort-preset', preset: v };
      },
      description: 'Cycle or set the motion-comfort preset'
    });

    // Motion sensitivity — comfort-preset's directional twin ('上げて' →
    // sensitive, '下げて' → tolerant, '標準に' → moderate).
    this.registerCommand('motion-sensitivity', {
      patterns: [/モーション感度を?(上げて|上げる|高く|敏感に)/,
        /モーション感度を?(下げて|下げる|低く|弱く)/,
        /モーション感度を?(標準に|普通に)/,
        /motion sensitivity (up|higher|down|lower|to standard)/i],
      action: (transcript) => {
        const preset = /上げ|高く|敏感|up|higher/i.test(transcript) ? 'sensitive'
          : /下げ|低く|弱く|down|lower/i.test(transcript) ? 'tolerant' : 'moderate';
        const JA = { sensitive: '敏感', moderate: '標準', tolerant: '寛容', disabled: '無効' };
        const v = this._onSettingToggle ? this._onSettingToggle('motionSensitivity', preset) : null;
        this.speak(v === null ? 'モーション感度を変更できません' : `モーション感度を${JA[v] || v}にしました`);
        return { action: 'motion-sensitivity', preset: v };
      },
      description: 'Set motion sensitivity by direction'
    });

    // Panel distance — low-vision users pull the reading surface closer
    // without leaving immersion for the settings stepper.
    this.registerCommand('panel-distance', {
      patterns: [/パネルを(近づけて|近く|遠く|遠ざけて)/, /パネルを(近く|遠く)して/,
        /(パネル|画面|ウィンドウ)が?(遠い|遠すぎ|近い|近すぎ)/,
        /(画面|ウィンドウ)を(近づけて|遠ざけて|近く|遠く)/,
        /(パネル|画面|ウィンドウ)を?(大きく|小さく)(して|にして)?/,
        '遠すぎる', '近すぎる', '遠すぎ', '近すぎ',
        '近づけて', '遠ざけて', '近くして', '遠くして', 'もっと近く', 'もっと遠く',
        'もうちょっと大きく', 'もうちょっと小さく',
        '大きく見せて', '小さく見せて', '近くにして', '遠くにして',
        '近くに寄せて', '手前に寄せて', 'こっちに寄せて', '近くに移動',
        '小さくして', '近くで見せて', '近くで', '近くで読みたい',
        'こっちに来て', 'こっちにきて', '手前にして', '手前に来て',
        '奥にして', '奥に動かして', '奥に寄せて',
        /too (far|close)/i,
        /panel (closer|nearer|further|farther|away|bigger|smaller)/i,
        /(move|bring) (it|the panel) closer/i, /push (it|the panel) (away|back)/i,
        /shrink (the )?(panel|window)/i],
      action: (transcript) => {
        // '遠い'/'遠すぎ'/'大きく' are complaints of distance → bring it nearer;
        // '近い'/'近すぎ'/'小さく' are complaints of closeness → push it away.
        const nearer = /近づ|近く|遠い|遠すぎ|大きく|こっち|手前|closer|nearer|bigger|too far|bring/i.test(transcript)
          && !/遠く|遠ざ|近い|近すぎ|小さく|奥|further|farther|away|too close|smaller|push/i.test(transcript);
        const v = this._onPanelDistance ? this._onPanelDistance(nearer ? -0.2 : 0.2) : null;
        this.speak(v === null ? 'パネルはこれ以上移動できません' : `パネル距離 ${v.toFixed(1)}メートル`);
        return { action: 'panel-distance', distance: v };
      },
      description: 'Move the window panel closer or further'
    });

    // Strip-position actions — right-clicking a background tab in Chrome gets
    // Close / Pin without selecting it first. Registered BEFORE tab-select:
    // 'タブ3を閉じて' and 'close tab 3' both contain 'タブ3'/'tab 3', which the
    // select regexes would otherwise claim.
    this.registerCommand('tab-close-n', {
      patterns: [/タブ([0-9]+)を閉じて/, /close tab ([0-9]+)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const tabs = tabManager?.tabs || [];
        const idx = n - 1;
        if (idx < 0 || idx >= tabs.length) {
          this.speak(`タブ${n}はありません`);
          return { action: 'tab-close-n', index: -1 };
        }
        const title = tabs[idx].currentTitle || tabs[idx].currentUrl || `タブ${n}`;
        if (!tabManager.closeTab(idx)) {
          this.speak('ピン留めされたタブは閉じられません');
          return { action: 'tab-close-n', index: idx, closed: false };
        }
        this.speak(`${title}を閉じました`);
        return { action: 'tab-close-n', index: idx, closed: true };
      },
      description: 'Close the tab at a strip position'
    });
    this.registerCommand('tab-pin-n', {
      patterns: [/タブ([0-9]+)をピン/, /タブ([0-9]+)のピンを外/,
        /(un)?pin tab ([0-9]+)/i,
        new RegExp('^(un)?pin (?:the )?(' + EN_NUM + ') tab$', 'i')],
      action: (transcript) => {
        const WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
          seventh: 7, eighth: 8, ninth: 9, tenth: 10,
          one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
        const wm = transcript.match(new RegExp('(' + EN_NUM + ')', 'i'));
        const m = transcript.match(/([0-9]+)/);
        const tabs0 = tabManager?.tabs || [];
        const n = wm ? (wm[1].toLowerCase() === 'last' ? tabs0.length : WORDS[wm[1].toLowerCase()])
          : (m ? parseInt(m[1], 10) : 0);
        const tabs = tabManager?.tabs || [];
        const idx = n - 1;
        if (idx < 0 || idx >= tabs.length) {
          this.speak(`タブ${n}はありません`);
          return { action: 'tab-pin-n', index: -1 };
        }
        const wantUnpin = /^unpin/i.test(transcript) || /ピンを外|ピンが外|ピンをはず|ピンを取/.test(transcript);
        if (wantUnpin && !tabs[idx].pinned) {
          this.speak(`タブ${n}はピン留めされていません`);
          return { action: 'tab-pin-n', index: idx, state: 'unpinned' };
        }
        if (!wantUnpin && tabs[idx].pinned) {
          this.speak(`タブ${n}はすでにピン留めされています`);
          return { action: 'tab-pin-n', index: idx, state: 'pinned' };
        }
        const state = tabManager.togglePin(idx);
        this.speak(state === 'pinned' ? `タブ${n}をピン留めしました` : `タブ${n}のピンを外しました`);
        return { action: 'tab-pin-n', index: idx, state };
      },
      description: 'Toggle the pin on a strip position'
    });

    // Direct tab selection — Chrome Ctrl+1..8 lands on the tab at that strip
    // position (Ctrl+9 → last). The voice equivalent: 'タブ3' / 'tab 3' and
    // '最後のタブ' / 'last tab'. Out-of-range announces honestly instead of
    // clamping (clamping would move the user somewhere they didn't ask for).
    // tab-title-n — tab-select's reporting twin (VoiceOver 'tab N name'
    // parity): answers 'what is tab N called' WITHOUT switching. Registered
    // BEFORE tab-select: its /タブ(\d+)/ prefix match would absorb
    // 'タブNのタイトル' (verified by dispatch check).
    this.registerCommand('tab-title-n', {
      patterns: [/タブ\s*(\d+)のタイトル/, /タブ\s*(\d+)は(何|なん)/,
        /title of tab (\d+)/i, /tab (\d+) title/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const tabs = tabManager?.tabs || [];
        const p = tabs[n - 1];
        if (!p) {
          this.speak(`タブ${n}はありません`);
          return { action: 'tab-title-n', title: null };
        }
        const title = p.currentTitle || p.currentUrl || 'タイトルなし';
        this.speak(`タブ${n}のタイトルは「${title}」です`);
        return { action: 'tab-title-n', title };
      },
      description: 'Announce the title of tab N'
    });
    // pin-select — jump to the first pinned tab (the read twin of pin/unpin:
    // pinned tabs cluster at the strip's left, so 'the pinned tab' is
    // unambiguous). Chrome's Ctrl+1..8 reaches them by position; voice needs
    // the semantic name.
    this.registerCommand('pin-select', {
      patterns: ['ピン留めのタブ', 'ピンのタブ', /^pinned tab$/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        const i = tabs.findIndex((t) => t.pinned);
        if (i < 0) {
          this.speak('ピン留めされたタブがありません');
          return { action: 'pin-select', index: -1 };
        }
        tabManager.setActive(i);
        this.speak(`タブ${i + 1}に切り替えました`);
        return { action: 'pin-select', index: i };
      },
      description: 'Switch to the first pinned tab'
    });
    // reload-all — reload every open tab (Chrome 'Reload all' extension
    // parity). Each panel's own reload() keeps its URL guard, so a fresh
    // empty tab is a no-op rather than an error.
    this.registerCommand('reload-all', {
      patterns: ['すべて再読み込み', '全部再読み込み', 'すべてのタブを再読み込み',
        'reload em all', 'reload all of them', 'refresh them all',
        'refresh all of them', 'refresh every tab', 'reload every tab',
        /reload all( tabs)?/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        tabs.forEach((t) => t.reload?.());
        this.speak(tabs.length
          ? `${tabs.length}個のタブを再読み込みしました` : 'タブがありません');
        return { action: 'reload-all', count: tabs.length };
      },
      description: 'Reload every open tab'
    });
    // tab-by-name — switch by title/url substring instead of position
    // ('tab named news'/'ニュースのタブ' — VoiceOver 'tab by name' parity).
    // Registered AFTER pin-select: its generic /(.+)のタブ/ would steal
    // 'ピン留めのタブ' otherwise.
    // tab-relative — 'N個前/後のタブ' and '最後から/後ろからN番目' switch by
    // position relative to the active tab / counted from the end. Registered
    // before tab-by-name, which would otherwise search '二個前' as a title.
    this.registerCommand('tab-relative', {
      patterns: [/(\d+|[一二三四五六七八九])(?:個|つ)?(前|後)のタブ/,
        /(?:最後から|後ろから)(\d+|[一二三四五六七八九])番目/,
        /^(\d+)(?:st|nd|rd|th)? from (?:the )?(?:end|back|bottom)$/i,
        /^(first|second|third) from (?:the )?(?:end|back|bottom)$/i,
        /^second (to|from) last( tab)?$/i, /^penultimate( tab)?$/i,
        /(この|今の)(次|前)のタブ(?!を)/, /一個?(右|左)のタブ(?!を)/, /^その隣(?!のタブ?を|を)(?:のタブ)?/,
        /^(\d+|one|two|three) tabs? to the (left|right)$/i,
        /^(?:the )?tab to the (right|left)$/i,
        /^(?:the )?tab (?:next to|beside|after|before) (?:this|it|that)$/i,
        /^one tab over$/i, /^the next tab over$/i],
      action: (transcript) => {
        const NUM = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
          first: 1, second: 2, third: 3, penultimate: 2,
          one: 1, two: 2, three: 3 };
        const tabs = tabManager?.tabs || [];
        const cur = tabManager?.activeIndex ?? 0;
        // One-step neighbours wrap like nextTab/prevTab; counted offsets stay
        // strict ('2 tabs to the left' beyond the edge answers honestly).
        let wrap = false;
        let idx = -1;
        let m = transcript.match(/(\d+|[一二三四五六七八九])(?:個|つ)?(前|後)のタブ/);
        if (m) {
          const n = NUM[m[1]] ?? parseInt(m[1], 10);
          idx = cur + (m[2] === '前' ? -n : n);
        } else if ((m = transcript.match(/(?:最後から|後ろから)(\d+|[一二三四五六七八九])番目/))) {
          idx = tabs.length - (NUM[m[1]] ?? parseInt(m[1], 10));
        } else if ((m = transcript.match(new RegExp(
          '^(?:(?:([0-9]+)|first|second|third)(?:st|nd|rd|th)?\\s+(?:from|to)|penultimate)', 'i')))) {
          const n = m[1] ? parseInt(m[1], 10) : NUM[m[0].split(' ')[0].toLowerCase()];
          idx = tabs.length - n;
        } else if ((m = transcript.match(/(\d+|one|two|three) tabs? to the (left|right)/i))) {
          const n = parseInt(m[1], 10) || NUM[m[1].toLowerCase()];
          idx = cur + (m[2].toLowerCase() === 'left' ? -n : n);
        } else if ((m = transcript.match(/(この|今の)(次|前)のタブ/)) ||
            (m = transcript.match(/一個?(右|左)のタブ/))) {
          idx = cur + (m[2] === '前' || m[1] === '左' ? -1 : 1);
          wrap = true;
        } else if (/^(?:the )?tab to the left$/i.test(transcript) ||
            /before (?:this|it|that)/i.test(transcript)) {
          idx = cur - 1;
          wrap = true;
        } else if (/その隣|tab over|next to|beside|after|to the right/i.test(transcript)) {
          idx = cur + 1;
          wrap = true;
        }
        if (wrap && tabs.length) {
          idx = ((idx % tabs.length) + tabs.length) % tabs.length;
        }
        if (idx < 0 || idx >= tabs.length) {
          this.speak('その位置のタブはありません');
          return { action: 'tab-relative', index: -1 };
        }
        tabManager.setActive(idx);
        const t = tabs[idx];
        this.speak(`タブ${idx + 1}。${t.currentTitle || t.currentUrl}`);
        return { action: 'tab-relative', index: idx };
      },
      description: 'Switch to a tab by relative position'
    });

    // tab-audio / tab-meta / conditional — honest-absence atoms: the
    // answers are honest explanations, which beats letting tab-by-name
    // search 'どのタブが音出てる' as a title (probe-verified misroute).
    this.registerCommand('tab-audio', {
      patterns: ['どのタブが音出てる', '音が出てるタブ', '音が出ているタブ',
        '音が鳴ってるタブ', '音が鳴っているタブ', 'どのタブが鳴ってる',
        '音がなるタブ', 'うるさいタブ', 'どこから音が出てる',
        'mute them all', 'mute every tab', 'mute the other tabs', 'silence all tabs',
        new RegExp('mute (?:the )?(?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)? tab', 'i'),
        new RegExp('(?:un)?mute (?:the )?tab (?:number )?(?:' + EN_NUM + '|[0-9]+)', 'i'),
        '鳴りっぱなし', '音が鳴りっぱなし',
        /which tab is (playing|making (noise|sound))/i,
        /what tab is playing/i, /playing audio/i],
      action: () => {
        this.speak('タブごとの音声は検出できません。「ミュート」で全体を消音できます');
        return { action: 'tab-audio' };
      },
      description: 'Explain per-tab audio detection is unavailable'
    });
    this.registerCommand('tab-meta', {
      patterns: ['誰が書いた', '著者は誰', '作者は誰', '書いたのは誰',
        'この記事の著者', '著者を教えて', '作者を教えて',
        '何年の記事', 'いつの記事', 'いつ書かれた', 'いつ公開された',
        '公開日は', '公開日を教えて', '記事の日付', 'いつのニュース',
        /who (wrote|wrote this|is the author)/i, /written by/i,
        /how old is this/i, /when was this (written|published|posted)/i,
        /who is this/i, /who made (this|it)/i, /when was this/i, /when was it/i],
      action: () => {
        this.speak('記事の著者や公開日は読み取れません。「このタブについて」でタイトルとURLを読み上げます');
        return { action: 'tab-meta' };
      },
      description: 'Explain article metadata (author/date) is unavailable'
    });
    this.registerCommand('conditional', {
      patterns: ['読み終わったら閉じて', '読み終わったら', '終わったら教えて',
        '終わったら止めて', '終わったら閉じて', '通知が来たら教えて',
        '通知が来たら', '届いたら教えて', '完了したら教えて',
        'シャッフルして', 'ランダムに開いて', 'ランダムに読んで',
        /when (it'?s |it is )?(done|finished)/i, /let me know when/i,
        /notify me when/i],
      action: () => {
        this.speak('条件付きの操作はまだできません。手順をひとつずつ言ってください');
        return { action: 'conditional' };
      },
      description: 'Explain conditional/deferred commands are unavailable'
    });

    this.registerCommand('tab-by-name', {
      patterns: [new RegExp('^(?!(?:さっき|最後|最初|前|次|ピン|左|右|何番目|何枚目|何個目|現在|このタブ|秘密|シークレット|プライベート|一番左|一番右' +
        '|一つ右|一つ左|ひとつ右|ひとつ左|右隣|左隣|隣|どの|今どの|今|最近|使用中|アクティブな|選択中|幾つ|何個|何個か|いくつか|幾つか|違う|真ん中|左側|右側|もっと))(.+)のタブ(?!を|に|は|のタイトル)'),
      /^tab (?:named|called) (.+)$/i,
      new RegExp('^switch to (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)' +
        '(?:the )?(?!next\\b|previous\\b|(?:' + EN_NUM + ')(?:st|nd|rd|th)?\\s+tab\\b|[0-9]+\\b)(.+) tab$', 'i'),
      /(.+)のタブを(?:開いて|開けて|開く)/,
      new RegExp('^open (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab' +
        '|(?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)(?:the )?(.+) tab$', 'i'),
      new RegExp('^(?:go to|jump to|open) (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)' +
        '(?:the |my )?(.+?) tab$', 'i')],
      action: (transcript) => {
        const swRe = new RegExp('^switch to (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)' +
          '(?:the )?(?!next\\b|previous\\b|(?:' + EN_NUM + ')(?:st|nd|rd|th)?\\s+tab\\b|[0-9]+\\b)(.+) tab$', 'i');
        const goRe = new RegExp('^(?:go to|jump to|open) (?!the (?:' + EN_NUM + '|[0-9]+)(?:st|nd|rd|th)?\\s+tab)' +
          '(?:the |my )?(.+?) tab$', 'i');
        const m = transcript.match(/^(.+)のタブ/) ||
          transcript.match(/^tab (?:named|called) (.+)$/i) ||
          transcript.match(swRe) ||
          transcript.match(goRe);
        const term = (m ? m[1] : '').toLowerCase().trim();
        const tabs = tabManager?.tabs || [];
        const i = tabs.findIndex((t) => {
          const hay = `${t.currentTitle || ''} ${t.currentUrl || ''}`.toLowerCase();
          return term && hay.includes(term);
        });
        if (i < 0) {
          this.speak(`「${term}」のタブがありません`);
          return { action: 'tab-by-name', index: -1 };
        }
        tabManager.setActive(i);
        const p = tabs[i];
        this.speak(`タブ${i + 1}に切り替えました。${p.currentTitle || p.currentUrl}`);
        return { action: 'tab-by-name', index: i };
      },
      description: 'Switch to a tab by title or URL'
    });
    // describe-tab — the richer sibling of title/tab-status: index, title,
    // load state, privacy and pin flags in one line.
    this.registerCommand('describe-tab', {
      patterns: ['このタブについて', 'このタブは', 'タブの状態', 'ページ情報',
        'このページについて', 'ページについて', 'ページについて教えて',
        'どのタブか忘れた', 'どのタブだっけ', 'どのタブを見てる', '今どのタブ',
        'このページの情報', 'サイト情報', 'このサイトの情報',
        'このサイトについて', 'このタブについて教えて',
        'どんなサイト', 'どんなタブ', 'どんなところ', 'どんなページは',
        'ウィンドウについて', 'このウィンドウについて', 'ウィンドウの情報',
        '画面を説明して', '画面の説明', '何が表示されてる', '何が表示されている',
        '画面の内容', '何が見える', 'ページの内容', 'どんなページ',
        'これは何のページ', '何のサイト', 'サイト名', 'サイトの名前',
        '画面について', '何が表示されてますか',
        'これは何', 'これは何のページ', '何これ', 'このページは何',
        'tell me the title', 'show me the page', '見て', 'みて', '見せて',
        '閉じっぱなし', '開きっぱなし', 'つけっぱなし', 'check that out', 'check it out',
        'ご覧になりますか', 'ご覧になります', 'ご覧になりたい', 'ご覧くださいました',
        'can you see this', 'can you see it', '開けっぱなし',
        'ご覧ください', 'ご覧くださいませ', 'bring it up', 'pull it up',
        'queue it up', 'line it up', 'ご覧なさい',
        /did it (load|open|close)/i, /is it open/i, 'still open', 'its still open',
        '閉じたっけ', '閉じるっけ', '閉じてたっけ', '開いてたっけ',
        /たまま$/, /たばかり[。！？!?]?$/, /だまま$/,
        '閉じてはいる', '閉じてるんやったら', '閉じてるんなら',
        'what page', 'what site', 'what page is this', 'what site is this',
        '何のページ', 'ページは何', 'どんなページだ',
        '説明して', '説明してほしい', '内容は',
        'なにこれ', 'これなに', 'あれなに', '何それ', 'それなに', 'なんだこれ', '何だこれ',
        'what is this', 'whats this', 'what am i looking at',
        'lemme see', 'let me see', 'lemme see it', 'let me see it', 'see it', 'see this',
        'lemme see that',
        'アクティブなタブ', '使用中のタブ', '今のタブ', '最近のタブ',
        '閉じてる', '閉じている', '閉じたか', '閉じましたか', '開いてる', '開いている',
        '今見てるタブ', '今見ているタブ', '今開いてるタブ', '選択中のタブ',
        /describe (the )?tab/i, /^page info$/i, /^site info$/i,
        'hows it look', 'how does it look', 'whats on here', 'what does it look like'],
      action: () => {
        const tabs = tabManager?.tabs || [];
        const i = tabManager?.activeIndex ?? -1;
        const p = i >= 0 ? tabs[i] : null;
        if (!p) {
          this.speak('タブがありません');
          return { action: 'describe-tab' };
        }
        const title = p.currentTitle || p.currentUrl || 'タイトルなし';
        const state = p.loading ? '読み込み中' : '読み込み完了';
        const flags = [p.isPrivate ? 'プライベート' : '', p.pinned ? 'ピン留め' : '']
          .filter(Boolean).join('・');
        this.speak(`タブ${i + 1}（全${tabs.length}）。${title}。${state}` +
          `${flags ? `。${flags}` : ''}`);
        return { action: 'describe-tab', index: i };
      },
      description: 'Describe the active tab'
    });
    this.registerCommand('tab-select', {
      patterns: [/タブ([0-9]+)/, /(?<!mute )(?<!unmute )tab (?:number )?([0-9]+)/i,
        /^(?:the )?([0-9]+)(?:st|nd|rd|th)? tab$/i,
        new RegExp('switch to tab (?:number )?([0-9]+|' + EN_NUM + ')', 'i'),
        new RegExp('^(?:switch to|select|open|show|go to|jump to) (?:the )?(' + EN_NUM + ')(?:st|nd|rd|th)? tab$', 'i')],
      action: (transcript) => {
        const WORDS = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6,
          seventh: 7, eighth: 8, ninth: 9, tenth: 10,
          one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
        const wm = transcript.match(new RegExp('(' + EN_NUM + ')', 'i'));
        const m = transcript.match(/([0-9]+)/);
        const tabs0 = tabManager?.tabs || [];
        const n = wm ? (wm[1].toLowerCase() === 'last' ? tabs0.length : WORDS[wm[1].toLowerCase()])
          : (m ? parseInt(m[1], 10) : 0);
        const tabs = tabManager?.tabs || [];
        const idx = n - 1;
        if (idx < 0 || idx >= tabs.length) {
          this.speak(`タブ${n}はありません`);
          return { action: 'tab-select', index: -1 };
        }
        tabManager.setActive(idx);
        const p = tabs[idx];
        this.speak(p.currentTitle || p.currentUrl || `タブ${n}`);
        return { action: 'tab-select', index: idx };
      },
      description: 'Activate the tab at a strip position'
    });
    this.registerCommand('last-tab', {
      patterns: ['最後のタブ', '最後のタブを見せて', '一番右のタブ', '右端のタブ', '右の端のタブ', /last tab/i, /rightmost tab/i,
        '最後のやつ', '末尾のやつ', '最後の方のタブ', 'the last one'],
      action: () => {
        const tabs = tabManager?.tabs || [];
        if (!tabs.length) {
          this.speak('タブがありません');
          return { action: 'last-tab', index: -1 };
        }
        tabManager.setActive(tabs.length - 1);
        const p = tabs[tabs.length - 1];
        this.speak(p.currentTitle || p.currentUrl || `タブ${tabs.length}`);
        return { action: 'last-tab', index: tabs.length - 1 };
      },
      description: 'Activate the last tab (Ctrl+9 parity)'
    });

    // Read the page title — NVDA Insert+T parity. where-am-i describes the
    // whole location; this is the single-line "what page am I on" atom.
    this.registerCommand('title', {
      patterns: ['タイトル', 'このページのタイトル', 'ページ名', 'ページの名前',
        'ページタイトル', '今のページ', 'タブのタイトルは',
        'タブの名前', 'タブ名', 'サイトのタイトル', 'ページ名を教えて',
        'タイトルは',
        /page title/i, /^this page$/i, /^current page$/i,
        /what('s| is|s) (the |this )?(page|title)/i,
        'タイトルを読んで', 'タイトルを教えて',
        /read (the |this )?(page |tab )?title/i],
      action: () => {
        const p = tabManager?.getActiveTab?.() || null;
        if (!p) {
          this.speak('タブがありません');
          return { action: 'title', title: null };
        }
        const title = p.currentTitle || p.currentUrl || 'タイトルなし';
        this.speak(title);
        return { action: 'title', title };
      },
      description: 'Read the active tab title'
    });

    // Mute — the OS/hardware mute-key atom. The hook stores the pre-mute
    // level and restores it on unmute; 'unmute'/'ミュートを解除' pass an
    // explicit want so they can never mute by accident.
    this.registerCommand('mute-toggle', {
      patterns: ['ミュート', 'ミュートを解除', '消音', '消音を解除', '音を消して',
        '静かにして', '無音にして', '静音にして',
        '静音', 'サイレント', 'サイレントモード', '無音', '無音モード',
        '音なし', '音を出さないで', '音を出さない', '音を消す', '消音モード',
        'タブのミュート', 'このタブをミュート', 'タブをミュート', 'タブを消音',
        'このページをミュート', 'ページをミュート', 'サイトをミュート',
        '全部ミュート', '全体をミュート', '消音して', 'ミュートして',
        '音消して', '声を消して', '声を出さないで', '黙らせて',
        '音を切って', '音を切る', 'ミュート解除して', 'ミュートを外して',
        /be quiet/i, /shut up/i, /be silent/i, /^(quiet|silence)( please)?$/i,
        '静かにお願い', '静かにお願いします', '静かにお願いね',
        'ミュートを解除して', '音をつけて', '音をならして', '音ありにして',
        // 'mute the mic' = stop listening; 'mute other tabs' has no per-tab
        // surface — neither should toggle the master volume.
        new RegExp('(un)?mute(?!d\\b)(?!\\s+(?:other\\s+tabs?|the\\s+mic|mic\\b|microphone' +
          '|(the\\s+)?(' + EN_NUM + '|[0-9]+)(st|nd|rd|th)?\\s+tab|tab\\s+(?:number\\s+)?(' + EN_NUM + '|[0-9]+)))', 'i')],
      action: (transcript) => {
        const want = /unmute|解除|戻して|外して|つけて|ならして|ありにして/i.test(transcript)
          ? false : undefined;
        const muted = this._onMute ? this._onMute(want) : null;
        if (muted === null) {
          this.speak('ミュートを切り替えられません');
        } else if (muted) {
          this.speak('ミュート オンです');
        } else {
          this.speak('ミュートを解除しました');
        }
        return { action: 'mute-toggle', muted };
      },
      description: 'Toggle or clear the muted state'
    });

    // ── Numeric steppers by voice ────────────────────────────────────────────
    // The remaining settings steppers (grace window, snap angle, move speed,
    // caption hold, caption height) are unreachable for a voice-only user.
    // One generic onStepper hook serves them all; each command steps by ONE
    // increment of the stepper's own step size, matching the panel's arrows.
    const stepperCmd = (name, key, label, unit, upRe, downRe, patterns, desc) =>
      this.registerCommand(name, {
        patterns,
        action: (transcript) => {
          const dir = upRe.test(transcript) ? 1 : downRe.test(transcript) ? -1 : 0;
          const v = dir && this._onStepper ? this._onStepper(key, dir) : null;
          this.speak(v === null ? `${label}を変更できません` : `${label} ${v}${unit}`);
          return { action: name, value: v };
        },
        description: desc
      });

    // Tremor/nystagmus users widen the grace window (WCAG 2.2.1) — the most
    // accessibility-critical unreachable stepper.
    stepperCmd('grace-time', 'gazeGraceTime', 'グレース時間', 'ミリ秒',
      /長く|up|longer|increase/i, /短く|down|shorter|decrease/i,
      [/グレース時間を(長く|短く)/, /グレースを(長く|短く)/,
        /grace time (up|down|longer|shorter|increase|decrease)/i],
      'Adjust the gaze grace window');
    stepperCmd('snap-angle', 'snapTurnAngle', 'スナップ角', '度',
      /大きく|up|increase|larger/i, /小さく|down|decrease|smaller/i,
      [/スナップ角を(大きく|小さく)/, /snap( turn)? angle (up|down|increase|decrease)/i],
      'Adjust the snap-turn angle');
    stepperCmd('move-speed', 'smoothMoveSpeed', '移動速度', 'メートル毎秒',
      /速く|up|faster|increase/i, /遅く|down|slower|decrease/i,
      [/移動速度を(速く|遅く)/, /move speed (up|down|faster|slower|increase|decrease)/i],
      'Adjust smooth-movement speed');
    stepperCmd('caption-hold', 'captionDuration', 'キャプション保持時間', '秒',
      /長く|up|longer|increase/i, /短く|down|shorter|decrease/i,
      [/キャプションを(長く|短く)/, /caption (time|duration|hold) (up|down|longer|shorter|increase|decrease)/i],
      'Adjust caption hold time');
    stepperCmd('caption-height', 'captionHeight', 'キャプション高さ', 'メートル',
      /上|up|higher|raise/i, /下|down|lower/i,
      [/キャプションを(上|下)(に)?/, /caption (up|down|higher|lower|raise)/i],
      'Raise or lower the caption block');

    // Remaining toggles the generic hook already covers: left/right hand swap
    // (southpaw) and smooth movement (fires the vestibular warning toast via
    // _applyToggle, same as the panel toggle).
    this.registerCommand('southpaw-toggle', {
      patterns: [/利き手を(左|右)(に)?/, '左利き', '右利き',
        /(left|right)[- ]handed/i],
      action: (transcript) => {
        const want = /左|left/i.test(transcript) ? true
          : /右|right/i.test(transcript) ? false : undefined;
        const v = this._onSettingToggle ? this._onSettingToggle('southpaw', want) : null;
        this.speak(v === null ? '利き手を切り替えられません'
          : v ? '利き手を左にしました' : '利き手を右にしました');
        return { action: 'southpaw-toggle', southpaw: v };
      },
      description: 'Swap the dominant hand (southpaw)'
    });
    this.registerCommand('smooth-move-toggle', {
      patterns: [/スムーズ移動を(オン|オフ)/,
        /(smooth move|smooth movement|smooth locomotion) (on|off)/i],
      action: (transcript) => {
        const v = this._onSettingToggle ? this._onSettingToggle('enableSmoothMove', onOff(transcript)) : null;
        this.speak(v === null ? 'スムーズ移動を切り替えられません'
          : `スムーズ移動 ${v ? 'オン' : 'オフ'}です`);
        return { action: 'smooth-move-toggle', enabled: v };
      },
      description: 'Toggle smooth locomotion'
    });

    // Narration pitch — NVDA pitch parity next to the existing rate commands.
    this.registerCommand('speech-pitch', {
      patterns: [/声を(高く|低く)/, /ピッチを(上げて|下げて)/,
        /pitch (up|down|higher|lower)/i],
      action: (transcript) => {
        const up = /高く|up|higher|上げて/i.test(transcript);
        this.setSpeechPitch(this._speechPitch + (up ? 0.25 : -0.25));
        this.speak(`ピッチ ${this._speechPitch}倍`);
        return { action: 'speech-pitch', pitch: this._speechPitch };
      },
      description: 'Adjust narration pitch'
    });

    // Read the current URL — the single-line location atom (title reads the
    // page name; this reads the address).
    this.registerCommand('read-url', {
      patterns: ['URLを教えて', 'URLを読んで', 'アドレスを教えて',
        'URLを表示', 'アドレスを読んで', 'URLは',
        'このページのURL', 'ページのアドレス', 'このページのアドレス', 'URLを言って',
        '今のページのアドレス', '今のページのURL', 'ページURL', 'アドレスを言って',
        '今のURL', '現在のURL', 'アドレスは', 'URLは何',
        /(read|say|what is|what's|whats) (the |this )?(url|address)/i,
        /(page|tab) (url|address)/i],
      action: () => {
        const url = tabManager?.getActiveTab?.()?.currentUrl || '';
        this.speak(url || 'URLがありません');
        return { action: 'read-url', url: url || null };
      },
      description: 'Read the active tab URL'
    });

    // Close all tabs (Chrome's "Close all tabs"). Pinned tabs refuse inside
    // closeTab, so the announce reports what actually happened — and says so
    // when only pinned tabs remain.
    this.registerCommand('close-all-tabs', {
      patterns: ['すべてのタブを閉じて', 'すべてのタブを閉じる', '全部のタブを閉じて',
        '全て閉じて', '全部閉じて', 'タブを全部閉じる', '全部のタブを閉じる',
        '全部タブを閉じて', 'タブを全て閉じて', '全部のタブを消して',
        '全部閉めて', 'すべて閉めて', '全部のタブを閉めて', '全て閉める',
        'タブを全部閉じて', '全タブを閉じて', 'タブ全部閉じて', 'タブをすべて閉じて',
        'タブ全部閉めて', '全タブを閉めて', '全てのタブを閉じて',
        /close\s+all\s+tabs/i, /close (all )?my tabs/i, /^close everything$/i,
        /close all of them/i, /close (them|'em|em) all/i, /^close (em|'em)$/i,
        'close up shop', 'close em down', 'close it all down'],
      action: () => {
        if (!tabManager) {
          this.speak('タブがありません');
          return { action: 'close-all-tabs', closed: 0 };
        }
        const closed = tabManager.closeAllTabs();
        const left = tabManager.tabs.length;
        if (closed === 0) {
          this.speak(left > 0 ? 'ピン留めされたタブは閉じられません' : '閉じられるタブがありません');
        } else {
          this.speak(left > 0
            ? `${closed}個のタブを閉じました。ピン留め${left}個は残ります`
            : `${closed}個のタブを閉じました`);
        }
        return { action: 'close-all-tabs', closed, left };
      },
      description: 'Close every tab (pinned tabs stay)'
    });

    // Direct-select atoms: open the Nth bookmark or history entry in the
    // active tab — tab-select's parity for the saved lists. Out-of-range
    // stays honest ('ブックマークNはありません') rather than clamping.
    this.registerCommand('bookmark-select', {
      patterns: [/ブックマーク\s*(?:の)?\s*(\d+)/, /bookmark\s+(\d+)/i],
      action: (transcript) => {
        const n = Number(transcript.match(/(\d+)/)[1]);
        const title = this._onBookmarkOpen ? this._onBookmarkOpen(n) : null;
        this.speak(title || `ブックマーク${n}はありません`);
        return { action: 'bookmark-select', index: n, title: title || null };
      },
      description: 'Open the Nth bookmark'
    });

    this.registerCommand('history-select', {
      patterns: [/履歴\s*(?:の)?\s*(\d+)\s*番?目?/, /history\s+(\d+)/i],
      action: (transcript) => {
        const n = Number(transcript.match(/(\d+)/)[1]);
        const title = this._onHistoryOpen ? this._onHistoryOpen(n) : null;
        this.speak(title || `履歴${n}番目はありません`);
        return { action: 'history-select', index: n, title: title || null };
      },
      description: 'Open the Nth history entry'
    });

    // Date — the NVDA Insert+F12 pair for 'time': announce today's date.
    this.registerCommand('date', {
      patterns: ['今日の日付', '何月何日', '今日は何日', '日付を教えて',
        '今何曜日', '何曜日', '曜日は', '今日は何曜日',
        '曜日を教えて', '曜日は何', '今日の曜日', '日付は', '日付は何',
        'today is', "what's today", 'whats today',
        '明日の日付', '明日は何日', '明後日', 'あさって', '来週', '来月', '来年',
        '今年', '今日何日', '何日ですか', '明後日は何日',
        /what( is|'s) (the )?date/i, /current date/i, /what day/i,
        /tomorrow/i, /day after tomorrow/i, /next (week|month|year)/i,
        /today'?s? date/i, /^the date$/i, /whats? (is )?(the )?date/i],
      action: (transcript) => {
        const now = new Date();
        const wd = (d) => '日月火水木金土'[d.getDay()];
        if (/明後日|あさって|day after tomorrow/i.test(transcript)) {
          const d = new Date(now); d.setDate(d.getDate() + 2);
          this.speak(`明後日は${d.getMonth() + 1}月${d.getDate()}日（${wd(d)}曜日）です`);
        } else if (/明日|tomorrow/i.test(transcript)) {
          const d = new Date(now); d.setDate(d.getDate() + 1);
          this.speak(`明日は${d.getMonth() + 1}月${d.getDate()}日（${wd(d)}曜日）です`);
        } else if (/来週|next week/i.test(transcript)) {
          const d = new Date(now); d.setDate(d.getDate() + 7);
          this.speak(`来週の今日は${d.getMonth() + 1}月${d.getDate()}日です`);
        } else if (/来月|next month/i.test(transcript)) {
          const d = new Date(now); d.setMonth(d.getMonth() + 1);
          this.speak(`来月は${d.getMonth() + 1}月です`);
        } else if (/来年|next year/i.test(transcript)) {
          this.speak(`来年は${now.getFullYear() + 1}年です`);
        } else if (/今年/.test(transcript)) {
          this.speak(`今年は${now.getFullYear()}年です`);
        } else {
          this.speak(`今日は${now.getMonth() + 1}月${now.getDate()}日（${wd(now)}曜日）です`);
        }
        return { action: 'date' };
      },
      description: 'Announce today\'s date'
    });

    // Saved-list readouts — tabs-list's parity for bookmarks and history.
    // The hook hands back title arrays; counting and the 5-item cap (toc's
    // convention) live here so every list announces the same way.
    const listCmd = (name, label, hook, patterns, desc) => this.registerCommand(name, {
      patterns,
      action: () => {
        const items = hook ? hook() : null;
        const list = Array.isArray(items) ? items : [];
        if (!list.length) {
          this.speak(`${label}がありません`);
          return { action: name, items: [] };
        }
        const shown = list.slice(0, 5).join('、');
        const more = list.length > 5 ? `、他${list.length - 5}件` : '';
        this.speak(`${list.length}個の${label}。${shown}${more}`);
        return { action: name, count: list.length };
      },
      description: desc
    });
    listCmd('bookmarks-list', 'ブックマーク', this._onBookmarkList,
      ['ブックマーク一覧', 'ブックマークを読み上げ', 'ブックマークを読んで',
        'お気に入りを読んで', 'お気に入り一覧を読んで',
        /list\s+(my\s+)?bookmarks/i],
      'Read the bookmark list');
    listCmd('history-list', '履歴', this._onHistoryList,
      ['履歴一覧', '履歴を読み上げ', '履歴を読んで', '履歴を読み上げて',
        '閲覧履歴', 'ブラウザ履歴', 'ウェブ履歴', '検索履歴', '閲覧履歴を読んで',
        '最近の履歴', 'さっきの履歴', '昨日の履歴', '今日の履歴',
        '履歴を一覧', '履歴を全部読んで', '履歴を見て', '履歴を確認',
        '履歴はある', '履歴はあるか', '履歴を教えて',
        /list\s+(my\s+)?history/i],
      'Read the history list');

    // Count twins — the list commands' count-only surface (asking 'how many'
    // shouldn't read the whole list). Field-accessed late-bound hooks.
    const countCmd = (name, kind, unit, field, patterns, desc) =>
      this.registerCommand(name, {
        patterns,
        action: () => {
          const list = this[field] ? this[field]() : null;
          const n = list ? list.length : 0;
          this.speak(n ? `${n}${unit}の${kind}があります` : `${kind}がありません`);
          return { action: name, count: n };
        },
        description: desc
      });
    countCmd('bookmark-count', 'ブックマーク', '個', '_onBookmarkList',
      ['ブックマークは何個', 'ブックマークの数', 'ブックマークはいくつ',
        'お気に入りは何個', 'お気に入りの数', 'お気に入りはいくつ',
        'ブックマークいくつ', 'お気に入りいくつ',
        /how many bookmarks/i, /bookmark count/i],
      'Announce the bookmark count');
    countCmd('history-count', '履歴', '件', '_onHistoryList',
      ['履歴は何件', '履歴は何個', '履歴の数', '履歴はいくつ',
        '履歴いくつ', '履歴の件数',
        /how many (history|entries)/i, /history count/i],
      'Announce the history count');

    // stop-everything — the emergency atom: halt narration AND immersive
    // video in one phrase (stop-reading only covers TTS, video-stop only
    // video). Each half reports what it actually stopped.
    this.registerCommand('stop-everything', {
      patterns: ['すべて止めて', '全部止めて', 'すべてを止めて',
        'キャンセル', 'キャンセルして', '中止して', '止めて', '停止して',
        'やめさせて', '全部やめて', '止めさせて',
        /^cancel( that| it)?$/i,
        /stop everything/i, /stop all/i, /cancel all/i, /cancel everything/i,
        'enough', 'thats enough', 'that will do', 'enough of that',
        'cut it out', 'cut that out', 'knock it off', 'pack it in',
        'wrap it up', 'wrap up', 'call it', 'call it a day', 'call it quits', 'thats a wrap',
        'knock that off', 'cut it', 'quit it', 'quit that', 'cease', 'desist', 'halt',
        'thatll do', 'that will do it', 'thats plenty', 'that is enough',
        'no more of that', 'no more please', 'enough now', 'enough of this',
        'stop doing that', 'wrap this up', 'can it', 'thats quite enough',
        '全部キャンセル', 'すべてキャンセル', '全てキャンセル', '全てやめて', '止めろ', 'やめろ', '止めなさい', '止まれ', 'やまれ', 'とまれ'],
      action: () => {
        const speaking = !!this.synthesis?.speaking || !!this.synthesis?.pending;
        if (this.synthesis?.cancel) {
          this.synthesis.cancel();
        }
        const stoppedVideo = onVideoStop ? onVideoStop() : false;
        this.speak(speaking || stoppedVideo
          ? 'すべて停止しました' : '止めるものはありません');
        return { action: 'stop-everything', speaking, video: stoppedVideo };
      },
      description: 'Stop narration and video'
    });

    // security-status — the lock-icon's spoken twin (Chrome parity): 'is it
    // secure'/'このページは安全ですか' answers from the scheme, honestly.
    this.registerCommand('security-status', {
      patterns: ['このページは安全ですか', '安全かどうか', '安全ですか', 'httpsか',
        '証明書は', '証明書はどう', 'HTTPSですか', '安全なサイトですか',
        'セキュリティ状態', '危険なサイト', 'セキュアですか',
        '危険ですか', '危ないですか', '暗号化されてる', '暗号化されている',
        '暗号化されてますか', '接続は安全', '通信は安全',
        /certificate/i,
        /is (it|this) secure/i, /is this (safe|https)/i, /secure connection/i],
      action: () => {
        const url = tabManager?.getActiveTab?.()?.currentUrl;
        if (!url) {
          this.speak('ページがありません');
          return { action: 'security-status' };
        }
        const https = /^https:/i.test(url);
        this.speak(https
          ? 'https のため接続は暗号化されています'
          : 'http のため暗号化されていません');
        return { action: 'security-status', https };
      },
      description: 'Announce the connection security'
    });
    // hostname — the anti-phishing atom (address-bar domain readout):
    // 'ドメインは'/'hostname' answers the bare host, not the URL string.
    this.registerCommand('hostname', {
      patterns: ['ドメインは', 'どこのサイト', 'サイト名は', /hostname/i,
        'サイトを教えて', 'サイト名を教えて', 'このサイトのドメイン',
        'ドメイン名', 'ホスト名', 'サイトのドメイン名', 'ドメインを教えて',
        '誰のサイト', 'どこのサイトですか', 'URLはどこ', 'アドレスはどこ',
        'サイトのアドレス', 'どこのページ'],
      action: () => {
        const url = tabManager?.getActiveTab?.()?.currentUrl;
        let host = null;
        try {
          host = url ? new URL(url).hostname : null;
        } catch {
          host = null;
        }
        this.speak(host ? `ドメインは${host}です` : 'ドメインがありません');
        return { action: 'hostname', host };
      },
      description: 'Announce the site hostname'
    });
    // copy-line — clipboard twin of read-line ('この行をコピー'): the
    // current reader line goes to the clipboard.
    this.registerCommand('copy-line', {
      patterns: ['この行をコピー', '行をコピーして', /copy (this |the )?line/i],
      action: () => {
        const text = this._onCopyLine ? this._onCopyLine() : null;
        this.speak(text ? '行をコピーしました' : 'コピーする行がありません');
        return { action: 'copy-line', copied: !!text };
      },
      description: 'Copy the current reader line'
    });
    // copy-selection — sub-article copying isn't surfaced; honest pointer
    // beats silently copying the wrong extent or doing nothing.
    this.registerCommand('copy-selection', {
      patterns: ['ここをコピー', 'ここをコピーして', '選択した部分をコピー',
        '選択部分をコピー', 'この段落をコピー', '段落をコピー',
        'リンクのURLをコピー', 'リンク先をコピー',
        '全部選択して', 'すべて選択して', 'テキストを選択', 'テキストをコピー',
        '選択してコピー', '部分をコピー',
        /copy (the |this )?selection/i, /copy this part/i,
        /^select all$/i, /select (the )?(all|page|text|paragraph)/i,
        /copy (the |this )?page/i, /copy (the )?text/i],
      action: () => {
        this.speak('選択部分やリンクのコピーはまだできません。「記事をコピー」「URLをコピー」「行をコピー」はできます');
        return { action: 'copy-selection' };
      },
      description: 'Explain selection/link copy is unavailable'
    });
    // copy-article — the whole-article sibling: reader text to clipboard.
    this.registerCommand('copy-article', {
      patterns: ['記事をコピー', '本文をコピー',
        '全部コピー', 'すべてコピー', 'ページ全体をコピー', '全体をコピー',
        '見えている部分をコピー', 'この部分をコピー',
        /copy (the )?article/i, /copy all/i, /copy (the )?(whole|entire) page/i],
      action: () => {
        const chars = this._onCopyArticle ? this._onCopyArticle() : null;
        this.speak(chars
          ? `記事をコピーしました（${chars}文字）`
          : 'コピーする記事がありません');
        return { action: 'copy-article', chars };
      },
      description: 'Copy the article text'
    });
    // paragraphs-left / headings-left — the 'remaining' twins of
    // sentences-left (reading-progress parity), reusing the same
    // {index,total} surfaces so they can never disagree.
    this.registerCommand('paragraphs-left', {
      patterns: ['残りの段落', 'あと何段落', /paragraphs left/i],
      action: () => {
        const st = this._onParagraphStatus ? this._onParagraphStatus() : null;
        this.speak(st
          ? (st.total - st.index - 1 > 0
            ? `あと${st.total - st.index - 1}段落です` : '最後の段落です')
          : '記事を開いていません');
        return { action: 'paragraphs-left', left: st ? st.total - st.index - 1 : null };
      },
      description: 'Announce remaining paragraphs'
    });
    this.registerCommand('headings-left', {
      patterns: ['残りの見出し', 'あと何見出し', /headings left/i],
      action: () => {
        const st = this._onHeadingHere ? this._onHeadingHere() : null;
        this.speak(st
          ? (st.total - st.index - 1 > 0
            ? `あと${st.total - st.index - 1}見出しです` : '最後の見出しです')
          : '見出しがありません');
        return { action: 'headings-left', left: st ? st.total - st.index - 1 : null };
      },
      description: 'Announce remaining headings'
    });

    // read-heading — heading-here announces index/total; this reads the
    // heading TEXT itself (NVDA 'read current heading' parity).
    this.registerCommand('read-heading', {
      patterns: ['この見出しを読み上げ', '見出しを読んで', '見出しは何',
        '見出しを読み上げて', '見出しを読み上げ', '何見出し目', '見出し番号は',
        '今は何番目の見出し',
        /read (the |current |this )?heading/i, /what('s| is) the heading/i],
      action: () => {
        const h = tabManager?.getActiveTab?.()?.headingHere?.() || null;
        this.speak(h ? `「${h.text}」（${h.index}番目/全${h.total}）`
          : '見出しがありません');
        return { action: 'read-heading', text: h ? h.text : null };
      },
      description: 'Read the current heading'
    });
    // sentence-select — NVDA Alt+Down caret's indexed sibling: 'N番目の文'/
    // 'sentence 3' jumps the caret and speaks the sentence (sentenceAt
    // records the jumpBack mark).
    this.registerCommand('sentence-select', {
      patterns: [/([0-9]+)番目の文/, /sentence ([0-9]+)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const r = tabManager?.getActiveTab?.()?.sentenceAt?.(n);
        if (r === 'out') {
          this.speak(`文${n}はありません`);
          return { action: 'sentence-select', index: -1 };
        }
        this.speak(r
          ? `${r.index}番目の文（全${r.total}）。${r.sentence}`
          : '文がありません');
        return { action: 'sentence-select', index: r ? r.index : -1 };
      },
      description: 'Jump to the Nth sentence'
    });
    // first/last-sentence — the sentence-end atoms (first/lastHeading parity).
    this.registerCommand('first-sentence', {
      patterns: ['最初の文', '最初の文へ', '最初の文を読んで', /first sentence/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.firstSentence?.();
        this.speak(r
          ? `${r.index}番目の文（全${r.total}）。${r.sentence}`
          : '文がありません');
        return { action: 'first-sentence' };
      },
      description: 'Jump to the first sentence'
    });
    this.registerCommand('last-sentence', {
      patterns: ['最後の文', '最後の文へ', '最後の文を読んで', /last sentence/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.lastSentence?.();
        this.speak(r
          ? `${r.index}番目の文（全${r.total}）。${r.sentence}`
          : '文がありません');
        return { action: 'last-sentence' };
      },
      description: 'Jump to the last sentence'
    });
    // char-status / word-status — the caret-position twins: '何文字目'/
    // '何単語目' answer index/total within the caret's line (null until a
    // char/word nav has moved — honest).
    this.registerCommand('char-status', {
      patterns: ['何文字目', '文字の位置', 'この文字', 'この字', '今の文字',
        'この文字は', '今の字', '今の文字は',
        /char(acter)? position/i, /what (letter|character) (is this|is it)/i,
        /^this (character|letter)$/i],
      action: () => {
        const st = tabManager?.getActiveTab?.()?.charStatus?.() || null;
        this.speak(st
          ? `この行の${st.index}文字目（全${st.total}文字）`
          : '文字カーソルはまだ動いていません');
        return { action: 'char-status' };
      },
      description: 'Announce the char-caret position'
    });
    this.registerCommand('word-status', {
      patterns: ['何単語目', '単語の位置', '今の単語', '今の単語は',
        /word position/i, /what word (is this|is it)/i, /^this word$/i],
      action: () => {
        const st = tabManager?.getActiveTab?.()?.wordStatus?.() || null;
        this.speak(st
          ? `この行の${st.index}単語目（全${st.total}単語）`
          : '単語カーソルはまだ動いていません');
        return { action: 'word-status' };
      },
      description: 'Announce the word-caret position'
    });
    // private-count — the privacy query twin (tab-position's subset):
    // 'プライベートタブは何個' counts private tabs on the strip.
    this.registerCommand('private-count', {
      patterns: ['プライベートタブは何個', 'プライベートは何個',
        /how many private tabs/i, /private tabs count/i],
      action: () => {
        const n = (tabManager?.tabs || []).filter((t) => t.isPrivate).length;
        this.speak(n ? `${n}個のプライベートタブがあります` : 'プライベートタブはありません');
        return { action: 'private-count', count: n };
      },
      description: 'Count private tabs'
    });
    // last-command — the action echo ('what did it just do'): answers the
    // last non-repeat transcript, the spoken form of the executed command.
    this.registerCommand('last-command', {
      patterns: ['最後のコマンド', 'さっき何を実行した',
        /last command/i, /what was the last command/i],
      action: () => {
        this.speak(this._repeatableTranscript
          ? `最後のコマンドは「${this._repeatableTranscript}」でした`
          : 'まだコマンドを実行していません');
        return { action: 'last-command' };
      },
      description: 'Echo the last executed command'
    });

    // lines-left — the 'remaining' twin of line-status ('あと何行' answers
    // total-index; sentences-left/paragraphs-left parity).
    this.registerCommand('lines-left', {
      patterns: ['あと何行', '残りの行', /lines left/i, /how many lines left/i],
      action: () => {
        const st = tabManager?.getActiveTab?.()?.lineStatus?.() || null;
        this.speak(st
          ? (st.total - st.index > 0 ? `あと${st.total - st.index}行です` : '最後の行です')
          : '記事を開いていません');
        return { action: 'lines-left', left: st ? st.total - st.index : null };
      },
      description: 'Announce remaining lines'
    });
    // tabs-remaining — the strip-level twin: 'あと何タブ' counts tabs to the
    // right of the active one.
    this.registerCommand('tabs-remaining', {
      patterns: ['あと何タブ', '残りのタブ', /tabs (after|left|remaining)/i],
      action: () => {
        const tabs = tabManager?.tabs || [];
        const i = tabManager?.activeIndex ?? -1;
        const left = i >= 0 ? tabs.length - i - 1 : 0;
        this.speak(left > 0 ? `あと${left}タブです` : '最後のタブです');
        return { action: 'tabs-remaining', left };
      },
      description: 'Announce tabs after the active one'
    });
    // private-list — private-count's readout twin: names the private tabs.
    this.registerCommand('private-list', {
      patterns: ['プライベートタブ一覧', 'プライベート一覧', 'プライベートのみ',
        /private tab list/i, /list private tabs/i,
        /^incognito tabs?$/i, /^private tabs$/i],
      action: () => {
        const privs = (tabManager?.tabs || []).filter((t) => t.isPrivate);
        if (!privs.length) {
          this.speak('プライベートタブはありません');
          return { action: 'private-list', count: 0 };
        }
        const names = privs.slice(0, 5)
          .map((t) => t.currentTitle || t.currentUrl || 'タイトルなし');
        const more = privs.length > 5 ? `、他${privs.length - 5}件` : '';
        this.speak(`${privs.length}個のプライベートタブ。${names.join('、')}${more}`);
        return { action: 'private-list', count: privs.length };
      },
      description: 'List private tabs'
    });
    // line-chars — 'この行は何文字' answers currentLine's length (the line-
    // level twin of getCharCount's article total).
    this.registerCommand('line-chars', {
      patterns: ['この行は何文字', '行の文字数',
        /chars? (in|on) (this|the) line/i, /line length/i],
      action: () => {
        const line = tabManager?.getActiveTab?.()?.currentLine?.();
        this.speak(typeof line === 'string' && line
          ? `この行は${line.length}文字です`
          : '記事を開いていません');
        return { action: 'line-chars' };
      },
      description: 'Announce the current line length'
    });

    // pin-count — private-count's pinned twin.
    this.registerCommand('pin-count', {
      patterns: ['ピン留めは何個', 'ピン留めの数', 'ピンの数',
        /pinned (tab )?count/i, /how many pinned/i],
      action: () => {
        const n = (tabManager?.tabs || []).filter((t) => t.pinned).length;
        this.speak(n > 0 ? `${n}個のピン留めタブがあります` : 'ピン留めタブはありません');
        return { action: 'pin-count', count: n };
      },
      description: 'Announce pinned tab count'
    });
    // pin-list — the readout twin of pin-count (tabs-list for the pinned
    // cluster). Chrome pins have no separate UI surface, so enumerating
    // their titles is the only way a voice user learns what is pinned.
    this.registerCommand('pin-list', {
      patterns: ['ピン留め一覧', 'ピン留めのタブ一覧', 'ピン留めタブ一覧',
        'ピンの一覧', 'ピンを一覧', 'ピン留めを読んで', 'ピン留めを教えて',
        'ピン留めのタブを読んで', 'ピン留めされたタブ',
        /pinned tabs/i, /list (the )?pinned/i, /read (the )?pinned tabs/i,
        /what tabs are pinned/i],
      action: () => {
        const pinned = (tabManager?.tabs || []).filter((t) => t.pinned);
        if (!pinned.length) {
          this.speak('ピン留めタブはありません');
          return { action: 'pin-list', count: 0 };
        }
        const names = pinned.map((t) => t.currentTitle || t.currentUrl || 'タイトルなし');
        this.speak(`ピン留めは${pinned.length}個。${names.join('、')}`);
        return { action: 'pin-list', count: pinned.length };
      },
      description: 'Read the pinned tab titles aloud'
    });
    // mic-status — 'is the mic on' answers the recognizer's isListening flag
    // (wake-word users can't see the OS mic indicator inside the headset).
    this.registerCommand('mic-status', {
      patterns: ['マイクの状態', 'マイクはオン', '聞いていますか',
        '聞こえる', '聞こえますか', '聞こえます', '聞こえてる', '聞こえてますか', '聞こえてます',
        /mic status/i, /is the mic(rophone)? on/i, /can you hear me/i,
        /do you hear me/i, /are you listening/i,
        /mic check/i, /microphone check/i,
        /d?ya hear me/i, /toggle (the )?mic/i, /^mic toggle$/i,
        /flip (the )?mic/i, /switch (the )?mic/i],
      action: () => {
        this.speak(this.isListening ? 'マイクはオンです' : 'マイクはオフです');
        return { action: 'mic-status', listening: this.isListening };
      },
      description: 'Announce whether the mic is listening'
    });
    // history-latest — history-list's 'most recent' twin.
    this.registerCommand('history-latest', {
      patterns: ['最新の履歴', '履歴の最新', '最後に見たページ',
        'さっきの記事', '開いたばかりのページ', 'さっき開いたページ',
        'さっき見た記事', 'さっき読んでたページ',
        '履歴はいつ', 'いつ見た', 'いつ見たっけ', 'いつ見たんだっけ',
        'さっき見たのは', 'さっきのページは', '前のページは',
        'さっきのサイトは', '前に見たサイト', '最後に見たのは',
        '一番最後に見たページ',
        '前に来たことある', '来たことある', '前に見たことある',
        /latest history/i, /most recent (page|history|visit)/i,
        /when did i visit/i, /did i visit/i, /have i been here/i,
        /was i here before/i, /have i been here before/i, /did i (read|see) this( already| before)?/i],
      action: () => {
        const items = this._onHistoryList ? this._onHistoryList() : null;
        const latest = items && items[0];
        this.speak(latest
          ? `最新の履歴は「${latest.title || latest.url || 'タイトルなし'}」です`
          : '履歴がありません');
        return { action: 'history-latest', latest: latest ? latest.title : null };
      },
      description: 'Announce the most recent history entry'
    });
    // bookmark-latest — history-latest's saved-list twin.
    this.registerCommand('bookmark-latest', {
      patterns: ['最新のブックマーク', 'ブックマークの最新', '最後のブックマーク',
        /latest bookmark/i, /most recent bookmark/i],
      action: () => {
        const items = this._onBookmarkList ? this._onBookmarkList() : null;
        const latest = items && items[0];
        this.speak(latest
          ? `最新のブックマークは「${latest.title || latest.url || 'タイトルなし'}」です`
          : 'ブックマークがありません');
        return { action: 'bookmark-latest', latest: latest ? latest.title : null };
      },
      description: 'Announce the newest bookmark'
    });
    // loading-status — describe-tab's single-field twin: 'is it still
    // loading' answers only the flag (privacy-status parity).
    this.registerCommand('loading-status', {
      patterns: ['読み込み中ですか', '読み込みましたか', 'まだ読み込み中',
        '読み込み終わった', '読み込み完了', '更新中ですか', 'まだ読み込んでる',
        '読み込み中？', '読み込みは終わった', '読み込んでいる',
        '読み込んでいますか', '読み込んでる', '読み込み中です', 'まだ読み込み中ですか',
        /is (it|the page) (still )?loading/i, /has it loaded/i],
      action: () => {
        const loading = !!tabManager?.getActiveTab?.()?.loading;
        this.speak(loading ? '読み込み中です' : '読み込みは完了しています');
        return { action: 'loading-status', loading };
      },
      description: 'Announce whether the page is still loading'
    });
    // heading-count — headings-left's total twin.
    this.registerCommand('heading-count', {
      patterns: ['見出しの数', '見出しは何個', '見出しがいくつ',
        /how many headings/i, /heading count/i],
      action: () => {
        const h = tabManager?.getActiveTab?.()?.headingHere?.() || null;
        this.speak(h
          ? `${h.total}個の見出しがあります`
          : '見出しがありません');
        return { action: 'heading-count', count: h ? h.total : 0 };
      },
      description: 'Announce the total heading count'
    });

    // Copy the page title — copy-url's pair for the share surface.
    this.registerCommand('copy-title', {
      patterns: ['タイトルをコピー', 'ページ名をコピー',
        /copy\s+(the\s+)?(page\s+)?title/i],
      action: () => {
        const title = this._onCopyTitle ? this._onCopyTitle() : null;
        this.speak(title ? 'タイトルをコピーしました' : 'コピーするタイトルがありません');
        return { action: 'copy-title', title: title || null };
      },
      description: 'Copy the page title to the clipboard'
    });

    // Read from the visible position — NVDA read-from-current-position
    // parity. readAloud owns the start/nothing-to-read announcements.
    this.registerCommand('read-here', {
      patterns: ['ここから読み上げ', 'ここから読み上げて', 'ここから読んで',
        'ここを読んで', 'この辺を読んで',
        '続きを読んで', '続きから読んで',
        '残りを読んで', '残り全部読んで', '残りを全部読んで',
        '続きを全部読んで', 'あとの文を読んで',
        'つづきから', 'つづきから読んで', '途中から読んで', 'つづきを読んで',
        '続きは', 'つづきは', '残りは', '次の部分', '次の部分を読んで', 'あとは',
        '途中から', '途中から読み上げて', '途中から読み上げ',
        '最後まで読んで', 'あと全部読んで', '残り全部', 'あとを読んで',
        'この先を読んで', '続きをすべて読んで',
        /read\s+from\s+here/i, /read\s+from\s+(the\s+)?current/i,
        /continue reading/i],
      action: () => {
        const chunks = this._onReadHere ? this._onReadHere() : null;
        this.readAloud(chunks);
        return { action: 'read-here' };
      },
      description: 'Read aloud from the current position'
    });

    // History search — announce the hit count plus the most recent match.
    // 'を探して' stays with find-in-page (it owns that phrasing); use
    // '検索'/'調べて' here instead.
    this.registerCommand('history-search', {
      patterns: [
        /履歴(?:から|で|を)\s*(.+?)\s*(?:を|で)?(?:検索|調べて?)/,
        /履歴(?:の中)?(?:から|を|で)?\s*(?:検索|調べ)/,
        /history\s+search\s+(?:for\s+)?(.+)/i,
        /search\s+history\s+(?:for\s+)?(.+)/i
      ],
      action: (transcript) => {
        const m = transcript.match(/履歴(?:から|で|を)\s*(.+?)\s*(?:を|で)?(?:検索|調べて?)/)
          || transcript.match(/history\s+search\s+(?:for\s+)?(.+)/i)
          || transcript.match(/search\s+history\s+(?:for\s+)?(.+)/i);
        const term = (m && m[1] ? m[1] : '').trim();
        if (!term) {
          this.speak('履歴で検索する語を言ってください');
          return { action: 'history-search', term: '', count: 0 };
        }
        const res = this._onHistorySearch ? this._onHistorySearch(term) : null;
        this.speak(res
          ? `${res.count}件見つかりました。最近: ${res.title}`
          : `${term}は履歴にありません`);
        return { action: 'history-search', term, count: res ? res.count : 0 };
      },
      description: 'Search the browsing history'
    });

    // Reading progress — '進捗' announces how much of the article is done.
    this.registerCommand('reader-progress', {
      patterns: ['進捗', '何%読んだ', 'どれくらい読んだ', 'どのくらい読んだ',
        'どこまで読んだ', '読了ですか', 'スクロール位置', '今どのあたり', 'どのあたり',
        'ページ数は', '全部で何ページ', '何ページある', 'ページ数を教えて',
        'あと何ページ', '残り何ページ', '残りは何ページ', 'あと何ページある',
        'あと何枚', '残り何枚', '残りは何枚', 'あと何枚ある',
        /how many pages (?:are )?(?:left|remain|remaining)/i,
        '読み終わった', '読み終わり', '読了', '読み終わったとき',
        '読み上げが終わった', '読み上げ終わった', '読み上げは終わった',
        'どこまで読み終わった', '読み終えた', '読み終えました', '読了した',
        'done reading', 'finished reading', 'im done reading', 'finished the article',
        'finished it', 'all done reading',
        'まだ読んでる', '読んでる途中', '半分読んだ', '半分まで読んだ', 'もう半分',
        'ページの先頭にいる', '先頭にいる', 'どのくらい進んだ', 'どこまで来た',
        /reading\s+progress/i, /how\s+much\s+(have\s+i\s+)?read/i,
        /scroll position/i, /am i at the top/i, /are we at the bottom/i,
        /how far (along|have i (read|got))/i,
        'at the bottom yet', 'did i reach the end', 'how far down are we',
        'whats my position', 'what is my position', 'am i near the end',
        'almost there', 'nearly there', 'almost done', 'nearly done'],
      action: () => {
        const pct = this._onReaderProgress ? this._onReaderProgress() : null;
        this.speak(pct === null ? '記事を開いていません'
          : `記事の${pct}%を読みました`);
        return { action: 'reader-progress', pct };
      },
      description: 'Announce reading progress'
    });

    // Bookmark search — history-search's pair over the saved list.
    this.registerCommand('bookmark-search', {
      patterns: [
        /ブックマーク(?:から|で|を)\s*(.+?)\s*(?:を|で)?(?:検索|調べて?)/,
        /ブックマーク(?:の中)?(?:から|を|で)?\s*(?:検索|調べ)/,
        /bookmark\s+search\s+(?:for\s+)?(.+)/i,
        /search\s+bookmarks?\s+(?:for\s+)?(.+)/i
      ],
      action: (transcript) => {
        const m = transcript.match(/ブックマーク(?:から|で|を)\s*(.+?)\s*(?:を|で)?(?:検索|調べて?)/)
          || transcript.match(/bookmark\s+search\s+(?:for\s+)?(.+)/i)
          || transcript.match(/search\s+bookmarks?\s+(?:for\s+)?(.+)/i);
        const term = (m && m[1] ? m[1] : '').trim();
        if (!term) {
          this.speak('ブックマークを検索する語を言ってください');
          return { action: 'bookmark-search', term: '', count: 0 };
        }
        const res = this._onBookmarkSearch ? this._onBookmarkSearch(term) : null;
        this.speak(res
          ? `${res.count}件見つかりました。最初: ${res.title}`
          : `${term}はブックマークにありません`);
        return { action: 'bookmark-search', term, count: res ? res.count : 0 };
      },
      description: 'Search the bookmark list'
    });

    // Jump to the Nth find hit — findNextMatch's indexed sibling
    // (reader-goto-line's announce shape).
    this.registerCommand('find-match-select', {
      patterns: [/(\d+)\s*(?:番目?|件目?)\s*(?:の)?\s*(?:ヒット|結果)/,
        /ヒット\s*(\d+)/, /match\s+(\d+)/i, /hit\s+(\d+)/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
        const res = this._onFindMatch ? this._onFindMatch(n) : null;
        this.speak(res === 'out' ? `ヒット${n}はありません`
          : res === null ? '検索をしていません'
            : `${n}件目に移動しました`);
        return { action: 'find-match-select', index: n, res };
      },
      description: 'Jump to the Nth find hit'
    });

    // Remaining reading time — getReadingTimeMinutes scaled by progress.
    this.registerCommand('remaining-time', {
      patterns: ['あと何分', '残り何分', 'どれくらい残り', 'あとどれくらい',
        'あとどのくらい', '残り時間は', '残り時間', '残りはどれくらい',
        'どれくらい残ってる', 'あとどのくらい残ってる', 'あとどれくらい残ってる',
        '読了まで', '読み終わるまで', 'あとどれくらいで終わる', '終わるまであと',
        'あと何分で読み終わる', '読み終わりまで', 'あと何分で終わる', '残りの時間',
        'あとどのくらいで終わる',
        'あとどのくらい読む', '何分残ってる', 'あと何分くらい', '残りは何分',
        'あと少し', 'あとちょっと', 'もう少しで終わる', 'あと少しで終わる',
        /how much longer/i, /time left/i, /minutes left/i,
        'how much left', 'how much more', 'whats left', 'how much is left',
        'whats remaining', 'how much remains'],
      action: () => {
        const mins = this._onRemainingTime ? this._onRemainingTime() : null;
        this.speak(mins === null ? '記事を開いていません'
          : `残り約${mins}分です`);
        return { action: 'remaining-time', minutes: mins };
      },
      description: 'Announce remaining reading time'
    });

    // Jump to the Nth heading — nextHeading's indexed sibling
    // (find-match-select parity).
    this.registerCommand('heading-select', {
      patterns: [/(\d+)\s*(?:番目?|件目?)\s*(?:の)?\s*見出し/, /見出し\s*(\d+)/,
        /heading\s+(\d+)/i,
        /(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) heading/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const w = transcript.match(/(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) heading/i);
        const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
        const n = m ? Number(m[1]) : w ? ORD[w[1].toLowerCase()] : 0;
        const res = this._onHeadingSelect ? this._onHeadingSelect(n) : null;
        this.speak(res === 'out' ? `見出し${n}はありません`
          : res === null ? '見出しがありません'
            : `${res.index}番目の見出し（全${res.total}）`);
        return { action: 'heading-select', index: n, res };
      },
      description: 'Jump to the Nth heading'
    });

    // Find position without moving — the status-query sibling of
    // find-next (volume-status parity). 'find status' stays with
    // find-in-page — searching for the word is a legitimate query.
    this.registerCommand('find-status', {
      patterns: ['何件目', 'ヒットは何件', '何件ヒット',
        '見つからなかった', '見つからない', 'ヒットしない', '何件見つかった',
        'ヒット数', '見つかった数', 'ヒットは何個',
        '検索結果は何件', '件数は', '検索ヒット数', '検索結果の数',
        /how many (matches|hits)/i],
      action: () => {
        const res = this._onFindStatus ? this._onFindStatus() : null;
        this.speak(res ? `${res.total}件中${res.index}件目`
          : '検索をしていません');
        return { action: 'find-status', res };
      },
      description: 'Announce the current find position'
    });

    // First / last find hit — find-match-select's tail siblings.
    this.registerCommand('find-first', {
      patterns: ['最初のヒット', '最初の結果', /first (match|hit|result)/i,
        /^find first$/i],
      action: () => {
        const res = this._onFindMatch ? this._onFindMatch(1) : null;
        this.speak(res === 'out' || res === null ? '検索をしていません'
          : '1件目に移動しました');
        return { action: 'find-first', res };
      },
      description: 'Jump to the first find hit'
    });

    this.registerCommand('find-last', {
      patterns: ['最後のヒット', '最後の結果', /last (match|hit|result)/i,
        /^find last$/i],
      action: () => {
        const res = this._onFindLast ? this._onFindLast() : null;
        this.speak(res === null ? '検索をしていません'
          : `${res.index}件目に移動しました`);
        return { action: 'find-last', res };
      },
      description: 'Jump to the last find hit'
    });

    // Read the line under the scroll — VoiceOver "read current line"
    // parity (say-again reads the caption, this reads the article).
    this.registerCommand('read-line', {
      patterns: ['この行を読んで', '今の行を読んで', '現在の行を読み上げ',
        '行を読んで', '今の行を読み上げて', '今の行を読み上げ',
        /read (the )?(current )?line/i],
      action: () => {
        const line = this._onReadLine ? this._onReadLine() : null;
        this.speak(line || '記事を開いていません');
        return { action: 'read-line', line };
      },
      description: 'Read the current reader line'
    });

    // Paragraph navigation — NVDA/JAWS Ctrl+Down/Ctrl+Up parity. Same
    // wrap-and-announce shape as next-heading.
    this.registerCommand('next-paragraph', {
      patterns: ['次の段落', '段落を進め', '読み上げをスキップ', '次をスキップ',
        // 'skip ahead' is end-anchored so 'skip ahead 4 paragraphs' reaches
        // paragraph-skip-n instead of stepping once.
        'スキップして', '先読みして', '読み飛ばして',
        '飛ばして', '読み飛ばす', '飛ばす',
        'もう一段落', 'もう一段落読んで', '次の段落を読んで',
        /next\s+paragraph/i, /skip ahead\s*$/i, /skip (the |this |current |next )?paragraph/i],
      action: () => {
        const r = this._onParagraphStep ? this._onParagraphStep(1) : null;
        this.speak(r ? `${r.index}番目の段落（全${r.total}）` : '段落がありません');
        return { action: 'next-paragraph', ...r };
      },
      description: 'Jump to the next paragraph'
    });

    // 'Nつ先/前の段落' — next/prev-paragraph's counted sibling (Voice Access
    // 'skip ahead N' parity). Same relative stepper, just N steps.
    this.registerCommand('paragraph-skip-n', {
      patterns: [/([0-9]+|[一二三四五六七八九])\s*(?:つ|個)?先の段落/,
        /([0-9]+|[一二三四五六七八九])\s*(?:つ|個)?前の段落/,
        /skip (?:ahead|forward) (\d+) paragraphs?/i,
        /go back (\d+) paragraphs?/i],
      action: (transcript) => {
        const KANJI = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
        const m = transcript.match(/([0-9]+|[一二三四五六七八九])/);
        const n = m ? (KANJI[m[1]] || Number(m[1]) || 0) : 0;
        const back = /前の段落|back/i.test(transcript);
        const r = this._onParagraphStep ? this._onParagraphStep(back ? -n : n) : null;
        this.speak(r ? `${r.index}番目の段落（全${r.total}）` : '段落がありません');
        return { action: 'paragraph-skip-n', ...r };
      },
      description: 'Skip N paragraphs ahead or back'
    });

    this.registerCommand('prev-paragraph', {
      patterns: ['前の段落', '段落を戻し', /prev(?:ious)?\s+paragraph/i],
      action: () => {
        const r = this._onParagraphStep ? this._onParagraphStep(-1) : null;
        this.speak(r ? `${r.index}番目の段落（全${r.total}）` : '段落がありません');
        return { action: 'prev-paragraph', ...r };
      },
      description: 'Jump to the previous paragraph'
    });

    // Read paragraph N aloud — read-from-line's paragraph sibling. Must beat
    // paragraph-select: its /(\d+)番目の段落/ regex swallows 'N番目の段落を読み上げ'.
    this.registerCommand('read-paragraph-at', {
      patterns: [/(\d+)\s*番目?の?段落を読み上げ/, /(\d+)\s*番目?の?段落を読んで/,
        /(?:最初|最後)の段落を読(?:んで|み上げ)/, /read paragraph (\d+)/i],
      action: (transcript) => {
        let n;
        if (/最後/.test(transcript)) {
          const st = this._onParagraphStatus ? this._onParagraphStatus() : null;
          n = st?.total ?? null;
          if (!n) {
            this.speak('段落がありません');
            return { action: 'read-paragraph-at', index: null };
          }
        } else if (/最初/.test(transcript)) {
          n = 1;
        } else {
          const m = transcript.match(/(\d+)/);
          n = m ? Number(m[1]) : 0;
        }
        const chunks = this._onReadParagraphAt ? this._onReadParagraphAt(n) : [];
        if (chunks === 'out') {
          this.speak(`段落${n}はありません`);
        } else {
          this.readAloud(Array.isArray(chunks) ? chunks : [],
            { statusText: `${n}番目の段落を読み上げます` });
        }
        return { action: 'read-paragraph-at', index: n,
          chunks: Array.isArray(chunks) ? chunks.length : chunks };
      },
      description: 'Read the Nth paragraph aloud'
    });

    // Indexed + status variants — heading-select / find-status parity.
    this.registerCommand('paragraph-select', {
      patterns: [/(\d+)\s*(?:番目?|件目?)\s*(?:の)?\s*段落/, /段落\s*(\d+)/,
        /paragraph\s+(\d+)/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
        const res = this._onParagraphSelect ? this._onParagraphSelect(n) : null;
        this.speak(res === 'out' ? `段落${n}はありません`
          : res === null ? '段落がありません'
            : `${res.index}番目の段落（全${res.total}）`);
        return { action: 'paragraph-select', index: n, res };
      },
      description: 'Jump to the Nth paragraph'
    });

    this.registerCommand('paragraph-status', {
      patterns: ['何段落', '段落はいくつ', 'どの段落', 'この段落は', '現在の段落は',
        '段落は', '全部で何段落', 'この記事は何段落', '総段落数', '段落数は',
        '何段落目', '現在何段落', '段落番号は', '今の段落は', '今は何段落目', '今の段落',
        /which paragraph/i, /paragraph (count|position|status)/i],
      action: () => {
        const res = this._onParagraphStatus ? this._onParagraphStatus() : null;
        this.speak(res ? `全${res.total}段落の${res.index}段落目`
          : '記事を開いていません');
        return { action: 'paragraph-status', res };
      },
      description: 'Announce the current paragraph position'
    });

    // First/last paragraph — first-heading/last-heading's paragraph siblings.
    this.registerCommand('first-paragraph', {
      patterns: ['最初の段落', /first paragraph/i],
      action: () => {
        const res = this._onParagraphSelect ? this._onParagraphSelect(1) : null;
        this.speak(res ? `1番目の段落（全${res.total}）` : '段落がありません');
        return { action: 'first-paragraph', res };
      },
      description: 'Jump to the first paragraph'
    });
    this.registerCommand('last-paragraph', {
      patterns: ['最後の段落', /last paragraph/i],
      action: () => {
        const res = this._onLastParagraph ? this._onLastParagraph() : null;
        this.speak(res ? `最後の段落（全${res.total}）` : '段落がありません');
        return { action: 'last-paragraph', res };
      },
      description: 'Jump to the last paragraph'
    });

    // Article character count — the reading-time numerator as a status atom.
    this.registerCommand('char-count', {
      patterns: ['何文字', '文字数', '記事の文字数', /how many characters/i,
        '記事の長さ', 'このページの長さ', 'どのくらいの長さ',
        'どれくらいの長さ', '記事の長さは',
        '文字数は', 'あと何文字', '残りの文字数', '残り何文字', '文字数を教えて',
        '単語数', '何単語', '全部で何文字',
        /character count/i, /word count/i, /how many (words|characters)/i],
      action: () => {
        const chars = this._onCharCount ? this._onCharCount() : null;
        this.speak(chars === null ? '記事を開いていません'
          : `記事は${chars}文字です`);
        return { action: 'char-count', chars };
      },
      description: 'Announce the article character count'
    });

    // Read the paragraph under the scroll — NVDA "read current paragraph"
    // parity; read-aloud's block-scoped sibling. readAloud handles the
    // empty-list (title region / no article) announce itself.
    this.registerCommand('read-paragraph', {
      patterns: ['この段落を読み上げ', '現在の段落を読み上げ', '段落を読んで',
        '今の段落を読んで', 'この段落を読み上げて', 'その段落を読んで',
        'その段落を読み上げて',
        /read (the )?(current )?paragraph/i],
      action: () => {
        const chunks = this._onReadParagraph ? this._onReadParagraph() : [];
        this.readAloud(chunks);
        return { action: 'read-paragraph', chunks: chunks.length };
      },
      description: 'Read the current paragraph aloud'
    });

    // Sentence layer — NVDA/JAWS Alt+Down/Alt+Up parity. The caret walks
    // source-block sentences (a sentence spanning display lines is still
    // spoken whole); the scroll follows the line holding its start.
    this.registerCommand('next-sentence', {
      patterns: ['次の文', '文を次へ', '一文進め', 'もう一文',
        'もう一文読んで', '一文進んで', /next sentence/i],
      action: () => {
        const r = this._onSentenceStep ? this._onSentenceStep(1) : null;
        this.speak(r ? r.sentence : 'これ以上進めません');
        return { action: 'next-sentence', sentence: r ? r.sentence : null };
      },
      description: 'Speak the next sentence (NVDA Alt+Down)'
    });
    this.registerCommand('prev-sentence', {
      patterns: ['前の文', '前の文を読んで', '文を前へ', '一文戻し',
        'さっきの文', 'さっきの文を読んで', '前の文に戻って', '文を戻して',
        '一文戻って',
        /prev(?:ious)? sentence/i, /read (the )?prev(?:ious)? sentence/i],
      action: () => {
        const r = this._onSentenceStep ? this._onSentenceStep(-1) : null;
        this.speak(r ? r.sentence : 'これ以上戻れません');
        return { action: 'prev-sentence', sentence: r ? r.sentence : null };
      },
      description: 'Speak the previous sentence (NVDA Alt+Up)'
    });

    // Read the sentence under the scroll — read-line's sentence sibling.
    this.registerCommand('read-sentence', {
      patterns: ['この文を読んで', 'この文を読み上げ', '文を読んで', '現在の文',
        '今の文を読み直して', 'この文を読み直して', '文を読み直して',
        '今の文', 'この文', '読み上げ中の文', '現在の文章', 'この文章',
        /read (this |the |current )?sentence/i],
      action: () => {
        const r = this._onSentence ? this._onSentence() : null;
        this.speak(r ? r.sentence : '文がありません');
        return { action: 'read-sentence', sentence: r ? r.sentence : null };
      },
      description: 'Read the current sentence'
    });
    this.registerCommand('sentence-status', {
      patterns: ['何文目', '現在何文目', 'どの文', 'この文は', '文は',
        '全部で何文', 'この記事は何文', '総文数', '文数は',
        /which sentence/i, /sentence (position|status)/i],
      action: () => {
        const res = this._onSentenceStatus ? this._onSentenceStatus() : null;
        this.speak(res ? `現在${res.index}文目（全${res.total}文）`
          : '記事を開いていません');
        return { action: 'sentence-status', res };
      },
      description: 'Announce the current sentence position'
    });

    // Char caret — NVDA/JAWS Left/Right single-character review, the finest
    // reading grain below word-nav.
    this.registerCommand('next-char', {
      patterns: ['次の文字', '文字を次へ', /next char(?:acter)?/i,
        '一文字進んで', '一文字進む', '一文字次', 'ひと文字', 'ひと文字進んで',
        '次の文字へ', '次の文字に', '一文字ずつ進んで', '次の一文字'],
      action: () => {
        const r = this._onCharStep ? this._onCharStep(1) : null;
        this.speak(r ? r.char : 'これ以上進めません');
        return { action: 'next-char', char: r ? r.char : null };
      },
      description: 'Speak the next character (NVDA Right arrow)'
    });
    this.registerCommand('prev-char', {
      patterns: ['前の文字', '文字を前へ', /prev(?:ious)? char(?:acter)?/i,
        '一文字戻る', '一文字戻って', '一文字前', 'ひと文字戻る', 'ひと文字前',
        '前の文字へ', '前の文字に', '文字を一つ戻る', '一文字ずつ戻る'],
      action: () => {
        const r = this._onCharStep ? this._onCharStep(-1) : null;
        this.speak(r ? r.char : 'これ以上戻れません');
        return { action: 'prev-char', char: r ? r.char : null };
      },
      description: 'Speak the previous character (NVDA Left arrow)'
    });

    // Read/spell the word under the caret — NVDA numpad-5 (+double) parity.
    this.registerCommand('read-word', {
      patterns: ['この単語を読んで', '単語を読んで', '現在の単語', 'この単語',
        '文字を読んで', 'この字', '今の字', 'この漢字', '漢字を読んで',
        '読み方を教えて', 'この漢字の読み方', 'ふりがな', '字を読んで',
        '発音して', '発音を教えて', 'この発音',
        /read (this |the |current )?word/i, /current word/i],
      action: () => {
        const r = this._onWord ? this._onWord() : null;
        this.speak(r ? r.word : '単語がありません');
        return { action: 'read-word', word: r ? r.word : null };
      },
      description: 'Read the current word'
    });
    this.registerCommand('spell-word', {
      patterns: ['この単語をスペル', 'スペル読み', 'つづり', 'スペルで読んで',
        'スペルを教えて', 'スペル', 'スペルは', 'つづりを教えて',
        'どう綴る', '綴りを教えて', '綴りは', 'つづりは',
        /spell (this |the )?word/i, /spell it/i, /^spell (that|this)$/i,
        /how (is it|do you spell) (spelled|it)/i, /how is .* spelled/i],
      action: () => {
        const r = this._onSpellWord ? this._onSpellWord() : null;
        this.speak(r ? r.spelled : '単語がありません');
        return { action: 'spell-word', spelled: r ? r.spelled : null };
      },
      description: 'Spell the current word'
    });

    // Voice-side status queries — the 'how is X set' twin of every voice
    // control the user can change but cannot see.
    this.registerCommand('speech-rate-status', {
      patterns: ['読み上げ速度は', '読み上げの速さは', '現在の読み上げ速度',
        '今の読み上げ速度', '今の速さは', '今の速さ', '読み上げの速さ',
        '再生速度', '再生速度は', '再生速度を教えて',
        '読む速さは', 'どのくらいの速さ', 'どれくらいの速さ',
        '読むスピード', 'スピードは', '読み上げのスピード',
        /speech rate/i, /reading rate/i, /how fast/i,
        /reading speed/i, /voice speed/i, /what speed/i, /reading pace/i,
        /^super fast$/i, /^really fast$/i, /^pretty fast$/i, /^kinda fast$/i,
        /^fast huh$/i, /^very fast$/i],
      action: () => {
        this.speak(`読み上げ速度は${this._speechRate}倍です`);
        return { action: 'speech-rate-status', rate: this._speechRate };
      },
      description: 'Announce the current speech rate'
    });
    this.registerCommand('speech-pitch-status', {
      patterns: ['ピッチは', '声の高さは', '現在のピッチ', '今のピッチ',
        /voice pitch/i, /pitch/i],
      action: () => {
        this.speak(`声の高さは${this._speechPitch}倍です`);
        return { action: 'speech-pitch-status', pitch: this._speechPitch };
      },
      description: 'Announce the current speech pitch'
    });
    this.registerCommand('voice-name', {
      patterns: ['どの声', '声の名前', '今の声', '声は何', '音声エンジン',
        'どの声を使ってる', /which voice|voice name|what voice/i],
      action: () => {
        this.speak(this._voice ? `声は${this._voice.name}です` : '声は未選択です');
        return { action: 'voice-name', voice: this._voice ? this._voice.name : null };
      },
      description: 'Announce the selected narration voice'
    });
    this.registerCommand('language-status', {
      patterns: ['言語は', '言語設定は', '今の言語', '読み上げ言語', '読み上げの言語',
        /what language|which language/i, /reading language/i],
      action: () => {
        this.speak(`言語は${this.language}です`);
        return { action: 'language-status', language: this.language };
      },
      description: 'Announce the recognition language'
    });
    this.registerCommand('search-engine-status', {
      patterns: ['どの検索エンジン', '検索エンジンはどれ', '検索エンジンは',
        /which search engine|what search engine/i],
      action: () => {
        const e = this._onSearchEngineStatus ? this._onSearchEngineStatus() : null;
        this.speak(e ? `検索エンジンは${e}です` : '検索エンジンを確認できません');
        return { action: 'search-engine-status', engine: e };
      },
      description: 'Announce the current search engine'
    });

    // Stepper statuses — onStepper(key, 0) is the read-only query twin of the
    // voice stepper commands (delta 0 changes nothing, returns the value).
    const stepperStatusCmd = (name, key, label, unit, patterns, desc) =>
      this.registerCommand(name, {
        patterns,
        action: () => {
          const v = this._onStepper ? this._onStepper(key, 0) : null;
          this.speak(v === null ? `${label}を確認できません` : `${label} ${v}${unit}`);
          return { action: name, value: v };
        },
        description: desc
      });
    stepperStatusCmd('grace-time-status', 'gazeGraceTime', 'グレース時間', 'ミリ秒',
      ['グレース時間は', /grace time/i], 'Announce the gaze grace window');
    stepperStatusCmd('snap-angle-status', 'snapTurnAngle', 'スナップ角', '度',
      ['スナップ角は', /snap( turn)? angle/i], 'Announce the snap-turn angle');
    stepperStatusCmd('move-speed-status', 'smoothMoveSpeed', '移動速度', 'メートル毎秒',
      ['移動速度は', /move speed|movement speed/i], 'Announce the move speed');
    stepperStatusCmd('caption-hold-status', 'captionDuration', 'キャプション保持時間', '秒',
      ['キャプション保持は', 'キャプション時間は', /caption (time|duration|hold)/i],
      'Announce caption hold time');
    stepperStatusCmd('caption-height-status', 'captionHeight', 'キャプション高さ', 'メートル',
      ['キャプション高さは', /caption height/i], 'Announce caption height');

    // Article structural summary — VoiceOver rotor summary parity
    // ('describe page'): title + heading/paragraph/char counts in one line.
    this.registerCommand('article-summary', {
      patterns: ['この記事について', '記事の概要', '記事の情報',
        '要約して', 'このページを要約', 'ページを要約して', '概要は', '記事を要約',
        'ページの概要', '概要を教えて', '概要は何', 'このページの概要',
        'ここに書いてあること', 'ここに何が書いてある', '何が書かれてる',
        '何が書いてある', '内容を教えて', 'ページの内容を教えて',
        /describe (the )?(page|article)/i, /page info|article info/i,
        /summari[sz]e/i, /sum (it|this) up/i],
      action: () => {
        const s = this._onArticleSummary ? this._onArticleSummary() : null;
        if (!s) {
          this.speak('記事を開いていません');
        } else {
          const title = s.title ? `タイトル「${s.title}」。` : '';
          this.speak(`${title}見出し${s.headings}個、段落${s.paragraphs}個、` +
            `${s.chars}文字です`);
        }
        return { action: 'article-summary', summary: s };
      },
      description: 'Describe the article structure'
    });

    // Read the heading covering the scroll — headingAt's positional sibling
    // that reports instead of moving (NVDA 'read current heading' parity).
    this.registerCommand('heading-here', {
      patterns: ['この見出し', '現在の見出し', /current heading/i],
      action: () => {
        const h = this._onHeadingHere ? this._onHeadingHere() : null;
        if (h === undefined || h === null) {
          this.speak('記事を開いていません');
        } else if (!h.text) {
          this.speak('見出しがありません');
        } else {
          this.speak(`${h.index}番目の見出し（全${h.total}）。${h.text}`);
        }
        return { action: 'heading-here', heading: h };
      },
      description: 'Announce the heading at the current position'
    });

    // Remaining sentence count — reading-progress's sentence twin. Reuses the
    // sentence-status surface ({index,total}) so it cannot disagree.
    this.registerCommand('sentences-left', {
      patterns: ['あと何文', '残り何文', '残りの文は', /sentences left/i,
        '残りの記事', '残りのテキスト', '未読', '読み残し', '読み残した部分'],
      action: () => {
        const s = this._onSentenceStatus ? this._onSentenceStatus() : null;
        if (!s) {
          this.speak('記事を開いていません');
        } else if (s.index >= s.total) {
          this.speak('最後の文です');
        } else {
          this.speak(`あと${s.total - s.index}文です`);
        }
        return { action: 'sentences-left', left: s ? s.total - s.index : null };
      },
      description: 'Announce the remaining sentence count'
    });

    // Recognition sensitivity — lives on the voice layer itself (the
    // confidence threshold in handleRecognitionResult), so it needs no host
    // hook. ±0.1 steps inside 0–1; honest at the ends.
    const sensStep = (dir, label) => {
      const next = Math.min(1, Math.max(0, this.settings.sensitivity + dir * 0.1));
      const rounded = Math.round(next * 10) / 10;
      if (rounded === this.settings.sensitivity) {
        this.speak(`これ以上${label}できません`);
        return null;
      }
      this.settings.sensitivity = rounded;
      this.speak(`認識感度は${rounded}です`);
      return rounded;
    };
    this.registerCommand('sensitivity-up', {
      patterns: ['感度を上げて', '感度を高く', /sensitivity up|raise sensitivity|increase sensitivity/i],
      action: () => ({ action: 'sensitivity-up', value: sensStep(1, '上げ') }),
      description: 'Raise recognition sensitivity'
    });
    this.registerCommand('sensitivity-down', {
      patterns: ['感度を下げて', '感度を低く', /sensitivity down|lower sensitivity|decrease sensitivity/i],
      action: () => ({ action: 'sensitivity-down', value: sensStep(-1, '下げ') }),
      description: 'Lower recognition sensitivity'
    });
    // sensitivity-status — the query twin (up/down mutate; this reports).
    this.registerCommand('sensitivity-status', {
      patterns: ['感度は', '認識感度は', /sensitivity( status)?$/i],
      action: () => {
        this.speak(`認識感度は${this.settings.sensitivity}です`);
        return { action: 'sensitivity-status', value: this.settings.sensitivity };
      },
      description: 'Announce recognition sensitivity'
    });

    // contrast-status / dwell-time-status — query twins for the panel
    // toggles (high-contrast switch, dwell-time stepper); a voice-only
    // user cannot read the row to check the current value.
    this.registerCommand('contrast-status', {
      // 'ハイコントラスト…'/'high contrast…' belong to the high-contrast
      // toggle (registered earlier), so the query keeps disambiguated forms.
      patterns: ['コントラストは', 'ハイコントラストは', 'ハイコントラストはどう',
        'ハイコントラストか', 'ハイコントラストは今', 'ハイコントラストですか',
        'ハイコントラストかどうか', 'コントラストモードは',
        /ハイコントラストは(?:どう|か|今|現在)/,
        /is high contrast (on|off|enabled)/i, /contrast status/i],
      action: () => {
        const v = this._onContrastStatus ? this._onContrastStatus() : null;
        this.speak(v === null ? 'コントラストを確認できません'
          : `ハイコントラストは${v ? 'オン' : 'オフ'}です`);
        return { action: 'contrast-status', value: v };
      },
      description: 'Announce high-contrast state'
    });
    this.registerCommand('dwell-time-status', {
      patterns: ['注視時間は', '注視選択の時間は', /dwell time( status)?/i],
      action: () => {
        const v = this._onDwellTimeStatus ? this._onDwellTimeStatus() : null;
        this.speak(v === null ? '注視時間を確認できません'
          : `注視時間は${v}ミリ秒です`);
        return { action: 'dwell-time-status', value: v };
      },
      description: 'Announce dwell-select time'
    });

    // save-session — Chrome "restore pages" parity, write direction:
    // persists the tab-strip snapshot (private tabs excluded by
    // serializeSession) for the next boot's restore-session.
    this.registerCommand('save-session', {
      patterns: ['セッションを保存', 'セッション保存', 'タブを保存して',
        /save (the )?session/i],
      action: () => {
        const n = this._onSessionSave ? this._onSessionSave() : 0;
        this.speak(n > 0 ? `${n}個のタブを保存しました` : '保存できません');
        return { action: 'save-session', saved: n };
      },
      description: 'Persist the tab session'
    });

    // save-session's write twin — Chrome 'restore pages' → discard.
    this.registerCommand('clear-session', {
      patterns: ['セッションを消して', 'セッションを消去', 'セッションを削除',
        '保存したセッションを消して',
        /clear (the |saved )?session/i, /delete (the )?session/i],
      action: () => {
        const ok = this._onSessionClear ? this._onSessionClear() : false;
        this.speak(ok ? '保存したセッションを消去しました'
          : '保存されたセッションはありません');
        return { action: 'clear-session', cleared: ok };
      },
      description: 'Clear the persisted tab session'
    });

    // Wake-word requirement — the voice layer's own flag (like sensitivity);
    // toggling off always wakes, toggling on re-sleeps so the user must say
    // the wake word next.
    this.registerCommand('wake-word-toggle', {
      patterns: [/ウェイクワードを(オン|オフ)/, /wake word (on|off)/i],
      action: (transcript) => {
        const want = /オン|on/i.test(transcript);
        this.settings.requireWakeWord = want;
        this.isAwake = !want;
        this.speak(`ウェイクワードを${want ? 'オン' : 'オフ'}にしました`);
        return { action: 'wake-word-toggle', requireWakeWord: want };
      },
      description: 'Toggle the wake-word requirement'
    });

    // Line position without moving — find-status's line sibling.
    this.registerCommand('line-status', {
      patterns: ['何行目', '現在何行目', '行番号', 'この行は', '行は',
        '今どこを読んでる', 'どこまで読んでる', '読み上げ位置',
        '読み上げ中の行', '読み上げ中の場所', '現在位置', '今の位置',
        '読み上げ中', '読み上げの位置',
        '全部で何行', 'この記事は何行', '総行数', '行数は', '何行ある',
        '読んでいたところ', 'どこまで読んでた', '読み上げ位置に戻って', 'どこ読んでた', '何読んでた', 'どこを読んでた',
        '今何行目', '現在の行', '行番号は', '今の行は', '現在の行番号', '今は何行目',
        '今の行', '読んでるところ', '今読んでるところ',
        /line (number|position)/i],
      action: () => {
        const res = this._onLineStatus ? this._onLineStatus() : null;
        this.speak(res ? `現在${res.index}行目（全${res.total}行）`
          : '記事を開いていません');
        return { action: 'line-status', res };
      },
      description: 'Announce the current line number'
    });

    // Strip position — tabs-list announces the titles; this answers the
    // "where am I in the strip" question.
    this.registerCommand('tab-status', {
      patterns: ['タブは何個', '何個のタブ', '何番目のタブ', '何枚目のタブ',
        '幾つのタブ', 'タブは幾つ', 'タブ幾つ',
        '何個目のタブ', 'タブは何番目', 'タブの順番', 'このタブの位置',
        '現在のタブ番号', 'タブの位置',
        'タブの数', 'ウィンドウの数', 'タブの枚数',
        'タブは何枚', '何タブ', 'タブいくつ', '何個タブ', 'タブはいくつ開いてる',
        'いくつ開いてる', '何個開いてる', '全部で何タブ', 'タブ何個',
        'タブをいくつ開いてる', 'いくつタブを開いてる',
        'タブ数', '開いてる数', '全部で何個', 'どのくらい開いてる',
        '開いてるタブ数', 'タブの個数', 'タブ何個ある', '全部でいくつ',
        'count my tabs', 'number of tabs', 'count tabs', 'the tab count',
        'いくつかのタブ', '何個かのタブ', '幾つかのタブ', 'a couple of tabs', 'a few tabs', 'several tabs',
        /how many tabs/i, /which tab/i, /tab (count|position)/i,
        /any tabs( open)?/i, /are there (any )?tabs/i],
      action: () => {
        const res = this._onTabStatus ? this._onTabStatus() : null;
        this.speak(res ? `${res.total}個のタブの${res.index}枚目を表示中`
          : 'タブがありません');
        return { action: 'tab-status', res };
      },
      description: 'Announce the tab strip position'
    });

    // Privacy / pin status — honest answers to state questions the
    // private-mode toggle and pin commands can change. Phrasings stay
    // unambiguous: 'プライベートモード'/'プライベートタブ'/'ピン留め' are
    // owned by private-mode / private-tab / pin-tab respectively.
    this.registerCommand('privacy-status', {
      patterns: ['プライベートかどうか', 'シークレットですか',
        'プライベートですか', 'プライベートモードは', 'シークレットモードは',
        'シークレットモードですか', 'プライベートモードですか',
        'プライベートタブですか',
        /private mode (status|on|off)/i, /is (this|it) private/i],
      action: () => {
        const priv = this._onPrivacyStatus ? this._onPrivacyStatus() : null;
        this.speak(priv === null ? 'タブがありません'
          : priv ? 'プライベートタブです' : '通常のタブです');
        return { action: 'privacy-status', priv };
      },
      description: 'Announce whether the active tab is private'
    });

    this.registerCommand('pin-status', {
      patterns: ['ピンされてますか', 'ピンがありますか', 'ピン留めしてる', 'ピンしてる',
        'ピンされてる', 'ピン留めされてる',
        /is (this|it|the tab) pinned/i, /pin(ned)? status/i,
        /did i pin (it|this|the tab)/i, /did (it|this) get pinned/i,
        /was (it|this|the tab) pinned/i],
      action: () => {
        const pinned = this._onPinStatus ? this._onPinStatus() : null;
        this.speak(pinned === null ? 'タブがありません'
          : pinned ? 'ピン留めされています' : 'ピン留めされていません');
        return { action: 'pin-status', pinned };
      },
      description: 'Announce whether the active tab is pinned'
    });

    // Vim `` mark — return to the pre-jump scroll position. Phrasings
    // avoid 戻る (go-back owns it) and 探して (find-in-page owns it).
    this.registerCommand('jump-back', {
      patterns: ['さっきの場所', '元の位置へ', 'ジャンプバック',
        'この場所に戻って', 'さっきの場所に戻って', '前の場所に戻って',
        '元の場所に戻って', 'さっきの位置に戻って',
        'さっきのところ', 'さっきのところに戻って',
        /jump\s+back/i, /previous (spot|position)/i],
      action: () => {
        const moved = this._onJumpBack ? this._onJumpBack() : false;
        this.speak(moved ? '元の場所に戻りました' : '戻る場所がありません');
        return { action: 'jump-back', moved };
      },
      description: 'Jump back to the pre-jump position'
    });

    // Chrome's Esc — dismiss the find bar's highlights.
    this.registerCommand('clear-find', {
      patterns: ['検索を解除', 'ハイライトを消して', 'ハイライトを消す',
        '検索をクリア', '検索を閉じて', '検索バーを閉じて', '検索窓を閉じて',
        '検索を消して', '検索を終了', '検索を終了して', 'ハイライトを解除',
        '検索をやめる', '検索をキャンセル', '検索を中止', '検索をキャンセルして',
        'ハイライトを外して', 'ハイライトを取り除いて', '検索をやめて',
        '強調を消して', '蛍光ペンを消して', '選択を解除', '選択解除',
        '選択をやめて', '選択を解除して',
        /clear (the )?(search|find)/i, /clear highlights?/i],
      action: () => {
        const cleared = this._onClearFind ? this._onClearFind() : false;
        this.speak(cleared ? 'ハイライトを消しました' : '検索をしていません');
        return { action: 'clear-find', cleared };
      },
      description: 'Dismiss the find highlights'
    });

    // Dismiss pending notifications — toasts/captions auto-expire, but a
    // voice user who wants the display clear NOW needs the manual twin
    // (Chrome notification '×' parity). The hook clears the caption queue;
    // without it the honest answer is that they expire on their own.
    this.registerCommand('dismiss-notify', {
      patterns: ['通知を消して', '通知を閉じて', '通知を消去', 'トーストを消して',
        'メッセージを消して', 'メッセージを閉じて', 'ダイアログを閉じて',
        '警告を消して', '表示を消して', '通知はいい', '通知を全部消して',
        '消して', '消えて', '消してほしい',
        '通知を止めて', '通知をオフ', '通知をミュート', '通知を消してほしい',
        /dismiss (the )?(notification|toast|alert|message)s?/i,
        /clear (the )?notifications?/i, /close (the )?notification/i],
      action: () => {
        const done = this._onDismissNotify ? this._onDismissNotify() : false;
        this.speak(done ? '通知を消去しました' : '表示は自動で消えます');
        return { action: 'dismiss-notify', done };
      },
      description: 'Dismiss pending notifications'
    });
    // read-notify — the readout twin of dismiss-notify: '最新の通知'/
    // 'read the notification' re-speaks the newest caption line via the
    // onReadNotify hook (CaptionSystem.lastLine), so a voice user who
    // heard a chime can ask what it said after the toast expired.
    this.registerCommand('read-notify', {
      patterns: ['通知を読んで', '通知を読み上げて', '最新の通知', '最近の通知',
        '最後の通知', '何を通知した', '通知は何', '通知の内容', '今の通知',
        '通知を見せて', '通知を表示して', '通知を確認',
        '通知はある', '通知がある', '通知がきた', '通知きた', '新しい通知',
        /read (the |my )?(last |latest )?notifications?/i,
        /last notification/i, /latest notification/i,
        /what('s| was)? (the |that )?(last )?notification/i,
        /any (new )?notifications?/i],
      action: () => {
        const t = this._onReadNotify ? this._onReadNotify() : null;
        this.speak(t || '通知はありません');
        return { action: 'read-notify', text: t || null };
      },
      description: 'Read the newest notification aloud'
    });

    // Honest-absence cluster — phrases whose surface deliberately does not
    // exist, answered plainly instead of NO-MATCH ('認識できませんでした'
    // leaves the user guessing whether the phrase or the feature failed).
    // reader-mode: every article already renders via the reader extractor,
    // so the toggle is an always-on answer.
    this.registerCommand('reader-mode', {
      patterns: ['リーダー表示', 'リーダーモード', 'リーダーモードにして',
        'リーダー表示にして', 'シンプルな表示', '簡易表示', '簡易表示にして',
        'リーダーを閉じて', 'リーダーを終了', 'リーダーをやめて',
        'リーダー表示を解除', '元のページに戻して', '元の表示に戻して',
        '元の表示に戻る', '元に戻す',
        /reader mode/i, /easy reading/i, /simplified view/i,
        /exit reader/i, /leave reader/i],
      action: () => {
        this.speak('記事は常にリーダー表示で開きます');
        return { action: 'reader-mode' };
      },
      description: 'Explain that articles always render in reader view'
    });
    // dark-mode: the only theme variant is high-contrast, so point there
    // instead of pretending.
    this.registerCommand('dark-mode', {
      patterns: ['ダークモード', 'ダークモードにして', 'ダークモードをオン',
        'ナイトモード', '夜モード', '暗いテーマ',
        '背景を暗く', '目に優しく', '目に優しいモード', 'ブルーライト',
        'ブルーライトカット', '夜用モード', 'ダークテーマ',
        /dark mode/i, /night mode/i, /dark theme/i, /turn on dark/i, /lights out/i,
        /night time/i],
      action: () => {
        this.speak('ダークモードはありません。ハイコントラストモードが使えます');
        return { action: 'dark-mode' };
      },
      description: 'Explain there is no dark mode and point at high-contrast'
    });
    // brightness: panel luminance is the headset's OS domain — the browser
    // layer has no brightness surface to drive.
    this.registerCommand('brightness', {
      patterns: ['明るくして', '暗くして', '明るさを上げて', '明るさを下げて',
        '画面を明るく', '画面を暗く', '輝度を上げて', '輝度を下げて', '輝度',
        '明るすぎる', '眩しい', 'まぶしい', 'まぶしすぎる', '暗すぎる',
        '画面が明るい', '画面が眩しい',
        'もっと暗く', 'もっと暗くして', '暗くしてほしい', '暗くならない',
        '画面を暗くして', '暗くなって', 'もっと明るく', 'もっと明るくして',
        /brightness/i, /^brighter$/i, /^dimmer$/i, /is it (dark|bright)/i,
        /make (it|the screen) (brighter|dimmer|darker)/i, /^brighten$/i,
        /dim (it|the screen)/i, /darken it/i, /too bright/i, /way too bright/i,
        /^blinding$/i, /lights on/i, /light it up/i],
      action: () => {
        this.speak('明るさはヘッドセット本体の設定で変更してください');
        return { action: 'brightness' };
      },
      description: 'Explain brightness lives in headset settings'
    });
    // print / screenshot: no print dialog or capture pipeline exists in the
    // VR layer — honest refusal beats a silent failure or a fake success.
    this.registerCommand('print', {
      patterns: ['印刷して', 'プリントして', '印刷', 'プリント',
        'このページを印刷', '印刷したい', 'プリントしたい',
        'PDFに保存', 'PDFで保存', 'PDFとして保存', 'PDFを保存', 'PDFで出力',
        /print/i, /save (as |to )?pdf/i, /export (as |to )?pdf/i],
      action: () => {
        this.speak('このブラウザでは印刷できません');
        return { action: 'print' };
      },
      description: 'Explain printing is unavailable'
    });
    this.registerCommand('screenshot', {
      patterns: ['スクリーンショット', 'スクショ', '画面を撮って', '写真を撮って',
        '画面をキャプチャ', 'スクリーンショットを撮って', 'スクショして',
        'スクショを撮って', '画面を撮影', '画面を撮影して',
        /screenshot/i, /take a (screenshot|picture|photo)/i,
        /capture the screen/i],
      action: () => {
        this.speak('このブラウザではスクリーンショットを撮影できません');
        return { action: 'screenshot' };
      },
      description: 'Explain screenshots are unavailable'
    });
    // sort-tabs: no auto-sort surface — point at the ordinal-move atom that
    // does exist ('N番目に移動して' → move-tab-to-n).
    this.registerCommand('sort-tabs', {
      patterns: ['タブを並び替えて', 'タブを並べ替えて', 'タブをソート',
        'タブをソートして', 'タブを順番に', 'タブ順を整えて',
        'タブを並べて', 'タブを左右に', 'タブを整列', 'タブ順を変えて',
        'タブを整理して', 'タブを整理', '整理して', '片付けて',
        'タブを片付けて', 'タブをまとめて', 'タブをきれいにして',
        /sort (the |my )?tabs/i, /reorder (the |my )?tabs/i,
        /organize (the |my )?tabs/i, /tidy (the |my )?tabs/i,
        'alphabetize', 'sort by name', 'sort by title', 'sort em', 'organize them',
        'tidy them up'],
      action: () => {
        this.speak('自動並び替えはありません。N番目に移動して、と言ってください');
        return { action: 'sort-tabs' };
      },
      description: 'Point at ordinal move instead of auto-sort'
    });

    // Chrome "Paste and go" — clipboard URL → navigate. The hook resolves
    // asynchronously (clipboard.readText + permission), so the announce
    // happens in the promise, keeping the action itself synchronous.
    this.registerCommand('paste-go', {
      patterns: ['ペーストして開く', '貼り付けて開く', 'ペーストして移動',
        'ペーストして', 'ペーストして開いて', '貼り付けて',
        /paste and (go|open|navigate)/i, /paste it/i, /paste (the )?clipboard/i],
      action: () => {
        const p = this._onPasteGo
          ? Promise.resolve(this._onPasteGo())
          : Promise.resolve(null);
        p.then((msg) => this.speak(msg || 'URLがコピーされていません'));
        return { action: 'paste-go' };
      },
      description: 'Navigate to the clipboard URL'
    });

    // Read the clipboard aloud — NVDA's read-clipboard atom. Same async
    // announce pattern as paste-go; the hook resolves to the text to speak.
    // Web Share API parity — 'share this page' hands the URL to the OS
    // share sheet, or copies it when the API is missing (hook decides).
    this.registerCommand('share-page', {
      patterns: ['共有して', 'このページを共有', 'このページを共有して',
        'ページを共有', 'ページを共有して', 'ツイートして', 'メールで送って',
        '共有したい', 'シェアしたい',
        'ページを送って', 'このページを送って', '友達に送って', '友達に共有',
        'リンクを共有', 'シェアして', 'シェアする',
        'リンクを送って', 'SNSで共有', '送って', '送ってください',
        /^share( this page| it)?$/i, /share (the )?(page|url|link)/i,
        /tweet (this|it)/i, /email (this|it|the link)/i, /share (on|via) \w+/i],
      action: () => {
        const p = this._onShare
          ? Promise.resolve(this._onShare())
          : Promise.resolve(null);
        p.then((msg) => this.speak(msg || '共有できません'));
        return { action: 'share-page' };
      },
      description: 'Share the active page (Web Share or clipboard)'
    });

    // Chrome's translate bubble — navigates to the Google Translate wrapper
    // for the current URL (the only translate surface a web app can reach).
    this.registerCommand('translate-page', {
      patterns: ['翻訳して', 'このページを翻訳', 'このページを翻訳して',
        'ページを翻訳', 'ページを翻訳して', '英語に翻訳', '日本語に翻訳',
        '中国語に翻訳', /translate (this |the )?page/i, /translate (it|this)/i,
        /translate to (english|japanese|chinese)/i,
        'この文を翻訳して', '英語に訳して', '日本語に訳して',
        '中国語に訳して', '文章を翻訳', '文章を翻訳して', '訳して', '翻訳'],
      action: (transcript) => {
        const url = tabManager?.getActiveTab?.()?.currentUrl;
        if (!url) {
          this.speak('ページを開いていません');
          return { action: 'translate-page', translated: false };
        }
        const tl = /英語|english/i.test(transcript) ? 'en'
          : /中国語|chinese/i.test(transcript) ? 'zh-CN' : 'ja';
        onGoTo?.('https://translate.google.com/translate?sl=auto' +
          `&tl=${tl}&u=${encodeURIComponent(url)}`);
        this.speak('翻訳ページを開きます');
        return { action: 'translate-page', tl };
      },
      description: 'Translate the page via Google Translate'
    });

    this.registerCommand('read-clipboard', {
      patterns: ['クリップボードを読み上げ', 'クリップボードを読んで',
        '何をコピーした', 'コピーした内容', 'コピーしたもの', 'コピー内容',
        'コピーしたものは', 'コピーしたものを読んで',
        /read (the )?clipboard/i, /what('s| is) (in|on) (the )?clipboard/i],
      action: () => {
        const p = this._onReadClipboard
          ? Promise.resolve(this._onReadClipboard())
          : Promise.resolve(null);
        p.then((msg) => this.speak(msg || 'コピーされていません'));
        return { action: 'read-clipboard' };
      },
      description: 'Speak the clipboard contents'
    });

    // Chrome's "Close incognito tabs" — bulk-close only the private tabs.
    // 'incognito' is deliberately absent from the English pattern: it
    // belongs to private-mode's /incognito/i which is registered earlier.
    this.registerCommand('close-private-tabs', {
      patterns: ['プライベートタブを閉じて', 'プライベートタブをすべて閉じて',
        'シークレットタブを閉じて', /close (all )?private tabs/i],
      action: () => {
        const n = tabManager?.closePrivateTabs?.() ?? 0;
        this.speak(n ? `${n}個のプライベートタブを閉じました` : 'プライベートタブがありません');
        return { action: 'close-private-tabs', closed: n };
      },
      description: 'Close every private tab'
    });

    // last-tab's pair — Ctrl+1..8 lands on a position, this lands on the
    // strip's first slot directly (like Vim's g^).
    this.registerCommand('first-tab', {
      patterns: ['最初のタブ', '先頭のタブ', '一番左のタブ', '左端のタブ', '左の端のタブ', /first tab/i, /leftmost tab/i,
        '最初のやつ', '先頭のやつ', '最初の方のタブ', 'the first one'],
      action: () => {
        const tabs = tabManager?.tabs || [];
        if (!tabs.length) {
          this.speak('タブがありません');
          return { action: 'first-tab', index: -1 };
        }
        tabManager.setActive(0);
        const p = tabs[0];
        this.speak(p.currentTitle || p.currentUrl || 'タブ1');
        return { action: 'first-tab', index: 0 };
      },
      description: 'Activate the first tab'
    });

    // Bookmarked-state query — privacy-status's pair for the saved list.
    // Phrasings avoid 'ブックマーク' bare (toggle) and 'ブックマークを開いて'.
    this.registerCommand('bookmark-status', {
      patterns: ['ブックマーク済みですか', 'ブックマークされていますか',
        'ブックマークされてますか', 'ブックマークに入ってる', 'ブックマークにある',
        'ブックマークしたか', 'お気に入りに入ってる', 'お気に入り済み', 'ブックマーク済み',
        'お気に入り登録してる', 'お気に入りに登録した', 'ブックマークに追加した',
        'お気に入りに追加してる',
        'ブックマークした', '保存してるか', '保存した',
        /did i (bookmark|save)( this)?/i, /have i (bookmarked|saved)( this)?/i,
        '保存してる', '保存されてる', 'お気に入りに入れた', /is (this |it )?bookmarked/i,
        /in (the )?bookmarks\?*$/i, /did i bookmark/i,
        /is it saved/i, /did it save/i, /did it (get )?bookmark(ed)?/i,
        /was it (saved|bookmarked)/i, /did i already (save|bookmark)( it| this)?/i],
      action: () => {
        const active = tabManager?.getActiveTab?.();
        if (!active) {
          this.speak('ページを開いていません');
          return { action: 'bookmark-status', bookmarked: null };
        }
        const marked = !!(active.isBookmarked?.(active.currentUrl));
        this.speak(marked ? 'ブックマークされています' : 'ブックマークされていません');
        return { action: 'bookmark-status', bookmarked: marked };
      },
      description: 'Announce whether the active page is bookmarked'
    });

    // Ctrl+L parity — focus the VR address bar so the keyboard comes up
    // prefilled. The hook lives on the panel (WebPanel.onUrlInputRequested),
    // so the tabManager closure is enough — no extra _onX wiring.
    this.registerCommand('url-input', {
      patterns: ['アドレスバー', 'URLを入力して', 'アドレスを入力',
        'URLを打って', '検索バー', '検索フィールド',
        'アドレスバーを見せて', 'アドレスバーを出して', 'アドレスバーを開いて',
        /address bar/i, /search bar/i, /enter (a |the )?(url|address)/i],
      action: () => {
        const p = tabManager?.getActiveTab?.();
        if (!p?.onUrlInputRequested) {
          this.speak('アドレスバーがありません');
          return { action: 'url-input', opened: false };
        }
        p.onUrlInputRequested(p.currentUrl || 'https://', (url) => {
          if (url) {
            p.navigate?.(url);
          }
        });
        this.speak('URLを入力してください');
        return { action: 'url-input', opened: true };
      },
      description: 'Focus the address bar (Ctrl+L parity)'
    });

    // Quest hold-button parity — return the player rig to the origin by
    // voice. The hook also fires its own caption via recenter().
    this.registerCommand('recenter', {
      patterns: ['リセンター', '中央に戻して', 'センタリング',
        '正面に戻して', '向きをリセット', '向きを戻して',
        'カメラをリセット', '視点をリセット', '正面を向いて',
        '中央にして', '真ん中にして', 'リセンターして', '向き直して',
        '真ん中に戻して', 'センターにして', 'リセンタリング', '中央に合わせて',
        'パネルを中央に', 'パネルが見えない', 'パネルはどこ', 'パネルの位置',
        '画面が見えない', '画面はどこ',
        /recenter/i, /center (the )?(view|position|panel)/i,
        /where is the panel/i, /center it/i,
        'turn around', 'look behind', 'face the other way', 'turn the other way',
        'look backwards', 'turn around and look'],
      action: () => {
        const ok = this._onRecenter ? this._onRecenter() : false;
        this.speak(ok ? '中央に戻しました' : '中央に戻せません');
        return { action: 'recenter', moved: ok };
      },
      description: 'Return the player to the origin'
    });

    // Video position query — video-seek's status pair. The hook returns
    // {t,d} seconds or null when nothing is playing.
    this.registerCommand('video-status', {
      patterns: ['動画はどのくらい', '動画の位置', '動画は何分',
        '今どの辺', 'どの辺まで', '再生位置', '再生時間',
        '再生位置は', '再生時間は', 'あとどれくらいの動画', 'どのくらいの動画',
        '動画の残り', '動画の残り時間', '何が再生されてる', '何が流れてる',
        '再生中', '再生してる', '再生していますか', '再生中ですか',
        '何を再生中', '何が再生中',
        /what('?s| is) playing/i, /is (it|anything|something) playing/i, /is it recording/i,
        /anything playing/i, /something playing/i, /what'?s on/i,
        /video (position|time)/i, /how far (in|through)/i],
      action: () => {
        const st = this._onVideoStatus ? this._onVideoStatus() : null;
        if (!st) {
          this.speak('再生中の動画がありません');
          return { action: 'video-status', position: null };
        }
        const mm = (s) => `${Math.floor(s / 60)}分${Math.floor(s % 60)}秒`;
        this.speak(Number.isFinite(st.d)
          ? `${mm(st.t)}を再生中（全${mm(st.d)}）`
          : `${mm(st.t)}を再生中`);
        return { action: 'video-status', position: st.t };
      },
      description: 'Announce the video position'
    });

    // Recently-closed list — Chrome history "recently closed" parity: the
    // LIFO stack's read-only twin (nothing is reopened or popped). The
    // closed stack stores URLs only, so the readout speaks URLs; private
    // tabs never enter the stack, so they never appear here either.
    this.registerCommand('closed-list', {
      patterns: ['閉じたタブの一覧', '最近閉じたタブ', '最近閉じたタブを読んで',
        '最近閉じたタブを教えて', '閉じたタブを読んで', '閉じたタブは何',
        'さっき閉じたタブは何', 'さっき閉じたタブを教えて',
        '何個閉じた', 'いくつ閉じた', '何個タブを閉じた',
        /recently closed/i, /closed tabs/i, /what did i (just )?close/i],
      action: () => {
        const list = tabManager?.closedTabs?.() || [];
        if (!list.length) {
          this.speak('閉じたタブはありません');
          return { action: 'closed-list', count: 0 };
        }
        const shown = list.slice(0, 3).join('、');
        const more = list.length > 3 ? `、他${list.length - 3}件` : '';
        this.speak(`${list.length}個のタブを閉じました。最近から: ${shown}${more}`);
        return { action: 'closed-list', count: list.length };
      },
      description: 'Announce recently closed tabs'
    });

    // Reopen every closed tab — reopen-tab's bulk variant (Ctrl+Shift+T held
    // until the stack drains). Loops reopenClosedTab and counts what it got;
    // a MAX_TABS cap ends the loop honestly with the partial count.
    this.registerCommand('reopen-all', {
      patterns: ['閉じたタブをすべて開き直して', 'すべての閉じたタブを開き直して',
        '閉じたタブを全部開き直して', /reopen all (closed )?tabs/i],
      action: () => {
        let n = 0;
        // Bound defensively at the closed-stack ceiling (CLOSED_STACK_MAX=10,
        // doubled for margin): a misbehaving reopenClosedTab must not hang.
        while (n < 20 && tabManager?.reopenClosedTab?.()) {
          n++;
        }
        this.speak(n ? `${n}個のタブを開き直しました` : '閉じたタブがありません');
        return { action: 'reopen-all', reopened: n };
      },
      description: 'Reopen every closed tab (LIFO)'
    });

    // Word-level navigation — NVDA/JAWS Ctrl+Right/Left parity. The panel
    // advances a word caret across laid-out lines; crossing a line follows
    // the caret with scrollContentTo so the spoken word stays visible.
    this.registerCommand('next-word', {
      patterns: ['次の単語', '次の言葉', '単語を次へ', /next word/i,
        '単語を進んで', '次の単語へ', '次の単語に', '単語単位で進んで',
        '語を飛ばす', '単語を飛ばす', '一単語進んで', '単語単位'],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.nextWord?.(1);
        this.speak(r ? r.word : 'これ以上進めません');
        return { action: 'next-word', word: r ? r.word : null };
      },
      description: 'Speak the next word (NVDA Ctrl+Right)'
    });
    this.registerCommand('prev-word', {
      patterns: ['前の単語', '前の言葉', '単語を前へ', /previous word/i,
        '単語を戻る', '単語を戻って', '前の単語へ', '前の単語に',
        '単語を一つ戻る', '一単語戻る', '一単語前'],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.nextWord?.(-1);
        this.speak(r ? r.word : 'これ以上戻れません');
        return { action: 'prev-word', word: r ? r.word : null };
      },
      description: 'Speak the previous word (NVDA Ctrl+Left)'
    });

    // Voice-interface language — iOS Voice Control language parity. Sets
    // recognition + utterance language via setLanguage; the answer is spoken
    // in the NEW language so the user hears the switch took effect.
    this.registerCommand('language-switch', {
      patterns: ['日本語にして', '日本語に切り替え', '日本語で', '英語にして',
        '英語に切り替え', '英語で', '英語で読んで', '日本語で読んで',
        '読み上げ言語を英語', '読み上げ言語を日本語', '英語で読み上げて', '日本語で読み上げて',
        '言語を変えて', '言語を切り替えて', 'change language', /change (the )?language/i,
        /switch to (english|japanese)/i,
        /speak english/i],
      action: (transcript) => {
        const en = /英語|english/i.test(transcript);
        const ja = /日本語|japanese/i.test(transcript);
        if (!en && !ja) {
          this.speak('日本語または英語を指定してください');
          return { action: 'language-switch', language: null };
        }
        this.setLanguage(en ? 'en-US' : 'ja-JP');
        this.speak(en ? 'Switched to English' : '日本語に切り替えました');
        return { action: 'language-switch', language: en ? 'en-US' : 'ja-JP' };
      },
      description: 'Switch the voice language'
    });


    // Switch back to the previously-active tab — Alt+Tab / MRU ping-pong.
    // 'last tab' is last-tab-select's phrase, '前のタブ' prev-tab's cycle;
    // 'さっきのタブ'/'switch back' are the unambiguous forms.
    this.registerCommand('last-tab-switch', {
      patterns: ['さっきのタブ', 'さっき見ていたタブ', 'さっきのタブに戻って',
        /switch back/i, /last active tab/i, /most recent tab/i],
      action: () => {
        const prev = tabManager?.previousActiveIndex?.();
        const n = (tabManager?.tabs || []).length;
        if (prev === undefined || prev === null || prev < 0 || prev >= n
          || prev === tabManager?.activeIndex) {
          this.speak('前のタブがありません');
          return { action: 'last-tab-switch', index: null };
        }
        tabManager.setActive(prev);
        this.speak(`タブ${prev + 1}に切り替えました`);
        return { action: 'last-tab-switch', index: prev };
      },
      description: 'Switch to the previously-active tab'
    });

    // Re-execute the last non-repeat command — Vim '.' / Voice Access
    // "repeat" parity. say-again owns 'repeat'/'もう一度' (it replays the
    // announcement); this re-runs the command itself. _repeatableTranscript
    // never stores repeat-command, so it cannot recurse.
    this.registerCommand('repeat-command', {
      patterns: ['もう一度実行して', 'もう一度実行', '同じことをして',
        '同じコマンドを実行', 'コマンドを繰り返して',
        /do it again/i, /run it again/i, /do the same/i, /execute again/i,
        'try again', 'try that again', 'do that again', 'again', 'one more time',
        'run it back', 'one more go', 'do it once more',
        'もっかい', 'もいっかい', 'もういっかい', 'もう一度だけ', 'もう一回だけ'],
      action: () => {
        const t = this._repeatableTranscript;
        if (!t) {
          this.speak('繰り返すコマンドがありません');
          return { action: 'repeat-command', repeated: null };
        }
        this.processCommand(t);
        return { action: 'repeat-command', repeated: t };
      },
      description: 'Repeat the last non-repeat command'
    });

    // Remove the active page's bookmark — the one-directional counterpart of
    // bookmark-page's toggle: never adds, only removes, and says so honestly
    // when the page was never bookmarked.
    this.registerCommand('unbookmark-page', {
      patterns: ['ブックマークを外して', 'ブックマークを解除して',
        'ブックマークを削除して', 'ブックマークを消して', 'ブックマークを削除',
        'ブックマークから消して', 'お気に入りから消して', 'お気に入りを外して',
        'ブックマークから外して',
        'お気に入りを削除', 'お気に入りを削除して', 'お気に入りから削除して',
        'お気に入りから削除', 'ブックマークから削除', 'お気に入りを消して',
        'ブックマークを消す', 'お気に入りから外して',
        /remove (this |the )?bookmark/i, /unbookmark/i],
      action: () => {
        const active = tabManager?.getActiveTab?.();
        if (!active) {
          this.speak('ページを開いていません');
          return { action: 'unbookmark-page', removed: null };
        }
        const marked = !!(active.isBookmarked?.(active.currentUrl));
        if (!marked) {
          this.speak('ブックマークされていません');
          return { action: 'unbookmark-page', removed: false };
        }
        active.onToggleBookmark?.(active.currentUrl, active.currentTitle || active.currentUrl);
        this.speak('ブックマークを外しました');
        return { action: 'unbookmark-page', removed: true };
      },
      description: 'Remove the bookmark for the active page'
    });

    // Is narration currently speaking — status counterpart of
    // pause-reading/stop-reading.
    this.registerCommand('speaking-status', {
      patterns: ['読み上げ中ですか', '読み上げていますか', '喋っていますか',
        '読んでいますか', '読んでる最中', '読んでいる最中', '読み上げています',
        '喋ってる', '喋ってますか',
        '読んでる', '読んでいる', '読み上げてる', '読み上げている', '読みっぱなし',
        '読んでたっけ', '読んでいたっけ', '読んでたかな', '喋ってたっけ',
        '読みつつある', '読みつつあります', '喋りつつある',
        /are you (still )?speaking/i, /is it (still )?speaking/i,
        /is it (still )?reading/i, /still reading/i],
      action: () => {
        const on = !!this.synthesis?.speaking;
        this.speak(on ? '読み上げ中です' : '読み上げていません');
        return { action: 'speaking-status', speaking: on };
      },
      description: 'Announce whether narration is speaking'
    });

    // First/last heading — find-first/find-last's heading siblings.
    this.registerCommand('first-heading', {
      patterns: ['最初の見出し', '先頭の見出し', '最初の見出しを読んで',
        /first heading/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.headingAt?.(1);
        this.speak(r && r !== 'out'
          ? `${r.index}番目の見出し（全${r.total}）`
          : '見出しがありません');
        return { action: 'first-heading', res: r };
      },
      description: 'Jump to the first heading'
    });
    this.registerCommand('last-heading', {
      patterns: ['最後の見出し', '末尾の見出し', '最後の見出しを読んで',
        /last heading/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.lastHeading?.();
        this.speak(r && r !== 'out'
          ? `最後の見出し（全${r.total}）`
          : '見出しがありません');
        return { action: 'last-heading', res: r };
      },
      description: 'Jump to the last heading'
    });

    // Line-at-a-time reading — NVDA/VoiceOver Down/Up-arrow parity. Speaks
    // the line it lands on (the spoken line is the whole point); honest when
    // the reader can't move or nothing is on that line.
    this.registerCommand('next-line', {
      patterns: ['次の行', '次の行を読んで', '行を進め', 'もう一行', '一つ下へ', 'ひとつ下へ', '行を進めて',
        'もう一行読んで', '次の行を進めて', /next line/i],
      action: () => {
        const t = tabManager?.getActiveTab?.();
        if (!t?.scrollContent?.(1)) {
          this.speak('これ以上進めません');
          return { action: 'next-line', moved: false };
        }
        this.speak(t.currentLine?.() ?? 'この行はありません');
        return { action: 'next-line', moved: true };
      },
      description: 'Read the next reader line'
    });
    this.registerCommand('prev-line', {
      patterns: ['前の行', '前の行を読んで', '行を戻して', '行を戻って', '一つ上へ', 'ひとつ上へ',
        /previous line/i, /prev line/i],
      action: () => {
        const t = tabManager?.getActiveTab?.();
        if (!t?.scrollContent?.(-1)) {
          this.speak('これ以上戻れません');
          return { action: 'prev-line', moved: false };
        }
        this.speak(t.currentLine?.() ?? 'この行はありません');
        return { action: 'prev-line', moved: true };
      },
      description: 'Read the previous reader line'
    });

    // Kindle "go to N%" parity — 'go to N percent' itself is go-to's EN
    // capture, so the bare percent forms are the unambiguous phrases.
    this.registerCommand('reader-percent', {
      patterns: [/(\d+)\s*[%％]\s*(?:のところ|地点)/,
        /(\d+)\s*パーセント(?:のところ|地点)?/, /(\d+)\s*percent/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : -1;
        const r = tabManager?.getActiveTab?.()?.scrollToPercent?.(n);
        if (r === undefined || r === null) {
          this.speak('記事を開いていません');
        } else if (r === 'out') {
          this.speak(`${n}%は範囲外です`);
        } else {
          this.speak(`${n}%地点に移動しました`);
        }
        return { action: 'reader-percent', pct: n, res: r };
      },
      description: 'Jump to a percent position in the article'
    });

    // Omnibox web search — the 'Xを検索' intent go-to's 開く/行く capture
    // doesn't cover. 履歴/ブックマーク searches are claimed by their own
    // commands, so exclude them from the term.
    this.registerCommand('web-search', {
      patterns: [/^(?!履歴|ブックマーク|ページ|設定|メニュー)(.+?)を検索して?/,
        /(.+?)について検索/,
        // 'ニュースを見せて'/'写真が見たい' — content intent, so search the
        // web. Panel-scoped '見せて' phrases (履歴/ブックマーク/タブ/設定/
        // 通知) all live on earlier registrations and keep winning.
        /(?!何)(.+?)(?:を見せて|を見せてほしい|を見せてくれ|が見たい|を見たい)/,
        // 'Xを教えて' — info intent (weather/news); scoped-help's
        // 'Xについて教えて' and help's '使い方を教えて' register earlier and
        // keep winning. Topic shortcuts ('今日の天気' bare) capture the
        // topic itself as the term.
        /(.+?)(?:を教えて|を教えてほしい|を知らせて)/,
        /^(今日の天気|明日の天気|今週の天気|天気は|天気|気温は|気温|湿度は|湿度|雨降る|最新ニュース|ニュースがある|ニュース読んで|ニュースを聞かせて|ニュース検索|ニュース|面白い記事|おすすめの記事|記事を読みたい)$/,
        // Bare lookup verbs & engine-scoped forms carry no term — the action
        // prompts ('検索語がありません') instead of searching for the verb itself.
        /^(調べて|調べたい|調べもの|検索させて|調べてほしい|調べろ|調べなさい)$/,
        'google it', 'google that', 'search it', 'search that', 'look it up', 'look that up',
        /^(google|グーグル)\s*で検索/, /で検索してほしい/,
        /search (?:the web |web )?for (.+)/i,
        /web search (?:for )?(.+)/i,
        '音声検索'],
      action: (transcript) => {
        const m = transcript.match(/^(?!履歴|ブックマーク|ページ|設定|メニュー)(.+?)を検索/)
          || transcript.match(/(.+?)について検索/)
          || transcript.match(/(?!何)(.+?)(?:を見せて|を見せてほしい|を見せてくれ|が見たい|を見たい)/)
          || transcript.match(/(.+?)(?:を教えて|を教えてほしい|を知らせて)/)
          || transcript.match(/^(今日の天気|明日の天気|今週の天気|天気は|天気|気温は|気温|湿度は|湿度|雨降る|最新ニュース|ニュースがある|ニュース読んで|ニュースを聞かせて|ニュース検索|ニュース|面白い記事|おすすめの記事|記事を読みたい)$/)
          || transcript.match(/search (?:the web |web )?for (.+)/i)
          || transcript.match(/web search (?:for )?(.+)/i);
        const term = (m && m[1] ? m[1] : '').trim();
        if (!term) {
          this.speak('検索語がありません');
          return { action: 'web-search', term: null };
        }
        if (onGoTo) {
          onGoTo(term);
        }
        this.speak(`「${term}」を検索します`);
        return { action: 'web-search', term };
      },
      description: 'Search the web for a term'
    });

    // Echo the last recognized transcript — ASR confidence verification: a
    // deaf or hard-of-hearing user can't hear whether the recognizer heard
    // them correctly; reading the transcript back is the only confirmation.
    // Connection status — NetworkInformation API twin of online-status:
    // effectiveType + downlink when the host exposes them.
    this.registerCommand('connection-status', {
      patterns: ['回線速度', '通信速度', 'ネットの速度', 'ネット速度', '通信状態',
        '回線が悪い', '電波が悪い', '通信が遅い', '速度が遅い', '回線が遅い',
        'ネットが重い', '回線が弱い', '電波が弱い',
        /connection (speed|status|type)/i, /network (speed|status)/i, /how fast/i],
      action: () => {
        const c = (typeof navigator !== 'undefined') ? navigator.connection : null;
        if (!c || (!c.effectiveType && !c.downlink)) {
          this.speak('通信情報を取得できません');
          return { action: 'connection-status', type: null };
        }
        const parts = [];
        if (c.effectiveType) {
          parts.push(c.effectiveType.toUpperCase());
        }
        if (c.downlink !== undefined) {
          parts.push(`約${c.downlink}Mbps`);
        }
        this.speak(`接続状態: ${parts.join('、')}です`);
        return { action: 'connection-status', type: c.effectiveType || null };
      },
      description: 'Announce network connection type and speed'
    });

    this.registerCommand('say-last-transcript', {
      patterns: ['何と言った', '今何と言いました', '何と言いました',
        '何と聞き取った', '何を言った', '何を聞き取った', '今何を言った',
        '今なんて言った', 'なんて言った', 'なんていった', '今何と言った',
        'なんて言ってた',
        /what did i say/i, /what did you hear/i],
      action: () => {
        const t = this._prevTranscript;
        this.speak(t ? `「${t}」と聞き取りました` : 'まだ何も聞き取っていません');
        return { action: 'say-last-transcript', transcript: t || null };
      },
      description: 'Echo the last recognized transcript'
    });

    // negate — 'Xしないで'/'やめておいて'/'never mind' is a request to do
    // NOTHING: acknowledge instead of answering 認識できませんでした (which
    // wrongly suggests the phrasing failed, not that no action was wanted).
    // Registered LAST of all: every concrete command wins first — e.g.
    // '読まないで' must keep reaching stop-reading (stop the narration),
    // '聞かないで' stays on 'stop'.
    this.registerCommand('negate', {
      patterns: [/ないで(ください|ね|よ|ー)?$/, /やめてお(?:いて|く|きましょう)/,
        /やめといて/, /やめとく/, /しなくて(?:も)?いい/, /なくていい/,
        /do(?:n't| not) (?:do )?(?:that|it)/i, /^never ?mind$/i, /cancel that/i,
        /^forget it$/i,
        '違う', 'そうじゃない', 'そうじゃなくて', '間違えた', '間違い', 'ちがう', '違います',
        'ええよ', 'もういい', 'いいよ', 'いいから', 'もういいから', '結構です', 'もう結構',
        '大丈夫です', 'もう大丈夫', 'いらない', 'もういらない', 'ほっといて', '放っといて',
        'そのままで', 'そのまま', 'そのままでいい',
        '置いといて', '置いとく', '置いておいて', '置いておく', 'このまま', 'このままで',
        '読まずに', '閉じずに', '戻らずに', '進まずに', '消さずに', '開かずに', /ずに$/,
        /(?:う|つ|る|く|ぐ|す|ぬ|ぶ|む)な[。！？!?]?$/, /^(?:(?:don'?t|do not)(?! forget to)|never)\b/i,
        'nope', 'nah', 'no way', 'no thanks', 'no thank you', 'not that', 'wrong one',
        'thats not what i said', 'forget that', 'scratch that',
        'nvm', 'disregard', 'ignore that', 'ignore me', 'ignore it', 'drop it',
        'my bad', 'whoops', 'oops', 'thanks anyway', 'thats wrong', 'thats incorrect',
        'wrong', 'incorrect', 'やめといた', 'やっぱりやめて', 'まあいいや', 'もういいや',
        'どうでもいい', 'それじゃない', 'それは違う',
        /^without\b/i, /on second thought/i, /second thoughts/i, 'never mind that',
        '気がない', 'つもりはない', 'つもりない', 'するつもりはない', 'やるつもりはない',
        'いいです', 'いいんです', 'いいですよ', 'そのままお願い', 'そのままにして',
        'そのままにしておいて', 'このままにして', 'このままにしておいて',
        'nopers', 'nope nope', 'absolutely not', 'not interested', 'negative',
        'hell no', 'no siree', 'not a chance', 'not a hope',
        'nah bruh', 'nah fam', 'nah man', 'nah dude', 'no can do', 'no dice',
        'negative ghostrider', 'most certainly not', 'whatever', 'whatever dude',
        'ok whatever', 'doesnt matter', 'doesnt matter anymore', 'forget everything',
        'not really', 'probably not', 'doubt it', 'i doubt it', 'nah probably not',
        'nevermind that', 'scratch it', 'scratch that one', 'nix that', 'nix it',
        'no way jose', 'perish the thought', 'forget about it',
        'let it go', 'i take it back', 'wrong thing', 'not what i meant',
        'thats not it', 'not it', 'not that one', 'the wrong one',
        'wrong tab', 'wrong page', 'you misheard', 'thats wrong tab',
        /[^く]れへん[のん]?$/, /らんね$/, /[^く]れんね$/, /えんね$/, /[えけせねへべめげぺ]んね$/, /[えけせねへべめげぺ]へん[のん]?$/,
        /もんか$/, /わけ(?:が|じゃ)?ない$/,
        /んぞ$/, /まへん[のん]?$/, /んねん$/, /[きぎしじち]へん[のん]?$/,
        /んと(?:いい|ええ|よい)(?:かも|かもな|かもね)?$/, // '閉じんといい' = 閉じないほうがいい
        'nuh uh', 'uh uh', 'nah nah',
        'hands off', 'hands off it', 'keep your hands off',
        /keep it/i, /leave it(?: be| alone)?/i, /まい[。！？!?]?$/],
      action: () => {
        this.speak('承知しました。実行しません');
        return { action: 'negate' };
      },
      description: 'Acknowledge a do-not request without acting'
    });

    console.debug('VoiceCommands: Browser integration connected');
  }

  /**
   * Start listening
   */
  start() {
    if (!this.isEnabled) {
      console.error('VoiceCommands: Not initialized');
      return false;
    }

    if (this.isListening) {
      console.debug('VoiceCommands: Already listening');
      return true;
    }

    try {
      this.recognition.start();
      return true;
    } catch (error) {
      console.error('VoiceCommands: Failed to start', error);
      return false;
    }
  }

  /**
   * Stop listening
   */
  stop() {
    if (this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * Permanently tear down: prevents the onend restart loop from re-starting
   * after the recognition is stopped, then releases the recognition object.
   */
  dispose() {
    this.isEnabled = false; // must happen before stop() to block onend restart
    this.stop();
    // Cancel any queued or in-progress utterance. Without this, an utterance
    // queued just before dispose() keeps speaking into a torn-down object
    // (null camera, freed GPU resources) — the same class of teardown bug
    // fixed for showVRToast() setTimeout in Session 4.
    if (this.synthesis) {
      this.synthesis.cancel();
    }
    this.recognition = null;
    this.synthesis = null;
  }

  /**
   * Speak text (TTS)
   */
  speak(text, options = {}) {
    // Mirror every spoken response to a visual channel so users who can speak
    // but not hear (deaf / HoH voice-command users, or anyone in a muted /
    // noisy space) still receive confirmations, errors and "not recognized"
    // feedback. Fires regardless of TTS availability. Skipped for narration
    // chunks (options.caption === false): mirroring a whole article would
    // flood the caption queue — the reader itself is already that channel.
    if (options.caption !== false && this.callbacks.onSpeak) {
      this.callbacks.onSpeak(text);
    }
    // Screen-reader "say again" parity: remember the last utterance so the
    // say-again command can replay it even when synthesis is unavailable.
    this._lastSpoken = text;
    if (!this.synthesis) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || this.language;
    utterance.rate = options.rate || this._speechRate;
    utterance.pitch = options.pitch || this._speechPitch;
    utterance.volume = options.volume || 1.0;
    if (this._voice) {
      utterance.voice = this._voice;
    }
    // Android/Quest Chrome can fire onerror with "network" or "not-allowed"
    // (audio focus stolen by another app, or no TTS engine installed for
    // ja-JP). The onSpeak callback already fired so captions reached the user;
    // just log and don't crash. (Qiita SpeechSynthesis Android stability
    // pattern: always wire onerror so a TTS failure isn't completely silent.)
    utterance.onerror = (e) => {
      console.debug('VoiceCommands: TTS utterance error', e.error);
    };

    this.synthesis.speak(utterance);
  }

  /**
   * Cancel every queued / in-progress utterance without touching the
   * recognizer — the "stop reading" atom.
   */
  stopSpeaking() {
    if (this.synthesis) {
      this.synthesis.cancel();
    }
  }

  /** Clamp + store the narration speed used for every utterance. */
  setSpeechRate(rate) {
    const r = Number(rate);
    this._speechRate = Number.isFinite(r) ? Math.min(3, Math.max(0.5, r)) : 1.0;
    return this._speechRate;
  }

  /** Clamp + store the narration pitch used for every utterance. */
  setSpeechPitch(pitch) {
    const p = Number(pitch);
    this._speechPitch = Number.isFinite(p) ? Math.min(2, Math.max(0.5, p)) : 1.0;
    return this._speechPitch;
  }

  /** Pause queued narration without dropping it (SpeechSynthesis.pause). */
  pauseSpeaking() {
    if (this.synthesis) {
      this.synthesis.pause?.();
    }
  }

  /** Resume narration paused by pauseSpeaking(). */
  resumeSpeaking() {
    if (this.synthesis) {
      this.synthesis.resume?.();
    }
  }

  /**
   * Narrate article chunks (Edge "Read Aloud" / Safari "Listen to Page").
   * Cancels any narration already playing, announces the start through the
   * normal captioned path, then queues each chunk *without* the caption
   * mirror so the article text doesn't flood the caption queue.
   * @param {string[]} chunks
   * @param {object} [options] statusText: spoken when narration begins;
   *   emptyText: spoken when there is nothing to read
   * @returns {boolean} true when chunks were queued
   */
  readAloud(chunks, options = {}) {
    const list = Array.isArray(chunks) ? chunks.filter((c) => typeof c === 'string' && c.trim()) : [];
    this.stopSpeaking();
    if (!list.length) {
      this.speak(options.emptyText || '読み上げられる文章がありません');
      return false;
    }
    if (options.statusText !== null) {
      this.speak(options.statusText || '読み上げを開始します');
    }
    for (const chunk of list) {
      this.speak(chunk, { caption: false });
    }
    return true;
  }

  /**
   * Set language
   */
  setLanguage(lang) {
    this.language = lang;
    if (this.recognition) {
      this.recognition.lang = lang;
    }
  }

  /**
   * Get available commands
   */
  getCommands() {
    return Array.from(this.commands.entries()).map(([name, cmd]) => ({
      name,
      description: cmd.description,
      patterns: cmd.patterns
    }));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      isListening: this.isListening,
      isEnabled: this.isEnabled,
      commandCount: this.commands.size,
      lastCommand: this.lastCommand,
      successRate: this.stats.commandsRecognized > 0 ? this.stats.commandsExecuted / this.stats.commandsRecognized : 0
    };
  }
}

/**
 * Usage:
 *
 * const voiceCommands = new VoiceCommands();
 * await voiceCommands.initialize();
 *
 * // Start listening
 * voiceCommands.start();
 *
 * // Register custom command
 * voiceCommands.registerCommand('custom', {
 *   patterns: ['カスタム', 'custom'],
 *   action: () => {
 *     console.debug('Custom command executed');
 *     return { action: 'custom' };
 *   },
 *   confirmationText: 'カスタムコマンドを実行します',
 *   description: 'Custom command'
 * });
 *
 * // Set callbacks
 * voiceCommands.callbacks.onCommand = (name, result) => {
 *   console.debug('Command:', name, result);
 * };
 */
