/**
 * VR License Manager
 * Chrome拡張機能使用ライセンスの管理
 * サブスクリプション（$0.5/月）と買い切り（$1.5）の処理
 * @author Qui Browser Team
 * @version 2.0.0
 */

class VRLicenseManager {
    constructor() {
        this.licenseData = null;
        this.stripePublicKey = 'pk_test_YOUR_STRIPE_PUBLIC_KEY'; // 要変更
        this.apiBaseUrl = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://api.qui-browser.com';

        this.stripe = null;
        this.isProcessingPayment = false;

        this.init();
    }

    async init() {
        console.log('VR License Manager initializing...');

        // ローカルストレージからライセンス情報を読み込み
        await this.loadLicenseFromStorage();

        // ライセンスの検証
        await this.validateLicense();

        // Stripeの初期化
        await this.initializeStripe();

        // URLパラメータのチェック（決済完了後のリダイレクト処理）
        this.checkPaymentRedirect();

        // 定期的なライセンス確認（1時間ごと）
        this.startLicenseCheck();
    }

    /**
     * Stripeの初期化
     */
    async initializeStripe() {
        // Stripe.jsの動的読み込み
        if (!window.Stripe) {
            return new Promise((resolve) => {
                const script = document.createElement('script');
                script.src = 'https://js.stripe.com/v3/';
                script.onload = () => {
                    this.stripe = window.Stripe(this.stripePublicKey);
                    resolve();
                };
                document.head.appendChild(script);
            });
        } else {
            this.stripe = window.Stripe(this.stripePublicKey);
        }
    }

    /**
     * ライセンスの読み込み
     */
    async loadLicenseFromStorage() {
        try {
            const stored = localStorage.getItem('vr-extension-license');
            if (stored) {
                this.licenseData = JSON.parse(stored);
                console.log('License loaded from storage:', this.licenseData.type);
            }
        } catch (error) {
            console.error('Failed to load license:', error);
            this.licenseData = null;
        }
    }

    /**
     * ライセンスの検証
     */
    async validateLicense() {
        if (!this.licenseData) {
            console.log('No license found');
            return false;
        }

        try {
            // サーバー側での検証
            const response = await fetch(`${this.apiBaseUrl}/api/check-license`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                query: new URLSearchParams({
                    customerId: this.licenseData.customerId,
                    email: this.licenseData.email
                })
            });

            if (!response.ok) {
                throw new Error('License validation failed');
            }

            const result = await response.json();

            if (result.hasLicense) {
                // ライセンスが有効
                this.licenseData = {
                    ...this.licenseData,
                    ...result,
                    isActive: true,
                    lastValidated: Date.now()
                };

                // サブスクリプションの場合、有効期限をチェック
                if (this.licenseData.type === 'subscription') {
                    const expiryDate = new Date(this.licenseData.expiryDate);
                    const now = new Date();

                    if (expiryDate <= now) {
                        console.log('Subscription expired');
                        this.licenseData.isActive = false;
                        await this.showRenewalPrompt();
                    }
                }

                this.saveLicense();
                return true;
            } else {
                // ライセンスが無効
                console.log('License is no longer valid');
                this.clearLicense();
                return false;
            }

        } catch (error) {
            console.error('License validation error:', error);

            // オフライン時は一定期間キャッシュされたライセンスを信頼
            if (this.licenseData.lastValidated) {
                const daysSinceValidation = (Date.now() - this.licenseData.lastValidated) / (1000 * 60 * 60 * 24);

                if (daysSinceValidation < 7) {
                    console.log('Using cached license (offline grace period)');
                    return true;
                }
            }

            return false;
        }
    }

    /**
     * 支払い処理の開始
     */
    async startPayment(plan) {
        if (this.isProcessingPayment) {
            console.log('Payment already in progress');
            return;
        }

        this.isProcessingPayment = true;

        try {
            // Checkout Sessionの作成
            const response = await fetch(`${this.apiBaseUrl}/api/create-checkout-session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                body: JSON.stringify({
                    plan: plan, // 'subscription' または 'lifetime'
                    userId: this.getUserId(),
                    email: this.getUserEmail()
                })
            });

            if (!response.ok) {
                throw new Error('Failed to create checkout session');
            }

            const session = await response.json();

            // Stripe Checkoutへリダイレクト
            const result = await this.stripe.redirectToCheckout({
                sessionId: session.id
            });

            if (result.error) {
                throw result.error;
            }

        } catch (error) {
            console.error('Payment failed:', error);
            this.showError('決済処理に失敗しました: ' + error.message);
        } finally {
            this.isProcessingPayment = false;
        }
    }

    /**
     * 決済完了後のリダイレクト処理
     */
    async checkPaymentRedirect() {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');

        if (sessionId) {
            console.log('Processing payment completion...');
            await this.verifyPayment(sessionId);

            // URLパラメータをクリア
            const url = new URL(window.location);
            url.searchParams.delete('session_id');
            window.history.replaceState({}, document.title, url.pathname);
        }
    }

    /**
     * 支払いの検証
     */
    async verifyPayment(sessionId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/verify-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                body: JSON.stringify({
                    sessionId: sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Payment verification failed');
            }

            const result = await response.json();

            if (result.success) {
                // ライセンスを保存
                this.licenseData = result.license;
                this.licenseData.isActive = true;
                this.saveLicense();

                // 成功通知
                this.showSuccess(`ライセンスが有効になりました（${this.licenseData.type === 'subscription' ? '月額プラン' : '買い切りプラン'}）`);

                // 拡張機能ローダーに通知
                if (window.vrExtensionLoader) {
                    window.vrExtensionLoader.licenseStatus = {
                        isActive: true,
                        ...this.licenseData
                    };
                }

                // UIの更新
                this.updateUI();

                return true;
            }

        } catch (error) {
            console.error('Payment verification error:', error);
            this.showError('決済の確認に失敗しました');
            return false;
        }
    }

    /**
     * サブスクリプションのキャンセル
     */
    async cancelSubscription() {
        if (!this.licenseData || this.licenseData.type !== 'subscription') {
            console.log('No active subscription to cancel');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/cancel-subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                body: JSON.stringify({
                    subscriptionId: this.licenseData.subscriptionId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to cancel subscription');
            }

            const result = await response.json();

            if (result.success) {
                this.licenseData.cancelAtPeriodEnd = true;
                this.licenseData.expiryDate = result.subscription.currentPeriodEnd;
                this.saveLicense();

                this.showSuccess(`サブスクリプションは${new Date(this.licenseData.expiryDate).toLocaleDateString('ja-JP')}に終了します`);
            }

        } catch (error) {
            console.error('Subscription cancellation error:', error);
            this.showError('サブスクリプションのキャンセルに失敗しました');
        }
    }

    /**
     * サブスクリプションの再開
     */
    async resumeSubscription() {
        if (!this.licenseData || this.licenseData.type !== 'subscription') {
            console.log('No subscription to resume');
            return;
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/resume-subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                body: JSON.stringify({
                    subscriptionId: this.licenseData.subscriptionId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to resume subscription');
            }

            const result = await response.json();

            if (result.success) {
                this.licenseData.cancelAtPeriodEnd = false;
                this.saveLicense();

                this.showSuccess('サブスクリプションを再開しました');
            }

        } catch (error) {
            console.error('Subscription resume error:', error);
            this.showError('サブスクリプションの再開に失敗しました');
        }
    }

    /**
     * ライセンスの保存
     */
    saveLicense() {
        try {
            localStorage.setItem('vr-extension-license', JSON.stringify(this.licenseData));
        } catch (error) {
            console.error('Failed to save license:', error);
        }
    }

    /**
     * ライセンスのクリア
     */
    clearLicense() {
        this.licenseData = null;
        localStorage.removeItem('vr-extension-license');

        // 拡張機能ローダーに通知
        if (window.vrExtensionLoader) {
            window.vrExtensionLoader.licenseStatus = { isActive: false };
        }
    }

    /**
     * ユーザーIDの取得
     */
    getUserId() {
        // ローカルストレージから取得、なければ生成
        let userId = localStorage.getItem('vr-user-id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('vr-user-id', userId);
        }
        return userId;
    }

    /**
     * ユーザーメールアドレスの取得
     */
    getUserEmail() {
        // 設定から取得、またはプロンプトで入力
        return localStorage.getItem('vr-user-email') || '';
    }

    /**
     * 定期的なライセンス確認
     */
    startLicenseCheck() {
        // 1時間ごとにライセンスを確認
        setInterval(() => {
            this.validateLicense();
        }, 60 * 60 * 1000);
    }

    /**
     * 更新プロンプトの表示
     */
    async showRenewalPrompt() {
        if (window.vrNotificationSystem) {
            window.vrNotificationSystem.showNotification({
                title: 'サブスクリプションの更新',
                message: 'サブスクリプションの有効期限が切れました。更新してください。',
                type: 'warning',
                actions: [
                    {
                        label: '更新する',
                        callback: () => this.startPayment('subscription')
                    },
                    {
                        label: '後で',
                        callback: () => {}
                    }
                ]
            });
        }
    }

    /**
     * UIの更新
     */
    updateUI() {
        // ライセンス状態に基づいてUIを更新
        const licenseIndicator = document.getElementById('license-indicator');
        if (licenseIndicator) {
            if (this.licenseData && this.licenseData.isActive) {
                licenseIndicator.classList.add('active');
                licenseIndicator.textContent = this.licenseData.type === 'subscription' ? 'サブスクリプション' : '買い切り';
            } else {
                licenseIndicator.classList.remove('active');
                licenseIndicator.textContent = 'ライセンスなし';
            }
        }

        // 拡張機能マネージャーUIの更新
        if (window.vrExtensionManagerUI) {
            window.vrExtensionManagerUI.updateLicenseStatus(this.licenseData);
        }
    }

    /**
     * ライセンス情報の取得
     */
    getLicenseInfo() {
        return {
            hasLicense: this.licenseData && this.licenseData.isActive,
            type: this.licenseData?.type,
            expiryDate: this.licenseData?.expiryDate,
            cancelAtPeriodEnd: this.licenseData?.cancelAtPeriodEnd
        };
    }

    /**
     * 支払い履歴の取得
     */
    async getPaymentHistory() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/payment-history`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors',
                query: new URLSearchParams({
                    customerId: this.licenseData?.customerId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to fetch payment history');
            }

            return await response.json();

        } catch (error) {
            console.error('Failed to get payment history:', error);
            return [];
        }
    }

    /**
     * エラー表示
     */
    showError(message) {
        if (window.vrNotificationSystem) {
            window.vrNotificationSystem.showNotification({
                title: 'エラー',
                message: message,
                type: 'error',
                duration: 5000
            });
        } else {
            console.error(message);
            alert(message);
        }
    }

    /**
     * 成功通知
     */
    showSuccess(message) {
        if (window.vrNotificationSystem) {
            window.vrNotificationSystem.showNotification({
                title: '成功',
                message: message,
                type: 'success',
                duration: 3000
            });
        } else {
            console.log(message);
        }
    }

    /**
     * プランの比較情報
     */
    getPlansComparison() {
        return {
            subscription: {
                name: '月額プラン',
                price: '$0.50',
                period: '月',
                features: [
                    'すべてのChrome拡張機能が使用可能',
                    'いつでもキャンセル可能',
                    '7日間の無料試用期間',
                    '自動更新'
                ],
                recommended: false
            },
            lifetime: {
                name: '買い切りプラン',
                price: '$1.50',
                period: '一回払い',
                features: [
                    'すべてのChrome拡張機能が使用可能',
                    '永久ライセンス',
                    '追加料金なし',
                    'アップデート込み'
                ],
                recommended: true
            }
        };
    }

    /**
     * デバッグ情報の取得
     */
    getDebugInfo() {
        return {
            licenseData: this.licenseData,
            stripeLoaded: !!this.stripe,
            apiBaseUrl: this.apiBaseUrl,
            userId: this.getUserId()
        };
    }
}

// グローバルに公開
window.VRLicenseManager = VRLicenseManager;

// 自動初期化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.vrLicenseManager = new VRLicenseManager();
    });
} else {
    window.vrLicenseManager = new VRLicenseManager();
}