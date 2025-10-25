/**
 * VR-Native Billing UI System
 * Version: 1.0.0
 *
 * VR空間内でのサブスクリプション管理・課金UIを提供
 *
 * Features:
 * - 3D pricing cards (料金プラン比較)
 * - VR-native checkout flow
 * - Subscription management dashboard
 * - Usage meters (使用量メーター)
 * - Hand gesture + voice control
 * - Smooth animations and transitions
 *
 * UX Design:
 * - 大きな文字 (VRで読みやすい)
 * - ハイコントラスト
 * - ハンドジェスチャーで選択可能
 * - 音声フィードバック
 */

class VRBillingUI {
  constructor(options = {}) {
    this.options = {
      // UI Settings
      cardWidth: 1.2,              // meters
      cardHeight: 1.8,             // meters
      cardSpacing: 0.3,            // meters
      cardDistance: 2.5,           // meters from user

      // Colors (Material Design)
      colorPrimary: 0x6200EE,      // Purple
      colorSecondary: 0x03DAC6,    // Teal
      colorFree: 0x9E9E9E,         // Gray
      colorPremium: 0x2196F3,      // Blue
      colorPro: 0x9C27B0,          // Purple
      colorEnterprise: 0x212121,   // Dark

      // Typography
      fontSize: 0.08,              // meters
      fontFamily: 'Arial, sans-serif',

      // Animations
      animationDuration: 300,      // ms
      hoverScale: 1.05,

      // API
      apiBaseUrl: '/api/billing',

      // Localization
      language: 'ja'               // 'ja', 'en'
    };

    Object.assign(this.options, options);

    // Three.js objects
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    // UI Elements
    this.pricingCards = [];
    this.subscriptionPanel = null;
    this.usageMeters = [];

    // State
    this.currentPlan = 'free';
    this.subscriptionStatus = 'inactive';
    this.userId = null;

    // Interaction
    this.selectedCard = null;
    this.hoveredCard = null;

    // Localization
    this.strings = this.getLocalizedStrings();
  }

  /**
   * Initialize billing UI
   */
  async initialize(scene, camera, userId) {
    console.log('[VRBillingUI] Initializing VR Billing UI...');

    this.scene = scene;
    this.camera = camera;
    this.userId = userId;

    // Fetch current subscription status
    await this.fetchSubscriptionStatus();

    console.log('[VRBillingUI] Initialization complete');
    console.log(`[VRBillingUI] Current plan: ${this.currentPlan}`);
  }

  /**
   * Fetch subscription status from API
   */
  async fetchSubscriptionStatus() {
    try {
      const response = await fetch(`${this.options.apiBaseUrl}/subscription/${this.userId}`);
      const data = await response.json();

      this.currentPlan = data.plan || 'free';
      this.subscriptionStatus = data.status || 'inactive';

      console.log('[VRBillingUI] Subscription status fetched:', data);
    } catch (error) {
      console.error('[VRBillingUI] Failed to fetch subscription:', error);
    }
  }

  /**
   * Show pricing cards in VR space
   */
  showPricingCards() {
    console.log('[VRBillingUI] Showing pricing cards...');

    // Clear existing cards
    this.pricingCards.forEach(card => this.scene.remove(card));
    this.pricingCards = [];

    // Pricing plans
    const plans = [
      {
        id: 'free',
        name: this.strings.plans.free.name,
        price: this.strings.plans.free.price,
        features: this.strings.plans.free.features,
        color: this.options.colorFree,
        buttonText: this.strings.currentPlan
      },
      {
        id: 'premium_monthly',
        name: this.strings.plans.premium.name,
        price: this.strings.plans.premium.priceMonthly,
        interval: this.strings.monthly,
        features: this.strings.plans.premium.features,
        color: this.options.colorPremium,
        buttonText: this.currentPlan === 'premium_monthly' || this.currentPlan === 'premium_yearly' ?
          this.strings.currentPlan : this.strings.startTrial
      },
      {
        id: 'pro_monthly',
        name: this.strings.plans.pro.name,
        price: this.strings.plans.pro.priceMonthly,
        interval: this.strings.monthly,
        features: this.strings.plans.pro.features,
        color: this.options.colorPro,
        buttonText: this.currentPlan === 'pro_monthly' || this.currentPlan === 'pro_yearly' ?
          this.strings.currentPlan : this.strings.upgrade,
        badge: 'Quest Pro'
      }
    ];

    // Calculate positions
    const totalWidth = plans.length * this.options.cardWidth + (plans.length - 1) * this.options.cardSpacing;
    const startX = -totalWidth / 2 + this.options.cardWidth / 2;

    // Create cards
    plans.forEach((plan, index) => {
      const x = startX + index * (this.options.cardWidth + this.options.cardSpacing);
      const y = 0;
      const z = -this.options.cardDistance;

      const card = this.createPricingCard(plan, x, y, z);
      this.pricingCards.push(card);
      this.scene.add(card);
    });

    console.log(`[VRBillingUI] Created ${plans.length} pricing cards`);
  }

  /**
   * Create a 3D pricing card
   */
  createPricingCard(plan, x, y, z) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.userData = { planId: plan.id };

    // Card background
    const cardGeometry = new THREE.PlaneGeometry(this.options.cardWidth, this.options.cardHeight);
    const cardMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      emissive: plan.color,
      emissiveIntensity: 0.1,
      roughness: 0.3,
      metalness: 0.1
    });
    const cardMesh = new THREE.Mesh(cardGeometry, cardMaterial);
    group.add(cardMesh);

    // Border (if current plan)
    if (this.isCurrentPlan(plan.id)) {
      const borderGeometry = new THREE.PlaneGeometry(
        this.options.cardWidth + 0.02,
        this.options.cardHeight + 0.02
      );
      const borderMaterial = new THREE.MeshBasicMaterial({
        color: this.options.colorSecondary,
        side: THREE.BackSide
      });
      const border = new THREE.Mesh(borderGeometry, borderMaterial);
      border.position.z = -0.001;
      group.add(border);
    }

    // Badge (if exists)
    if (plan.badge) {
      const badgeText = this.createTextMesh(plan.badge, this.options.fontSize * 0.6, 0xFFFFFF);
      badgeText.position.set(0, this.options.cardHeight / 2 - 0.15, 0.01);
      group.add(badgeText);
    }

    // Plan name
    const nameText = this.createTextMesh(plan.name, this.options.fontSize * 1.2, plan.color);
    nameText.position.set(0, this.options.cardHeight / 2 - 0.3, 0.01);
    group.add(nameText);

    // Price
    const priceText = this.createTextMesh(plan.price, this.options.fontSize * 1.5, 0x000000);
    priceText.position.set(0, this.options.cardHeight / 2 - 0.5, 0.01);
    group.add(priceText);

    // Interval (if exists)
    if (plan.interval) {
      const intervalText = this.createTextMesh(plan.interval, this.options.fontSize * 0.8, 0x666666);
      intervalText.position.set(0, this.options.cardHeight / 2 - 0.65, 0.01);
      group.add(intervalText);
    }

    // Features list
    const featuresStartY = this.options.cardHeight / 2 - 0.85;
    plan.features.forEach((feature, index) => {
      const featureText = this.createTextMesh(
        `✓ ${feature}`,
        this.options.fontSize * 0.7,
        0x000000,
        'left'
      );
      featureText.position.set(-this.options.cardWidth / 2 + 0.1, featuresStartY - index * 0.12, 0.01);
      group.add(featureText);
    });

    // Button
    const buttonY = -this.options.cardHeight / 2 + 0.2;
    const button = this.createButton(plan.buttonText, plan.color, plan.id);
    button.position.set(0, buttonY, 0.01);
    group.add(button);

    // Hover effect setup
    group.userData.originalScale = 1.0;
    group.userData.isButton = true;

    return group;
  }

  /**
   * Create 3D text mesh
   */
  createTextMesh(text, size, color, align = 'center') {
    // Simplified text creation (実際にはTextGeometryやThree.js Canvasテクスチャを使用)
    // ここではプレースホルダーとして平面を返す

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Background (transparent)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Text
    ctx.font = `bold ${size * 1000}px ${this.options.fontFamily}`;
    ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, align === 'center' ? canvas.width / 2 : 10, canvas.height / 2);

    // Create texture
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide
    });

    const geometry = new THREE.PlaneGeometry(size * text.length * 0.5, size);
    const mesh = new THREE.Mesh(geometry, material);

    return mesh;
  }

  /**
   * Create 3D button
   */
  createButton(text, color, planId) {
    const group = new THREE.Group();
    group.userData = { isButton: true, planId: planId };

    // Button background
    const buttonWidth = this.options.cardWidth * 0.8;
    const buttonHeight = 0.15;

    const buttonGeometry = new THREE.PlaneGeometry(buttonWidth, buttonHeight);
    const buttonMaterial = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3,
      roughness: 0.2
    });
    const buttonMesh = new THREE.Mesh(buttonGeometry, buttonMaterial);
    group.add(buttonMesh);

    // Button text
    const buttonText = this.createTextMesh(text, this.options.fontSize, 0xFFFFFF);
    buttonText.position.z = 0.01;
    group.add(buttonText);

    return group;
  }

  /**
   * Handle card interaction (hover, click)
   */
  handleCardInteraction(intersectedObject) {
    if (!intersectedObject) {
      // No hover
      if (this.hoveredCard) {
        this.hoveredCard.scale.set(1, 1, 1);
        this.hoveredCard = null;
      }
      return;
    }

    // Find card group
    let card = intersectedObject;
    while (card.parent && !card.userData.planId) {
      card = card.parent;
    }

    if (!card.userData.planId) return;

    // Hover effect
    if (this.hoveredCard !== card) {
      if (this.hoveredCard) {
        this.hoveredCard.scale.set(1, 1, 1);
      }
      this.hoveredCard = card;
      card.scale.set(this.options.hoverScale, this.options.hoverScale, 1);
    }
  }

  /**
   * Handle button click
   */
  async handleButtonClick(planId) {
    console.log('[VRBillingUI] Button clicked:', planId);

    if (this.isCurrentPlan(planId)) {
      // Already subscribed, show manage subscription
      this.showSubscriptionManagement();
      return;
    }

    // Start checkout flow
    await this.startCheckoutFlow(planId);
  }

  /**
   * Start Stripe checkout flow
   */
  async startCheckoutFlow(planId) {
    console.log('[VRBillingUI] Starting checkout for plan:', planId);

    try {
      // Show loading indicator
      this.showLoadingIndicator(this.strings.processing);

      // Create checkout session
      const response = await fetch(`${this.options.apiBaseUrl}/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          planId: planId,
          userId: this.userId,
          email: 'user@example.com', // 実際にはユーザーのメールアドレス
          currency: this.options.language === 'ja' ? 'jpy' : 'usd',
          successUrl: `${window.location.origin}/success`,
          cancelUrl: `${window.location.origin}/pricing`
        })
      });

      const data = await response.json();

      if (data.url) {
        // Redirect to Stripe Checkout
        console.log('[VRBillingUI] Redirecting to Stripe Checkout...');
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL received');
      }

    } catch (error) {
      console.error('[VRBillingUI] Checkout flow failed:', error);
      this.showErrorMessage(this.strings.checkoutError);
    } finally {
      this.hideLoadingIndicator();
    }
  }

  /**
   * Show subscription management panel
   */
  showSubscriptionManagement() {
    console.log('[VRBillingUI] Showing subscription management...');

    // Create portal session and redirect
    this.redirectToCustomerPortal();
  }

  /**
   * Redirect to Stripe Customer Portal
   */
  async redirectToCustomerPortal() {
    try {
      this.showLoadingIndicator(this.strings.loading);

      const response = await fetch(`${this.options.apiBaseUrl}/create-portal-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.userId,
          returnUrl: `${window.location.origin}/settings/subscription`
        })
      });

      const data = await response.json();

      if (data.url) {
        console.log('[VRBillingUI] Redirecting to Customer Portal...');
        window.location.href = data.url;
      } else {
        throw new Error('No portal URL received');
      }

    } catch (error) {
      console.error('[VRBillingUI] Portal redirect failed:', error);
      this.showErrorMessage(this.strings.portalError);
    } finally {
      this.hideLoadingIndicator();
    }
  }

  /**
   * Check if plan is current plan
   */
  isCurrentPlan(planId) {
    // Check both monthly and yearly variants
    if (planId.includes('monthly')) {
      return this.currentPlan === planId || this.currentPlan === planId.replace('monthly', 'yearly');
    } else if (planId.includes('yearly')) {
      return this.currentPlan === planId || this.currentPlan === planId.replace('yearly', 'monthly');
    }
    return this.currentPlan === planId;
  }

  /**
   * Show loading indicator
   */
  showLoadingIndicator(message) {
    // VR空間に3Dローディングインジケーターを表示
    console.log('[VRBillingUI] Loading:', message);
  }

  /**
   * Hide loading indicator
   */
  hideLoadingIndicator() {
    console.log('[VRBillingUI] Loading complete');
  }

  /**
   * Show error message
   */
  showErrorMessage(message) {
    // VR空間にエラーメッセージを表示
    console.error('[VRBillingUI] Error:', message);
    alert(message); // 仮のアラート
  }

  /**
   * Get localized strings
   */
  getLocalizedStrings() {
    if (this.options.language === 'ja') {
      return {
        monthly: '月額',
        yearly: '年額',
        currentPlan: '現在のプラン',
        startTrial: '14日間無料トライアル',
        upgrade: 'アップグレード',
        processing: '処理中...',
        loading: '読み込み中...',
        checkoutError: '決済処理に失敗しました',
        portalError: 'サブスクリプション管理ページの読み込みに失敗しました',
        plans: {
          free: {
            name: 'Free',
            price: '¥0',
            features: ['基本VRブラウジング', '基本ジェスチャー (3種)', '1080p動画', '60分/日']
          },
          premium: {
            name: 'Premium',
            priceMonthly: '¥980/月',
            priceYearly: '¥9,800/年',
            features: ['すべてのジェスチャー (15種)', 'Swypeテキスト入力', '4K動画', 'Foveated Rendering', 'クラウド同期', '無制限']
          },
          pro: {
            name: 'Pro',
            priceMonthly: '¥1,980/月',
            priceYearly: '¥19,800/年',
            features: ['視線追跡機能', '8K動画', 'AI機能', 'マルチプレイヤー', 'Eye-Tracked FR', '専用サポート']
          }
        }
      };
    } else {
      return {
        monthly: 'Monthly',
        yearly: 'Yearly',
        currentPlan: 'Current Plan',
        startTrial: 'Start 14-Day Trial',
        upgrade: 'Upgrade',
        processing: 'Processing...',
        loading: 'Loading...',
        checkoutError: 'Checkout failed',
        portalError: 'Failed to load subscription management',
        plans: {
          free: {
            name: 'Free',
            price: '$0',
            features: ['Basic VR browsing', 'Basic gestures (3)', '1080p video', '60 min/day']
          },
          premium: {
            name: 'Premium',
            priceMonthly: '$9.99/mo',
            priceYearly: '$99.99/yr',
            features: ['All gestures (15)', 'Swype text input', '4K video', 'Foveated Rendering', 'Cloud sync', 'Unlimited']
          },
          pro: {
            name: 'Pro',
            priceMonthly: '$19.99/mo',
            priceYearly: '$199.99/yr',
            features: ['Eye tracking', '8K video', 'AI features', 'Multiplayer', 'Eye-Tracked FR', 'Dedicated support']
          }
        }
      };
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    console.log('[VRBillingUI] Cleaning up VR Billing UI...');

    this.pricingCards.forEach(card => this.scene.remove(card));
    this.pricingCards = [];

    console.log('[VRBillingUI] Cleanup complete');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VRBillingUI;
}
