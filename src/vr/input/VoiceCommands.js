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
      onCommand: null,
      onTranscript: null,
      onError: null,
      onStart: null,
      onEnd: null
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
      console.log('VoiceCommands: Initialized successfully');
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
      console.log('VoiceCommands: Listening started');

      if (this.callbacks.onStart) {
        this.callbacks.onStart();
      }
    };

    this.recognition.onend = () => {
      this.isListening = false;
      console.log('VoiceCommands: Listening ended');

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

    console.log(`VoiceCommands: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);

    // Callback for transcript
    if (this.callbacks.onTranscript) {
      this.callbacks.onTranscript(transcript, confidence, isFinal);
    }

    // Check confidence threshold
    if (confidence < this.settings.sensitivity) {
      console.log('VoiceCommands: Low confidence, ignoring');
      return;
    }

    // Check for wake word
    if (this.settings.requireWakeWord && !this.isAwake) {
      if (this.containsWakeWord(transcript)) {
        this.isAwake = true;
        this.speak('はい、聞いています'); // "Yes, I'm listening"
        console.log('VoiceCommands: Wake word detected');
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
      console.log(`VoiceCommands: Executing command "${matchedKey}"`);

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
        console.error(`VoiceCommands: Command execution failed`, error);
        this.stats.commandsFailed++;
        this.speak('コマンドの実行に失敗しました'); // "Command execution failed"
      }

    } else {
      console.log(`VoiceCommands: No matching command for "${transcript}"`);
      this.stats.commandsFailed++;
      this.speak('コマンドが認識できませんでした'); // "Command not recognized"
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
      description: 'Search web'
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

    // Scroll commands
    this.registerCommand('scroll-down', {
      patterns: ['下にスクロール', '下', 'した', 'スクロールダウン'],
      action: () => {
        window.scrollBy(0, 300);
        return { action: 'scroll', direction: 'down' };
      },
      description: 'Scroll down'
    });

    this.registerCommand('scroll-up', {
      patterns: ['上にスクロール', '上', 'うえ', 'スクロールアップ'],
      action: () => {
        window.scrollBy(0, -300);
        return { action: 'scroll', direction: 'up' };
      },
      description: 'Scroll up'
    });

    // Volume control
    this.registerCommand('volume-up', {
      patterns: ['音量上げる', '音量アップ', 'ボリュームアップ'],
      action: () => {
        // Would adjust volume
        return { action: 'volume', change: 0.1 };
      },
      confirmationText: '音量を上げます',
      description: 'Increase volume'
    });

    this.registerCommand('volume-down', {
      patterns: ['音量下げる', '音量ダウン', 'ボリュームダウン'],
      action: () => {
        // Would adjust volume
        return { action: 'volume', change: -0.1 };
      },
      confirmationText: '音量を下げます',
      description: 'Decrease volume'
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

    // Help
    this.registerCommand('help', {
      patterns: ['ヘルプ', '助けて', '使い方', '何ができる'],
      action: () => {
        const commandList = Array.from(this.commands.entries())
          .map(([key, cmd]) => `${key}: ${cmd.description}`)
          .join(', ');

        this.speak(`使用可能なコマンドは、${this.commands.size}個です`);
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
      metadata: config.metadata || {}
    });

    // Register aliases if provided
    if (config.aliases) {
      config.aliases.forEach(alias => {
        this.aliases.set(alias, name);
      });
    }

    console.log(`VoiceCommands: Registered command "${name}"`);
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
   * Start listening
   */
  start() {
    if (!this.isEnabled) {
      console.error('VoiceCommands: Not initialized');
      return false;
    }

    if (this.isListening) {
      console.log('VoiceCommands: Already listening');
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
   * Speak text (TTS)
   */
  speak(text, options = {}) {
    if (!this.synthesis) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = options.lang || this.language;
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;

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
      successRate: this.stats.commandsExecuted / this.stats.commandsRecognized || 0
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
 *     console.log('Custom command executed');
 *     return { action: 'custom' };
 *   },
 *   confirmationText: 'カスタムコマンドを実行します',
 *   description: 'Custom command'
 * });
 *
 * // Set callbacks
 * voiceCommands.callbacks.onCommand = (name, result) => {
 *   console.log('Command:', name, result);
 * };
 */