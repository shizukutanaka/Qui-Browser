/**
 * YouTube Embed Handler
 * YouTube動画の埋め込みと統合管理
 *
 * 機能:
 * - YouTube URLの自動検出
 * - 埋め込みプレーヤーの生成
 * - YouTube IFrame API統合
 * - プレイリスト対応
 * - プライバシー強化モード
 */

class YouTubeEmbedHandler {
  constructor(options = {}) {
    this.options = {
      enablePrivacyMode: true, // youtube-nocookie.comを使用
      autoplay: false,
      controls: true,
      modestbranding: true,
      rel: 0, // 関連動画を同じチャンネルのみに制限
      enablejsapi: 1, // JavaScript API有効化
      origin: window.location.origin,
      ...options
    };

    this.players = new Map();
    this.apiReady = false;
    this.apiLoadPromise = null;

    this.init();
  }

  init() {
    this.loadYouTubeAPI();
    this.setupAutoDetection();
  }

  /**
   * YouTube IFrame APIの読み込み
   */
  loadYouTubeAPI() {
    if (this.apiLoadPromise) {
      return this.apiLoadPromise;
    }

    this.apiLoadPromise = new Promise((resolve, reject) => {
      // 既に読み込まれている場合
      if (window.YT && window.YT.Player) {
        this.apiReady = true;
        resolve();
        return;
      }

      // グローバルコールバック設定
      window.onYouTubeIframeAPIReady = () => {
        this.apiReady = true;
        resolve();
      };

      // スクリプト読み込み
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.onerror = reject;
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    });

    return this.apiLoadPromise;
  }

  /**
   * 自動検出とリンク変換
   */
  setupAutoDetection() {
    // ページ内のYouTubeリンクを検出
    document.addEventListener('DOMContentLoaded', () => {
      this.detectYouTubeLinks();
    });

    // 動的コンテンツの監視
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            this.detectYouTubeLinksInElement(node);
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
   * YouTube URLからビデオIDを抽出
   */
  extractVideoId(url) {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/,
      /youtube\.com\/embed\/([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * プレイリストIDを抽出
   */
  extractPlaylistId(url) {
    const match = url.match(/[?&]list=([^&\s]+)/);
    return match ? match[1] : null;
  }

  /**
   * タイムスタンプを抽出
   */
  extractTimestamp(url) {
    const match = url.match(/[?&]t=(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }

  /**
   * 埋め込みURL生成
   */
  generateEmbedUrl(videoId, options = {}) {
    const domain = this.options.enablePrivacyMode
      ? 'youtube-nocookie.com'
      : 'youtube.com';

    const params = new URLSearchParams({
      autoplay: options.autoplay !== undefined ? options.autoplay : this.options.autoplay,
      controls: options.controls !== undefined ? options.controls : this.options.controls,
      modestbranding: this.options.modestbranding ? 1 : 0,
      rel: this.options.rel,
      enablejsapi: this.options.enablejsapi,
      origin: this.options.origin,
      ...options.params
    });

    if (options.playlistId) {
      params.set('list', options.playlistId);
    }

    if (options.start) {
      params.set('start', options.start);
    }

    return `https://www.${domain}/embed/${videoId}?${params.toString()}`;
  }

  /**
   * 埋め込みプレーヤーを作成
   */
  async createEmbed(container, videoId, options = {}) {
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }

    if (!container) {
      throw new Error('Container not found');
    }

    await this.apiLoadPromise;

    const playerId = `youtube-player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const playerDiv = document.createElement('div');
    playerDiv.id = playerId;
    playerDiv.className = 'youtube-embed-player';

    // サムネイルとプレースホルダー
    const placeholder = this.createPlaceholder(videoId, options);
    container.appendChild(placeholder);

    // プレーヤー作成
    // eslint-disable-next-line no-undef
    const player = new YT.Player(playerId, {
      videoId: videoId,
      width: options.width || '100%',
      height: options.height || '100%',
      playerVars: {
        autoplay: options.autoplay ? 1 : 0,
        controls: options.controls !== false ? 1 : 0,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1,
        origin: window.location.origin,
        playsinline: 1,
        ...options.playerVars
      },
      events: {
        onReady: (e) => this.onPlayerReady(e, playerId),
        onStateChange: (e) => this.onPlayerStateChange(e, playerId),
        onError: (e) => this.onPlayerError(e, playerId)
      }
    });

    this.players.set(playerId, {
      player,
      container,
      videoId,
      options
    });

    // プレースホルダーを置き換え
    placeholder.replaceWith(playerDiv);

    return { playerId, player };
  }

  /**
   * サムネイルプレースホルダー作成
   */
  createPlaceholder(videoId, options = {}) {
    const placeholder = document.createElement('div');
    placeholder.className = 'youtube-embed-placeholder';
    placeholder.style.cssText = `
      position: relative;
      width: 100%;
      padding-top: 56.25%; /* 16:9 aspect ratio */
      background: #000;
      cursor: pointer;
      overflow: hidden;
    `;

    // サムネイル画像
    const thumbnail = document.createElement('img');
    thumbnail.src = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    thumbnail.alt = 'YouTube video thumbnail';
    thumbnail.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
    `;
    thumbnail.onerror = () => {
      // フォールバック
      thumbnail.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    };

    // 再生ボタン
    const playButton = document.createElement('div');
    playButton.innerHTML = `
      <svg viewBox="0 0 68 48" style="width:68px;height:48px;">
        <path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00"></path>
        <path d="M 45,24 27,14 27,34" fill="#fff"></path>
      </svg>
    `;
    playButton.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      cursor: pointer;
      opacity: 0.9;
      transition: opacity 0.2s;
    `;

    placeholder.appendChild(thumbnail);
    placeholder.appendChild(playButton);

    // ホバーエフェクト
    placeholder.addEventListener('mouseenter', () => {
      playButton.style.opacity = '1';
    });
    placeholder.addEventListener('mouseleave', () => {
      playButton.style.opacity = '0.9';
    });

    return placeholder;
  }

  /**
   * ページ内のYouTubeリンクを検出
   */
  detectYouTubeLinks() {
    this.detectYouTubeLinksInElement(document.body);
  }

  detectYouTubeLinksInElement(element) {
    const links = element.querySelectorAll('a[href*="youtube.com"], a[href*="youtu.be"]');

    links.forEach(link => {
      if (link.classList.contains('youtube-auto-embed-processed')) {
        return;
      }

      const videoId = this.extractVideoId(link.href);
      if (videoId && link.dataset.autoEmbed !== 'false') {
        this.convertLinkToEmbed(link, videoId);
      }

      link.classList.add('youtube-auto-embed-processed');
    });
  }

  /**
   * リンクを埋め込みに変換
   */
  convertLinkToEmbed(link, videoId) {
    const container = document.createElement('div');
    container.className = 'youtube-auto-embed-container';
    container.style.cssText = 'max-width: 100%; margin: 16px 0;';

    const playlistId = this.extractPlaylistId(link.href);
    const timestamp = this.extractTimestamp(link.href);

    link.parentNode.insertBefore(container, link);
    link.style.display = 'none'; // 元のリンクは非表示

    this.createEmbed(container, videoId, {
      playlistId,
      start: timestamp,
      autoplay: false
    });
  }

  /**
   * プレーヤーイベントハンドラ
   */
  onPlayerReady(event, playerId) {
    const playerData = this.players.get(playerId);
    if (playerData && playerData.options.onReady) {
      playerData.options.onReady(event);
    }

    // カスタムイベント発火
    this.dispatchEvent('playerReady', { playerId, event });
  }

  onPlayerStateChange(event, playerId) {
    const playerData = this.players.get(playerId);
    /* eslint-disable no-undef */
    const states = {
      [-1]: 'unstarted',
      [YT.PlayerState.ENDED]: 'ended',
      [YT.PlayerState.PLAYING]: 'playing',
      [YT.PlayerState.PAUSED]: 'paused',
      [YT.PlayerState.BUFFERING]: 'buffering',
      [YT.PlayerState.CUED]: 'cued'
    };
    /* eslint-enable no-undef */

    const stateName = states[event.data] || 'unknown';

    if (playerData && playerData.options.onStateChange) {
      playerData.options.onStateChange(event, stateName);
    }

    // カスタムイベント発火
    this.dispatchEvent('playerStateChange', { playerId, state: stateName, event });
  }

  onPlayerError(event, playerId) {
    const playerData = this.players.get(playerId);
    const errorMessages = {
      2: 'リクエストに無効なパラメータが含まれています',
      5: 'HTML5プレーヤーでエラーが発生しました',
      100: 'この動画は見つかりませんでした',
      101: 'この動画の所有者は埋め込みを許可していません',
      150: 'この動画の所有者は埋め込みを許可していません'
    };

    const errorMessage = errorMessages[event.data] || '不明なエラーが発生しました';

    console.error(`YouTube Player Error (${playerId}):`, errorMessage);

    if (playerData && playerData.options.onError) {
      playerData.options.onError(event, errorMessage);
    }

    // カスタムイベント発火
    this.dispatchEvent('playerError', { playerId, errorCode: event.data, errorMessage, event });
  }

  /**
   * プレーヤー制御
   */
  getPlayer(playerId) {
    const playerData = this.players.get(playerId);
    return playerData ? playerData.player : null;
  }

  play(playerId) {
    const player = this.getPlayer(playerId);
    if (player) player.playVideo();
  }

  pause(playerId) {
    const player = this.getPlayer(playerId);
    if (player) player.pauseVideo();
  }

  stop(playerId) {
    const player = this.getPlayer(playerId);
    if (player) player.stopVideo();
  }

  seekTo(playerId, seconds) {
    const player = this.getPlayer(playerId);
    if (player) player.seekTo(seconds, true);
  }

  setVolume(playerId, volume) {
    const player = this.getPlayer(playerId);
    if (player) player.setVolume(volume);
  }

  mute(playerId) {
    const player = this.getPlayer(playerId);
    if (player) player.mute();
  }

  unmute(playerId) {
    const player = this.getPlayer(playerId);
    if (player) player.unMute();
  }

  /**
   * プレーヤー情報取得
   */
  getCurrentTime(playerId) {
    const player = this.getPlayer(playerId);
    return player ? player.getCurrentTime() : 0;
  }

  getDuration(playerId) {
    const player = this.getPlayer(playerId);
    return player ? player.getDuration() : 0;
  }

  getPlayerState(playerId) {
    const player = this.getPlayer(playerId);
    return player ? player.getPlayerState() : -1;
  }

  /**
   * プレーヤー削除
   */
  destroyPlayer(playerId) {
    const playerData = this.players.get(playerId);
    if (playerData) {
      playerData.player.destroy();
      this.players.delete(playerId);
    }
  }

  destroyAllPlayers() {
    this.players.forEach((playerData, playerId) => {
      playerData.player.destroy();
    });
    this.players.clear();
  }

  /**
   * イベント発火
   */
  dispatchEvent(name, detail) {
    const event = new CustomEvent(`youtube:${name}`, { detail });
    document.dispatchEvent(event);
  }

  /**
   * ユーティリティ
   */
  static isYouTubeUrl(url) {
    return /(?:youtube\.com|youtu\.be)/.test(url);
  }

  static getThumbnailUrl(videoId, quality = 'maxresdefault') {
    // quality: maxresdefault, hqdefault, mqdefault, sddefault, default
    return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
  }

  static getWatchUrl(videoId) {
    return `https://www.youtube.com/watch?v=${videoId}`;
  }

  static getShareUrl(videoId) {
    return `https://youtu.be/${videoId}`;
  }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = YouTubeEmbedHandler;
} else {
  window.YouTubeEmbedHandler = YouTubeEmbedHandler;
}
