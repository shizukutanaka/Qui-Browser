/**
 * Voice Command System for VR
 * Hands-free control with natural language processing
 *
 * John Carmack principle: Voice is the ultimate VR input
 */

import { t, getLanguage } from '../../i18n/i18n.js';

/**
 * Map the app's 2-letter UI language code (from i18n.getLanguage(), 'en'/'ja')
 * to the BCP-47 tag the Web Speech APIs (SpeechRecognition/SpeechSynthesis)
 * require. Exported and pure so the mapping itself is directly testable
 * without constructing a VoiceCommands instance.
 *
 * Until this existed, `this.language` was hardcoded to 'ja-JP' at
 * construction with no i18n awareness anywhere in this file — an English-UI
 * user with enableVoice on got Japanese recognition/TTS regardless of their
 * chosen language, and all 25 confirmationText prompts were bare Japanese
 * literals (WCAG 3.1.2 Language of Parts). Voice is opt-in specifically for
 * users who find gaze/controller input difficult, so this silently defeated
 * the feature for exactly that population on the English UI.
 */
export function bcp47ForLanguage(lang) {
  return lang === 'en' ? 'en-US' : 'ja-JP';
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

    // Language settings — follows the UI language (i18n.getLanguage()), not
    // hardcoded. Sampled once at construction: there is currently no live
    // in-VR language toggle to react to (the only setLanguage(lang, root)
    // call site is the 2D landing page's button in src/main.js, before any
    // VR session — and VRApp constructs a fresh VoiceCommands on each
    // _buildVoiceCommands(), so a page reload after switching language on
    // the landing page picks up the new value here too).
    this.language = bcp47ForLanguage(getLanguage());
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
        this.speak(t('vr.voice.wakeAck'));
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

        // Speak confirmation if enabled — a catalog key (built-in commands)
        // takes priority and is resolved fresh via t() every time, so it
        // always speaks in the current language; a literal confirmationText
        // (custom commands registered via the public registerCommand() API)
        // is spoken exactly as given.
        if (matchedCommand.confirmationKey) {
          this.speak(t(matchedCommand.confirmationKey));
        } else if (matchedCommand.confirmationText) {
          this.speak(matchedCommand.confirmationText);
        }

      } catch (error) {
        console.error('VoiceCommands: Command execution failed', error);
        this.stats.commandsFailed++;
        this.speak(t('vr.voice.commandFailed'));
        if (this.callbacks.onCommandFailed) {
          this.callbacks.onCommandFailed({ reason: 'execution_error', transcript });
        }
      }

    } else {
      console.debug(`VoiceCommands: No matching command for "${transcript}"`);
      this.stats.commandsFailed++;
      this.speak(t('vr.voice.commandNotRecognized'));
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
    //
    // English patterns are appended (never prepended) to every array below:
    // _spokenExample()/help reads the FIRST plain-string pattern as the
    // phrase it announces, and prepending would silently switch what's read
    // aloud for existing (Japanese-primary) users — tested by the
    // pre-existing "every command with a literal string pattern appears in
    // the list" case.
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', /進[むめ]/, 'forward', 'go forward'],
      action: () => {
        window.history.forward();
        return { action: 'navigate', direction: 'forward' };
      },
      confirmationKey: 'vr.voice.confirm.navigate',
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/, 'back', 'go back'],
      action: () => {
        window.history.back();
        return { action: 'navigate', direction: 'back' };
      },
      confirmationKey: 'vr.voice.confirm.back',
      description: 'Navigate back'
    });

    this.registerCommand('refresh', {
      patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん', 'refresh', 'reload'],
      action: () => {
        window.location.reload();
        return { action: 'refresh' };
      },
      confirmationKey: 'vr.voice.confirm.refresh',
      description: 'Refresh page'
    });

    // Search command
    this.registerCommand('search', {
      patterns: [
        /検索[：:]\s*(.+)/, /さが[すせ][：:]\s*(.+)/, /サーチ[：:]\s*(.+)/,
        /^search\s*[：:]\s*(.+)/i
      ],
      action: (transcript) => {
        const match = transcript.match(/[：:]\s*(.+)/);
        if (match && match[1]) {
          const query = match[1];
          window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
          return { action: 'search', query };
        }
      },
      confirmationKey: 'vr.voice.confirm.search',
      description: 'Search web',
      example: '検索：てんき'
    });

    // VR mode control.
    //
    // 'vr-enter' cannot actually start a session from here: the WebXR spec
    // gates XRSystem.requestSession() behind transient user activation, and
    // a SpeechRecognition result event does not grant it — this app's own
    // PWA-auto-launch code (src/main.js) documents the identical constraint
    // for a *synthetic click*, which is closer to a real gesture than voice
    // ever is ("If the browser rejects it (SecurityError on desktop) the
    // user can still press the button"). Speaking a false "starting VR
    // mode" confirmation and then silently failing would be exactly the
    // "announced but nothing happened" defect voice commands exist to fix
    // (see stop-load, Session 75 続き22-24) — so this redirects honestly to
    // the one thing that does work, instead of pretending.
    this.registerCommand('vr-enter', {
      patterns: ['VRモード', 'VR開始', 'ブイアール', 'バーチャルリアリティ', 'vr mode', 'enter vr', 'start vr'],
      action: () => {
        this.speak(t('vr.voice.vrEnterUnavailable'));
        return { action: 'vr', enabled: false, unavailable: true };
      },
      description: 'Voice cannot start VR — WebXR requires a real user gesture'
    });

    // Exiting has no such restriction — XRSession.end() is not gated behind
    // activation — so this is a genuine hands-free command. The default
    // action here is a safe no-op stub; connectBrowser()'s onExitVR gives it
    // the real session handle once VRApp has wired one up.
    this.registerCommand('vr-exit', {
      patterns: ['VR終了', 'VRやめる', '通常モード', 'exit vr', 'stop vr', 'normal mode'],
      action: () => {
        return { action: 'vr', enabled: false };
      },
      confirmationKey: 'vr.voice.confirm.vrExit',
      description: 'Exit VR mode'
    });

    // NOTE: scroll-down / scroll-up are registered in connectBrowser() instead.
    // A duplicate pair used to live here calling `window.scrollBy`, which
    // scrolls the host page — meaningless inside an immersive session — and was
    // overwritten anyway (registerCommand is a Map.set, so the later
    // connectBrowser registration always won once it ran).

    // Volume control and Japanese IME mode. These defaults are silent no-ops:
    // VoiceCommands holds no audio or keyboard reference of its own, and a
    // no-op must not announce a change it didn't make. connectBrowser() gives
    // them real handles (onVolumeChange, vrKeyboard) and speaks the result.
    this.registerCommand('volume-up', {
      patterns: ['音量上げる', '音量アップ', 'ボリュームアップ', 'volume up', 'increase volume'],
      action: () => ({ action: 'volume', change: 0 }),
      description: 'Increase volume'
    });

    this.registerCommand('volume-down', {
      patterns: ['音量下げる', '音量ダウン', 'ボリュームダウン', 'volume down', 'decrease volume'],
      action: () => ({ action: 'volume', change: 0 }),
      description: 'Decrease volume'
    });

    this.registerCommand('ime-toggle', {
      patterns: ['日本語入力', '日本語モード', '入力切り替え', 'japanese input', 'toggle ime'],
      action: () => ({ action: 'ime' }),
      description: 'Switch hiragana / katakana input'
    });

    // Help — read back the actual spoken phrases, not just a count. A voice-
    // command user (often relying on voice because gaze/controller input is
    // difficult) has no other way to discover what to say; announcing "12
    // commands available" with no list defeats the purpose of a help command.
    this.registerCommand('help', {
      patterns: ['ヘルプ', '助けて', '使い方', '何ができる', 'help', 'what can i say'],
      action: () => {
        const phrases = Array.from(this.commands.values())
          .map((cmd) => this._spokenExample(cmd))
          .filter(Boolean);
        const commandList = phrases.join(t('vr.voice.helpSeparator'));

        this.speak(`${t('vr.voice.helpIntro')}${phrases.length}${t('vr.voice.helpIntroSuffix')}${commandList}`);
        return { action: 'help', commands: commandList };
      },
      description: 'Show help'
    });

    // Stop listening. Clearing isEnabled is what makes this real: stop()
    // alone just ends the current recognition, and onend's continuous-mode
    // restart brought listening straight back 100 ms later while the
    // confirmation had already said it stopped. connectBrowser() upgrades
    // this to turn the Voice setting off so the settings toggle agrees.
    this.registerCommand('stop', {
      patterns: ['停止', 'ストップ', 'やめて', '聞くな', 'stop listening', 'stop'],
      action: () => {
        this.isEnabled = false;
        this.stop();
        return { action: 'stop' };
      },
      confirmationKey: 'vr.voice.confirm.stopListening',
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
      // confirmationText: a literal string spoken as-is — the extensibility
      // point documented below for external/custom commands, which have no
      // catalog entry to look up.
      // confirmationKey: an i18n.js CATALOG key, resolved via t() at the
      // moment the command fires (not at registration time), so it always
      // reflects the current language even if it changes after
      // registerDefaultCommands()/connectBrowser() ran. Every built-in
      // command uses this instead of confirmationText.
      confirmationText: config.confirmationText || null,
      confirmationKey: config.confirmationKey || null,
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
   * @param {Function} [opts.onExitVR]       () => void — called to end the live WebXR
   *                                         session (host holds the renderer/session
   *                                         reference; VoiceCommands has none of its own)
   * @param {Function} [opts.onVolumeChange] (deltaPct: number) => {value, changed} —
   *                                         step the master volume; host clamps, persists
   *                                         and applies, and reports what actually happened
   * @param {Function} [opts.onStopListening] () => void — the voice "stop" command;
   *                                         host turns the Voice setting off (persisted,
   *                                         recognizer torn down, settings toggle updated)
   */
  connectBrowser({ tabManager, bookmarkPanel, vrKeyboard, onSearch, onTopSites, onGoTo,
    onClearHistory, onScrollContent, onFindInPage, onFindNext, onFollowLink, onExitVR,
    onVolumeChange, onStopListening } = {}) {
    // "Stop listening" = turn Voice off, exactly like the settings toggle, so
    // the toggle doesn't keep saying ON and the user knows where to turn it
    // back on. Without a host callback, still genuinely stop (no restart).
    this.registerCommand('stop', {
      patterns: ['停止', 'ストップ', 'やめて', '聞くな', 'stop listening', 'stop'],
      action: () => {
        this.isEnabled = false;
        this.stop();
        if (onStopListening) {
          onStopListening();
        }
        return { action: 'stop' };
      },
      confirmationKey: 'vr.voice.confirm.stopListening',
      description: 'Stop listening'
    });

    // Volume: step by the settings-panel stepper's own increment (10%) so
    // voice and the panel never disagree, and speak the RESULT — "already at
    // maximum" at the clamp, never "increasing" when nothing changed.
    const VOLUME_STEP = 10;
    const volumeCommand = (delta) => () => {
      const r = onVolumeChange ? onVolumeChange(delta) : null;
      if (!r) {
        return { action: 'volume', change: 0 };
      }
      this.speak(r.changed
        ? `${t('vr.voice.volumeLevel')} ${r.value}%`
        : t(delta > 0 ? 'vr.voice.volumeMax' : 'vr.voice.volumeMin'));
      return { action: 'volume', change: r.changed ? delta : 0, value: r.value };
    };
    this.registerCommand('volume-up', {
      patterns: ['音量上げる', '音量アップ', 'ボリュームアップ', 'volume up', 'increase volume'],
      action: volumeCommand(VOLUME_STEP),
      description: 'Increase volume'
    });
    this.registerCommand('volume-down', {
      patterns: ['音量下げる', '音量ダウン', 'ボリュームダウン', 'volume down', 'decrease volume'],
      action: volumeCommand(-VOLUME_STEP),
      description: 'Decrease volume'
    });

    // IME: there is no IME on/off in this app — romaji→kana is simply how the
    // keyboard always behaves. The one real, voice-unreachable IME action is
    // the hiragana⇄katakana switch, so this presses the keyboard's own shift
    // key (same path as the physical key: switchMode + key tint + badge).
    // A hidden keyboard is shown first so the result is visible. The 'shift'
    // branch of onKeyPress has no await before switchMode, so inputMode is
    // already updated when we read it to announce the new mode.
    this.registerCommand('ime-toggle', {
      patterns: ['日本語入力', '日本語モード', '入力切り替え', 'japanese input', 'toggle ime'],
      action: () => {
        if (!vrKeyboard) {
          return { action: 'ime' };
        }
        if (!vrKeyboard.group?.visible) {
          vrKeyboard.show();
        }
        Promise.resolve(vrKeyboard.onKeyPress('shift')).catch(() => {});
        const mode = vrKeyboard.ime?.inputMode === 'katakana' ? 'katakana' : 'hiragana';
        this.speak(t(mode === 'katakana' ? 'vr.voice.imeKatakana' : 'vr.voice.imeHiragana'));
        return { action: 'ime', mode };
      },
      description: 'Switch hiragana / katakana input'
    });

    // Give 'vr-exit' the real session handle. Unlike 'vr-enter' (see
    // registerDefaultCommands — starting a session needs user activation
    // voice can never grant), ending one is unrestricted, so this is a
    // genuine hands-free command once the host supplies onExitVR.
    this.registerCommand('vr-exit', {
      patterns: ['VR終了', 'VRやめる', '通常モード', 'exit vr', 'stop vr', 'normal mode'],
      action: () => {
        if (onExitVR) {
          onExitVR();
        }
        return { action: 'vr', enabled: false };
      },
      confirmationKey: 'vr.voice.confirm.vrExit',
      description: 'Exit VR mode'
    });

    // Top Sites — hands-free jump to the user's most-used destination
    // (frecency-ranked). The heavy lifting (ranking + navigation + caption) is
    // the host's via onTopSites, mirroring the onSearch decoupling.
    this.registerCommand('top-sites', {
      patterns: ['トップサイト', 'よく使うサイト', 'よくみるサイト', 'トップ', /トップ?サイト/, 'top sites', 'most visited'],
      action: () => {
        if (onTopSites) {
          onTopSites();
        }
        return { action: 'top-sites' };
      },
      confirmationKey: 'vr.voice.confirm.topSites',
      description: 'Open most-used site'
    });

    // Browser forward / back
    this.registerCommand('navigate', {
      patterns: ['進む', '次へ', 'すすむ', /進[むめ]/, 'forward', 'go forward'],
      action: () => {
        tabManager?.getActiveTab?.()?.goForward?.();
        return { action: 'navigate', direction: 'forward' };
      },
      confirmationKey: 'vr.voice.confirm.navigate',
      description: 'Navigate forward'
    });

    this.registerCommand('back', {
      patterns: ['戻る', '前へ', 'もどる', /戻[るれ]/, 'back', 'go back'],
      action: () => {
        tabManager?.getActiveTab?.()?.goBack?.();
        return { action: 'navigate', direction: 'back' };
      },
      confirmationKey: 'vr.voice.confirm.back',
      description: 'Navigate back'
    });

    this.registerCommand('refresh', {
      patterns: ['更新', '再読み込み', 'リフレッシュ', 'こうしん', 'refresh', 'reload'],
      action: () => {
        // Mirrors the chrome-bar reload slot's own overload: while a page is
        // still loading, "reload" has nothing finished to reload, so treat it
        // as the stop it would otherwise force the user to wait out. This is
        // the same fix as the reload button itself — voice had the identical
        // bug (restart an identical fetch on its own fresh 5s timer, forever
        // one press behind actually escaping a hung page).
        const tab = tabManager?.getActiveTab?.();
        if (tab?.loading) {
          tab.stop?.();
        } else {
          tab?.reload?.();
        }
        return { action: 'refresh' };
      },
      confirmationKey: 'vr.voice.confirm.refresh',
      description: 'Refresh page'
    });

    // Stop a page still loading. Separate command, separate key, from the
    // top-level 'stop' (voice recognition itself, registerDefaultCommands) —
    // that one's patterns (including the English 'stop'/'stop listening')
    // are all bare EXACT-STRING matches, and none of them equals the full
    // phrase "stop loading" that this command's regex requires, so the two
    // cannot collide even though 'stop' is a substring of 'stop-load's
    // English pattern. Reusing the key 'stop' in this Map would silently
    // replace it, which is why this lives under its own 'stop-load' key. A
    // gaze or controller user already reaches this via the chrome bar's
    // reload slot, which swaps to a stop control while loading; voice had no
    // path there at all until now — the same "control exists, no way to
    // reach it hands-free" shape this repo keeps finding.
    this.registerCommand('stop-load', {
      patterns: [/読み込みを?(停止|中止|やめ)/, /stop\s+loading/i],
      action: () => {
        tabManager?.getActiveTab?.()?.stop?.();
        return { action: 'stop-load' };
      },
      confirmationKey: 'vr.voice.confirm.stopLoad',
      description: 'Stop the page currently loading',
      example: '読み込みを停止'
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
      confirmationKey: 'vr.voice.confirm.clearHistory',
      description: 'Clear browsing history',
      example: '履歴を消去'
    });

    // Follow a link by its printed number.
    //
    // The reader prints links as "1. label", one row per destination, but the
    // only way to open one was to point at the row — gaze dwell or a
    // controller ray. A voice-primary user (the person enableVoice exists for)
    // could see every destination and open none of them. The mirror image of
    // the Session 66 gap, where scrolling was voice-only.
    //
    // MUST come before 'go-to': its /^(.+)を開く?/ matches 「1番を開く」 and
    // its /^(?:open|go to)\s+(.+)/i matches "open link 3" (both measured), and
    // processCommand stops at the first hit. go-to is registered last as the
    // catch-all, so registering here wins — pinned by a test.
    this.registerCommand('open-link', {
      patterns: [
        /(?:リンク)?\s*([0-9０-９]+)\s*(?:番)?\s*(?:を)?\s*開く/,
        /^リンク\s*([0-9０-９]+)$/,
        /open\s+link\s+(\d+)/i,
        /^link\s+(\d+)$/i
      ],
      action: (transcript) => {
        const m = transcript.match(/(?:リンク)?\s*([0-9０-９]+)\s*(?:番)?\s*(?:を)?\s*開く/)
          || transcript.match(/^リンク\s*([0-9０-９]+)$/)
          || transcript.match(/open\s+link\s+(\d+)/i)
          || transcript.match(/^link\s+(\d+)$/i);
        if (!m || !m[1]) {
          return;
        }
        // Japanese ASR and IMEs routinely emit full-width digits.
        const n = parseInt(m[1].replace(/[０-９]/g, (d) =>
          String.fromCharCode(d.charCodeAt(0) - 0xfee0)), 10);
        if (!Number.isFinite(n) || !onFollowLink) {
          return;
        }
        onFollowLink(n);
        return { action: 'open-link', index: n };
      },
      confirmationKey: 'vr.voice.confirm.openLink',
      description: 'Follow a numbered link in the reader',
      example: 'リンク3を開く'
    });

    // Find in page — search WITHIN the article the reader is showing.
    //
    // MUST come before 'search' in MATCH order: processCommand stops at the
    // first hit and search's /検索[：:]/ pattern is unanchored, so 「ページ内
    // 検索：てんき」 would otherwise be swallowed as a web search — the
    // registration-order trap the go-to catch-all documented (Session 18).
    // Registering earlier in this method is NOT enough: the constructor also
    // registers a 'search', and Map.set on an existing key KEEPS its original
    // insertion position — so the key must be deleted first for the browser
    // re-registration below to actually take a later slot. (Measured: without
    // the delete, find-in-page never fired.)
    this.commands.delete('search');
    this.registerCommand('find-in-page', {
      patterns: [/ページ内検索[：:]\s*(.+)/, /find on page\s+(.+)/i],
      action: (transcript) => {
        const m = transcript.match(/ページ内検索[：:]\s*(.+)/) || transcript.match(/find on page\s+(.+)/i);
        if (m && m[1] && onFindInPage) {
          onFindInPage(m[1].trim());
          return { action: 'find-in-page', query: m[1].trim() };
        }
      },
      confirmationKey: 'vr.voice.confirm.findInPage',
      description: 'Find text in the current page',
      example: 'ページ内検索：てんき'
    });

    // Jump to the next find-in-page match. 「次へ」 belongs to forward
    // navigation, so these phrases name the search result explicitly.
    this.registerCommand('find-next', {
      patterns: ['次の検索結果', '次のマッチ', /next match/i, /find next/i],
      action: () => {
        if (onFindNext) {
          onFindNext();
        }
        return { action: 'find-next' };
      },
      confirmationKey: 'vr.voice.confirm.findNext',
      description: 'Jump to the next match',
      example: '次の検索結果'
    });

    // Web search — route through VR address bar / tab navigation
    this.registerCommand('search', {
      patterns: [
        /検索[：:]\s*(.+)/, /さが[すせ][：:]\s*(.+)/, /サーチ[：:]\s*(.+)/,
        /^search\s*[：:]\s*(.+)/i
      ],
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
      confirmationKey: 'vr.voice.confirm.search',
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
      patterns: ['下にスクロール', '下', 'した', 'スクロールダウン', 'scroll down', 'down'],
      action: () => {
        if (onScrollContent) {
          onScrollContent(SCROLL_LINES);
        }
        return { action: 'scroll', direction: 'down' };
      },
      description: 'Scroll down'
    });

    this.registerCommand('scroll-up', {
      patterns: ['上にスクロール', '上', 'うえ', 'スクロールアップ', 'scroll up', 'up'],
      action: () => {
        if (onScrollContent) {
          onScrollContent(-SCROLL_LINES);
        }
        return { action: 'scroll', direction: 'up' };
      },
      description: 'Scroll up'
    });

    // Bookmark panel toggle
    this.registerCommand('bookmarks', {
      patterns: ['ブックマーク', 'お気に入り', '履歴', 'bookmarks', 'favorites', 'history'],
      action: () => {
        bookmarkPanel?.toggle?.();
        return { action: 'bookmarks' };
      },
      confirmationKey: 'vr.voice.confirm.bookmarks',
      description: 'Toggle bookmarks panel'
    });

    // Keyboard toggle
    this.registerCommand('keyboard', {
      patterns: ['キーボード', 'キーボードを開く', 'キーボードを閉じる', 'keyboard', 'open keyboard', 'close keyboard'],
      action: () => {
        // Visibility lives on the Three.js group; VRJapaneseKeyboard has no
        // `visible` of its own, so reading that made this always show() and
        // never hide(). group is null until the first show() builds it.
        if (vrKeyboard) {
          vrKeyboard.group?.visible ? vrKeyboard.hide() : vrKeyboard.show();
        }
        return { action: 'keyboard' };
      },
      confirmationKey: 'vr.voice.confirm.keyboard',
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
      confirmationKey: 'vr.voice.confirm.goTo',
      description: 'Open site by name from history/bookmarks, fall back to search',
      example: 'githubを開く'
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
  dispose({ keepSpeech = false } = {}) {
    this.isEnabled = false; // must happen before stop() to block onend restart
    this.stop();
    // Cancel any queued or in-progress utterance. Without this, an utterance
    // queued just before dispose() keeps speaking into a torn-down object
    // (null camera, freed GPU resources) — the same class of teardown bug
    // fixed for showVRToast() setTimeout in Session 4. `keepSpeech` is for
    // the one caller that WANTS its last line heard: the voice "stop" command,
    // whose own confirmation is queued just before this teardown runs.
    if (this.synthesis && !keepSpeech) {
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
    utterance.lang = options.lang || this.language;
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
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
