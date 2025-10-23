/**
 * Stripe Payment API
 * Chrome拡張機能使用料の決済処理
 * $0.50/月のサブスクリプション または $1.50の買い切り
 * @author Qui Browser Team
 * @version 2.0.0
 */

// Node.js/Express.js サーバーサイド実装例
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// CORS設定
app.use(cors({
    origin: ['http://localhost:8080', 'https://qui-browser.example.com'],
    credentials: true
}));

// Body parserの設定
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Stripe Webhook用のraw bodyパーサー
app.use('/webhook', express.raw({ type: 'application/json' }));

/**
 * 価格設定
 * Stripeダッシュボードで事前に作成する必要があります
 */
const PRICE_IDS = {
    subscription: 'price_1234567890abcdef', // $0.50/月のサブスクリプション価格ID
    lifetime: 'price_0987654321fedcba'     // $1.50の一回払い価格ID
};

/**
 * Checkout Sessionの作成
 * POST /api/create-checkout-session
 */
app.post('/api/create-checkout-session', async (req, res) => {
    try {
        const { plan, priceId, userId } = req.body;

        // 入力検証
        if (!plan || !['subscription', 'lifetime'].includes(plan)) {
            return res.status(400).json({
                error: 'Invalid plan type'
            });
        }

        // セッションパラメータの設定
        const sessionParams = {
            payment_method_types: ['card'],
            mode: plan === 'subscription' ? 'subscription' : 'payment',
            success_url: `${req.headers.origin}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin}/payment-cancel`,
            customer_email: req.body.email,
            client_reference_id: userId,
            metadata: {
                plan: plan,
                product: 'vr_extension_access'
            },
            line_items: [{
                price: PRICE_IDS[plan],
                quantity: 1
            }],
            // 自動税金計算の有効化（オプション）
            automatic_tax: {
                enabled: false
            },
            // 請求先住所の収集（オプション）
            billing_address_collection: 'auto',
            // 同意事項の表示
            consent_collection: {
                terms_of_service: 'required',
            }
        };

        // サブスクリプションの場合、試用期間を設定可能
        if (plan === 'subscription') {
            sessionParams.subscription_data = {
                trial_period_days: 7, // 7日間の無料試用期間
                metadata: {
                    plan: 'monthly',
                    price: '0.50'
                }
            };
        }

        // Checkout Sessionの作成
        const session = await stripe.checkout.sessions.create(sessionParams);

        res.json({
            id: session.id,
            url: session.url
        });

    } catch (error) {
        console.error('Checkout session creation failed:', error);
        res.status(500).json({
            error: 'Failed to create checkout session',
            message: error.message
        });
    }
});

/**
 * 支払い成功後のライセンス発行
 * POST /api/verify-payment
 */
app.post('/api/verify-payment', async (req, res) => {
    try {
        const { sessionId } = req.body;

        if (!sessionId) {
            return res.status(400).json({
                error: 'Session ID is required'
            });
        }

        // Checkout Sessionの取得
        const session = await stripe.checkout.sessions.retrieve(sessionId, {
            expand: ['line_items', 'customer', 'subscription']
        });

        // 支払い確認
        if (session.payment_status !== 'paid') {
            return res.status(400).json({
                error: 'Payment not completed'
            });
        }

        // ライセンスデータの生成
        const licenseData = {
            id: session.id,
            customerId: session.customer,
            email: session.customer_email,
            type: session.mode === 'subscription' ? 'subscription' : 'lifetime',
            status: 'active',
            purchaseDate: new Date().toISOString()
        };

        // サブスクリプションの場合
        if (session.mode === 'subscription' && session.subscription) {
            const subscription = await stripe.subscriptions.retrieve(session.subscription);
            licenseData.subscriptionId = subscription.id;
            licenseData.expiryDate = new Date(subscription.current_period_end * 1000).toISOString();
            licenseData.cancelAtPeriodEnd = subscription.cancel_at_period_end;
        }

        // データベースにライセンス情報を保存（実装が必要）
        // await saveLicenseToDatabase(licenseData);

        res.json({
            success: true,
            license: licenseData
        });

    } catch (error) {
        console.error('Payment verification failed:', error);
        res.status(500).json({
            error: 'Failed to verify payment',
            message: error.message
        });
    }
});

/**
 * サブスクリプションのキャンセル
 * POST /api/cancel-subscription
 */
app.post('/api/cancel-subscription', async (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                error: 'Subscription ID is required'
            });
        }

        // サブスクリプションを期間終了時にキャンセル
        const subscription = await stripe.subscriptions.update(
            subscriptionId,
            { cancel_at_period_end: true }
        );

        res.json({
            success: true,
            subscription: {
                id: subscription.id,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString()
            }
        });

    } catch (error) {
        console.error('Subscription cancellation failed:', error);
        res.status(500).json({
            error: 'Failed to cancel subscription',
            message: error.message
        });
    }
});

/**
 * サブスクリプションの再開
 * POST /api/resume-subscription
 */
app.post('/api/resume-subscription', async (req, res) => {
    try {
        const { subscriptionId } = req.body;

        if (!subscriptionId) {
            return res.status(400).json({
                error: 'Subscription ID is required'
            });
        }

        // キャンセル予定を取り消し
        const subscription = await stripe.subscriptions.update(
            subscriptionId,
            { cancel_at_period_end: false }
        );

        res.json({
            success: true,
            subscription: {
                id: subscription.id,
                cancelAtPeriodEnd: subscription.cancel_at_period_end,
                status: subscription.status
            }
        });

    } catch (error) {
        console.error('Subscription resume failed:', error);
        res.status(500).json({
            error: 'Failed to resume subscription',
            message: error.message
        });
    }
});

/**
 * ライセンス状態の確認
 * GET /api/check-license
 */
app.get('/api/check-license', async (req, res) => {
    try {
        const { email, customerId } = req.query;

        if (!email && !customerId) {
            return res.status(400).json({
                error: 'Email or customer ID is required'
            });
        }

        // 顧客の検索
        let customer;
        if (customerId) {
            customer = await stripe.customers.retrieve(customerId);
        } else {
            const customers = await stripe.customers.list({
                email: email,
                limit: 1
            });
            customer = customers.data[0];
        }

        if (!customer) {
            return res.json({
                hasLicense: false
            });
        }

        // サブスクリプションの確認
        const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 1
        });

        if (subscriptions.data.length > 0) {
            const subscription = subscriptions.data[0];
            return res.json({
                hasLicense: true,
                type: 'subscription',
                expiryDate: new Date(subscription.current_period_end * 1000).toISOString(),
                status: subscription.status
            });
        }

        // 一回払いの購入履歴確認
        const charges = await stripe.charges.list({
            customer: customer.id,
            limit: 100
        });

        const lifetimePurchase = charges.data.find(charge =>
            charge.paid &&
            charge.metadata &&
            charge.metadata.product === 'vr_extension_access' &&
            charge.metadata.plan === 'lifetime'
        );

        if (lifetimePurchase) {
            return res.json({
                hasLicense: true,
                type: 'lifetime',
                purchaseDate: new Date(lifetimePurchase.created * 1000).toISOString(),
                status: 'active'
            });
        }

        res.json({
            hasLicense: false
        });

    } catch (error) {
        console.error('License check failed:', error);
        res.status(500).json({
            error: 'Failed to check license',
            message: error.message
        });
    }
});

/**
 * Stripe Webhookの処理
 * POST /webhook
 */
app.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // イベントタイプに基づいて処理
    switch (event.type) {
        case 'checkout.session.completed':
            // 支払い完了時の処理
            const session = event.data.object;
            await handleCheckoutComplete(session);
            break;

        case 'customer.subscription.updated':
            // サブスクリプション更新時の処理
            const subscription = event.data.object;
            await handleSubscriptionUpdate(subscription);
            break;

        case 'customer.subscription.deleted':
            // サブスクリプションキャンセル時の処理
            const cancelledSubscription = event.data.object;
            await handleSubscriptionCancellation(cancelledSubscription);
            break;

        case 'invoice.payment_failed':
            // 支払い失敗時の処理
            const invoice = event.data.object;
            await handlePaymentFailure(invoice);
            break;

        default:
            console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
});

/**
 * Checkout完了時の処理
 */
async function handleCheckoutComplete(session) {
    console.log('Checkout completed:', session.id);

    // ライセンスの有効化処理
    const licenseData = {
        customerId: session.customer,
        email: session.customer_email,
        type: session.mode === 'subscription' ? 'subscription' : 'lifetime',
        status: 'active',
        sessionId: session.id,
        purchaseDate: new Date().toISOString()
    };

    // データベースに保存（実装が必要）
    // await saveLicenseToDatabase(licenseData);

    // 確認メールの送信（実装が必要）
    // await sendConfirmationEmail(licenseData);
}

/**
 * サブスクリプション更新時の処理
 */
async function handleSubscriptionUpdate(subscription) {
    console.log('Subscription updated:', subscription.id);

    // ライセンス情報の更新（実装が必要）
    // await updateLicenseInDatabase(subscription);
}

/**
 * サブスクリプションキャンセル時の処理
 */
async function handleSubscriptionCancellation(subscription) {
    console.log('Subscription cancelled:', subscription.id);

    // ライセンスの無効化（実装が必要）
    // await revokeLicenseInDatabase(subscription.customer);
}

/**
 * 支払い失敗時の処理
 */
async function handlePaymentFailure(invoice) {
    console.log('Payment failed for invoice:', invoice.id);

    // 支払い失敗通知の送信（実装が必要）
    // await sendPaymentFailureNotification(invoice);
}

/**
 * 返金処理
 * POST /api/refund
 */
app.post('/api/refund', async (req, res) => {
    try {
        const { chargeId, amount, reason } = req.body;

        const refund = await stripe.refunds.create({
            charge: chargeId,
            amount: amount, // セント単位（オプション、指定しない場合は全額返金）
            reason: reason || 'requested_by_customer'
        });

        res.json({
            success: true,
            refund: {
                id: refund.id,
                amount: refund.amount,
                status: refund.status
            }
        });

    } catch (error) {
        console.error('Refund failed:', error);
        res.status(500).json({
            error: 'Failed to process refund',
            message: error.message
        });
    }
});

// エラーハンドリング
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// サーバー起動
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Stripe payment API server running on port ${PORT}`);
});

module.exports = app;