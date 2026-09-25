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
    onVideoSeek, onSettingsPanel, onBookmarkOpen, onHistoryOpen, onReaderLine } = {}) {
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

    // Browser forward / back
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', /進[むめ]/],
      action: () => {
        tabManager?.getActiveTab?.()?.goForward?.();
        return { action: 'navigate', direction: 'forward' };
      },
      confirmationText: '進みます',
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/],
      action: () => {
        tabManager?.getActiveTab?.()?.goBack?.();
        return { action: 'navigate', direction: 'back' };
      },
      confirmationText: '戻ります',
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
      patterns: ['タブを閉じる', 'タブを閉じて', 'このタブを閉じる', /close\s+tab\b/i],
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
        /pin (this |the )?tab/i, /unpin (this |the )?tab/i],
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
