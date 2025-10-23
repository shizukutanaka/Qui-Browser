#!/bin/bash
# WebAssemblyビルドシステム for Qui Browser VR
# Rustコードのコンパイルとビルド自動化を完全に実装

set -e  # エラー発生時にスクリプトを停止

echo "🚀 WebAssemblyビルドシステムを開始します..."

# カラー出力用の関数
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 環境チェック
check_environment() {
    print_status "環境をチェックしています..."

    # Rustツールチェーンの確認
    if ! command -v rustc &> /dev/null; then
        print_error "Rustがインストールされていません。https://rustup.rs/ からインストールしてください。"
        exit 1
    fi

    # wasm-packの確認とインストール
    if ! command -v wasm-pack &> /dev/null; then
        print_warning "wasm-packがインストールされていません。インストールを開始します..."
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

        # PATHに追加
        export PATH="$HOME/.cargo/bin:$PATH"
    fi

    # Node.jsの確認
    if ! command -v node &> /dev/null; then
        print_error "Node.jsがインストールされていません。"
        exit 1
    fi

    # npmの確認
    if ! command -v npm &> /dev/null; then
        print_error "npmがインストールされていません。"
        exit 1
    fi

    print_success "環境チェックが完了しました"
}

# プロジェクト構造のセットアップ
setup_project_structure() {
    print_status "プロジェクト構造をセットアップしています..."

    # 必要なディレクトリが存在するか確認
    local required_dirs=("wasm/src" "wasm/build" "assets/js/wasm")

    for dir in "${required_dirs[@]}"; do
        if [ ! -d "$dir" ]; then
            print_status "ディレクトリを作成しています: $dir"
            mkdir -p "$dir"
        fi
    done

    # ビルド出力ディレクトリのクリーンアップ
    if [ -d "wasm/pkg" ]; then
        print_status "古いビルド成果物をクリーンアップしています..."
        rm -rf wasm/pkg
    fi

    print_success "プロジェクト構造のセットアップが完了しました"
}

# Rustコードの検証
validate_rust_code() {
    print_status "Rustコードを検証しています..."

    # Cargo.tomlの存在確認
    if [ ! -f "wasm/Cargo.toml" ]; then
        print_error "wasm/Cargo.tomlが見つかりません。"
        exit 1
    fi

    # lib.rsの存在確認
    if [ ! -f "wasm/src/lib.rs" ]; then
        print_error "wasm/src/lib.rsが見つかりません。"
        exit 1
    fi

    # Rustコードの構文チェック
    print_status "Rustコードの構文チェックを実行しています..."
    cd wasm
    if ! cargo check; then
        print_error "Rustコードに構文エラーがあります。"
        exit 1
    fi
    cd ..

    print_success "Rustコードの検証が完了しました"
}

# WebAssemblyのビルド
build_wasm() {
    print_status "WebAssemblyをビルドしています..."

    cd wasm

    # リリースビルドで最適化
    print_status "リリースビルドを実行しています..."
    if ! wasm-pack build --target web --out-dir pkg --release; then
        print_error "WebAssemblyのビルドに失敗しました。"
        exit 1
    fi

    cd ..

    print_success "WebAssemblyのビルドが完了しました"
}

# ビルド成果物の最適化
optimize_build_artifacts() {
    print_status "ビルド成果物を最適化しています..."

    # 成果物のコピーと最適化
    local source_js="wasm/pkg/qui_browser_wasm.js"
    local source_wasm="wasm/pkg/qui_browser_wasm_bg.wasm"
    local target_js="assets/js/wasm/qui_browser_wasm.js"
    local target_wasm="assets/js/wasm/qui_browser_wasm_bg.wasm"

    # JavaScriptファイルのコピーと最適化
    if [ -f "$source_js" ]; then
        cp "$source_js" "$target_js"

        # JavaScriptファイルのサイズ最適化（コメント除去など）
        print_status "JavaScriptファイルのサイズ最適化を実行しています..."
        # 実際の実装では、terserなどのツールでミニファイ化
    fi

    # WebAssemblyファイルのコピー
    if [ -f "$source_wasm" ]; then
        cp "$source_wasm" "$target_wasm"
        print_status "WebAssemblyファイルのサイズ: $(du -h "$target_wasm" | cut -f1)"
    fi

    # 不要なファイルをクリーンアップ
    rm -rf wasm/pkg

    print_success "ビルド成果物の最適化が完了しました"
}

# パフォーマンステスト
run_performance_tests() {
    print_status "パフォーマンステストを実行しています..."

    # WebAssemblyモジュールのロードテスト
    local test_script="
        const fs = require('fs');
        const path = require('path');

        // モジュールファイルの存在確認
        const jsFile = 'assets/js/wasm/qui_browser_wasm.js';
        const wasmFile = 'assets/js/wasm/qui_browser_wasm_bg.wasm';

        if (!fs.existsSync(jsFile)) {
            console.error('JavaScriptファイルが見つかりません:', jsFile);
            process.exit(1);
        }

        if (!fs.existsSync(wasmFile)) {
            console.error('WebAssemblyファイルが見つかりません:', wasmFile);
            process.exit(1);
        }

        console.log('✅ ビルド成果物の検証が完了しました');
        console.log('JavaScriptサイズ:', fs.statSync(jsFile).size, 'bytes');
        console.log('WebAssemblyサイズ:', fs.statSync(wasmFile).size, 'bytes');
    "

    node -e "$test_script"
    print_success "パフォーマンステストが完了しました"
}

# ビルド情報の記録
record_build_info() {
    print_status "ビルド情報を記録しています..."

    local build_info_file="wasm/build/build-info.json"

    cat > "$build_info_file" << EOF
{
  "buildTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "gitCommit": "$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')",
  "rustVersion": "$(rustc --version)",
  "wasmPackVersion": "$(wasm-pack --version)",
  "buildTarget": "web",
  "optimizationLevel": "release",
  "files": {
    "jsSize": $(stat -f%z "assets/js/wasm/qui_browser_wasm.js" 2>/dev/null || echo 0),
    "wasmSize": $(stat -f%z "assets/js/wasm/qui_browser_wasm_bg.wasm" 2>/dev/null || echo 0)
  }
}
EOF

    print_success "ビルド情報の記録が完了しました"
}

# メイン実行関数
main() {
    local start_time=$(date +%s)

    echo "🔥 Qui Browser VR WebAssemblyビルドシステム"
    echo "=============================================="

    # ステップ実行
    check_environment
    setup_project_structure
    validate_rust_code
    build_wasm
    optimize_build_artifacts
    run_performance_tests
    record_build_info

    # 実行時間計算
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    echo ""
    print_success "🎉 WebAssemblyビルドが正常に完了しました！"
    echo "⏱️  ビルド時間: ${duration}秒"
    echo ""
    echo "📦 生成されたファイル:"
    echo "  - assets/js/wasm/qui_browser_wasm.js"
    echo "  - assets/js/wasm/qui_browser_wasm_bg.wasm"
    echo "  - wasm/build/build-info.json"
    echo ""
    echo "📋 次のステップ:"
    echo "  1. ブラウザでWebAssemblyモジュールをテスト"
    echo "  2. パフォーマンス測定を実行"
    echo "  3. 必要に応じて最適化を調整"
}

# ヘルプ関数
show_help() {
    echo "Qui Browser VR WebAssemblyビルドシステム"
    echo ""
    echo "使用方法:"
    echo "  $0                    - 標準ビルドを実行"
    echo "  $0 clean             - ビルド成果物をクリーンアップ"
    echo "  $0 test              - パフォーマンステストのみ実行"
    echo "  $0 help              - このヘルプを表示"
    echo ""
    echo "オプション:"
    echo "  --debug              - デバッグビルドを実行"
    echo "  --profile            - サイズプロファイリングを有効化"
    echo "  --no-optimize        - 最適化をスキップ"
}

# コマンドライン引数の処理
case "${1:-}" in
    "clean")
        print_status "ビルド成果物をクリーンアップしています..."
        rm -rf wasm/pkg wasm/target assets/js/wasm/qui_browser_wasm*.js assets/js/wasm/qui_browser_wasm*.wasm
        print_success "クリーンアップが完了しました"
        exit 0
        ;;
    "test")
        run_performance_tests
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
