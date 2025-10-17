'use strict';

const fs = require('fs');
const path = require('path');

const initiatives = [
  {
    jaTitle: 'CSPプリセット自動生成',
    enTitle: 'Automated CSP preset generation',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: 'CSPテンプレートの自動生成基盤を構築し、',
    enDetail: 'build an automated CSP template generation platform,'
  },
  {
    jaTitle: 'TLS証明書自動更新',
    enTitle: 'Automated TLS certificate renewal',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: 'TLS証明書の失効を検知して自動再発行する仕組みを整備し、',
    enDetail: 'establish automated TLS certificate renewal workflows,'
  },
  {
    jaTitle: '依存関係脆弱性監視強化',
    enTitle: 'Enhanced dependency vulnerability monitoring',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: '依存ライブラリの脆弱性をリアルタイムに監視し、',
    enDetail: 'monitor dependency vulnerabilities in real time,'
  },
  {
    jaTitle: 'リクエストトレーシング高速化',
    enTitle: 'Accelerated request tracing',
    categoryJa: '可観測性',
    categoryEn: 'Observability',
    jaDetail: 'トレースIDの収集と集計を最適化し、',
    enDetail: 'optimize trace ID collection and aggregation,'
  },
  {
    jaTitle: 'リアルタイムメトリクス集約',
    enTitle: 'Real-time metrics aggregation',
    categoryJa: '可観測性',
    categoryEn: 'Observability',
    jaDetail: 'メトリクスをリアルタイムに集約するパイプラインを整備し、',
    enDetail: 'introduce pipelines for real-time metrics aggregation,'
  },
  {
    jaTitle: 'レスポンスキャッシュアルゴリズム調整',
    enTitle: 'Adaptive response cache tuning',
    categoryJa: 'パフォーマンス',
    categoryEn: 'Performance',
    jaDetail: 'レスポンスキャッシュのアルゴリズムを動的に調整し、',
    enDetail: 'tune the response cache algorithm dynamically,'
  },
  {
    jaTitle: '静的ファイル圧縮前処理',
    enTitle: 'Static asset precompression',
    categoryJa: 'パフォーマンス',
    categoryEn: 'Performance',
    jaDetail: '静的ファイルの事前圧縮パイプラインを導入し、',
    enDetail: 'introduce a precompression pipeline for static assets,'
  },
  {
    jaTitle: 'レート制限プロファイリング',
    enTitle: 'Intelligent rate limit profiling',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: 'アクセスパターンに基づくレート制限プロファイルを構築し、',
    enDetail: 'build access-pattern-based rate limit profiles,'
  },
  {
    jaTitle: 'エラーレポートポータル構築',
    enTitle: 'Error report portal',
    categoryJa: '開発体験',
    categoryEn: 'Developer Experience',
    jaDetail: 'エラー情報を集中管理するポータルを整備し、',
    enDetail: 'stand up a centralized error reporting portal,'
  },
  {
    jaTitle: 'APIスキーマ検証自動化',
    enTitle: 'Automated API schema validation',
    categoryJa: '品質',
    categoryEn: 'Quality',
    jaDetail: 'APIスキーマの検証をCIに組み込み、',
    enDetail: 'embed API schema validation into CI,'
  },
  {
    jaTitle: 'ヘルスチェック拡張',
    enTitle: 'Expanded health checks',
    categoryJa: '信頼性',
    categoryEn: 'Reliability',
    jaDetail: '重要指標を網羅するヘルスチェックを追加し、',
    enDetail: 'extend health checks to cover critical indicators,'
  },
  {
    jaTitle: 'セッションログ相関分析',
    enTitle: 'Session log correlation analytics',
    categoryJa: '可観測性',
    categoryEn: 'Observability',
    jaDetail: 'セッションログを相関分析する仕組みを整備し、',
    enDetail: 'enable correlation analytics across session logs,'
  },
  {
    jaTitle: 'CI高速パイプライン最適化',
    enTitle: 'Optimized CI acceleration',
    categoryJa: 'ビルド',
    categoryEn: 'Build',
    jaDetail: 'CIパイプラインのボトルネックを排除し、',
    enDetail: 'eliminate bottlenecks in the CI pipeline,'
  },
  {
    jaTitle: 'コンフィグ動的リロード',
    enTitle: 'Dynamic configuration reload',
    categoryJa: '運用',
    categoryEn: 'Operations',
    jaDetail: '設定変更をダウンタイムなく反映する仕組みを構築し、',
    enDetail: 'enable zero-downtime dynamic configuration reloads,'
  },
  {
    jaTitle: '構成監査証跡整備',
    enTitle: 'Configuration audit trail reinforcement',
    categoryJa: 'コンプライアンス',
    categoryEn: 'Compliance',
    jaDetail: '構成変更の履歴を正確に保存する証跡を整備し、',
    enDetail: 'reinforce configuration change audit trails,'
  },
  {
    jaTitle: '多言語ドキュメント基盤構築',
    enTitle: 'Multilingual documentation platform',
    categoryJa: 'ドキュメンテーション',
    categoryEn: 'Documentation',
    jaDetail: '多言語に対応できるドキュメント基盤を構築し、',
    enDetail: 'build a documentation platform that supports multiple languages,'
  },
  {
    jaTitle: 'アクセシビリティ自動監査',
    enTitle: 'Automated accessibility auditing',
    categoryJa: 'アクセシビリティ',
    categoryEn: 'Accessibility',
    jaDetail: 'アクセシビリティ監査の自動化ワークフローを整備し、',
    enDetail: 'set up automated accessibility audit workflows,'
  },
  {
    jaTitle: 'ダークモードUI最適化',
    enTitle: 'Dark mode UI optimization',
    categoryJa: 'ユーザー体験',
    categoryEn: 'User Experience',
    jaDetail: 'ダークモードの配色とコントラストを改善し、',
    enDetail: 'refine dark mode colour and contrast,'
  },
  {
    jaTitle: 'モバイルネットワーク最適化',
    enTitle: 'Mobile network optimization',
    categoryJa: 'パフォーマンス',
    categoryEn: 'Performance',
    jaDetail: 'モバイル回線を想定した最適化ルールを整備し、',
    enDetail: 'establish optimization rules for mobile networks,'
  },
  {
    jaTitle: '帯域制御ポリシー整備',
    enTitle: 'Bandwidth control policies',
    categoryJa: 'ネットワーク',
    categoryEn: 'Networking',
    jaDetail: '帯域制御のポリシーを細分化し、',
    enDetail: 'define granular bandwidth control policies,'
  },
  {
    jaTitle: 'ログサニタイズ強化',
    enTitle: 'Log sanitization enhancements',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: 'ログサニタイズルールを強化し、',
    enDetail: 'strengthen log sanitization rules,'
  },
  {
    jaTitle: 'リアルタイム通知チャネル整備',
    enTitle: 'Real-time notification channels',
    categoryJa: '運用',
    categoryEn: 'Operations',
    jaDetail: 'リアルタイム通知チャネルを統合し、',
    enDetail: 'consolidate real-time notification channels,'
  },
  {
    jaTitle: 'バックアップ世代管理自動化',
    enTitle: 'Automated backup generation management',
    categoryJa: 'レジリエンス',
    categoryEn: 'Resilience',
    jaDetail: 'バックアップ世代を自動管理する仕組みを構築し、',
    enDetail: 'automate generation management for backups,'
  },
  {
    jaTitle: '災害復旧プレイブック整備',
    enTitle: 'Disaster recovery playbook',
    categoryJa: 'レジリエンス',
    categoryEn: 'Resilience',
    jaDetail: '災害復旧の手順を体系化したプレイブックを整備し、',
    enDetail: 'compile standardized disaster recovery playbooks,'
  },
  {
    jaTitle: 'ストレージ圧縮戦略刷新',
    enTitle: 'Storage compression strategy',
    categoryJa: 'ストレージ',
    categoryEn: 'Storage',
    jaDetail: 'ストレージ圧縮戦略を刷新し、',
    enDetail: 'refresh the storage compression strategy,'
  },
  {
    jaTitle: 'データ保持ポリシー自動化',
    enTitle: 'Automated data retention policy',
    categoryJa: 'コンプライアンス',
    categoryEn: 'Compliance',
    jaDetail: 'データ保持ポリシーの自動適用基盤を構築し、',
    enDetail: 'build an automated data retention policy engine,'
  },
  {
    jaTitle: 'HTTP/2サーバープッシュ検証',
    enTitle: 'HTTP/2 server push evaluation',
    categoryJa: 'パフォーマンス',
    categoryEn: 'Performance',
    jaDetail: 'HTTP/2サーバープッシュの効果を検証し、',
    enDetail: 'evaluate the benefits of HTTP/2 server push,'
  },
  {
    jaTitle: 'WebSocketサポート拡張',
    enTitle: 'WebSocket support expansion',
    categoryJa: '機能',
    categoryEn: 'Feature',
    jaDetail: 'WebSocket通信のサポートを拡張し、',
    enDetail: 'expand support for WebSocket communication,'
  },
  {
    jaTitle: 'サービスワーカー最適化',
    enTitle: 'Service worker optimization',
    categoryJa: 'フロントエンド',
    categoryEn: 'Frontend',
    jaDetail: 'サービスワーカーのキャッシュ制御を最適化し、',
    enDetail: 'optimize service worker cache controls,'
  },
  {
    jaTitle: 'ブラウザ同期API拡張',
    enTitle: 'Browser sync API expansion',
    categoryJa: '機能',
    categoryEn: 'Feature',
    jaDetail: 'ブラウザ同期向けAPIを拡張し、',
    enDetail: 'extend browser synchronization APIs,'
  },
  {
    jaTitle: 'ユーザープロファイル暗号化強化',
    enTitle: 'User profile encryption enhancement',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: 'ユーザープロファイルの暗号化層を強化し、',
    enDetail: 'strengthen encryption layers for user profiles,'
  },
  {
    jaTitle: '秘密情報ローテーション自動化',
    enTitle: 'Automated secrets rotation',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: '秘密情報を自動ローテーションする仕組みを整備し、',
    enDetail: 'automate secrets rotation workflows,'
  },
  {
    jaTitle: '監査ログ保存拡張',
    enTitle: 'Audit log retention extension',
    categoryJa: 'コンプライアンス',
    categoryEn: 'Compliance',
    jaDetail: '監査ログの保存期間と検索性能を拡張し、',
    enDetail: 'extend retention and searchability for audit logs,'
  },
  {
    jaTitle: 'ヘッドレステスト強化',
    enTitle: 'Headless testing enhancement',
    categoryJa: 'テスト',
    categoryEn: 'Testing',
    jaDetail: 'ヘッドレスブラウザテストの網羅性を高め、',
    enDetail: 'increase coverage for headless browser tests,'
  },
  {
    jaTitle: '負荷試験スケジューラ',
    enTitle: 'Load testing scheduler',
    categoryJa: 'パフォーマンス',
    categoryEn: 'Performance',
    jaDetail: '自動スケジュールされた負荷試験を実施し、',
    enDetail: 'run automatically scheduled load tests,'
  },
  {
    jaTitle: 'インシデント対応ランブック標準化',
    enTitle: 'Standardized incident runbooks',
    categoryJa: '運用',
    categoryEn: 'Operations',
    jaDetail: 'インシデント対応ランブックを標準化し、',
    enDetail: 'standardize incident response runbooks,'
  },
  {
    jaTitle: 'リソース可視化ダッシュボード',
    enTitle: 'Resource visualization dashboard',
    categoryJa: '可観測性',
    categoryEn: 'Observability',
    jaDetail: 'リソース使用量を可視化するダッシュボードを整備し、',
    enDetail: 'provide dashboards for resource usage visualization,'
  },
  {
    jaTitle: 'クラウド互換デプロイ層',
    enTitle: 'Cloud-compatible deployment layer',
    categoryJa: 'インフラ',
    categoryEn: 'Infrastructure',
    jaDetail: 'クラウド向けのデプロイ互換層を構築し、',
    enDetail: 'build a deployment compatibility layer for cloud targets,'
  },
  {
    jaTitle: 'コンテナ最適化',
    enTitle: 'Container optimization',
    categoryJa: 'インフラ',
    categoryEn: 'Infrastructure',
    jaDetail: 'コンテナイメージの最適化と軽量化を実施し、',
    enDetail: 'optimize and slim container images,'
  },
  {
    jaTitle: 'アクセス制御境界強化',
    enTitle: 'Access control boundary hardening',
    categoryJa: 'セキュリティ',
    categoryEn: 'Security',
    jaDetail: '境界型アクセス制御を強化し、',
    enDetail: 'harden perimeter access control boundaries,'
  },
  {
    jaTitle: 'プラグインAPI設計',
    enTitle: 'Plugin API design',
    categoryJa: '拡張性',
    categoryEn: 'Extensibility',
    jaDetail: 'プラグイン向けの安定したAPIを設計し、',
    enDetail: 'design stable APIs for plugin integrations,'
  },
  {
    jaTitle: 'CLIツール整備',
    enTitle: 'CLI toolkit',
    categoryJa: '開発体験',
    categoryEn: 'Developer Experience',
    jaDetail: '開発者向けCLIツールを整備し、',
    enDetail: 'provide a robust CLI toolkit for developers,'
  },
  {
    jaTitle: 'Webhook管理基盤',
    enTitle: 'Webhook management platform',
    categoryJa: '連携',
    categoryEn: 'Integration',
    jaDetail: 'Webhook管理のライフサイクルを整備し、',
    enDetail: 'build a lifecycle management platform for webhooks,'
  },
  {
    jaTitle: 'イベントストリーム監視',
    enTitle: 'Event stream monitoring',
    categoryJa: '可観測性',
    categoryEn: 'Observability',
    jaDetail: 'イベントストリームの監視を強化し、',
    enDetail: 'enhance monitoring of event streams,'
  },
  {
    jaTitle: 'データ検証ルールエンジン',
    enTitle: 'Data validation rules engine',
    categoryJa: 'データ品質',
    categoryEn: 'Data Quality',
    jaDetail: 'データ検証ルールを動的に適用するエンジンを構築し、',
    enDetail: 'build a rules engine for dynamic data validation,'
  },
  {
    jaTitle: 'キャッシュ整合性チェック',
    enTitle: 'Cache consistency checks',
    categoryJa: 'パフォーマンス',
    categoryEn: 'Performance',
    jaDetail: 'キャッシュ整合性を定期チェックする仕組みを整備し、',
    enDetail: 'establish recurring cache consistency checks,'
  },
  {
    jaTitle: 'パフォーマンス予測モデル',
    enTitle: 'Performance forecasting model',
    categoryJa: '分析',
    categoryEn: 'Analytics',
    jaDetail: '負荷トレンドを予測するモデルを構築し、',
    enDetail: 'develop models that forecast load trends,'
  },
  {
    jaTitle: 'ユーザー行動分析基盤',
    enTitle: 'User behaviour analytics foundation',
    categoryJa: '分析',
    categoryEn: 'Analytics',
    jaDetail: 'ユーザー行動データを分析する基盤を整備し、',
    enDetail: 'set up a foundation for user behaviour analytics,'
  },
  {
    jaTitle: 'UXフィードバック収集ループ',
    enTitle: 'UX feedback collection loop',
    categoryJa: 'ユーザー体験',
    categoryEn: 'User Experience',
    jaDetail: 'UXフィードバックを定常的に収集する仕組みを整備し、',
    enDetail: 'create a constant UX feedback collection loop,'
  },
  {
    jaTitle: 'サポートナレッジベース整備',
    enTitle: 'Support knowledge base',
    categoryJa: 'サポート',
    categoryEn: 'Support',
    jaDetail: 'サポートナレッジベースを拡充し、',
    enDetail: 'expand the support knowledge base,'
  }
];

const actionSegments = [
  { ja: '優先導入で', en: 'Prioritized rollout to' },
  { ja: '段階的ロールアウトで', en: 'Phased rollout to' },
  { ja: '運用標準化により', en: 'Operational standardization to' },
  { ja: '継続的改善サイクルを設定し', en: 'Establish continuous improvement cycles to' },
  { ja: 'ユーザー協働で', en: 'Co-design with users to' },
  { ja: '自動化パイプラインを適用して', en: 'Apply automation pipelines to' },
  { ja: 'SLO基準を定義して', en: 'Define SLO baselines to' },
  { ja: '品質ゲートを追加し', en: 'Add quality gates to' },
  { ja: '分離環境を活用して', en: 'Leverage isolated environments to' },
  { ja: '監査要件を踏まえながら', en: 'Align with audit requirements to' },
  { ja: '高リスク領域を優先し', en: 'Prioritize high-risk areas to' },
  { ja: '軽量アーキテクチャを保ちつつ', en: 'Maintain lightweight architecture while' },
  { ja: 'データ駆動のワークフローで', en: 'Use data-driven workflows to' },
  { ja: '自律的な監視を構築して', en: 'Build autonomous monitoring to' },
  { ja: 'サービス設計ガイドラインに沿って', en: 'Follow service design guidelines to' },
  { ja: '内製化体制を整備し', en: 'Strengthen in-house capabilities to' },
  { ja: 'テンプレートを整備して', en: 'Prepare templates to' },
  { ja: 'プラットフォーム横断で', en: 'Work across platforms to' },
  { ja: '可観測性を高めて', en: 'Increase observability to' },
  { ja: '省力化を意識して', en: 'Focus on labor reduction to' }
];

const approachSegments = [
  { ja: '検証環境と本番環境を分離し、', en: 'separate validation and production environments and' },
  { ja: 'ロールバック戦略を明確化し、', en: 'clarify rollback strategies and' },
  { ja: '標準化されたプレイブックを整備して', en: 'document standardized playbooks and' },
  { ja: '軽量な監視エージェントを導入して', en: 'introduce lightweight monitoring agents and' },
  { ja: 'セキュリティレビューを自動化し、', en: 'automate security reviews and' },
  { ja: '依存関係を可視化し、', en: 'visualize dependencies and' },
  { ja: 'スケール試験を継続実施し、', en: 'run recurring scale tests and' },
  { ja: 'ロギングを構造化し、', en: 'structure logging and' },
  { ja: 'テストカバレッジを95%まで引き上げて', en: 'raise automated test coverage to 95% and' },
  { ja: 'CIを5段階に細分化して', en: 'split CI into five stages and' },
  { ja: 'レポートダッシュボードを整備し、', en: 'build reporting dashboards and' },
  { ja: 'フェールセーフAPIを追加して', en: 'add fail-safe APIs and' },
  { ja: 'サービスカタログを整備し、', en: 'maintain a service catalog and' },
  { ja: 'メトリクスの整合性を保証し、', en: 'ensure metric consistency and' },
  { ja: 'クラウドインフラとオンプレ双方に対応し、', en: 'support both cloud and on-prem environments and' },
  { ja: '変更管理フローを簡素化して', en: 'simplify change management flows and' },
  { ja: 'ドキュメントを多言語で同期し、', en: 'synchronize documentation across languages and' },
  { ja: 'ユーザーフィードバックを連続取得して', en: 'capture user feedback continuously and' },
  { ja: 'ナレッジ共有セッションを設計し、', en: 'design knowledge-sharing sessions and' },
  { ja: '学習データを安全に保管し、', en: 'store training data securely and' }
];

const metricSegments = [
  { ja: '平均復旧時間を20%短縮する。', en: 'shorten mean time to recovery by 20%.' },
  { ja: '障害検知までの時間を15分以内に抑える。', en: 'limit incident detection time to under 15 minutes.' },
  { ja: 'ピーク時の応答時間を35%改善する。', en: 'improve peak response time by 35%.' },
  { ja: 'キャッシュヒット率を85%以上に到達させる。', en: 'raise cache hit rate beyond 85%.' },
  { ja: 'セキュリティインシデントを半減させる。', en: 'halve security incident occurrences.' },
  { ja: '手作業工数を40%削減する。', en: 'cut manual effort by 40%.' },
  { ja: '重大障害ゼロを12か月維持する。', en: 'maintain zero critical incidents for 12 months.' },
  { ja: '監査指摘件数をゼロに抑える。', en: 'keep audit findings at zero.' },
  { ja: '国際化対応速度を2倍に高める。', en: 'double the speed of internationalization updates.' },
  { ja: 'SLO達成率を99.9%に引き上げる。', en: 'raise SLO attainment to 99.9%.' },
  { ja: 'CPU負荷を25%抑制する。', en: 'reduce CPU load by 25%.' },
  { ja: '帯域利用を30%最適化する。', en: 'optimize bandwidth consumption by 30%.' },
  { ja: 'サポート問い合わせの初動時間を10分以内にする。', en: 'keep support initial response within 10 minutes.' },
  { ja: 'デプロイ時間を半分に短縮する。', en: 'halve deployment time.' },
  { ja: 'リリース後バグ率を0.2%以下に抑える。', en: 'keep post-release bug rate below 0.2%.' },
  { ja: 'コンプライアンス遵守率を100%維持する。', en: 'sustain 100% compliance adherence.' },
  { ja: 'APIスループットを50%向上させる。', en: 'increase API throughput by 50%.' },
  { ja: 'UX満足度スコアを4.6以上に引き上げる。', en: 'lift UX satisfaction score to 4.6 or higher.' },
  { ja: 'ビルド失敗率を0.5%以下に抑制する。', en: 'limit build failure rate below 0.5%.' },
  { ja: 'ログ解析時間を70%短縮する。', en: 'shorten log analysis time by 70%.' }
];

const kpiMetrics = [
  { ja: 'CSP適用成功率', en: 'CSP adoption success rate' },
  { ja: '証明書更新自動成功率', en: 'Certificate renewal auto success rate' },
  { ja: '脆弱性検知リードタイム', en: 'Vulnerability detection lead time' },
  { ja: '分散トレーシング完了率', en: 'Distributed tracing completion rate' },
  { ja: 'メトリクス収集遅延', en: 'Metrics collection latency' },
  { ja: 'キャッシュヒット率', en: 'Cache hit rate' },
  { ja: '静的圧縮率', en: 'Static compression ratio' },
  { ja: 'レート制限誤検知率', en: 'Rate limit false positive rate' },
  { ja: 'エラーポータル利用率', en: 'Error portal usage rate' },
  { ja: 'スキーマ検証合格率', en: 'Schema validation pass rate' },
  { ja: 'ヘルスチェック成功率', en: 'Health check success ratio' },
  { ja: 'ログ相関一致率', en: 'Log correlation accuracy' },
  { ja: 'CIステージ通過時間', en: 'CI stage completion time' },
  { ja: '構成リロード成功率', en: 'Configuration reload success rate' },
  { ja: '監査証跡整備率', en: 'Audit trail coverage' },
  { ja: '多言語ドキュメント整備率', en: 'Multilingual documentation coverage' },
  { ja: 'アクセシビリティ適合率', en: 'Accessibility compliance ratio' },
  { ja: 'ユーザー体験満足度', en: 'User experience satisfaction' },
  { ja: '帯域制御達成度', en: 'Bandwidth control attainment' },
  { ja: 'バックアップ整合性率', en: 'Backup integrity rate' }
];

const releaseWaves = [
  { ja: 'FY2025 Q1', en: 'FY2025 Q1' },
  { ja: 'FY2025 Q2', en: 'FY2025 Q2' },
  { ja: 'FY2025 Q3', en: 'FY2025 Q3' },
  { ja: 'FY2025 Q4', en: 'FY2025 Q4' },
  { ja: 'FY2026 Q1', en: 'FY2026 Q1' },
  { ja: 'FY2026 Q2', en: 'FY2026 Q2' },
  { ja: 'FY2026 Q3', en: 'FY2026 Q3' },
  { ja: 'FY2026 Q4', en: 'FY2026 Q4' },
  { ja: 'FY2027 Q1', en: 'FY2027 Q1' },
  { ja: 'FY2027 Q2', en: 'FY2027 Q2' }
];

const total = 500;
const lines = [];
lines.push('# 改善バックログ / Improvement Backlog');
lines.push('');
lines.push('重要度が高い項目から中程度の項目までを網羅した500の改善施策です。');
lines.push('This backlog lists 500 improvements from high to medium priority.');
lines.push('');

for (let i = 1; i <= total; i++) {
  const initiative = initiatives[(i - 1) % initiatives.length];
  const action = actionSegments[(i - 1) % actionSegments.length];
  const approach = approachSegments[Math.floor((i - 1) / 50) % approachSegments.length];
  const metric = metricSegments[Math.floor((i - 1) / 20) % metricSegments.length];
  const kpi = kpiMetrics[((i - 1) * 3 + Math.floor(i / 11)) % kpiMetrics.length];
  const release = releaseWaves[Math.floor((i - 1) / 50) % releaseWaves.length];

  const priorityJa = i <= 250 ? '高優先度' : '中優先度';
  const priorityEn = i <= 250 ? 'High priority' : 'Medium priority';
  const prefix = i <= 250 ? 'H' : 'M';
  const idNumber = String(i).padStart(3, '0');
  const titleLine = `- **${prefix}${idNumber} (${priorityJa} / ${priorityEn}) ${initiative.jaTitle} / ${initiative.enTitle}**`;
  lines.push(titleLine);
  const jaSentence = `${action.ja}${initiative.jaDetail}${approach.ja}${metric.ja}`;
  const enSentence = `${action.en} ${initiative.enDetail} ${approach.en} ${metric.en}`;
  lines.push(`  JA: ${jaSentence}`);
  lines.push(`  EN: ${enSentence}`);
  lines.push(`  分類 / Category: ${initiative.categoryJa} / ${initiative.categoryEn}`);
  lines.push(`  KPI: ${kpi.ja} / ${kpi.en}`);
  lines.push(`  リリース目標 / Target Release: ${release.ja} / ${release.en}`);
  lines.push(`  追跡ID / Tracking ID: IMP-${String(i).padStart(3, '0')}`);
  lines.push('');
}

const outputDir = path.join(__dirname, '..', 'docs');
fs.mkdirSync(outputDir, { recursive: true });
const outputPath = path.join(outputDir, 'improvement-backlog.md');
if (fs.existsSync(outputPath)) {
  throw new Error('Target file docs/improvement-backlog.md already exists.');
}
fs.writeFileSync(outputPath, lines.join('\n'), { encoding: 'utf8', flag: 'wx' });
console.log(`Generated ${total} backlog entries at ${outputPath}`);
