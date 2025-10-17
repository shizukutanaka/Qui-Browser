# Qui Browser コンポーネントガイド

## 📚 目次

1. [はじめに](#はじめに)
2. [基本コンポーネント](#基本コンポーネント)
3. [高度なコンポーネント](#高度なコンポーネント)
4. [インタラクティブコンポーネント](#インタラクティブコンポーネント)
5. [使用例](#使用例)
6. [カスタマイズ](#カスタマイズ)

---

## はじめに

Qui Browserは、**Atlassian Design
System**の原則に基づいた包括的なコンポーネントライブラリを提供します。

### 特徴

- ✅ **アクセシブル**: WCAG 2.1 AA準拠
- ✅ **レスポンシブ**: モバイルファースト設計
- ✅ **テーマ対応**: ライト/ダーク/ハイコントラスト
- ✅ **モジュラー**: 簡単に統合・カスタマイズ可能
- ✅ **パフォーマンス最適化**: 軽量で高速

### インストール

```html
<!-- Design System -->
<link rel="stylesheet" href="/assets/styles/design-system.css" />
<link rel="stylesheet" href="/assets/styles/components.css" />
<link rel="stylesheet" href="/assets/styles/components-advanced.css" />
<link rel="stylesheet" href="/assets/styles/animations.css" />

<!-- Scripts -->
<script src="/assets/js/ui-components.js"></script>
<script src="/assets/js/components-advanced.js"></script>
<script src="/assets/js/theme-manager.js"></script>
```

---

## 基本コンポーネント

### Button (ボタン)

#### バリアント

```html
<!-- Primary -->
<button class="btn btn-primary">保存</button>

<!-- Secondary -->
<button class="btn btn-secondary">キャンセル</button>

<!-- Subtle -->
<button class="btn btn-subtle">詳細</button>

<!-- Danger -->
<button class="btn btn-danger">削除</button>

<!-- Success -->
<button class="btn btn-success">承認</button>
```

#### サイズ

```html
<button class="btn btn-primary btn-sm">小</button>
<button class="btn btn-primary">標準</button>
<button class="btn btn-primary btn-lg">大</button>
```

#### アイコンボタン

```html
<button class="btn btn-icon btn-subtle" aria-label="設定">⚙️</button>
<button class="btn btn-icon-sm btn-subtle" aria-label="閉じる">×</button>
```

#### 状態

```html
<!-- 無効化 -->
<button class="btn btn-primary" disabled>保存</button>

<!-- ローディング -->
<button class="btn btn-primary btn-loading">処理中...</button>
```

### Input (入力フィールド)

```html
<div class="input-group">
  <label class="input-label" for="email">メールアドレス</label>
  <input
    type="email"
    class="input"
    id="email"
    placeholder="your@email.com"
    required
  />
  <div class="input-helper">ログイン用のメールアドレスを入力してください</div>
</div>
```

#### バリデーション

```html
<!-- エラー状態 -->
<input type="text" class="input input-error" />
<div class="input-error-message">このフィールドは必須です</div>

<!-- 成功状態 -->
<input type="text" class="input input-success" />
```

### Card (カード)

```html
<div class="card">
  <div class="card-header">
    <h3 class="card-title">カードタイトル</h3>
    <span class="badge badge-success">新規</span>
  </div>
  <div class="card-body">カードのコンテンツがここに入ります。</div>
  <div class="card-footer">
    <button class="btn btn-secondary">キャンセル</button>
    <button class="btn btn-primary">保存</button>
  </div>
</div>
```

#### インタラクティブカード

```html
<div class="card card-interactive hover-lift">クリック可能なカード</div>
```

### Badge (バッジ)

```html
<span class="badge badge-primary">Primary</span>
<span class="badge badge-success">Success</span>
<span class="badge badge-warning">Warning</span>
<span class="badge badge-danger">Danger</span>
<span class="badge badge-neutral">Neutral</span>
```

---

## 高度なコンポーネント

### Avatar (アバター)

#### JavaScript での作成

```javascript
// 基本的なアバター
const avatar = AdvancedComponents.Avatar.create({
  name: 'John Doe',
  size: 'md'
});
container.appendChild(avatar);

// 画像付きアバター
const avatarWithImage = AdvancedComponents.Avatar.create({
  src: '/path/to/image.jpg',
  name: 'Jane Smith',
  size: 'lg'
});

// ステータス付きアバター
const avatarWithStatus = AdvancedComponents.Avatar.create({
  name: 'Bob Johnson',
  size: 'md',
  status: 'online' // online, offline, busy, away
});

// アバターグループ
const group = AdvancedComponents.Avatar.createGroup(
  [
    { name: 'User 1' },
    { name: 'User 2' },
    { name: 'User 3' },
    { name: 'User 4' },
    { name: 'User 5' }
  ],
  3
); // 最大3つまで表示
```

### Lozenge (ステータスラベル)

```html
<span class="lozenge lozenge-default">Default</span>
<span class="lozenge lozenge-success">Success</span>
<span class="lozenge lozenge-removed">Removed</span>
<span class="lozenge lozenge-inprogress">In Progress</span>
<span class="lozenge lozenge-new">New</span>
<span class="lozenge lozenge-moved">Moved</span>

<!-- ボールド -->
<span class="lozenge lozenge-success lozenge-bold">Success</span>

<!-- サブトル -->
<span class="lozenge lozenge-success lozenge-subtle">Success</span>
```

### Inline Message (インラインメッセージ)

```html
<!-- 情報 -->
<div class="inline-message inline-message-connectivity">
  <div class="inline-message-icon">ℹ️</div>
  <div class="inline-message-content">
    <div class="inline-message-title">接続情報</div>
    <div class="inline-message-description">
      サーバーに正常に接続されています。
    </div>
  </div>
</div>

<!-- 警告 -->
<div class="inline-message inline-message-warning">
  <div class="inline-message-icon">⚠️</div>
  <div class="inline-message-content">
    <div class="inline-message-title">警告</div>
    <div class="inline-message-description">この操作は元に戻せません。</div>
  </div>
</div>

<!-- エラー -->
<div class="inline-message inline-message-error">
  <div class="inline-message-icon">❌</div>
  <div class="inline-message-content">
    <div class="inline-message-title">エラー</div>
    <div class="inline-message-description">処理中にエラーが発生しました。</div>
  </div>
</div>

<!-- 成功 -->
<div class="inline-message inline-message-confirmation">
  <div class="inline-message-icon">✓</div>
  <div class="inline-message-content">
    <div class="inline-message-title">成功</div>
    <div class="inline-message-description">変更が保存されました。</div>
  </div>
</div>
```

### Breadcrumbs (パンくずリスト)

```javascript
const breadcrumbs = AdvancedComponents.Breadcrumbs.create([
  { label: 'ホーム', href: '/' },
  { label: 'プロジェクト', href: '/projects' },
  { label: '設定', href: '/projects/settings' }
]);

container.appendChild(breadcrumbs);
```

### Page Header (ページヘッダー)

```html
<div class="page-header">
  <div class="page-header-top">
    <h1 class="page-header-title">ページタイトル</h1>
    <div class="page-header-actions">
      <button class="btn btn-secondary">エクスポート</button>
      <button class="btn btn-primary">新規作成</button>
    </div>
  </div>
  <p class="page-header-description">ページの説明がここに表示されます。</p>
  <div class="page-header-meta">
    <span>更新日: 2025-10-09</span>
    <span>作成者: Admin</span>
  </div>
</div>
```

---

## インタラクティブコンポーネント

### Toast Notifications

```javascript
// 成功通知
window.toast.success('保存に成功しました');

// エラー通知
window.toast.error('エラーが発生しました');

// 警告
window.toast.warning('注意してください');

// 情報
window.toast.info('お知らせです');

// カスタム
window.toast.show({
  type: 'success',
  title: 'カスタムタイトル',
  message: 'カスタムメッセージ',
  duration: 5000,
  closable: true
});
```

### Modal (モーダル)

```javascript
const modal = new UIComponents.Modal({
  title: 'モーダルタイトル',
  content: '<p>モーダルのコンテンツ</p>',
  footer: `
    <button class="btn btn-secondary">キャンセル</button>
    <button class="btn btn-primary">OK</button>
  `,
  closable: true,
  onClose: () => {
    console.log('モーダルが閉じられました');
  }
});

modal.open();

// 確認ダイアログ
const confirmed = await UIComponents.Modal.confirm(
  '本当に削除しますか?',
  '確認'
);

if (confirmed) {
  // 削除処理
}
```

### Table (テーブル)

```javascript
const table = new AdvancedComponents.Table(container, {
  columns: [
    { key: 'name', label: '名前' },
    { key: 'email', label: 'メール' },
    {
      key: 'role',
      label: '役割',
      render: value => {
        return `<span class="lozenge lozenge-success">${value}</span>`;
      }
    }
  ],
  data: [
    { name: '田中太郎', email: 'tanaka@example.com', role: 'Admin' },
    { name: '佐藤花子', email: 'sato@example.com', role: 'User' }
  ],
  sortable: true
});

// データ更新
table.updateData(newData);
```

### Pagination (ページネーション)

```javascript
const pagination = new AdvancedComponents.Pagination({
  total: 100, // 総アイテム数
  pageSize: 10, // 1ページあたりのアイテム数
  currentPage: 1, // 現在のページ
  maxButtons: 7, // 最大ボタン数
  onChange: page => {
    console.log('ページが変更されました:', page);
    // ページ変更時の処理
  }
});

container.appendChild(pagination.render());
```

### Form Validation

```javascript
const form = document.querySelector('form');

form.addEventListener('submit', e => {
  e.preventDefault();

  const isValid = AdvancedComponents.FormValidator.validate(form);

  if (isValid) {
    // フォーム送信処理
    window.toast.success('フォームが送信されました');
  } else {
    window.toast.error('入力内容を確認してください');
  }
});
```

### Inline Edit

```javascript
const element = document.getElementById('editable-text');

const inlineEdit = new AdvancedComponents.InlineEdit(element, {
  onSave: (newValue, oldValue) => {
    console.log(`${oldValue} → ${newValue}`);
    window.toast.success('更新しました');
  },
  onCancel: () => {
    window.toast.info('キャンセルしました');
  }
});
```

### Empty State

```javascript
const emptyState = AdvancedComponents.createEmptyState({
  icon: '📭',
  title: 'データがありません',
  description: 'まだアイテムが追加されていません。',
  actions: [
    {
      label: '新規作成',
      className: 'btn btn-primary',
      onClick: () => {
        // 新規作成処理
      }
    }
  ]
});

container.appendChild(emptyState);
```

---

## フォームコンポーネント

### Checkbox

```html
<label class="checkbox-wrapper">
  <input type="checkbox" class="checkbox-input" />
  <span class="checkbox-box"></span>
  <div>
    <div class="checkbox-label">ラベル</div>
    <div class="checkbox-description">説明文がここに入ります</div>
  </div>
</label>
```

### Radio

```html
<div class="radio-group">
  <label class="radio-wrapper">
    <input type="radio" name="option" class="radio-input" />
    <span class="radio-circle"></span>
    <span class="radio-label">オプション 1</span>
  </label>
  <label class="radio-wrapper">
    <input type="radio" name="option" class="radio-input" />
    <span class="radio-circle"></span>
    <span class="radio-label">オプション 2</span>
  </label>
</div>
```

### Toggle

```html
<label class="toggle-wrapper">
  <input type="checkbox" class="toggle-input" />
  <span class="toggle-switch"></span>
  <span class="toggle-label">通知を有効化</span>
</label>
```

### Select

```html
<div class="select-wrapper">
  <select class="select">
    <option>オプションを選択...</option>
    <option value="1">オプション 1</option>
    <option value="2">オプション 2</option>
    <option value="3">オプション 3</option>
  </select>
</div>
```

---

## ナビゲーションコンポーネント

### Side Navigation

```html
<nav class="side-nav">
  <a href="#" class="side-nav-item active">
    <span class="side-nav-icon">🏠</span>
    <span class="side-nav-label">ホーム</span>
  </a>
  <a href="#" class="side-nav-item">
    <span class="side-nav-icon">📊</span>
    <span class="side-nav-label">ダッシュボード</span>
    <span class="badge badge-danger side-nav-badge">3</span>
  </a>

  <div class="side-nav-section">
    <div class="side-nav-section-title">設定</div>
    <a href="#" class="side-nav-item">
      <span class="side-nav-icon">⚙️</span>
      <span class="side-nav-label">一般設定</span>
    </a>
  </div>
</nav>
```

---

## カスタマイズ

### カラー

```css
:root {
  --color-brand-primary: #0052cc;
  --color-success: #00875a;
  --color-warning: #ff991f;
  --color-danger: #de350b;
}
```

### スペーシング

```css
:root {
  --space-4: 0.25rem;
  --space-8: 0.5rem;
  --space-12: 0.75rem;
  --space-16: 1rem;
  --space-24: 1.5rem;
}
```

### タイポグラフィ

```css
:root {
  --font-size-12: 0.75rem;
  --font-size-14: 0.875rem;
  --font-size-16: 1rem;
  --font-size-20: 1.25rem;
  --font-size-24: 1.5rem;
}
```

---

## ベストプラクティス

### アクセシビリティ

```html
<!-- ARIAラベルを使用 -->
<button class="btn btn-icon" aria-label="設定を開く">⚙️</button>

<!-- スキップリンクを提供 -->
<a href="#main-content" class="skip-link">メインコンテンツへスキップ</a>

<!-- 適切な見出し階層 -->
<h1>ページタイトル</h1>
<h2>セクション</h2>
<h3>サブセクション</h3>
```

### レスポンシブデザイン

```html
<!-- タッチターゲットを十分な大きさに -->
<button class="btn btn-primary" style="min-height: 44px; min-width: 44px;">
  ボタン
</button>

<!-- モバイル優先でデザイン -->
<div class="demo-grid">
  <!-- 自動的にレスポンシブになります -->
</div>
```

### パフォーマンス

```javascript
// デバウンスを使用
const debouncedSearch = UIComponents.debounce(query => {
  // 検索処理
}, 300);

// スロットルを使用
const throttledScroll = UIComponents.throttle(() => {
  // スクロール処理
}, 100);
```

---

## デモ

すべてのコンポーネントの動作デモは、[components-demo.html](components-demo.html)
で確認できます。

```bash
# デモページを開く
open components-demo.html
```

---

## サポート

- [ドキュメント](docs/UI_UX_IMPROVEMENTS.md)
- [Atlassian Design System](https://atlassian.design/)

---

**更新日**: 2025-10-09 **バージョン**: 2.0.0
