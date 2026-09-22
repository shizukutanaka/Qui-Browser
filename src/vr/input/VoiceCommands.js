/**
 * Voice Command System for VR
 * Hands-free control with natural language processing
 *
 * John Carmack principle: Voice is the ultimate VR input
 */

/**
 * Katakana → hiragana fold. ja-JP recognizers emit the same utterance in
 * kanji, katakana or a mix ('戻る' vs 'モドル'), so command patterns would
 * need every script variant listed without folding. U+30F6 (ヶ) folds to
 * U+3096 (ゖ) — contiguous katakana maps cleanly by −0x60.
 */
function foldKatakana(s) {
  return s.replace(/[ァ-ヶ]/g, (c) => String.fromCodePoint(c.codePointAt(0) - 0x60));
}

/**
 * NFKC + lowercase + whitespace collapse — NO kana fold. Regexp patterns
 * are tested on BOTH this and the folded form: a pattern spelled in
 * katakana (/トップ?サイト/) cannot match folded hiragana text, and one
 * spelled in hiragana cannot match katakana transcripts — covering both
 * keeps every existing pattern working whichever script the engine emits.
 */
function basicNormalizeSpeech(s) {
  return String(s === null || s === undefined ? '' : s)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalized form for regex patterns: NFKC (full-width 'ＶＲ'→'VR',
 * '：'→':'), lowercase, kana-folded, whitespace collapsed. Punctuation is
 * KEPT — argument-capturing patterns like /検索[:：]\s*(.+)/ need the colon.
 */
function normalizeSpeechText(s) {
  return foldKatakana(String(s === null || s === undefined ? '' : s)
    .normalize('NFKC')
    .toLowerCase())
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Compact form for literal patterns, aliases and the wake word: everything
 * `normalizeSpeechText` produces minus whitespace, punctuation and symbols.
 * An engine that appends a terminal '。' ('戻る。') or inserts no space
 * still lands on the command phrase exactly.
 */
function normalizeCommandText(s) {
  return normalizeSpeechText(s).replace(/[\s\p{P}\p{S}]/gu, '');
}

export class VoiceCommands {
  constructor() {
    this.recognition = null;
    this.synthesis = null;
    this.isListening = false;
    this.isEnabled = false;

    // Command registry
    this.commands = new Map();
    this.aliases = new Map();

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
    // Same compact normalization as command matching — 'キューブラウザ。'
    // or a katakana/whitespace variant still wakes.
    return normalizeCommandText(transcript)
      .includes(normalizeCommandText(this.settings.wakeWord));
  }

  /**
   * Process voice command
   */
  processCommand(transcript, confidence) {
    this.stats.commandsRecognized++;
    this.stats.averageConfidence = (this.stats.averageConfidence * (this.stats.commandsRecognized - 1) + confidence) / this.stats.commandsRecognized;

    // Normalize transcript — two forms: `normalized`/`unfolded` keep
    // punctuation for argument-capturing regexes, `compact` drops it for
    // literal/alias comparison (see the helpers above for why both exist).
    const normalized = normalizeSpeechText(transcript);
    const unfolded = basicNormalizeSpeech(transcript);
    const compact = normalizeCommandText(transcript);

    // Find matching command
    let matchedCommand = null;
    let matchedKey = null;

    // Check exact matches
    for (const [key, command] of this.commands) {
      if (command.patterns.some(pattern => {
        if (typeof pattern === 'string') {
          return compact === normalizeCommandText(pattern);
        } else if (pattern instanceof RegExp) {
          return pattern.test(normalized) || pattern.test(unfolded);
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
        if (compact.includes(normalizeCommandText(alias))) {
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
    // Navigation commands
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', /進[むめ]/],
      action: () => {
        window.history.forward();
        return { action: 'navigate', direction: 'forward' };
      },
      confirmationText: '進みます'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/],
      action: () => {
        window.history.back();
        return { action: 'navigate', direction: 'back' };
      },
      confirmationText: '戻ります'
    });

    this.registerCommand('refresh', {
      patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん'],
      action: () => {
        window.location.reload();
        return { action: 'refresh' };
      },
      confirmationText: '更新します'
    });

    // Search command — standalone fallback (connectBrowser replaces this with
    // real in-VR wiring). window.open returns null when the popup blocker
    // refuses it — speech results carry no transient user activation, so that
    // is the common case; falling back to location.href keeps the announced
    // action real instead of announcing a search that never happens.
    this.registerCommand('search', {
      patterns: [/検索[：:]\s*(.+)/, /さが[すせ][：:]\s*(.+)/, /サーチ[：:]\s*(.+)/],
      action: (transcript) => {
        const match = transcript.match(/[：:]\s*(.+)/);
        if (match && match[1]) {
          const query = match[1].trim();
          const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
          const opened = window.open(url, '_blank', 'noopener');
          if (!opened && window.location) {
            window.location.href = url;
          }
          return { action: 'search', query };
        }
      },
      confirmationText: '検索します',
      example: '検索：てんき'
    });

    // NOTE: vr-enter / vr-exit / volume-up / volume-down / ime-toggle are
    // registered in connectBrowser() instead. They used to live here as
    // placeholders that returned a result and spoke a confirmation while
    // performing no action — "VRモードを終了します" announced to a
    // voice-primary user who could not verify it, with the session still
    // running. Announcing an action that never happens is worse than no
    // command: those now exist only as real host-callback wiring.
    //
    // (scroll-down / scroll-up moved the same way earlier; navigate, back,
    // refresh and search keep host-page fallbacks that work when VoiceCommands
    // is embedded without connectBrowser.)

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
      }
    });

    // Stop listening
    this.registerCommand('stop', {
      patterns: ['停止', 'ストップ', 'やめて', '聞くな'],
      action: () => {
        this.stop();
        return { action: 'stop' };
      },
      confirmationText: '音声認識を停止します'
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
   * @param {Function} [opts.onEnterVR]     () => void — request the VR session
   *                                         (same path as the landing Enter-VR button)
   * @param {Function} [opts.onExitVR]      () => void — end the current XR session
   * @param {Function} [opts.onVolumeChange] (delta: number) => number — apply a
   *                                         master-volume step and return the new
   *                                         level (0-100) so it can be spoken back
   */
  connectBrowser({ tabManager, bookmarkPanel, vrKeyboard, onSearch, onTopSites, onGoTo,
    onClearHistory, onScrollContent, onEnterVR, onExitVR, onVolumeChange } = {}) {
    // Session / volume / IME commands are registered only when the host wires
    // them — a command that confirms an action it cannot perform is a lie the
    // voice-primary user cannot verify, so an unwired capability stays an
    // honest "command not recognized" (and stays out of the 'help' list).
    if (onEnterVR) {
      this.registerCommand('vr-enter', {
        patterns: ['VRモード', 'VR開始', 'ブイアール', 'バーチャルリアリティ'],
        action: () => {
          onEnterVR();
          return { action: 'vr', enabled: true };
        },
        confirmationText: 'VRモードを開始します'
      });
    }

    if (onExitVR) {
      this.registerCommand('vr-exit', {
        patterns: ['VR終了', 'VRやめる', '通常モード'],
        action: () => {
          onExitVR();
          return { action: 'vr', enabled: false };
        },
        confirmationText: 'VRモードを終了します'
      });
    }

    if (onVolumeChange) {
      // Speak the resulting level (the callback returns it) — a bare "音量を
      // 上げます" would leave the user unable to tell a real change from no-op.
      const volumeAction = (delta) => () => {
        const level = onVolumeChange(delta);
        if (typeof level === 'number') {
          this.speak(`音量 ${level}%`);
        }
        return { action: 'volume', level };
      };
      this.registerCommand('volume-up', {
        patterns: ['音量上げる', '音量アップ', 'ボリュームアップ'],
        action: volumeAction(0.1)
      });
      this.registerCommand('volume-down', {
        patterns: ['音量下げる', '音量ダウン', 'ボリュームダウン'],
        action: volumeAction(-0.1)
      });
    }

    // "日本語入力" — the Japanese IME lives inside the VR keyboard, so the
    // honest toggle is the keyboard itself (show() activates the IME; hide()
    // deactivates it). Registered only when the host supplies the keyboard.
    if (vrKeyboard) {
      this.registerCommand('ime-toggle', {
        patterns: ['日本語入力', '日本語モード', '入力切り替え'],
        action: () => {
          vrKeyboard.visible ? vrKeyboard.hide() : vrKeyboard.show();
          return { action: 'ime' };
        },
        confirmationText: '日本語入力を切り替えます'
      });
    }

    // Top Sites — hands-free jump to the user's most-used destination
    // (frecency-ranked). The heavy lifting (ranking + navigation + caption) is
    // the host's via onTopSites, mirroring the onSearch decoupling.
    if (onTopSites) {
      this.registerCommand('top-sites', {
        patterns: ['トップサイト', 'よく使うサイト', 'よくみるサイト', 'トップ', /トップ?サイト/],
        action: () => {
          onTopSites();
          return { action: 'top-sites' };
        },
        confirmationText: 'よく使うサイトを開きます'
      });
    }

    // Browser forward / back
    if (tabManager) {
      this.registerCommand('navigate', {
        patterns: ['進む', '次へ', 'すすむ', /進[むめ]/],
        action: () => {
          tabManager.getActiveTab?.()?.goForward?.();
          return { action: 'navigate', direction: 'forward' };
        },
        confirmationText: '進みます'
      });

      this.registerCommand('back', {
        patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/],
        action: () => {
          tabManager.getActiveTab?.()?.goBack?.();
          return { action: 'navigate', direction: 'back' };
        },
        confirmationText: '戻ります'
      });

      this.registerCommand('refresh', {
        patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん'],
        action: () => {
          tabManager.getActiveTab?.()?.reload?.();
          return { action: 'refresh' };
        },
        confirmationText: '更新します'
      });
    }

    // Clear browsing history (privacy) — hands-free equivalent of the settings
    // panel "Clear History" action (Session 56). Registered before the greedy
    // go-to catch-all. The '履歴' patterns don't collide with go-to's 'を開く'
    // capture, but specific-before-catch-all is the rule (processCommand stops
    // at the first match in registration order).
    if (onClearHistory) {
      this.registerCommand('clear-history', {
        patterns: [
          '履歴を消去', '履歴を削除', '履歴クリア', '履歴を消す', 'りれきを消去',
          /履歴を?(消去|削除|クリア|消す)/,
          /clear\s+history/i, /delete\s+history/i
        ],
        action: () => {
          onClearHistory();
          return { action: 'clear-history' };
        },
        confirmationText: '履歴を消去します',
        example: '履歴を消去'
      });
    }

    // Web search — route through VR address bar / tab navigation
    if (onSearch || tabManager) {
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
        example: '検索：てんき'
      });
    }

    // Scroll the reader viewport.
    //
    // This previously called `iframe.contentWindow.scrollBy`, which threw on
    // every cross-origin page (swallowed) and, even same-origin, scrolled an
    // iframe that is never visible in VR — so the command did nothing at all.
    // It now drives the panel's own reader viewport via onScrollContent.
    if (onScrollContent) {
      const SCROLL_LINES = 8;
      this.registerCommand('scroll-down', {
        patterns: ['下にスクロール', '下', 'した', 'スクロールダウン'],
        action: () => {
          onScrollContent(SCROLL_LINES);
          return { action: 'scroll', direction: 'down' };
        }
      });

      this.registerCommand('scroll-up', {
        patterns: ['上にスクロール', '上', 'うえ', 'スクロールアップ'],
        action: () => {
          onScrollContent(-SCROLL_LINES);
          return { action: 'scroll', direction: 'up' };
        }
      });
    }

    // Bookmark panel toggle
    if (bookmarkPanel) {
      this.registerCommand('bookmarks', {
        patterns: ['ブックマーク', 'お気に入り', '履歴'],
        action: () => {
          bookmarkPanel.toggle?.();
          return { action: 'bookmarks' };
        },
        confirmationText: 'ブックマークパネルを開きます'
      });
    }

    // Keyboard toggle
    this.registerCommand('keyboard', {
      patterns: ['キーボード', 'キーボードを開く', 'キーボードを閉じる'],
      action: () => {
        if (vrKeyboard) {
          vrKeyboard.visible ? vrKeyboard.hide() : vrKeyboard.show();
        }
        return { action: 'keyboard' };
      },
      confirmationText: 'キーボードを切り替えます'
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
    if (onGoTo) {
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
          if (query) {
            onGoTo(query);
          }
          return { action: 'go-to', query: query || null };
        },
        // Immediate "command understood" cue, like search/navigate/top-sites.
        // Spoken via TTS (blind users) and mirrored to captions via onSpeak
        // (deaf/HoH) the moment the command matches — before navigation, and
        // independent of whether a frecency hit is found (WCAG 4.1.3).
        confirmationText: '開きます',
        example: 'githubを開く'
      });
    }

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
    // recognition may be null after dispose() while isListening is still true
    // (its onend can no longer fire to clear the flag) — guard the deref so a
    // late stop() doesn't crash on a torn-down engine.
    if (this.isListening && this.recognition) {
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
    // feedback. Fires regardless of TTS availability.
    if (this.callbacks.onSpeak) {
      this.callbacks.onSpeak(text);
    }
    if (!this.synthesis) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    // volume and pitch both accept 0 as a real endpoint (mute / lowest pitch)
    // — `||` would silently substitute the default, so use nullish defaults.
    // rate keeps `||`: 0 is out of its 0.1–10 spec range, so falling back to
    // 1.0 on a bogus value is the right behaviour there.
    utterance.lang = options.lang || this.language;
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch ?? 1.0;
    utterance.volume = options.volume ?? 1.0;
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
 *   confirmationText: 'カスタムコマンドを実行します'
 * });
 *
 * // Set callbacks
 * voiceCommands.callbacks.onCommand = (name, result) => {
 *   console.debug('Command:', name, result);
 * };
 */
