# Pull Request

## 変更の概要 / Summary

このPRで何を変更したかを簡潔に説明してください。
*Briefly describe what this PR changes.*

## 関連Issue / Related Issues

このPRに関連するIssueがあればリンクしてください。
*Link any related issues.*

Closes #[issue number]
Related to #[issue number]

## 変更の種類 / Type of Change

該当するものにチェックを入れてください：
*Please check the relevant option:*

- [ ] 🐛 バグ修正 / Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ 新機能 / New feature (non-breaking change which adds functionality)
- [ ] 💥 破壊的変更 / Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 ドキュメント更新 / Documentation update
- [ ] 🎨 UI/UXの改善 / UI/UX improvement
- [ ] ⚡️ パフォーマンス改善 / Performance improvement
- [ ] ♻️ リファクタリング / Code refactoring
- [ ] ✅ テスト追加・修正 / Test addition or modification
- [ ] 🔧 設定変更 / Configuration change
- [ ] 🏗️ ビルド・CI/CD変更 / Build or CI/CD change

## 変更内容の詳細 / Detailed Description

### 実装の詳細 / Implementation Details

どのように実装したかを説明してください。
*Explain how you implemented the changes.*

### 技術的な決定事項 / Technical Decisions

重要な技術的決定とその理由を説明してください。
*Explain any important technical decisions and why you made them.*

## テスト / Testing

### テスト内容 / What was tested

どのようなテストを実施したか記載してください：
*Describe the tests you performed:*

- [ ] ユニットテストを追加 / Added unit tests
- [ ] 既存のテストが通過 / All existing tests pass
- [ ] 手動テスト実施 / Manual testing performed
- [ ] E2Eテスト実施 / E2E testing performed
- [ ] VRデバイスでテスト / Tested on VR device

### テスト環境 / Test Environment

**デバイス / Device:**
- [ ] Meta Quest 2
- [ ] Meta Quest 3
- [ ] Pico 4
- [ ] PC（開発環境）/ PC (development)
- [ ] その他 / Other: ___________

**ブラウザ / Browser:**
- ブラウザ: [例: Meta Quest Browser 28.0]
- OS: [例: Android 12]

### テスト結果 / Test Results

```
テスト結果をここに貼り付け
Paste test results here
```

## スクリーンショット / Screenshots

UI/UXの変更がある場合は、変更前後のスクリーンショットを追加してください。
*If there are UI/UX changes, add before/after screenshots.*

### Before（変更前）

### After（変更後）

## パフォーマンスへの影響 / Performance Impact

この変更がパフォーマンスに与える影響を説明してください：
*Describe any performance impact of this change:*

- [ ] パフォーマンス改善あり / Performance improvement
- [ ] パフォーマンスに影響なし / No performance impact
- [ ] パフォーマンスへの影響を確認中 / Performance impact being evaluated

**測定結果 / Measurements:**
```
変更前 / Before: XX FPS, XX ms
変更後 / After: XX FPS, XX ms
```

## 破壊的変更 / Breaking Changes

破壊的変更がある場合は、詳細と移行方法を記載してください：
*If there are breaking changes, describe them and how to migrate:*

- [ ] 破壊的変更なし / No breaking changes
- [ ] 破壊的変更あり（下記参照）/ Breaking changes (see below)

**移行ガイド / Migration Guide:**
```
既存のコードを以下のように変更してください
Update existing code as follows:
```

## チェックリスト / Checklist

PRを提出する前に、以下を確認してください：
*Before submitting, please check the following:*

### コード品質 / Code Quality
- [ ] コードは[コーディング規約](../CONTRIBUTING.md#コーディング規約)に従っている / Code follows the [coding conventions](../CONTRIBUTING.md)
- [ ] セルフレビューを実施した / I have performed a self-review of my code
- [ ] コードにコメントを追加した（特に複雑な部分）/ I have commented my code, particularly in hard-to-understand areas
- [ ] リンターエラーがない / No linter errors
- [ ] 不要なコンソールログを削除した / Removed unnecessary console.log statements

### テスト / Testing
- [ ] ユニットテストを追加・更新した / I have added/updated unit tests
- [ ] すべてのテストが通過している / All tests pass
  ```bash
  npm test
  ```
- [ ] テストカバレッジが維持・向上している / Test coverage is maintained or improved
- [ ] VRデバイスで動作確認した / Tested on VR device

### ドキュメント / Documentation
- [ ] ドキュメントを更新した / I have updated the documentation
- [ ] APIドキュメントを更新した（該当する場合）/ Updated API docs (if applicable)
- [ ] CHANGELOGを更新した / Updated CHANGELOG.md
- [ ] READMEを更新した（該当する場合）/ Updated README (if applicable)
- [ ] コード内のコメントを日本語/英語で記載した / Added code comments in Japanese/English

### その他 / Other
- [ ] 依存関係の変更がある場合、package.jsonを更新した / Updated package.json if dependencies changed
- [ ] 新しいファイルのライセンスヘッダーを追加した / Added license headers to new files
- [ ] ビルドが成功する / Build succeeds
  ```bash
  npm run build
  ```
- [ ] デプロイメント設定を更新した（該当する場合）/ Updated deployment configs (if applicable)

## セキュリティへの影響 / Security Impact

この変更がセキュリティに与える影響を説明してください：
*Describe any security impact of this change:*

- [ ] セキュリティへの影響なし / No security impact
- [ ] セキュリティが向上した / Security improvement
- [ ] 潜在的なセキュリティ問題を発見（詳細は非公開で報告）/ Found potential security issue (report privately)

## 追加のコンテキスト / Additional Context

レビュアーに伝えたい追加情報があれば記載してください。
*Add any additional context for reviewers.*

## レビュアーへのメモ / Notes for Reviewers

特に注目してほしい部分や、フィードバックが欲しい部分があれば記載してください。
*Highlight any areas where you'd particularly like feedback.*

---

**レビュアーへ / For Reviewers:**

このPRをレビューする際は、以下を確認してください：
*When reviewing this PR, please check:*

- [ ] コードの品質と可読性 / Code quality and readability
- [ ] テストの妥当性 / Test validity
- [ ] パフォーマンスへの影響 / Performance impact
- [ ] セキュリティへの考慮 / Security considerations
- [ ] ドキュメントの完全性 / Documentation completeness
- [ ] 破壊的変更の妥当性 / Validity of breaking changes (if any)

---

ご協力ありがとうございます！/ Thank you for your contribution! 🎉
