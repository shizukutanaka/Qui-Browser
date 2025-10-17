/**
 * Qui Browser VR Help System
 * VRデバイス専用ヘルプ・チュートリアルシステム
 *
 * 機能:
 * - インタラクティブなチュートリアル
 * - コンテキストヘルプ
 * - ジェスチャーガイド
 * - トラブルシューティング
 * - FAQシステム
 * - 進捗追跡
 */

class VRHelpSystem {
  constructor() {
    this.helpContent = new Map();
    this.tutorials = new Map();
    this.userProgress = new Map();
    this.helpUI = null;
    this.currentTutorial = null;
    this.isVisible = false;

    // ヘルプ設定
    this.settings = {
      showTooltips: true,
      autoShowHelp: true,
      tutorialSpeed: 'normal', // slow, normal, fast
      voiceGuidance: false,
      highlightElements: true
    };

    this.init();
  }

  init() {
    // ヘルプコンテンツの初期化
    this.initializeHelpContent();

    // チュートリアルの初期化
    this.initializeTutorials();

    // ユーザー進捗の読み込み
    this.loadUserProgress();

    // UIの作成
    this.createHelpUI();

    // イベントリスナーの設定
    this.setupEventListeners();

    console.log('[VR Help] VR Help System initialized');
  }

  /**
   * ヘルプコンテンツの初期化
   */
  initializeHelpContent() {
    // 基本操作のヘルプ
    this.helpContent.set('basic-navigation', {
      title: '基本ナビゲーション',
      content: `
        <h3>VR空間内の移動</h3>
        <ul>
          <li><strong>テレポート:</strong> ピンチジェスチャーで目的地を選択</li>
          <li><strong>スムーズ移動:</li> コントローラーのスティックを使用</li>
          <li><strong>回転:</strong> コントローラーのトリガーを使用</li>
        </ul>
      `,
      category: 'navigation',
      keywords: ['移動', 'テレポート', '回転']
    });

    this.helpContent.set('gesture-controls', {
      title: 'ジェスチャーコントロール',
      content: `
        <h3>利用可能なジェスチャー</h3>
        <ul>
          <li><strong>ピンチ:</strong> テレポート先の選択</li>
          <li><strong>握り拳:</strong> 緊急停止</li>
          <li><strong>開いた手:</strong> メニュー表示</li>
          <li><strong>親指立て:</strong> クイックメニュー</li>
          <li><strong>指さし:</strong> インタラクション</li>
        </ul>
      `,
      category: 'gestures',
      keywords: ['ジェスチャー', '手', '操作']
    });

    this.helpContent.set('settings-access', {
      title: '設定へのアクセス',
      content: `
        <h3>VR設定を開く方法</h3>
        <ul>
          <li><strong>キーボード:</strong> Ctrl+Alt+S</li>
          <li><strong>メニュー:</strong> 設定ボタンをクリック</li>
          <li><strong>音声:</strong> 「設定を開く」と言う</li>
        </ul>
      `,
      category: 'settings',
      keywords: ['設定', 'アクセス', 'メニュー']
    });

    this.helpContent.set('troubleshooting', {
      title: 'トラブルシューティング',
      content: `
        <h3>よくある問題と解決法</h3>
        <ul>
          <li><strong>FPSが低い:</strong> 設定で品質を下げる</li>
          <li><strong>バッテリー消耗が早い:</strong> 低消費モードを有効化</li>
          <li><strong>ネットワークエラー:</strong> オフラインモードを確認</li>
          <li><strong>ジェスチャーが効かない:</strong> ハンドトラッキングを再起動</li>
        </ul>
      `,
      category: 'troubleshooting',
      keywords: ['問題', '解決', 'エラー']
    });
  }

  /**
   * チュートリアルの初期化
   */
  initializeTutorials() {
    // 入門チュートリアル
    this.tutorials.set('getting-started', {
      id: 'getting-started',
      title: 'VRブラウザ入門',
      description: 'Qui Browser VRの基本的な使い方を学びましょう',
      estimatedTime: 5,
      steps: [
        {
          id: 'welcome',
          title: 'ようこそ',
          content: 'Qui Browser VRへようこそ。このチュートリアルでは基本的な操作を学びます。',
          action: 'next'
        },
        {
          id: 'navigation-intro',
          title: '移動の基本',
          content: 'VR空間内を移動するには、ピンチジェスチャーを使ってテレポートできます。',
          action: 'highlight',
          target: 'gesture-area',
          gesture: 'pinch'
        },
        {
          id: 'menu-intro',
          title: 'メニューの使い方',
          content: '開いた手のジェスチャーで各種メニューを表示できます。',
          action: 'highlight',
          target: 'menu-area',
          gesture: 'open'
        },
        {
          id: 'settings-intro',
          title: '設定のカスタマイズ',
          content: 'Ctrl+Alt+Sで設定画面を開き、好みに合わせて調整できます。',
          action: 'show-settings'
        },
        {
          id: 'complete',
          title: '完了',
          content: '基本操作を学びました。ヘルプはいつでも利用可能です。',
          action: 'complete'
        }
      ]
    });

    // ジェスチャー操作チュートリアル
    this.tutorials.set('gesture-mastery', {
      id: 'gesture-mastery',
      title: 'ジェスチャーマスター',
      description: '全てのジェスチャー操作をマスターしましょう',
      estimatedTime: 10,
      steps: [
        {
          id: 'pinch-tutorial',
          title: 'ピンチジェスチャー',
          content: '親指と人差し指でつまむジェスチャーです。テレポートに使用します。',
          action: 'demonstrate',
          gesture: 'pinch'
        },
        {
          id: 'fist-tutorial',
          title: '握り拳ジェスチャー',
          content: '全ての指を握るジェスチャーです。緊急停止に使用します。',
          action: 'demonstrate',
          gesture: 'fist'
        },
        {
          id: 'open-tutorial',
          title: '開いた手ジェスチャー',
          content: '手のひらを開くジェスチャーです。メニュー表示に使用します。',
          action: 'demonstrate',
          gesture: 'open'
        },
        {
          id: 'point-tutorial',
          title: '指さしジェスチャー',
          content: '人差し指を伸ばすジェスチャーです。インタラクションに使用します。',
          action: 'demonstrate',
          gesture: 'point'
        },
        {
          id: 'thumbs-up-tutorial',
          title: '親指立てジェスチャー',
          content: '親指を立てるジェスチャーです。クイックメニューに使用します。',
          action: 'demonstrate',
          gesture: 'thumbsUp'
        }
      ]
    });
  }

  /**
   * ユーザー進捗の読み込み
   */
  loadUserProgress() {
    try {
      const progress = localStorage.getItem('qui-vr-help-progress');
      if (progress) {
        const parsed = JSON.parse(progress);
        Object.entries(parsed).forEach(([tutorialId, tutorialProgress]) => {
          this.userProgress.set(tutorialId, tutorialProgress);
        });
      }
    } catch (error) {
      console.warn('[VR Help] Failed to load user progress:', error);
    }
  }

  /**
   * ユーザー進捗の保存
   */
  saveUserProgress() {
    try {
      const progress = {};
      this.userProgress.forEach((tutorialProgress, tutorialId) => {
        progress[tutorialId] = tutorialProgress;
      });
      localStorage.setItem('qui-vr-help-progress', JSON.stringify(progress));
    } catch (error) {
      console.warn('[VR Help] Failed to save user progress:', error);
    }
  }

  /**
   * ヘルプUIの作成
   */
  createHelpUI() {
    // ヘルプコンテナの作成
    this.helpUI = document.createElement('div');
    this.helpUI.id = 'vr-help-container';
    this.helpUI.className = 'vr-help-container';
    this.helpUI.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.9);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: white;
    `;

    // ヘルプパネルの作成
    const panel = document.createElement('div');
    panel.className = 'vr-help-panel';
    panel.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      border-radius: 16px;
      max-width: 800px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      padding: 24px;
      color: #172b4d;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    `;

    // ヘッダー
    const header = this.createHelpHeader();
    panel.appendChild(header);

    // コンテンツエリア
    const content = document.createElement('div');
    content.className = 'vr-help-content';
    content.style.cssText = `
      margin: 20px 0;
      min-height: 200px;
    `;
    panel.appendChild(content);

    // フッター
    const footer = this.createHelpFooter();
    panel.appendChild(footer);

    this.helpUI.appendChild(panel);
    document.body.appendChild(this.helpUI);

    this.contentArea = content;
  }

  /**
   * ヘルプヘッダーの作成
   */
  createHelpHeader() {
    const header = document.createElement('div');
    header.className = 'vr-help-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e1e5e9;
    `;

    const title = document.createElement('h2');
    title.textContent = 'VRヘルプ';
    title.style.cssText = `
      margin: 0;
      color: #172b4d;
      font-size: 24px;
      font-weight: 600;
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'vr-help-close';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b778c;
      padding: 4px 8px;
      border-radius: 4px;
      transition: all 0.2s;
    `;
    closeButton.addEventListener('click', () => this.hide());
    closeButton.addEventListener('mouseover', () => {
      closeButton.style.background = '#f4f5f7';
      closeButton.style.color = '#172b4d';
    });
    closeButton.addEventListener('mouseout', () => {
      closeButton.style.background = 'none';
      closeButton.style.color = '#6b778c';
    });

    header.appendChild(title);
    header.appendChild(closeButton);

    return header;
  }

  /**
   * ヘルプフッターの作成
   */
  createHelpFooter() {
    const footer = document.createElement('div');
    footer.className = 'vr-help-footer';
    footer.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e1e5e9;
    `;

    // ナビゲーションボタン
    const navButtons = document.createElement('div');
    navButtons.className = 'vr-help-navigation';
    navButtons.style.cssText = `
      display: flex;
      gap: 8px;
    `;

    const prevButton = document.createElement('button');
    prevButton.textContent = '前へ';
    prevButton.className = 'vr-help-nav-prev';
    prevButton.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #dfe1e6;
      border-radius: 4px;
      background: white;
      color: #6b778c;
      cursor: pointer;
      font-size: 14px;
    `;
    prevButton.addEventListener('click', () => this.navigateTutorial(-1));

    const nextButton = document.createElement('button');
    nextButton.textContent = '次へ';
    nextButton.className = 'vr-help-nav-next';
    nextButton.style.cssText = `
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      background: #0052cc;
      color: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    `;
    nextButton.addEventListener('click', () => this.navigateTutorial(1));

    navButtons.appendChild(prevButton);
    navButtons.appendChild(nextButton);

    // 完了ボタン
    const completeButton = document.createElement('button');
    completeButton.textContent = '完了';
    completeButton.className = 'vr-help-complete';
    completeButton.style.cssText = `
      padding: 8px 16px;
      border: 1px solid #dfe1e6;
      border-radius: 4px;
      background: white;
      color: #6b778c;
      cursor: pointer;
      font-size: 14px;
    `;
    completeButton.addEventListener('click', () => this.completeTutorial());

    footer.appendChild(navButtons);
    footer.appendChild(completeButton);

    this.navButtons = { prev: prevButton, next: nextButton, complete: completeButton };

    return footer;
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // キーボードショートカット
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey && event.altKey && event.key === 'h') {
        event.preventDefault();
        this.toggle();
      }
    });

    // VRジェスチャー統合
    if (window.vrGestureControls) {
      window.vrGestureControls.onGesture('open', (action, data) => {
        if (action === 'start' && this.settings.autoShowHelp) {
          this.showContextHelp('menu-area');
        }
      });
    }

    // 背景クリックで閉じる
    this.helpUI.addEventListener('click', (event) => {
      if (event.target === this.helpUI) {
        this.hide();
      }
    });
  }

  /**
   * ヘルプの表示
   */
  show(contentId = null, tutorialId = null) {
    if (tutorialId) {
      this.startTutorial(tutorialId);
    } else if (contentId) {
      this.showHelpContent(contentId);
    } else {
      this.showHelpOverview();
    }

    this.helpUI.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * ヘルプの非表示
   */
  hide() {
    this.helpUI.style.display = 'none';
    this.isVisible = false;
    this.currentTutorial = null;
  }

  /**
   * ヘルプの表示/非表示切り替え
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * ヘルプ概要の表示
   */
  showHelpOverview() {
    const overview = `
      <h3>VRヘルプセンター</h3>
      <div class="help-categories">
        <div class="help-category" data-category="getting-started">
          <h4>🚀 はじめに</h4>
          <p>Qui Browser VRの基本的な使い方を学びましょう</p>
          <button onclick="vrHelpSystem.startTutorial('getting-started')">チュートリアル開始</button>
        </div>
        <div class="help-category" data-category="gestures">
          <h4>✋ ジェスチャー操作</h4>
          <p>ハンドトラッキングによる直感的な操作方法</p>
          <button onclick="vrHelpSystem.showHelpContent('gesture-controls')">詳細を見る</button>
        </div>
        <div class="help-category" data-category="navigation">
          <h4>🧭 ナビゲーション</h4>
          <p>VR空間内の移動と操作</p>
          <button onclick="vrHelpSystem.showHelpContent('basic-navigation')">詳細を見る</button>
        </div>
        <div class="help-category" data-category="settings">
          <h4>⚙️ 設定</h4>
          <p>ブラウザのカスタマイズ方法</p>
          <button onclick="vrHelpSystem.showHelpContent('settings-access')">詳細を見る</button>
        </div>
        <div class="help-category" data-category="troubleshooting">
          <h4>🔧 トラブルシューティング</h4>
          <p>問題解決のためのガイド</p>
          <button onclick="vrHelpSystem.showHelpContent('troubleshooting')">詳細を見る</button>
        </div>
      </div>
    `;

    this.contentArea.innerHTML = overview;
    this.updateNavigationButtons(false);
  }

  /**
   * ヘルプコンテンツの表示
   */
  showHelpContent(contentId) {
    const content = this.helpContent.get(contentId);
    if (!content) {
      this.showHelpOverview();
      return;
    }

    const html = `
      <h3>${content.title}</h3>
      <div class="help-content">
        ${content.content}
      </div>
      <div class="help-keywords">
        <small>キーワード: ${content.keywords.join(', ')}</small>
      </div>
    `;

    this.contentArea.innerHTML = html;
    this.updateNavigationButtons(false);
  }

  /**
   * コンテキストヘルプの表示
   */
  showContextHelp(context) {
    let contentId;

    switch (context) {
      case 'menu-area':
        contentId = 'gesture-controls';
        break;
      case 'settings':
        contentId = 'settings-access';
        break;
      case 'navigation':
        contentId = 'basic-navigation';
        break;
      default:
        return;
    }

    this.showHelpContent(contentId);
    this.helpUI.style.display = 'flex';
    this.isVisible = true;
  }

  /**
   * チュートリアルの開始
   */
  startTutorial(tutorialId) {
    const tutorial = this.tutorials.get(tutorialId);
    if (!tutorial) return;

    this.currentTutorial = {
      ...tutorial,
      currentStep: 0,
      progress: this.userProgress.get(tutorialId) || { completed: false, currentStep: 0 }
    };

    this.showTutorialStep(0);
    this.updateNavigationButtons(true);
  }

  /**
   * チュートリアルステップの表示
   */
  showTutorialStep(stepIndex) {
    if (!this.currentTutorial) return;

    const step = this.currentTutorial.steps[stepIndex];
    if (!step) return;

    const progress = (stepIndex + 1) / this.currentTutorial.steps.length * 100;

    const html = `
      <div class="tutorial-header">
        <h3>${this.currentTutorial.title}</h3>
        <div class="tutorial-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <span class="progress-text">${stepIndex + 1} / ${this.currentTutorial.steps.length}</span>
        </div>
      </div>
      <div class="tutorial-step">
        <h4>${step.title}</h4>
        <p>${step.content}</p>
        ${this.getStepActionHtml(step)}
      </div>
    `;

    this.contentArea.innerHTML = html;

    // ステップ固有の処理
    this.executeStepAction(step);
  }

  /**
   * ステップアクションのHTML取得
   */
  getStepActionHtml(step) {
    switch (step.action) {
      case 'highlight':
        return `<div class="action-hint">💡 ${step.gesture ? `${step.gesture}ジェスチャーを試してください` : '指定された要素を操作してください'}</div>`;
      case 'demonstrate':
        return `<div class="action-hint">👋 ${step.gesture}ジェスチャーを実演してください</div>`;
      case 'show-settings':
        return `<div class="action-hint">⚙️ Ctrl+Alt+Sキーで設定を開いてください</div>`;
      default:
        return '';
    }
  }

  /**
   * ステップアクションの実行
   */
  executeStepAction(step) {
    switch (step.action) {
      case 'highlight':
        if (step.target) {
          this.highlightElement(step.target);
        }
        break;
      case 'demonstrate':
        if (step.gesture) {
          this.demonstrateGesture(step.gesture);
        }
        break;
      case 'show-settings':
        // 設定を開くヒントを表示
        setTimeout(() => {
          if (window.vrSettingsUI) {
            window.vrSettingsUI.show();
          }
        }, 2000);
        break;
    }
  }

  /**
   * チュートリアルナビゲーション
   */
  navigateTutorial(direction) {
    if (!this.currentTutorial) return;

    const newStep = this.currentTutorial.currentStep + direction;
    const maxStep = this.currentTutorial.steps.length - 1;

    if (newStep >= 0 && newStep <= maxStep) {
      this.currentTutorial.currentStep = newStep;
      this.showTutorialStep(newStep);

      // 進捗を保存
      this.userProgress.set(this.currentTutorial.id, {
        completed: false,
        currentStep: newStep,
        lastUpdated: Date.now()
      });
      this.saveUserProgress();
    }
  }

  /**
   * チュートリアルの完了
   */
  completeTutorial() {
    if (!this.currentTutorial) return;

    // 完了状態を保存
    this.userProgress.set(this.currentTutorial.id, {
      completed: true,
      currentStep: this.currentTutorial.steps.length - 1,
      lastUpdated: Date.now()
    });
    this.saveUserProgress();

    // 完了メッセージを表示
    const html = `
      <div class="tutorial-complete">
        <h3>🎉 チュートリアル完了！</h3>
        <p>${this.currentTutorial.title}を完了しました。</p>
        <p>VRブラウザの使い方が少しでもわかったでしょうか？</p>
        <div class="completion-actions">
          <button onclick="vrHelpSystem.showHelpOverview()">ヘルプセンターに戻る</button>
          <button onclick="vrHelpSystem.hide()">閉じる</button>
        </div>
      </div>
    `;

    this.contentArea.innerHTML = html;
    this.updateNavigationButtons(false);

    this.currentTutorial = null;
  }

  /**
   * ナビゲーションボタンの更新
   */
  updateNavigationButtons(isTutorial) {
    if (!this.navButtons) return;

    const { prev, next, complete } = this.navButtons;

    if (isTutorial && this.currentTutorial) {
      const currentStep = this.currentTutorial.currentStep;
      const maxStep = this.currentTutorial.steps.length - 1;

      prev.style.display = currentStep > 0 ? 'inline-block' : 'none';
      next.style.display = currentStep < maxStep ? 'inline-block' : 'none';
      complete.style.display = currentStep === maxStep ? 'inline-block' : 'none';
    } else {
      prev.style.display = 'none';
      next.style.display = 'none';
      complete.style.display = 'inline-block';
    }
  }

  /**
   * 要素のハイライト
   */
  highlightElement(selector) {
    if (!this.settings.highlightElements) return;

    const element = document.querySelector(selector);
    if (element) {
      element.style.boxShadow = '0 0 0 4px #0052cc';
      element.style.transition = 'box-shadow 0.3s ease';

      setTimeout(() => {
        element.style.boxShadow = '';
      }, 3000);
    }
  }

  /**
   * ジェスチャーのデモンストレーション
   */
  demonstrateGesture(gestureName) {
    if (!this.settings.showTooltips) return;

    // ジェスチャーガイドを表示
    const guide = document.createElement('div');
    guide.className = 'gesture-guide';
    guide.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
      z-index: 10001;
      font-size: 18px;
    `;

    guide.innerHTML = `
      <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
      <div>${gestureName}ジェスチャーを試してください</div>
    `;

    document.body.appendChild(guide);

    setTimeout(() => {
      if (guide.parentNode) {
        guide.remove();
      }
    }, 5000);
  }

  /**
   * ヘルプ検索
   */
  searchHelp(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    this.helpContent.forEach((content, id) => {
      if (content.title.toLowerCase().includes(lowerQuery) ||
          content.keywords.some(keyword => keyword.toLowerCase().includes(lowerQuery))) {
        results.push({ id, ...content });
      }
    });

    return results;
  }

  /**
   * FAQの取得
   */
  getFAQ() {
    return [
      {
        question: 'VRモードを開始するには？',
        answer: 'WebXR対応のVRデバイスを接続し、ブラウザでVRコンテンツにアクセスしてください。'
      },
      {
        question: 'ジェスチャーが反応しない',
        answer: 'ハンドトラッキングが有効になっているか確認してください。設定 > ジェスチャー から有効化できます。'
      },
      {
        question: 'バッテリー消耗が早い',
        answer: '設定 > パフォーマンス で品質を下げるとバッテリー消費を抑えられます。'
      },
      {
        question: 'ネットワークエラーが発生する',
        answer: 'オフライン設定を確認し、必要に応じてオフラインモードを有効化してください。'
      }
    ];
  }

  /**
   * ヘルプ統計の取得
   */
  getHelpStats() {
    return {
      tutorialsCompleted: Array.from(this.userProgress.values()).filter(p => p.completed).length,
      totalTutorials: this.tutorials.size,
      helpContentViewed: this.helpContent.size,
      settings: { ...this.settings }
    };
  }

  /**
   * 設定の更新
   */
  updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    // 設定はlocalStorageに保存されるため、ここでは何もしない
  }

  /**
   * ヘルプのリセット
   */
  resetHelp() {
    this.userProgress.clear();
    localStorage.removeItem('qui-vr-help-progress');
    console.log('[VR Help] Help progress reset');
  }
}

// グローバルインスタンス作成
const vrHelpSystem = new VRHelpSystem();

// グローバルアクセス用
window.vrHelpSystem = vrHelpSystem;

// 初期化完了通知
document.addEventListener('DOMContentLoaded', () => {
  console.log('[VR Help] VR Help System initialized');

  // ヘルプボタンの追加（オプション）
  const helpButton = document.createElement('button');
  helpButton.textContent = 'ヘルプ';
  helpButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 20px;
    padding: 12px 16px;
    background: #0052cc;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  `;
  helpButton.addEventListener('click', () => vrHelpSystem.show());
  document.body.appendChild(helpButton);
});
