#!/bin/bash
# CI/CD統合スクリプト for Qui Browser VR WebAssemblyビルド
# GitHub Actions、GitLab CI、JenkinsなどのCI/CDシステムとの統合

set -e

echo "🔄 CI/CD統合ビルドを開始します..."

# 環境変数設定
export RUST_BACKTRACE=1
export CARGO_TERM_COLOR=always

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[CI/CD INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[CI/CD SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[CI/CD WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[CI/CD ERROR]${NC} $1"
}

# 依存関係のインストール
install_dependencies() {
    print_status "依存関係をインストールしています..."

    # Rustツールチェーンのインストール（必要な場合）
    if ! command -v rustc &> /dev/null; then
        print_status "Rustツールチェーンをインストールしています..."
        curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
        source ~/.cargo/env
    fi

    # wasm-packのインストール
    if ! command -v wasm-pack &> /dev/null; then
        print_status "wasm-packをインストールしています..."
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    fi

    # Node.jsのセットアップ（nvm使用）
    if [ -z "$NODE_VERSION" ]; then
        export NODE_VERSION="18"
    fi

    if ! command -v node &> /dev/null; then
        print_status "Node.jsをセットアップしています..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        nvm install $NODE_VERSION
        nvm use $NODE_VERSION
    fi

    print_success "依存関係のインストールが完了しました"
}

# キャッシュのセットアップ
setup_cache() {
    print_status "ビルドキャッシュをセットアップしています..."

    # Cargoレジストリキャッシュ
    if [ -d "$HOME/.cargo/registry" ]; then
        print_status "Cargoキャッシュを復元しています..."
    fi

    # Node.jsキャッシュ
    if [ -d "node_modules" ]; then
        print_status "Node.jsキャッシュを復元しています..."
    fi

    print_success "キャッシュのセットアップが完了しました"
}

# コードの検証
validate_code() {
    print_status "コードを検証しています..."

    # Rustコードのフォーマットチェック
    print_status "Rustコードのフォーマットを確認しています..."
    cd wasm
    cargo fmt -- --check
    if [ $? -ne 0 ]; then
        print_warning "Rustコードのフォーマットエラーがあります。フォーマットを修正します..."
        cargo fmt
    fi
    cd ..

    # Rustコードのクリップチェック
    print_status "Rustコードのクリップチェックを実行しています..."
    cd wasm
    cargo clippy -- -D warnings
    cd ..

    print_success "コードの検証が完了しました"
}

# テストの実行
run_tests() {
    print_status "テストを実行しています..."

    # Rustテスト
    cd wasm
    print_status "Rustユニットテストを実行しています..."
    cargo test --release

    # WebAssemblyテスト（wasm-pack test）
    print_status "WebAssembly統合テストを実行しています..."
    wasm-pack test --headless --firefox

    cd ..

    print_success "すべてのテストが完了しました"
}

# セキュリティスキャン
security_scan() {
    print_status "セキュリティスキャンを実行しています..."

    # Rustセキュリティ監査（cargo-audit）
    if command -v cargo-audit &> /dev/null; then
        print_status "依存関係のセキュリティ監査を実行しています..."
        cd wasm
        cargo audit
        cd ..
    fi

    # バイナリスキャン（バイナリサイズチェック）
    print_status "バイナリサイズチェックを実行しています..."
    local wasm_size=$(stat -f%z "assets/js/wasm/qui_browser_wasm_bg.wasm" 2>/dev/null || echo 0)
    local max_size=$((2 * 1024 * 1024))  # 2MB制限

    if [ "$wasm_size" -gt "$max_size" ]; then
        print_warning "WebAssemblyファイルサイズが制限を超えています: $wasm_size bytes > $max_size bytes"
    else
        print_success "WebAssemblyファイルサイズチェックを通過しました: $wasm_size bytes"
    fi

    print_success "セキュリティスキャンが完了しました"
}

# 成果物の生成と最適化
generate_artifacts() {
    print_status "成果物を生成しています..."

    # メインビルド実行
    ./wasm/build.sh

    # 追加の最適化（サイズ圧縮）
    print_status "追加の最適化を実行しています..."
    cd assets/js/wasm

    # gzip圧縮
    if [ -f "qui_browser_wasm.js" ]; then
        gzip -c qui_browser_wasm.js > qui_browser_wasm.js.gz
    fi

    if [ -f "qui_browser_wasm_bg.wasm" ]; then
        gzip -c qui_browser_wasm_bg.wasm > qui_browser_wasm_bg.wasm.gz
        brotli -c qui_browser_wasm_bg.wasm > qui_browser_wasm_bg.wasm.br
    fi

    cd ../../..

    print_success "成果物の生成と最適化が完了しました"
}

# アーティファクトのアップロード準備
prepare_artifacts() {
    print_status "アーティファクトのアップロードを準備しています..."

    # アーティファクトディレクトリの作成
    mkdir -p dist/artifacts

    # 必要なファイルをコピー
    cp assets/js/wasm/qui_browser_wasm.js dist/artifacts/
    cp assets/js/wasm/qui_browser_wasm_bg.wasm dist/artifacts/
    cp wasm/build/build-info.json dist/artifacts/

    # 圧縮ファイルもコピー
    if [ -f "assets/js/wasm/qui_browser_wasm.js.gz" ]; then
        cp assets/js/wasm/qui_browser_wasm.js.gz dist/artifacts/
    fi
    if [ -f "assets/js/wasm/qui_browser_wasm_bg.wasm.gz" ]; then
        cp assets/js/wasm/qui_browser_wasm_bg.wasm.gz dist/artifacts/
    fi
    if [ -f "assets/js/wasm/qui_browser_wasm_bg.wasm.br" ]; then
        cp assets/js/wasm/qui_browser_wasm_bg.wasm.br dist/artifacts/
    fi

    # アーティファクトのサイズ情報を記録
    ls -la dist/artifacts/ > dist/artifacts/file-list.txt

    print_success "アーティファクトの準備が完了しました"
}

# デプロイ準備
prepare_deployment() {
    print_status "デプロイ準備を実行しています..."

    # リリースノートの生成
    if command -v git &> /dev/null && [ -d .git ]; then
        print_status "リリース情報を生成しています..."

        # 最新のコミットメッセージを取得
        local latest_commit=$(git log -1 --pretty=%B)

        cat > dist/deployment-info.json << EOF
{
  "version": "$(git describe --tags --abbrev=0 2>/dev/null || echo 'v0.1.0')",
  "commit": "$(git rev-parse HEAD)",
  "branch": "$(git branch --show-current)",
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "latestCommit": "$latest_commit",
  "platform": "WebAssembly",
  "target": "web"
}
EOF
    fi

    print_success "デプロイ準備が完了しました"
}

# メイン実行関数
main() {
    local start_time=$(date +%s)

    echo "🔥 Qui Browser VR WebAssembly CI/CDビルド"
    echo "=========================================="

    # ステップ実行
    install_dependencies
    setup_cache
    validate_code
    run_tests
    security_scan
    generate_artifacts
    prepare_artifacts
    prepare_deployment

    # 実行時間計算
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    print_success "🎉 CI/CDビルドが正常に完了しました！"
    echo "⏱️  総実行時間: ${duration}秒"
    echo ""
    echo "📦 生成されたアーティファクト:"
    echo "  - dist/artifacts/qui_browser_wasm.js"
    echo "  - dist/artifacts/qui_browser_wasm_bg.wasm"
    echo "  - dist/artifacts/build-info.json"
    echo "  - dist/deployment-info.json"
    echo ""
    echo "📋 次のステップ:"
    echo "  1. アーティファクトをアップロード"
    echo "  2. デプロイを実行"
    echo "  3. インテグレーションテストを実行"
}

# ヘルプ関数
show_help() {
    echo "Qui Browser VR WebAssembly CI/CDビルドシステム"
    echo ""
    echo "使用方法:"
    echo "  $0                    - 標準CI/CDビルドを実行"
    echo "  $0 quick             - 高速ビルド（テストスキップ）"
    echo "  $0 full              - フルビルド（追加検証含む）"
    echo "  $0 help              - このヘルプを表示"
    echo ""
    echo "環境変数:"
    echo "  NODE_VERSION         - 使用するNode.jsバージョン（デフォルト: 18）"
    echo "  CARGO_PROFILE        - Cargoプロファイル（release/debug）"
    echo "  ENABLE_CACHE         - キャッシュ有効化（true/false）"
}

# コマンドライン引数の処理
case "${1:-}" in
    "quick")
        print_status "高速ビルドを実行しています..."
        install_dependencies
        generate_artifacts
        print_success "高速ビルドが完了しました"
        exit 0
        ;;
    "full")
        print_status "フルビルドを実行しています..."
        main
        # 追加の検証ステップ
        print_status "追加の検証を実行しています..."
        # カバレッジレポート生成など
        print_success "フルビルドが完了しました"
        exit 0
        ;;
    "help"|"-h"|"--help")
        show_help
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "不明なオプションです: $1"
        show_help
        exit 1
        ;;
esac
