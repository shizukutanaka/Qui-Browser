/**
 * Enhanced Video Player Component
 * YouTube風の高機能動画プレーヤー
 *
 * 機能:
 * - YouTube風キーボードショートカット
 * - Picture-in-Picture (PiP)
 * - 再生速度調整
 * - 品質選択
 * - タッチコントロール
 * - キーボードナビゲーション
 * - アクセシビリティ対応
 */

class EnhancedVideoPlayer {
  constructor(videoElement, options = {}) {
    this.video = videoElement;
    this.container = videoElement.parentElement;
    this.options = {
      enableKeyboardShortcuts: true,
      enablePiP: true,
      enableQualitySelection: true,
      enablePlaybackSpeed: true,
      enableTooltips: true,
      defaultPlaybackRate: 1.0,
      playbackRates: [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0],
      ...options
    };

    this.state = {
      isPlaying: false,
      isMuted: false,
      isFullscreen: false,
      isPiP: false,
      volume: 1.0,
      playbackRate: this.options.defaultPlaybackRate,
      currentTime: 0,
      duration: 0,
      buffered: 0
    };

    this.shortcuts = {
      // 再生制御
      'k': () => this.togglePlay(),
      ' ': () => this.togglePlay(),
      'm': () => this.toggleMute(),
      'f': () => this.toggleFullscreen(),
      'i': () => this.togglePictureInPicture(),
      't': () => this.toggleTheaterMode(),

      // 音量調整
      'ArrowUp': () => this.adjustVolume(0.05),
      'ArrowDown': () => this.adjustVolume(-0.05),

      // シーク
      'ArrowLeft': () => this.seek(-5),
      'ArrowRight': () => this.seek(5),
      'j': () => this.seek(-10),
      'l': () => this.seek(10),
      '0': () => this.seekToPercentage(0),
      '1': () => this.seekToPercentage(10),
      '2': () => this.seekToPercentage(20),
      '3': () => this.seekToPercentage(30),
      '4': () => this.seekToPercentage(40),
      '5': () => this.seekToPercentage(50),
      '6': () => this.seekToPercentage(60),
      '7': () => this.seekToPercentage(70),
      '8': () => this.seekToPercentage(80),
      '9': () => this.seekToPercentage(90),

      // 再生速度
      '>': () => this.changePlaybackSpeed(0.25),
      '<': () => this.changePlaybackSpeed(-0.25),

      // フレーム単位
      ',': () => this.frameStep(-1),
      '.': () => this.frameStep(1),

      // その他
      'c': () => this.toggleCaptions(),
      'Escape': () => this.exitFullscreen()
    };

    this.init();
  }

  init() {
    this.setupControls();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupAccessibility();
    this.updateState();
  }

  setupControls() {
    // カスタムコントロールのHTML生成
    const controls = document.createElement('div');
    controls.className = 'video-player-controls';
    controls.innerHTML = `
      <div class="video-player-progress">
        <div class="video-player-progress-bar">
          <div class="video-player-progress-buffered"></div>
          <div class="video-player-progress-played"></div>
          <div class="video-player-progress-handle"></div>
        </div>
      </div>
      <div class="video-player-bottom-controls">
        <button class="video-player-btn video-player-play" aria-label="再生/一時停止" title="再生 (k)">
          <svg class="video-player-icon-play" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          <svg class="video-player-icon-pause" viewBox="0 0 24 24" style="display:none;">
            <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
          </svg>
        </button>
        <button class="video-player-btn video-player-next" aria-label="次へ (Shift+N)" title="次へ">
          <svg viewBox="0 0 24 24">
            <path d="M6 4l12 8-12 8V4zm14 0v16h-2V4h2z"/>
          </svg>
        </button>
        <button class="video-player-btn video-player-volume" aria-label="ミュート (m)" title="ミュート">
          <svg class="video-player-icon-volume-high" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
          <svg class="video-player-icon-volume-muted" viewBox="0 0 24 24" style="display:none;">
            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
          </svg>
        </button>
        <input type="range" class="video-player-volume-slider" min="0" max="100" value="100" aria-label="音量">
        <span class="video-player-time">
          <span class="video-player-time-current">0:00</span> / <span class="video-player-time-duration">0:00</span>
        </span>
        <div class="video-player-spacer"></div>
        <button class="video-player-btn video-player-speed" aria-label="再生速度" title="再生速度 (Shift+>/<)">
          <span class="video-player-speed-label">1x</span>
        </button>
        <button class="video-player-btn video-player-quality" aria-label="品質" title="品質">
          <svg viewBox="0 0 24 24">
            <path d="M15 17h6v1h-6v-1zm-4 0H3v1h8v-2h1v1h-1zm3-9h1V4h-1v4zm-3 4h6v-1h-6v1zM6 4v4H5V4H3v4c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2V4H6zm13 4h1c1.1 0 2-.9 2-2V4h-2v4h-1V4h-2v4c0 1.1.9 2 2 2z"/>
          </svg>
        </button>
        <button class="video-player-btn video-player-pip" aria-label="ピクチャーインピクチャー (i)" title="ピクチャーインピクチャー">
          <svg viewBox="0 0 24 24">
            <path d="M19 7h-8v6h8V7zm2-4H3c-1.1 0-2 .9-2 2v14c0 1.1.9 1.98 2 1.98h18c1.1 0 2-.88 2-1.98V5c0-1.1-.9-2-2-2zm0 16.01H3V4.98h18v14.03z"/>
          </svg>
        </button>
        <button class="video-player-btn video-player-fullscreen" aria-label="フルスクリーン (f)" title="フルスクリーン">
          <svg class="video-player-icon-fullscreen-enter" viewBox="0 0 24 24">
            <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>
          </svg>
          <svg class="video-player-icon-fullscreen-exit" viewBox="0 0 24 24" style="display:none;">
            <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>
          </svg>
        </button>
      </div>
      <div class="video-player-speed-menu" style="display:none;">
        ${this.options.playbackRates.map(rate => `
          <button class="video-player-speed-option ${rate === this.options.defaultPlaybackRate ? 'active' : ''}" data-rate="${rate}">
            ${rate === 1 ? '標準' : rate + 'x'}
          </button>
        `).join('')}
      </div>
      <div class="video-player-overlay">
        <div class="video-player-overlay-center">
          <button class="video-player-overlay-play" aria-label="再生">
            <svg viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </button>
        </div>
        <div class="video-player-overlay-loading" style="display:none;">
          <div class="video-player-spinner"></div>
        </div>
      </div>
    `;

    this.container.classList.add('video-player-container');
    this.container.appendChild(controls);
    this.controls = controls;

    // コントロール要素への参照を保存
    this.elements = {
      playBtn: controls.querySelector('.video-player-play'),
      nextBtn: controls.querySelector('.video-player-next'),
      volumeBtn: controls.querySelector('.video-player-volume'),
      volumeSlider: controls.querySelector('.video-player-volume-slider'),
      timeDisplay: controls.querySelector('.video-player-time'),
      timeCurrent: controls.querySelector('.video-player-time-current'),
      timeDuration: controls.querySelector('.video-player-time-duration'),
      speedBtn: controls.querySelector('.video-player-speed'),
      speedLabel: controls.querySelector('.video-player-speed-label'),
      speedMenu: controls.querySelector('.video-player-speed-menu'),
      qualityBtn: controls.querySelector('.video-player-quality'),
      pipBtn: controls.querySelector('.video-player-pip'),
      fullscreenBtn: controls.querySelector('.video-player-fullscreen'),
      progressBar: controls.querySelector('.video-player-progress-bar'),
      progressPlayed: controls.querySelector('.video-player-progress-played'),
      progressBuffered: controls.querySelector('.video-player-progress-buffered'),
      progressHandle: controls.querySelector('.video-player-progress-handle'),
      overlay: controls.querySelector('.video-player-overlay'),
      overlayPlay: controls.querySelector('.video-player-overlay-play'),
      overlayLoading: controls.querySelector('.video-player-overlay-loading')
    };
  }

  setupEventListeners() {
    // ビデオイベント
    this.video.addEventListener('play', () => this.onPlay());
    this.video.addEventListener('pause', () => this.onPause());
    this.video.addEventListener('volumechange', () => this.onVolumeChange());
    this.video.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.video.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
    this.video.addEventListener('progress', () => this.onProgress());
    this.video.addEventListener('waiting', () => this.onWaiting());
    this.video.addEventListener('canplay', () => this.onCanPlay());
    this.video.addEventListener('ended', () => this.onEnded());
    this.video.addEventListener('enterpictureinpicture', () => this.onEnterPiP());
    this.video.addEventListener('leavepictureinpicture', () => this.onLeavePiP());

    // コントロールイベント
    this.elements.playBtn.addEventListener('click', () => this.togglePlay());
    this.elements.volumeBtn.addEventListener('click', () => this.toggleMute());
    this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value / 100));
    this.elements.speedBtn.addEventListener('click', () => this.toggleSpeedMenu());
    this.elements.pipBtn.addEventListener('click', () => this.togglePictureInPicture());
    this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.elements.overlayPlay.addEventListener('click', () => this.togglePlay());

    // プログレスバー
    this.elements.progressBar.addEventListener('click', (e) => this.onProgressClick(e));
    this.elements.progressBar.addEventListener('mousedown', () => this.onProgressDragStart());
    this.elements.progressBar.addEventListener('touchstart', () => this.onProgressDragStart());

    // 速度メニュー
    this.elements.speedMenu.querySelectorAll('.video-player-speed-option').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const rate = parseFloat(e.target.dataset.rate);
        this.setPlaybackRate(rate);
        this.toggleSpeedMenu();
      });
    });

    // フルスクリーン変更
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.onFullscreenChange());

    // コンテナホバー（コントロール表示）
    let hideControlsTimeout;
    this.container.addEventListener('mouseenter', () => {
      this.container.classList.add('video-player-controls-visible');
      clearTimeout(hideControlsTimeout);
    });
    this.container.addEventListener('mouseleave', () => {
      if (this.state.isPlaying) {
        hideControlsTimeout = setTimeout(() => {
          this.container.classList.remove('video-player-controls-visible');
        }, 2000);
      }
    });
    this.container.addEventListener('mousemove', () => {
      this.container.classList.add('video-player-controls-visible');
      clearTimeout(hideControlsTimeout);
      if (this.state.isPlaying) {
        hideControlsTimeout = setTimeout(() => {
          this.container.classList.remove('video-player-controls-visible');
        }, 2000);
      }
    });
  }

  setupKeyboardShortcuts() {
    if (!this.options.enableKeyboardShortcuts) return;

    document.addEventListener('keydown', (e) => {
      // 入力要素の場合はスキップ
      if (e.target.matches('input, textarea, select, [contenteditable]')) {
        return;
      }

      // Shift+キーの処理
      if (e.shiftKey) {
        if (e.key === '>') {
          e.preventDefault();
          this.changePlaybackSpeed(0.25);
          return;
        } else if (e.key === '<') {
          e.preventDefault();
          this.changePlaybackSpeed(-0.25);
          return;
        } else if (e.key === 'N') {
          e.preventDefault();
          this.playNext();
          return;
        } else if (e.key === 'P') {
          e.preventDefault();
          this.playPrevious();
          return;
        } else if (e.key === '?') {
          e.preventDefault();
          this.showKeyboardShortcuts();
          return;
        }
      }

      const handler = this.shortcuts[e.key];
      if (handler) {
        e.preventDefault();
        handler();
      }
    });
  }

  setupAccessibility() {
    this.video.setAttribute('tabindex', '0');
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', '動画プレーヤー');
  }

  // 再生制御
  togglePlay() {
    if (this.video.paused) {
      this.video.play();
    } else {
      this.video.pause();
    }
  }

  toggleMute() {
    this.video.muted = !this.video.muted;
  }

  adjustVolume(delta) {
    const newVolume = Math.max(0, Math.min(1, this.video.volume + delta));
    this.setVolume(newVolume);
  }

  setVolume(volume) {
    this.video.volume = volume;
    this.video.muted = volume === 0;
    this.elements.volumeSlider.value = volume * 100;
  }

  // シーク
  seek(seconds) {
    this.video.currentTime = Math.max(0, Math.min(this.video.duration, this.video.currentTime + seconds));
  }

  seekToPercentage(percentage) {
    this.video.currentTime = (this.video.duration * percentage) / 100;
  }

  frameStep(direction) {
    const frameTime = 1 / 30; // 30fps想定
    this.seek(frameTime * direction);
  }

  // 再生速度
  changePlaybackSpeed(delta) {
    const rates = this.options.playbackRates;
    const currentIndex = rates.indexOf(this.state.playbackRate);
    const newIndex = Math.max(0, Math.min(rates.length - 1, currentIndex + (delta > 0 ? 1 : -1)));
    this.setPlaybackRate(rates[newIndex]);
  }

  setPlaybackRate(rate) {
    this.video.playbackRate = rate;
    this.state.playbackRate = rate;
    this.elements.speedLabel.textContent = rate === 1 ? '1x' : rate + 'x';

    // メニューの選択状態更新
    this.elements.speedMenu.querySelectorAll('.video-player-speed-option').forEach(btn => {
      btn.classList.toggle('active', parseFloat(btn.dataset.rate) === rate);
    });

    this.showNotification(`再生速度: ${rate}x`);
  }

  toggleSpeedMenu() {
    const isVisible = this.elements.speedMenu.style.display !== 'none';
    this.elements.speedMenu.style.display = isVisible ? 'none' : 'block';
  }

  // フルスクリーン
  toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement &&
        !document.mozFullScreenElement && !document.msFullscreenElement) {
      this.enterFullscreen();
    } else {
      this.exitFullscreen();
    }
  }

  enterFullscreen() {
    if (this.container.requestFullscreen) {
      this.container.requestFullscreen();
    } else if (this.container.webkitRequestFullscreen) {
      this.container.webkitRequestFullscreen();
    } else if (this.container.mozRequestFullScreen) {
      this.container.mozRequestFullScreen();
    } else if (this.container.msRequestFullscreen) {
      this.container.msRequestFullscreen();
    }
  }

  exitFullscreen() {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }

  toggleTheaterMode() {
    this.container.classList.toggle('video-player-theater-mode');
    this.showNotification(
      this.container.classList.contains('video-player-theater-mode')
        ? 'シアターモード: オン'
        : 'シアターモード: オフ'
    );
  }

  // Picture-in-Picture
  async togglePictureInPicture() {
    if (!this.options.enablePiP) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await this.video.requestPictureInPicture();
      }
    } catch (err) {
      console.error('Picture-in-Picture エラー:', err);
      this.showNotification('Picture-in-Pictureはサポートされていません');
    }
  }

  // プレイリスト
  playNext() {
    this.dispatchEvent('next');
    this.showNotification('次の動画');
  }

  playPrevious() {
    this.dispatchEvent('previous');
    this.showNotification('前の動画');
  }

  toggleCaptions() {
    const tracks = this.video.textTracks;
    if (tracks.length > 0) {
      const track = tracks[0];
      track.mode = track.mode === 'showing' ? 'hidden' : 'showing';
      this.showNotification(track.mode === 'showing' ? '字幕: オン' : '字幕: オフ');
    }
  }

  // イベントハンドラ
  onPlay() {
    this.state.isPlaying = true;
    this.container.classList.add('video-player-playing');
    this.elements.playBtn.querySelector('.video-player-icon-play').style.display = 'none';
    this.elements.playBtn.querySelector('.video-player-icon-pause').style.display = 'block';
    this.elements.overlayPlay.style.display = 'none';
  }

  onPause() {
    this.state.isPlaying = false;
    this.container.classList.remove('video-player-playing');
    this.elements.playBtn.querySelector('.video-player-icon-play').style.display = 'block';
    this.elements.playBtn.querySelector('.video-player-icon-pause').style.display = 'none';
  }

  onVolumeChange() {
    this.state.volume = this.video.volume;
    this.state.isMuted = this.video.muted;

    const iconHigh = this.elements.volumeBtn.querySelector('.video-player-icon-volume-high');
    const iconMuted = this.elements.volumeBtn.querySelector('.video-player-icon-volume-muted');

    if (this.video.muted || this.video.volume === 0) {
      iconHigh.style.display = 'none';
      iconMuted.style.display = 'block';
    } else {
      iconHigh.style.display = 'block';
      iconMuted.style.display = 'none';
    }
  }

  onTimeUpdate() {
    this.state.currentTime = this.video.currentTime;
    this.updateProgress();
    this.updateTimeDisplay();
  }

  onLoadedMetadata() {
    this.state.duration = this.video.duration;
    this.updateTimeDisplay();
  }

  onProgress() {
    this.updateBuffered();
  }

  onWaiting() {
    this.elements.overlayLoading.style.display = 'flex';
  }

  onCanPlay() {
    this.elements.overlayLoading.style.display = 'none';
  }

  onEnded() {
    this.dispatchEvent('ended');
  }

  onEnterPiP() {
    this.state.isPiP = true;
    this.container.classList.add('video-player-pip-active');
  }

  onLeavePiP() {
    this.state.isPiP = false;
    this.container.classList.remove('video-player-pip-active');
  }

  onFullscreenChange() {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement ||
                            document.mozFullScreenElement || document.msFullscreenElement);
    this.state.isFullscreen = isFullscreen;
    this.container.classList.toggle('video-player-fullscreen', isFullscreen);

    const iconEnter = this.elements.fullscreenBtn.querySelector('.video-player-icon-fullscreen-enter');
    const iconExit = this.elements.fullscreenBtn.querySelector('.video-player-icon-fullscreen-exit');

    if (isFullscreen) {
      iconEnter.style.display = 'none';
      iconExit.style.display = 'block';
    } else {
      iconEnter.style.display = 'block';
      iconExit.style.display = 'none';
    }
  }

  onProgressClick(e) {
    const rect = this.elements.progressBar.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    this.video.currentTime = pos * this.video.duration;
  }

  onProgressDragStart() {
    this.isDragging = true;
    const onMouseMove = (e) => {
      if (this.isDragging) {
        this.onProgressClick(e);
      }
    };
    const onMouseUp = () => {
      this.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('touchend', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onMouseMove);
    document.addEventListener('touchend', onMouseUp);
  }

  // UI更新
  updateProgress() {
    const percentage = (this.video.currentTime / this.video.duration) * 100;
    this.elements.progressPlayed.style.width = percentage + '%';
    this.elements.progressHandle.style.left = percentage + '%';
  }

  updateBuffered() {
    if (this.video.buffered.length > 0) {
      const bufferedEnd = this.video.buffered.end(this.video.buffered.length - 1);
      const percentage = (bufferedEnd / this.video.duration) * 100;
      this.elements.progressBuffered.style.width = percentage + '%';
    }
  }

  updateTimeDisplay() {
    this.elements.timeCurrent.textContent = this.formatTime(this.video.currentTime);
    this.elements.timeDuration.textContent = this.formatTime(this.video.duration);
  }

  formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  showNotification(message) {
    // 既存の通知を削除
    const existing = this.container.querySelector('.video-player-notification');
    if (existing) {
      existing.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'video-player-notification';
    notification.textContent = message;
    this.container.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('video-player-notification-show');
    }, 10);

    setTimeout(() => {
      notification.classList.remove('video-player-notification-show');
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  showKeyboardShortcuts() {
    const shortcuts = `
      <div class="video-player-shortcuts-modal">
        <div class="video-player-shortcuts-content">
          <h3>キーボードショートカット</h3>
          <div class="video-player-shortcuts-grid">
            <div class="video-player-shortcuts-section">
              <h4>再生制御</h4>
              <dl>
                <dt>K または スペース</dt><dd>再生/一時停止</dd>
                <dt>J</dt><dd>10秒戻る</dd>
                <dt>L</dt><dd>10秒進む</dd>
                <dt>← →</dt><dd>5秒シーク</dd>
                <dt>0-9</dt><dd>動画の0-90%へ移動</dd>
                <dt>, .</dt><dd>1フレーム戻る/進む</dd>
              </dl>
            </div>
            <div class="video-player-shortcuts-section">
              <h4>音量</h4>
              <dl>
                <dt>M</dt><dd>ミュート切替</dd>
                <dt>↑ ↓</dt><dd>音量調整</dd>
              </dl>
            </div>
            <div class="video-player-shortcuts-section">
              <h4>表示</h4>
              <dl>
                <dt>F</dt><dd>フルスクリーン</dd>
                <dt>T</dt><dd>シアターモード</dd>
                <dt>I</dt><dd>Picture-in-Picture</dd>
                <dt>C</dt><dd>字幕切替</dd>
              </dl>
            </div>
            <div class="video-player-shortcuts-section">
              <h4>その他</h4>
              <dl>
                <dt>Shift + &gt;</dt><dd>速度を上げる</dd>
                <dt>Shift + &lt;</dt><dd>速度を下げる</dd>
                <dt>Shift + N</dt><dd>次の動画</dd>
                <dt>Shift + P</dt><dd>前の動画</dd>
                <dt>Shift + ?</dt><dd>このヘルプ</dd>
              </dl>
            </div>
          </div>
          <button class="video-player-shortcuts-close">閉じる</button>
        </div>
      </div>
    `;

    const modal = document.createElement('div');
    modal.innerHTML = shortcuts;
    this.container.appendChild(modal.firstElementChild);

    modal.querySelector('.video-player-shortcuts-close').addEventListener('click', () => {
      modal.firstElementChild.remove();
    });
  }

  updateState() {
    this.state.isPlaying = !this.video.paused;
    this.state.isMuted = this.video.muted;
    this.state.volume = this.video.volume;
    this.state.currentTime = this.video.currentTime;
    this.state.duration = this.video.duration;
    this.state.playbackRate = this.video.playbackRate;
  }

  dispatchEvent(name, detail = {}) {
    this.container.dispatchEvent(new CustomEvent(`videoplayer:${name}`, { detail }));
  }

  // 公開API
  getState() {
    return { ...this.state };
  }

  destroy() {
    this.controls.remove();
    this.container.classList.remove('video-player-container');
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedVideoPlayer;
} else {
  window.EnhancedVideoPlayer = EnhancedVideoPlayer;
}
