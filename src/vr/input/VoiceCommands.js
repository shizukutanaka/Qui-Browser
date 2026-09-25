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
    this._onPanelDistance = null;
    this._onMute = null;
    this._onStepper = null;
    this._onVideoSeek = null;
    this._onSettingsPanel = null;
    this._onBookmarkOpen = null;
    this._onHistoryOpen = null;
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

    // Find matching command
    let matchedCommand = null;
    let matchedKey = null;

    // Check exact matches
    for (const [key, command] of this.commands) {
      if (command.patterns.some(pattern => {
        if (typeof pattern === 'string') {
          return normalized === pattern.toLowerCase();
        } else if (pattern instanceof RegExp) {
          return pattern.test(normalized);
        }
        return false;
      })) {
        matchedCommand = command;
        matchedKey = key;
        break;
      }
    }

    // Check aliases
    if (!matchedCommand) {
      for (const [alias, commandKey] of this.aliases) {
        if (normalized.includes(alias.toLowerCase())) {
          matchedCommand = this.commands.get(commandKey);
          matchedKey = commandKey;
          break;
        }
      }
    }

    // Execute command if found
    if (matchedCommand) {
      console.debug(`VoiceCommands: Executing command "${matchedKey}"`);

      try {
        const result = matchedCommand.action(transcript, confidence);
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
    // Seek the immersive video — YouTube's J/L keys (±10s) for a user who
    // can't reach the HUD while watching. Registered before navigate/back:
    // their loose /戻|進/ regexes would otherwise swallow '10秒戻る'. Seconds
    // are captured when spoken ('30秒戻る'), else the 10-second step applies.
    this.registerCommand('video-seek', {
      patterns: [/(\d+)\s*秒\s*(戻|進)/, '動画を戻して', '動画を進めて', '巻き戻して',
        /seek\s+(forward|back)/i, /rewind/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const secs = m ? Number(m[1]) : 10;
        const back = /戻|巻き戻|rewind|back/i.test(transcript);
        const delta = back ? -secs : secs;
        const pos = this._onVideoSeek ? this._onVideoSeek(delta) : null;
        this.speak(pos === null ? '再生中の動画がありません'
          : `${secs}秒${back ? '戻り' : '進み'}ました`);
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
        /open\s+settings/i, /close\s+settings/i],
      action: (transcript) => {
        let want;
        if (/閉じ|close/i.test(transcript)) {
          want = false;
        } else if (/開|open/i.test(transcript)) {
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

    // Go to reader line N — VoiceOver's go-to-line for the laid-out
    // article. Hoisted like the commands above: the go-to catch-all would
    // otherwise route 'go to line 30' as a navigation request.
    this.registerCommand('reader-goto-line', {
      patterns: [/(\d+)\s*行目/, /line\s+(\d+)/i],
      action: (transcript) => {
        const n = Number(transcript.match(/(\d+)/)[1]);
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
        /(\d+)\s*lines?\s+(forward|back)/i,
        /scroll\s+(?:forward|down|back|up)\s+(\d+)\s*lines?/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
        const back = /戻|back|up/i.test(transcript);
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
        '消音中ですか', /is (it |this |the )?muted/i, /mute status/i],
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
        /what (am i |are we )?searching for/i, /find query/i, /search query/i],
      action: () => {
        const q = this._onFindQuery ? this._onFindQuery() : null;
        this.speak(q ? `「${q}」を検索中です` : '検索していません');
        return { action: 'find-query', query: q };
      },
      description: 'Announce the active find-in-page query'
    });

    // Navigation commands
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', /進[むめ]/],
      action: () => {
        window.history.forward();
        return { action: 'navigate', direction: 'forward' };
      },
      confirmationText: '進みます',
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/],
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
      patterns: ['VRモード', 'VR開始', 'ブイアール', 'バーチャルリアリティ'],
      action: () => {
        // Would trigger VR mode
        return { action: 'vr', enabled: true };
      },
      confirmationText: 'VRモードを開始します',
      description: 'Enter VR mode'
    });

    this.registerCommand('vr-exit', {
      patterns: ['VR終了', 'VRやめる', '通常モード'],
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
      patterns: ['音量上げる', '音量アップ', 'ボリュームアップ'],
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
      patterns: ['音量下げる', '音量ダウン', 'ボリュームダウン'],
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
      patterns: ['音量は', '今の音量', '音量を教えて', '音量いくつ',
        /current volume/i, /volume (status|level)/i],
      action: () => {
        const v = this._onVolumeStatus ? this._onVolumeStatus() : null;
        this.speak(v === null ? '音量を取得できません' : `音量は${v}%です`);
        return { action: 'volume-status', volume: v };
      },
      description: 'Announce the current volume'
    });

    // Settings-by-voice: the caption-size and gaze-dwell steppers are the
    // flagship a11y knobs and a voice-only user cannot reach the settings
    // panel mid-immersion. Same clamp/apply/persist path as the steppers,
    // hosted by the app via onCaptionScale/onDwellTime.
    this.registerCommand('caption-size-up', {
      patterns: ['キャプションを大きく', '字幕を大きく', 'キャプションを大きくして',
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
        /larger (article|reader) text/i, /bigger (article|reader) text/i,
        /increase (article|reader) text size/i],
      action: () => {
        const v = this._onReaderScale ? this._onReaderScale(0.25) : null;
        this.speak(v === null ? '記事の文字はこれ以上大きくできません' : `記事の文字サイズ ${v.toFixed(2)}倍`);
        return { action: 'reader-size-up', scale: v };
      },
      description: 'Increase reader article text size'
    });

    this.registerCommand('reader-size-down', {
      patterns: ['記事の文字を小さく', '記事を小さく', 'リーダーの文字を小さく', '記事の文字を小さくして',
        /smaller (article|reader) text/i, /decrease (article|reader) text size/i],
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
      patterns: [/読み上げ速度([0-9.]+)倍/, /(speech|talk|reading) (rate|speed) (to )?([0-9.]+)/i],
      action: (transcript) => {
        const m = transcript.match(/[0-9.]+/);
        const rate = m ? this.setSpeechRate(parseFloat(m[0])) : this._speechRate;
        this.speak(`読み上げ速度 ${rate.toFixed(2)}倍`);
        return { action: 'speech-rate-set', rate };
      },
      description: 'Set speech rate to a numeric multiplier'
    });

    // Current time — the NVDA Insert+F12 atom. Announce hour/minute
    // naturally ('15時04分'); no host hook needed.
    this.registerCommand('time', {
      patterns: ['今何時', '現在の時刻', '時刻を教えて', '何時ですか', '時間を教えて',
        /what time/i, /current time/i],
      action: () => {
        const now = new Date();
        const mm = String(now.getMinutes()).padStart(2, '0');
        this.speak(`現在時刻は${now.getHours()}時${mm}分です`);
        return { action: 'time' };
      },
      description: 'Announce the current time'
    });

    // Voice picker — NVDA's voice-selection atom. SpeechSynthesis engines ship
    // several voices; cycling lands on the next one and announces its name so
    // the user can keep cycling until a voice they can parse comes up. Keeps
    // working without a browser connection (synthesis only).
    this.registerCommand('select-voice', {
      patterns: ['声を変えて', '読み上げ音声を変えて', '声を変える',
        '音声を変えて', /change (the )?voice/i, /next voice/i],
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
      patterns: ['ヘルプ', '助けて', '使い方', '何ができる'],
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

    // Stop listening
    this.registerCommand('stop', {
      patterns: ['停止', 'ストップ', 'やめて', '聞くな'],
      action: () => {
        this.stop();
        return { action: 'stop' };
      },
      confirmationText: '音声認識を停止します',
      description: 'Stop listening'
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
    onClearHistory, onScrollContent, onTogglePrivateMode, onVolume, onBookmarkPage, onReadAloud,
    onVideoToggle, onVideoStop, onCopyUrl, onCaptionScale, onDwellTime, onVolumeStatus, onReaderScale,
    onHighContrast, onSearchEngine, onRestoreSession, onSettingToggle, onPanelDistance, onMute, onStepper,
    onVideoSeek, onSettingsPanel, onBookmarkOpen, onHistoryOpen, onReaderLine,
    onBookmarkList, onHistoryList, onCopyTitle,
    onReadHere, onTopSiteOpen, onHistorySearch,
    onReaderScroll, onReaderProgress,
    onBookmarkSearch, onFindMatch, onRemainingTime,
    onHeadingSelect, onFindStatus, onFindLast, onReadLine,
    onParagraphStep, onParagraphSelect, onParagraphStatus, onCharCount,
    onReadParagraph, onLineStatus, onTabStatus, onPrivacyStatus, onPinStatus,
    onJumpBack, onClearFind, onPasteGo, onReadClipboard, onRecenter, onVideoStatus,
    onMuteStatus, onFindQuery, onReadFromLine, onHalfPage, onSentenceStep,
    onSentence, onSentenceStatus, onLastParagraph, onReadParagraphAt,
    onSearchEngineStatus, onCharStep, onWord, onSpellWord } = {}) {
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
    if (onPasteGo) {
      this._onPasteGo = onPasteGo;
    }
    if (onReadClipboard) {
      this._onReadClipboard = onReadClipboard;
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
    // Top Sites — hands-free jump to the user's most-used destination
    // (frecency-ranked). The heavy lifting (ranking + navigation + caption) is
    // the host's via onTopSites, mirroring the onSearch decoupling.
    this.registerCommand('top-sites', {
      patterns: ['トップサイト', 'よく使うサイト', 'よくみるサイト', 'トップ', /トップ?サイト/],
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
      patterns: ['進む', '次へ', 'すすむ', /進[むめ]/],
      action: () => {
        const moved = tabManager?.getActiveTab?.()?.goForward?.() || false;
        this.speak(moved ? '進みます' : '進めません');
        return { action: 'navigate', direction: 'forward', moved };
      },
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/],
      action: () => {
        const moved = tabManager?.getActiveTab?.()?.goBack?.() || false;
        this.speak(moved ? '戻ります' : '戻れません');
        return { action: 'navigate', direction: 'back', moved };
      },
      description: 'Navigate back'
    });

    this.registerCommand('refresh', {
      patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん'],
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
        /履歴を?(消去|削除|クリア|消す)/,
        /clear\s+history/i, /delete\s+history/i
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
      patterns: ['下にスクロール', '下', 'した', 'スクロールダウン'],
      action: () => {
        if (onScrollContent) {
          onScrollContent(SCROLL_LINES);
        }
        return { action: 'scroll', direction: 'down' };
      },
      description: 'Scroll down'
    });

    this.registerCommand('scroll-up', {
      patterns: ['上にスクロール', '上', 'うえ', 'スクロールアップ'],
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
    this.registerCommand('new-tab', {
      patterns: ['新しいタブ', '新しいタブを開く', '新規タブ', /new\s+tab/i],
      action: () => {
        tabManager?.newTab?.();
        return { action: 'new-tab' };
      },
      confirmationText: '新しいタブを開きます',
      description: 'Open a new tab'
    });

    this.registerCommand('close-tab', {
      patterns: ['タブを閉じる', 'タブを閉じて', 'このタブを閉じる', /close\s+tab\b(?!\s*\d)/i],
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
        /pin (this |the )?tab(?!\s*\d)/i, /unpin (this |the )?tab(?!\s*\d)/i],
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
        /move (the |this )?tab left/i],
      action: () => {
        const moved = tabManager?.moveTab?.(tabManager.activeIndex, -1) || false;
        this.speak(moved ? 'タブを移動しました' : 'タブをこれ以上移動できません');
        return { action: 'move-tab-left', moved };
      },
      description: 'Move the active tab left'
    });

    this.registerCommand('move-tab-right', {
      patterns: ['タブを右に移動', 'タブを右へ', 'タブを右に動かして',
        /move (the |this )?tab right/i],
      action: () => {
        const moved = tabManager?.moveTab?.(tabManager.activeIndex, 1) || false;
        this.speak(moved ? 'タブを移動しました' : 'タブをこれ以上移動できません');
        return { action: 'move-tab-right', moved };
      },
      description: 'Move the active tab right'
    });

    this.registerCommand('next-tab', {
      patterns: ['次のタブ', /next\s+tab/i],
      action: () => {
        tabManager?.nextTab?.();
        return { action: 'next-tab' };
      },
      confirmationText: '次のタブに切り替えます',
      description: 'Activate next tab'
    });

    this.registerCommand('prev-tab', {
      patterns: ['前のタブ', /previous\s+tab|prev\s+tab/i],
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
        /reopen(?:\s+closed)?\s+tab/i, /restore\s+tab/i
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
        '読み込み中止', '読み込みを中止', '読み込みを止めて',
        /読み込み.*(止め|停止|中止)/, /stop\s+loading/i, /abort\s+loading/i
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
        /new (private|incognito) tab/i],
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
        /private\s+mode/i, /incognito/i
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

    // Reader Home/End atoms — the reader viewport is the only scrollable
    // surface in VR, so top/bottom jump commands target it directly.
    this.registerCommand('scroll-top', {
      patterns: ['先頭へ', '最初に戻る', 'ページの先頭', '一番上', /scroll (to )?top/i],
      action: () => {
        tabManager?.getActiveTab?.()?.scrollToTop?.();
        return { action: 'scroll-top' };
      },
      confirmationText: '先頭へ移動します',
      description: 'Jump to the top of the article'
    });

    this.registerCommand('scroll-bottom', {
      patterns: ['末尾へ', '最後まで', 'ページの最後', '一番下', /scroll (to )?bottom/i],
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
      patterns: ['次のページ', 'ページダウン', '下のページ', /next\s+page/i, /page\s+down/i],
      action: () => {
        tabManager?.getActiveTab?.()?.scrollContentPage?.(1);
        return { action: 'next-page' };
      },
      confirmationText: '次のページへ進みます',
      description: 'Scroll the article one page down'
    });

    this.registerCommand('prev-page', {
      patterns: ['前のページ', 'ページアップ', '上のページ', /previous\s+page|prev\s+page|page\s+up/i],
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
        /read\s+aloud/i, /read\s+(this|the)\s+(page|article)/i,
        /listen\s+to\s+(this|the)\s+(page|article)/i
      ],
      action: () => {
        const chunks = onReadAloud ? onReadAloud() : null;
        this.readAloud(chunks);
        return { action: 'read-aloud' };
      },
      description: 'Read the article aloud'
    });

    this.registerCommand('stop-reading', {
      patterns: ['読み上げを止めて', '読み上げ停止', '読み上げ中止', /stop\s+reading/i, /stop\s+narrat/i],
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
        /pause\s+(the\s+)?(reading|narration|article)/i],
      action: () => {
        this.pauseSpeaking();
        return { action: 'pause-reading' };
      },
      confirmationText: '読み上げを一時停止します',
      description: 'Pause the article narration'
    });

    this.registerCommand('resume-reading', {
      patterns: ['読み上げを再開', '読み上げを続けて', '読み上げ再開',
        /resume\s+(the\s+)?(reading|narration|article)/i],
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
        /speak faster|talk faster/i, /speed up (speech|reading|talk)/i,
        /increase (speech|talk|reading) (rate|speed)/i],
      action: () => {
        const rate = this.setSpeechRate(this._speechRate + 0.25);
        this.speak(`読み上げ速度 ${rate.toFixed(2)}倍`);
        return { action: 'speech-faster', rate };
      },
      description: 'Increase narration speed'
    });

    this.registerCommand('speech-slower', {
      patterns: ['遅くして', 'もっと遅く', '読み上げを遅く', '読み上げをゆっくり',
        /speak slower|talk slower/i, /slow down (speech|reading|talk)/i,
        /decrease (speech|talk|reading) (rate|speed)/i],
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
        /table of contents/i, /read (the )?(contents|toc|outline)/i],
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
      patterns: ['次を探して', '次の候補', /find\s+next/i, /next\s+match/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.findNextMatch?.() || null;
        this.speak(r ? `${r.index}/${r.total}件目` : '見つかりませんでした');
        return { action: 'find-next', ...r };
      },
      description: 'Jump to the next find match'
    });

    this.registerCommand('find-prev', {
      patterns: ['前を探して', '前の候補', /find\s+prev/i, /previous\s+match/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.findPrevMatch?.() || null;
        this.speak(r ? `${r.index}/${r.total}件目` : '見つかりませんでした');
        return { action: 'find-prev', ...r };
      },
      description: 'Jump to the previous find match'
    });

    this.registerCommand('find-in-page', {
      patterns: ['ページ内検索', /find\s+(?:in\s+(?:this\s+)?page\s+)?(.+)/i, /(.+?)を探して/],
      action: (transcript) => {
        const bare = transcript === 'ページ内検索';
        const m = transcript.match(/find\s+(?:in\s+(?:this\s+)?page\s+)?(.+)/i)
          || transcript.match(/(.+?)を探して/);
        if (bare || !m) {
          this.speak('検索する語を言ってください');
          return { action: 'find-in-page', count: 0 };
        }
        const count = tabManager?.getActiveTab?.()?.findInReader?.(m[1]) || 0;
        this.speak(count ? `${count}件見つかりました` : '見つかりませんでした');
        return { action: 'find-in-page', count };
      },
      description: 'Find text on the page'
    });

    // Heading navigation — the screen-reader H / Shift+H atom (NVDA, JAWS,
    // VoiceOver rotor). The article title counts as heading zero.
    this.registerCommand('next-heading', {
      patterns: ['次の見出し', '見出しへ', /next\s+heading/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.nextHeading?.(1) || null;
        this.speak(r ? `${r.index}番目の見出し（全${r.total}）` : '見出しがありません');
        return { action: 'next-heading', ...r };
      },
      description: 'Jump to the next heading'
    });

    this.registerCommand('prev-heading', {
      patterns: ['前の見出し', /prev(?:ious)?\s+heading/i],
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
      patterns: ['履歴を開いて', '履歴を見て', '履歴を表示',
        /open\s+(?:the\s+)?history/i, /show\s+(?:the\s+)?history/i],
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
      patterns: ['もう一度', 'もう一回', '聞き直し', 'もう一度言って',
        /repeat( that)?/i, /say (that )?again/i],
      action: () => {
        this.speak(this._lastSpoken || '直前の発話がありません');
        return { action: 'say-again' };
      },
      description: 'Repeat the last spoken message'
    });

    this.registerCommand('where-am-i', {
      patterns: ['どこ', 'どこにいる', '現在地', '現在のページ', 'このページは',
        /where\s+am\s+i/i, /what(?:'s| is) (?:this|the) (?:page|site)/i],
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
        /list\s+tabs/i, /how many tabs/i, /what tabs/i],
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
      patterns: ['動画を止めて', '動画停止', 'ビデオを止めて', /stop\s+(the\s+)?video/i],
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
      patterns: ['他のタブを閉じて', '他のタブを閉じる', /close\s+other\s+tabs/i],
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

    // Duplicate the active tab (Chrome's "Duplicate tab" context-menu atom).
    this.registerCommand('duplicate-tab', {
      patterns: ['タブを複製', 'タブをコピー', '複製', /duplicate (this )?tab/i],
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
        'ページを保存', /bookmark (this|this page|the page|page)/i,
        /add (this|page) (to )?bookmarks?/i
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
      patterns: ['ブックマーク', 'お気に入り', '履歴'],
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
        /open (the )?bookmarks/i, /show (the )?bookmarks/i],
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

    // Keyboard toggle
    this.registerCommand('keyboard', {
      patterns: ['キーボード', 'キーボードを開く', 'キーボードを閉じる'],
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

    // REGISTERED LAST ON PURPOSE: its `を開く` / `open X` capture is greedy and
    // would otherwise swallow more specific commands (e.g. "キーボードを開く"
    // → keyboard toggle). processCommand matches in registration order and
    // stops at the first hit, so this generic catch-all must come after every
    // specific command to act only on utterances none of them claimed.
    this.registerCommand('go-to', {
      patterns: [
        /^(.+)(?:を開く?|に(?:行く|移動(?:する)?))/,
        /^(?:open|go to|navigate to)\s+(.+)/i
      ],
      action: (transcript) => {
        const t = transcript.toLowerCase().trim();
        const jpMatch = t.match(/^(.+)(?:を開く?|に(?:行く|移動(?:する)?))/);
        const enMatch = t.match(/^(?:open|go to|navigate to)\s+(.+)/);
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
      patterns: [/ハイコントラスト/, /高コントラスト/,
        /high contrast/i],
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
        /reading (time|length)/i, /how long (does it take )?to read/i],
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
      patterns: [/検索エンジンを?(.+)/, /(use|switch to|change to|set) (google|bing|duckduckgo|ecosia)/i],
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
      if (/オフ|無効|消して|off|disable/i.test(transcript)) {
        return false;
      }
      if (/オン|有効|つけて|on|enable/i.test(transcript)) {
        return true;
      }
      return undefined;
    };
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
      [/キャプションを(オン|オフ|つけて|消して)/, /字幕を(つけて|消して|オン|オフ)/,
        /(captions|subtitles) (on|off)/i, /(enable|disable|turn on|turn off) captions/i],
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

    // Panel distance — low-vision users pull the reading surface closer
    // without leaving immersion for the settings stepper.
    this.registerCommand('panel-distance', {
      patterns: [/パネルを(近づけて|近く|遠く|遠ざけて)/, /パネルを(近く|遠く)して/,
        /panel (closer|nearer|further|farther|away)/i],
      action: (transcript) => {
        const nearer = /近|closer|nearer/i.test(transcript);
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
        /(un)?pin tab ([0-9]+)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
        const tabs = tabManager?.tabs || [];
        const idx = n - 1;
        if (idx < 0 || idx >= tabs.length) {
          this.speak(`タブ${n}はありません`);
          return { action: 'tab-pin-n', index: -1 };
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
    this.registerCommand('tab-select', {
      patterns: [/タブ([0-9]+)/, /tab ([0-9]+)/i],
      action: (transcript) => {
        const m = transcript.match(/([0-9]+)/);
        const n = m ? parseInt(m[1], 10) : 0;
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
      patterns: ['最後のタブ', '最後のタブを見せて', /last tab/i],
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
      patterns: ['タイトル', 'このページのタイトル', 'ページ名', /page title/i,
        /what('s| is) (the |this )?(page|title)/i],
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
        /(un)?mute/i],
      action: (transcript) => {
        const want = /unmute|解除|戻して/i.test(transcript) ? false : undefined;
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
        /(read|say|what is|what's) (the )?url/i],
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
        /close\s+all\s+tabs/i],
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
        /what( is|'s) (the )?date/i, /current date/i],
      action: () => {
        const now = new Date();
        this.speak(`今日は${now.getMonth() + 1}月${now.getDate()}日です`);
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
      ['ブックマーク一覧', 'ブックマークを読み上げ', /list\s+(my\s+)?bookmarks/i],
      'Read the bookmark list');
    listCmd('history-list', '履歴', this._onHistoryList,
      ['履歴一覧', '履歴を読み上げ', /list\s+(my\s+)?history/i],
      'Read the history list');

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
        /read\s+from\s+here/i, /read\s+from\s+(the\s+)?current/i],
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
        /履歴(?:から|で)\s*(.+?)\s*(?:を)?(?:検索|調べて?)/,
        /history\s+search\s+(?:for\s+)?(.+)/i,
        /search\s+history\s+(?:for\s+)?(.+)/i
      ],
      action: (transcript) => {
        const m = transcript.match(/履歴(?:から|で)\s*(.+?)\s*(?:を)?(?:検索|調べて?)/)
          || transcript.match(/history\s+search\s+(?:for\s+)?(.+)/i)
          || transcript.match(/search\s+history\s+(?:for\s+)?(.+)/i);
        const term = (m && m[1] ? m[1] : '').trim();
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
        /reading\s+progress/i, /how\s+much\s+(have\s+i\s+)?(read|left)/i],
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
        /ブックマーク(?:から|で)\s*(.+?)\s*(?:を)?(?:検索|調べて?)/,
        /bookmark\s+search\s+(?:for\s+)?(.+)/i,
        /search\s+bookmarks?\s+(?:for\s+)?(.+)/i
      ],
      action: (transcript) => {
        const m = transcript.match(/ブックマーク(?:から|で)\s*(.+?)\s*(?:を)?(?:検索|調べて?)/)
          || transcript.match(/bookmark\s+search\s+(?:for\s+)?(.+)/i)
          || transcript.match(/search\s+bookmarks?\s+(?:for\s+)?(.+)/i);
        const term = (m && m[1] ? m[1] : '').trim();
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
        /how much longer/i, /time left/i, /minutes left/i],
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
        /heading\s+(\d+)/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
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
      patterns: ['最初のヒット', '最初の結果', /first (match|hit|result)/i],
      action: () => {
        const res = this._onFindMatch ? this._onFindMatch(1) : null;
        this.speak(res === 'out' || res === null ? '検索をしていません'
          : '1件目に移動しました');
        return { action: 'find-first', res };
      },
      description: 'Jump to the first find hit'
    });

    this.registerCommand('find-last', {
      patterns: ['最後のヒット', '最後の結果', /last (match|hit|result)/i],
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
      patterns: ['次の段落', '段落を進め', /next\s+paragraph/i],
      action: () => {
        const r = this._onParagraphStep ? this._onParagraphStep(1) : null;
        this.speak(r ? `${r.index}番目の段落（全${r.total}）` : '段落がありません');
        return { action: 'next-paragraph', ...r };
      },
      description: 'Jump to the next paragraph'
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
        /read paragraph (\d+)/i],
      action: (transcript) => {
        const m = transcript.match(/(\d+)/);
        const n = m ? Number(m[1]) : 0;
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
      patterns: ['何段落', '段落はいくつ', 'どの段落', /which paragraph/i,
        /paragraph (count|position|status)/i],
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
        /character count/i, /word count/i],
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
      patterns: ['次の文', '文を次へ', '一文進め', /next sentence/i],
      action: () => {
        const r = this._onSentenceStep ? this._onSentenceStep(1) : null;
        this.speak(r ? r.sentence : 'これ以上進めません');
        return { action: 'next-sentence', sentence: r ? r.sentence : null };
      },
      description: 'Speak the next sentence (NVDA Alt+Down)'
    });
    this.registerCommand('prev-sentence', {
      patterns: ['前の文', '文を前へ', '一文戻し', /prev(?:ious)? sentence/i],
      action: () => {
        const r = this._onSentenceStep ? this._onSentenceStep(-1) : null;
        this.speak(r ? r.sentence : 'これ以上戻れません');
        return { action: 'prev-sentence', sentence: r ? r.sentence : null };
      },
      description: 'Speak the previous sentence (NVDA Alt+Up)'
    });

    // Read the sentence under the scroll — read-line's sentence sibling.
    this.registerCommand('read-sentence', {
      patterns: ['この文を読んで', 'この文を読み上げ', '文を読んで',
        /read (this |the |current )?sentence/i],
      action: () => {
        const r = this._onSentence ? this._onSentence() : null;
        this.speak(r ? r.sentence : '文がありません');
        return { action: 'read-sentence', sentence: r ? r.sentence : null };
      },
      description: 'Read the current sentence'
    });
    this.registerCommand('sentence-status', {
      patterns: ['何文目', '現在何文目', 'どの文', /which sentence/i,
        /sentence (position|status)/i],
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
      patterns: ['次の文字', '文字を次へ', /next char(?:acter)?/i],
      action: () => {
        const r = this._onCharStep ? this._onCharStep(1) : null;
        this.speak(r ? r.char : 'これ以上進めません');
        return { action: 'next-char', char: r ? r.char : null };
      },
      description: 'Speak the next character (NVDA Right arrow)'
    });
    this.registerCommand('prev-char', {
      patterns: ['前の文字', '文字を前へ', /prev(?:ious)? char(?:acter)?/i],
      action: () => {
        const r = this._onCharStep ? this._onCharStep(-1) : null;
        this.speak(r ? r.char : 'これ以上戻れません');
        return { action: 'prev-char', char: r ? r.char : null };
      },
      description: 'Speak the previous character (NVDA Left arrow)'
    });

    // Read/spell the word under the caret — NVDA numpad-5 (+double) parity.
    this.registerCommand('read-word', {
      patterns: ['この単語を読んで', '単語を読んで', '現在の単語',
        /read (this |the |current )?word/i, /current word/i],
      action: () => {
        const r = this._onWord ? this._onWord() : null;
        this.speak(r ? r.word : '単語がありません');
        return { action: 'read-word', word: r ? r.word : null };
      },
      description: 'Read the current word'
    });
    this.registerCommand('spell-word', {
      patterns: ['この単語をスペル', 'スペル読み', 'つづり',
        /spell (this |the )?word/i, /spell it/i],
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
      patterns: ['読み上げ速度は', '読み上げの速さは', /speech rate/i,
        /reading rate/i, /how fast/i],
      action: () => {
        this.speak(`読み上げ速度は${this._speechRate}倍です`);
        return { action: 'speech-rate-status', rate: this._speechRate };
      },
      description: 'Announce the current speech rate'
    });
    this.registerCommand('speech-pitch-status', {
      patterns: ['ピッチは', '声の高さは', /voice pitch/i, /pitch/i],
      action: () => {
        this.speak(`声の高さは${this._speechPitch}倍です`);
        return { action: 'speech-pitch-status', pitch: this._speechPitch };
      },
      description: 'Announce the current speech pitch'
    });
    this.registerCommand('voice-name', {
      patterns: ['どの声', '声の名前', '今の声', /which voice|voice name/i],
      action: () => {
        this.speak(this._voice ? `声は${this._voice.name}です` : '声は未選択です');
        return { action: 'voice-name', voice: this._voice ? this._voice.name : null };
      },
      description: 'Announce the selected narration voice'
    });
    this.registerCommand('language-status', {
      patterns: ['言語は', '言語設定は', /what language|which language/i],
      action: () => {
        this.speak(`言語は${this.language}です`);
        return { action: 'language-status', language: this.language };
      },
      description: 'Announce the recognition language'
    });
    this.registerCommand('search-engine-status', {
      patterns: ['どの検索エンジン', '検索エンジンはどれ',
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

    // Line position without moving — find-status's line sibling.
    this.registerCommand('line-status', {
      patterns: ['何行目', '現在何行目', '行番号', /line (number|position)/i],
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
      patterns: ['タブは何個', '何個のタブ', '何番目のタブ', 'タブの位置',
        /how many tabs/i, /which tab/i, /tab (count|position)/i],
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
      patterns: ['プライベートかどうか', /private mode (status|on|off)/i,
        /is (this|it) private/i],
      action: () => {
        const priv = this._onPrivacyStatus ? this._onPrivacyStatus() : null;
        this.speak(priv === null ? 'タブがありません'
          : priv ? 'プライベートタブです' : '通常のタブです');
        return { action: 'privacy-status', priv };
      },
      description: 'Announce whether the active tab is private'
    });

    this.registerCommand('pin-status', {
      patterns: ['ピンされてますか', 'ピンがありますか',
        /is (this|it|the tab) pinned/i, /pin(ned)? status/i],
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
        /jump\s+back/i, /previous (spot|position|line)/i],
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
        '検索をクリア', /clear (the )?(search|find)/i, /clear highlights?/i],
      action: () => {
        const cleared = this._onClearFind ? this._onClearFind() : false;
        this.speak(cleared ? 'ハイライトを消しました' : '検索をしていません');
        return { action: 'clear-find', cleared };
      },
      description: 'Dismiss the find highlights'
    });

    // Chrome "Paste and go" — clipboard URL → navigate. The hook resolves
    // asynchronously (clipboard.readText + permission), so the announce
    // happens in the promise, keeping the action itself synchronous.
    this.registerCommand('paste-go', {
      patterns: ['ペーストして開く', '貼り付けて開く', 'ペーストして移動',
        /paste and (go|open|navigate)/i],
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
    this.registerCommand('read-clipboard', {
      patterns: ['クリップボードを読み上げ', 'クリップボードを読んで',
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
      patterns: ['最初のタブ', '先頭のタブ', /first tab/i],
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
        'ブックマークされてますか', /is (this |it )?bookmarked/i],
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
        'URLを打って', /address bar/i, /enter (a |the )?(url|address)/i],
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
        /recenter/i, /center (the )?(view|position)/i],
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
      patterns: ['次の単語', '次の言葉', '単語を次へ', /next word/i],
      action: () => {
        const r = tabManager?.getActiveTab?.()?.nextWord?.(1);
        this.speak(r ? r.word : 'これ以上進めません');
        return { action: 'next-word', word: r ? r.word : null };
      },
      description: 'Speak the next word (NVDA Ctrl+Right)'
    });
    this.registerCommand('prev-word', {
      patterns: ['前の単語', '前の言葉', '単語を前へ', /previous word/i],
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
        '英語に切り替え', '英語で', /switch to (english|japanese)/i,
        /speak english/i],
      action: (transcript) => {
        const en = /英語|english/i.test(transcript);
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
        /do it again/i, /run it again/i, /do the same/i, /execute again/i],
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
        'ブックマークを削除して', 'ブックマークを消して',
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
        '読んでいますか', /are you (still )?speaking/i, /is it (still )?speaking/i],
      action: () => {
        const on = !!this.synthesis?.speaking;
        this.speak(on ? '読み上げ中です' : '読み上げていません');
        return { action: 'speaking-status', speaking: on };
      },
      description: 'Announce whether narration is speaking'
    });

    // First/last heading — find-first/find-last's heading siblings.
    this.registerCommand('first-heading', {
      patterns: ['最初の見出し', '先頭の見出し', /first heading/i],
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
      patterns: ['最後の見出し', '末尾の見出し', /last heading/i],
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
      patterns: ['次の行', '次の行を読んで', '行を進め', /next line/i],
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
      patterns: ['前の行', '前の行を読んで', '行を戻して',
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
      patterns: [/^(?!履歴|ブックマーク|ページ)(.+?)を検索して?/,
        /(.+?)について検索/, /search (?:the web |web )?for (.+)/i,
        /web search (?:for )?(.+)/i],
      action: (transcript) => {
        const m = transcript.match(/^(?!履歴|ブックマーク|ページ)(.+?)を検索/)
          || transcript.match(/(.+?)について検索/)
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
    this.registerCommand('say-last-transcript', {
      patterns: ['何と言った', '今何と言いました', '何と言いました',
        '何と聞き取った', /what did i say/i, /what did you hear/i],
      action: () => {
        const t = this._prevTranscript;
        this.speak(t ? `「${t}」と聞き取りました` : 'まだ何も聞き取っていません');
        return { action: 'say-last-transcript', transcript: t || null };
      },
      description: 'Echo the last recognized transcript'
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
