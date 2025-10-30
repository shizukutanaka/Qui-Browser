/**
 * Multimedia Translation System
 * Provides translation for audio/video content, subtitles, and real-time captioning
 */

class MultimediaTranslationSystem {
  constructor() {
    this.speechRecognizer = null;
    this.textToSpeech = null;
    this.subtitleTrack = null;
    this.isListening = false;
    this.currentCaptions = [];
    this.supportedFormats = ['mp4', 'webm', 'ogg', 'mp3', 'wav'];
  }

  /**
   * Initialize multimedia translation system
   */
  async initialize() {
    console.info('🎬 Multimedia Translation System initialized');
    await this.setupSpeechRecognition();
    await this.setupTextToSpeech();
    this.setupSubtitleIntegration();
    return true;
  }

  /**
   * Setup speech recognition for real-time captioning
   */
  async setupSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.speechRecognizer = new SpeechRecognition();

      this.speechRecognizer.continuous = true;
      this.speechRecognizer.interimResults = true;
      this.speechRecognizer.lang = i18next.language;

      this.speechRecognizer.onstart = () => {
        this.isListening = true;
        this.showCaptionStatus('🎤 Listening...');
      };

      this.speechRecognizer.onend = () => {
        this.isListening = false;
        this.showCaptionStatus('⏹️ Not listening');
      };

      this.speechRecognizer.onresult = (event) => {
        this.processSpeechResults(event);
      };

      this.speechRecognizer.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        this.showCaptionStatus(`❌ Error: ${event.error}`);
      };
    } else {
      console.warn('Speech recognition not supported in this browser');
    }
  }

  /**
   * Setup text-to-speech for audio playback
   */
  async setupTextToSpeech() {
    if ('speechSynthesis' in window) {
      // Text-to-speech is available
      this.textToSpeech = window.speechSynthesis;
      console.info('🔊 Text-to-speech initialized');
    } else {
      console.warn('Text-to-speech not supported');
    }
  }

  /**
   * Setup subtitle integration for video elements
   */
  setupSubtitleIntegration() {
    // Monitor for video elements
    this.observeVideoElements();

    // Add subtitle toggle buttons to existing videos
    document.querySelectorAll('video').forEach(video => {
      this.addSubtitleControls(video);
    });
  }

  /**
   * Observe for new video elements
   */
  observeVideoElements() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.tagName === 'VIDEO') {
            this.addSubtitleControls(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Add subtitle controls to video element
   */
  addSubtitleControls(video) {
    const controls = document.createElement('div');
    controls.className = 'subtitle-controls';
    controls.innerHTML = `
      <button class="subtitle-toggle" title="Toggle Subtitles">字幕</button>
      <button class="caption-toggle" title="Toggle Live Captions">字幕</button>
      <select class="subtitle-language">
        <option value="">言語を選択</option>
        ${this.generateLanguageOptions()}
      </select>
    `;

    // Add styles
    this.addSubtitleStyles();

    // Event listeners
    const subtitleToggle = controls.querySelector('.subtitle-toggle');
    const captionToggle = controls.querySelector('.caption-toggle');
    const languageSelect = controls.querySelector('.subtitle-language');

    subtitleToggle.addEventListener('click', () => {
      this.toggleSubtitles(video);
    });

    captionToggle.addEventListener('click', () => {
      this.toggleLiveCaptions(video);
    });

    languageSelect.addEventListener('change', (e) => {
      this.changeSubtitleLanguage(video, e.target.value);
    });

    video.parentNode.appendChild(controls);
  }

  /**
   * Generate language options for subtitle selector
   */
  generateLanguageOptions() {
    return languages.map(lang => {
      const selected = lang.code === i18next.language ? 'selected' : '';
      return `<option value="${lang.code}" ${selected}>${lang.nativeName}</option>`;
    }).join('');
  }

  /**
   * Toggle subtitle display
   */
  async toggleSubtitles(video) {
    const currentLang = i18next.language;
    const hasSubtitles = video.textTracks.length > 0;

    if (hasSubtitles) {
      // Toggle existing subtitles
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
      }
    } else {
      // Generate subtitles for current video
      await this.generateSubtitlesForVideo(video, currentLang);
    }
  }

  /**
   * Generate subtitles for video content
   */
  async generateSubtitlesForVideo(video, targetLang) {
    try {
      // Extract audio from video (this would require Web Audio API)
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioContext.createMediaElementSource(video);

      // In real implementation, this would use speech-to-text APIs
      // For now, we'll create placeholder subtitles
      await this.createPlaceholderSubtitles(video, targetLang);

    } catch (error) {
      console.error('Subtitle generation failed:', error);
    }
  }

  /**
   * Create placeholder subtitles for demonstration
   */
  async createPlaceholderSubtitles(video, targetLang) {
    const track = video.addTextTrack('captions', `Subtitles (${targetLang})`, targetLang);

    // Add some sample cues
    const cues = [
      { start: 0, end: 3, text: 'Welcome to the presentation' },
      { start: 3, end: 6, text: 'Today we will discuss' },
      { start: 6, end: 9, text: 'Important topics' }
    ];

    cues.forEach(cue => {
      const vttCue = new VTTCue(cue.start, cue.end, cue.text);
      track.addCue(vttCue);
    });

    track.mode = 'showing';
    console.info('📝 Placeholder subtitles added');
  }

  /**
   * Toggle live captions
   */
  toggleLiveCaptions(video) {
    if (!this.speechRecognizer) {
      alert('Speech recognition not supported in this browser');
      return;
    }

    if (this.isListening) {
      this.speechRecognizer.stop();
      this.hideLiveCaptions();
    } else {
      this.speechRecognizer.lang = i18next.language;
      this.speechRecognizer.start();
      this.showLiveCaptions();
    }
  }

  /**
   * Show live captions overlay
   */
  showLiveCaptions() {
    let captionContainer = document.getElementById('live-captions');

    if (!captionContainer) {
      captionContainer = document.createElement('div');
      captionContainer.id = 'live-captions';
      captionContainer.className = 'live-captions';
      captionContainer.innerHTML = `
        <div class="caption-text"></div>
        <div class="caption-controls">
          <button class="caption-clear">クリア</button>
          <button class="caption-export">エクスポート</button>
        </div>
      `;

      this.addCaptionStyles();
      document.body.appendChild(captionContainer);

      // Event listeners for controls
      captionContainer.querySelector('.caption-clear').addEventListener('click', () => {
        this.clearLiveCaptions();
      });

      captionContainer.querySelector('.caption-export').addEventListener('click', () => {
        this.exportCaptions();
      });
    }

    captionContainer.style.display = 'block';
  }

  /**
   * Hide live captions overlay
   */
  hideLiveCaptions() {
    const captionContainer = document.getElementById('live-captions');
    if (captionContainer) {
      captionContainer.style.display = 'none';
    }
  }

  /**
   * Process speech recognition results
   */
  processSpeechResults(event) {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    const captionText = document.querySelector('.caption-text');
    if (captionText) {
      captionText.innerHTML = `
        <span class="final">${finalTranscript}</span>
        <span class="interim">${interimTranscript}</span>
      `;
    }

    if (finalTranscript) {
      this.currentCaptions.push({
        text: finalTranscript,
        timestamp: new Date().toISOString(),
        language: i18next.language
      });

      // Auto-translate if different from UI language
      if (i18next.language !== 'en') {
        this.translateCaption(finalTranscript);
      }
    }
  }

  /**
   * Translate caption text
   */
  async translateCaption(text) {
    try {
      const translation = await window.machineTranslation.translate(text, i18next.language, 'en');
      const captionText = document.querySelector('.caption-text');

      if (captionText) {
        captionText.innerHTML += `
          <div class="translated-caption">
            <small>${translation}</small>
          </div>
        `;
      }
    } catch (error) {
      console.error('Caption translation failed:', error);
    }
  }

  /**
   * Show caption status
   */
  showCaptionStatus(message) {
    let statusElement = document.getElementById('caption-status');

    if (!statusElement) {
      statusElement = document.createElement('div');
      statusElement.id = 'caption-status';
      statusElement.className = 'caption-status';
      document.body.appendChild(statusElement);
    }

    statusElement.textContent = message;
    statusElement.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      if (statusElement) {
        statusElement.style.display = 'none';
      }
    }, 3000);
  }

  /**
   * Clear live captions
   */
  clearLiveCaptions() {
    this.currentCaptions = [];
    const captionText = document.querySelector('.caption-text');
    if (captionText) {
      captionText.innerHTML = '';
    }
  }

  /**
   * Export captions as file
   */
  exportCaptions() {
    if (this.currentCaptions.length === 0) {
      alert('No captions to export');
      return;
    }

    const format = 'vtt'; // WebVTT format
    let content = 'WEBVTT\n\n';

    this.currentCaptions.forEach((caption, index) => {
      const startTime = new Date(caption.timestamp);
      const endTime = new Date(startTime.getTime() + 3000); // Assume 3 second duration

      content += `${index + 1}\n`;
      content += `${this.formatTime(startTime)} --> ${this.formatTime(endTime)}\n`;
      content += `${caption.text}\n\n`;
    });

    // Download file
    const blob = new Blob([content], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions-${Date.now()}.vtt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Format time for VTT
   */
  formatTime(date) {
    return date.toISOString().substr(11, 12).replace('.', ',');
  }

  /**
   * Change subtitle language
   */
  async changeSubtitleLanguage(video, targetLang) {
    if (!targetLang) return;

    // Stop current subtitles
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'hidden';
    }

    // Generate new subtitles
    await this.generateSubtitlesForVideo(video, targetLang);
  }

  /**
   * Add caption styles
   */
  addCaptionStyles() {
    if (document.getElementById('caption-styles')) return;

    const style = document.createElement('style');
    style.id = 'caption-styles';
    style.textContent = `
      .live-captions {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        max-width: 80%;
        z-index: 1000;
        font-size: 18px;
        line-height: 1.4;
      }

      .caption-text {
        margin-bottom: 10px;
      }

      .final {
        color: white;
      }

      .interim {
        color: #ccc;
        font-style: italic;
      }

      .translated-caption {
        margin-top: 5px;
        font-size: 14px;
        opacity: 0.8;
      }

      .caption-controls {
        display: flex;
        gap: 10px;
        justify-content: center;
      }

      .caption-controls button {
        background: #007bff;
        color: white;
        border: none;
        padding: 5px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
      }

      .caption-controls button:hover {
        background: #0056b3;
      }

      .caption-status {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 10px 15px;
        border-radius: 4px;
        z-index: 1001;
      }

      .subtitle-controls {
        display: flex;
        gap: 5px;
        margin-top: 5px;
      }

      .subtitle-controls button,
      .subtitle-controls select {
        font-size: 12px;
        padding: 2px 6px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Add subtitle styles
   */
  addSubtitleStyles() {
    if (document.getElementById('subtitle-styles')) return;

    const style = document.createElement('style');
    style.id = 'subtitle-styles';
    style.textContent = `
      .subtitle-controls {
        display: flex;
        gap: 5px;
        margin-top: 5px;
        justify-content: center;
      }

      .subtitle-controls button {
        background: #007bff;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
      }

      .subtitle-controls select {
        background: white;
        border: 1px solid #ddd;
        padding: 2px 4px;
        border-radius: 3px;
        font-size: 11px;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Translate YouTube video captions
   */
  async translateYouTubeVideo(videoId, targetLang) {
    try {
      // Get video transcript (this would require YouTube API)
      const transcript = await this.getYouTubeTranscript(videoId);

      if (!transcript) {
        throw new Error('Transcript not available');
      }

      // Translate each caption
      const translatedCaptions = [];
      for (const caption of transcript) {
        const translation = await window.machineTranslation.translate(
          caption.text,
          targetLang,
          'en'
        );

        translatedCaptions.push({
          start: caption.start,
          end: caption.end,
          text: translation
        });
      }

      return translatedCaptions;
    } catch (error) {
      console.error('YouTube translation failed:', error);
      return null;
    }
  }

  /**
   * Get YouTube transcript (placeholder - would use YouTube API)
   */
  async getYouTubeTranscript(videoId) {
    // In real implementation, this would use YouTube Data API
    // For demonstration, return placeholder data
    return [
      { start: 0, end: 5, text: 'Hello and welcome to this video' },
      { start: 5, end: 10, text: 'Today we will discuss important topics' },
      { start: 10, end: 15, text: 'Let me explain the main concepts' }
    ];
  }

  /**
   * Get multimedia translation statistics
   */
  getMultimediaStats() {
    return {
      totalCaptions: this.currentCaptions.length,
      supportedLanguages: languages.length,
      supportedFormats: this.supportedFormats,
      speechRecognitionSupported: !!this.speechRecognizer,
      textToSpeechSupported: !!this.textToSpeech
    };
  }
}

// Initialize multimedia translation system
window.multimediaTranslation = new MultimediaTranslationSystem();

// Export for use in other modules
export { MultimediaTranslationSystem };
