#!/usr/bin/env node
/**
 * Dependency Vulnerability Monitor
 * 依存関係の脆弱性監視スクリプト
 *
 * 機能:
 * - npm audit実行
 * - 脆弱性レポート生成
 * - 自動修正提案
 * - CI/CD統合対応
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class DependencyMonitor {
  constructor(options = {}) {
    this.options = {
      auditLevel: options.auditLevel || 'moderate', // low, moderate, high, critical
      outputFormat: options.outputFormat || 'text', // text, json, html
      autoFix: options.autoFix || false,
      reportPath: options.reportPath || './reports',
      exitOnVulnerabilities: options.exitOnVulnerabilities || false,
      ...options
    };

    this.results = {
      vulnerabilities: [],
      summary: {},
      timestamp: new Date().toISOString(),
      packageInfo: {}
    };
  }

  /**
   * メイン実行
   */
  async run() {
    console.log('🔍 依存関係の脆弱性チェックを開始します...\n');

    try {
      // パッケージ情報取得
      this.results.packageInfo = this.getPackageInfo();
      console.log(`📦 プロジェクト: ${this.results.packageInfo.name} v${this.results.packageInfo.version}\n`);

      // npm audit実行
      await this.runNpmAudit();

      // 依存関係ツリー確認
      await this.checkDependencyTree();

      // 古いパッケージ確認
      await this.checkOutdated();

      // レポート生成
      await this.generateReport();

      // 自動修正（オプション）
      if (this.options.autoFix && this.results.summary.total > 0) {
        await this.attemptAutoFix();
      }

      // 結果表示
      this.displaySummary();

      // 終了コード判定
      if (this.options.exitOnVulnerabilities && this.results.summary.total > 0) {
        console.log('\n❌ 脆弱性が検出されたため、終了コード1で終了します');
        process.exit(1);
      }

      console.log('\n✅ チェック完了');
      return this.results;
    } catch (error) {
      console.error('\n❌ エラーが発生しました:', error.message);
      if (this.options.exitOnVulnerabilities) {
        process.exit(1);
      }
      throw error;
    }
  }

  /**
   * パッケージ情報取得
   */
  getPackageInfo() {
    try {
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      return {
        name: packageJson.name || 'unknown',
        version: packageJson.version || '0.0.0',
        dependencies: Object.keys(packageJson.dependencies || {}).length,
        devDependencies: Object.keys(packageJson.devDependencies || {}).length
      };
    } catch (error) {
      return {
        name: 'unknown',
        version: '0.0.0',
        dependencies: 0,
        devDependencies: 0
      };
    }
  }

  /**
   * npm audit実行
   */
  async runNpmAudit() {
    console.log('📊 npm auditを実行中...');

    try {
      const output = execSync(
        `npm audit --audit-level=${this.options.auditLevel} --json`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      const auditResult = JSON.parse(output);
      this.parseAuditResult(auditResult);
    } catch (error) {
      // npm auditは脆弱性がある場合、非ゼロ終了コードを返す
      if (error.stdout) {
        try {
          const auditResult = JSON.parse(error.stdout);
          this.parseAuditResult(auditResult);
        } catch (parseError) {
          console.error('⚠️  npm audit出力のパースに失敗:', parseError.message);
        }
      }
    }
  }

  /**
   * audit結果パース
   */
  parseAuditResult(auditResult) {
    // npm v7+ のフォーマット
    if (auditResult.vulnerabilities) {
      for (const [pkgName, vuln] of Object.entries(auditResult.vulnerabilities)) {
        this.results.vulnerabilities.push({
          package: pkgName,
          severity: vuln.severity,
          via: vuln.via,
          range: vuln.range,
          nodes: vuln.nodes,
          fixAvailable: vuln.fixAvailable
        });
      }
    }

    // サマリー
    if (auditResult.metadata) {
      this.results.summary = {
        total: auditResult.metadata.vulnerabilities?.total || 0,
        info: auditResult.metadata.vulnerabilities?.info || 0,
        low: auditResult.metadata.vulnerabilities?.low || 0,
        moderate: auditResult.metadata.vulnerabilities?.moderate || 0,
        high: auditResult.metadata.vulnerabilities?.high || 0,
        critical: auditResult.metadata.vulnerabilities?.critical || 0
      };
    }
  }

  /**
   * 依存関係ツリー確認
   */
  async checkDependencyTree() {
    console.log('🌳 依存関係ツリーを確認中...');

    try {
      const output = execSync('npm list --json --depth=0', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      const treeData = JSON.parse(output);
      this.results.dependencyTree = {
        dependencies: Object.keys(treeData.dependencies || {}).length,
        problems: treeData.problems || []
      };

      if (this.results.dependencyTree.problems.length > 0) {
        console.log(`⚠️  依存関係の問題: ${this.results.dependencyTree.problems.length}件`);
      }
    } catch (error) {
      console.log('⚠️  依存関係ツリーの取得に失敗');
    }
  }

  /**
   * 古いパッケージ確認
   */
  async checkOutdated() {
    console.log('📅 古いパッケージを確認中...');

    try {
      const output = execSync('npm outdated --json', {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      });

      if (output) {
        const outdated = JSON.parse(output);
        this.results.outdated = Object.keys(outdated).map(pkg => ({
          package: pkg,
          current: outdated[pkg].current,
          wanted: outdated[pkg].wanted,
          latest: outdated[pkg].latest,
          type: outdated[pkg].type
        }));

        console.log(`📦 更新可能なパッケージ: ${this.results.outdated.length}件`);
      } else {
        this.results.outdated = [];
        console.log('✅ すべてのパッケージが最新です');
      }
    } catch (error) {
      // npm outdatedは古いパッケージがある場合、非ゼロ終了コードを返す
      if (error.stdout) {
        try {
          const outdated = JSON.parse(error.stdout);
          this.results.outdated = Object.keys(outdated).map(pkg => ({
            package: pkg,
            current: outdated[pkg].current,
            wanted: outdated[pkg].wanted,
            latest: outdated[pkg].latest,
            type: outdated[pkg].type
          }));
          console.log(`📦 更新可能なパッケージ: ${this.results.outdated.length}件`);
        } catch {
          this.results.outdated = [];
        }
      } else {
        this.results.outdated = [];
      }
    }
  }

  /**
   * レポート生成
   */
  async generateReport() {
    // reportsディレクトリ作成
    if (!fs.existsSync(this.options.reportPath)) {
      fs.mkdirSync(this.options.reportPath, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // JSON形式
    if (this.options.outputFormat === 'json' || this.options.outputFormat === 'all') {
      const jsonPath = path.join(this.options.reportPath, `dependency-audit-${timestamp}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2));
      console.log(`\n📄 JSONレポート: ${jsonPath}`);
    }

    // HTML形式
    if (this.options.outputFormat === 'html' || this.options.outputFormat === 'all') {
      const htmlPath = path.join(this.options.reportPath, `dependency-audit-${timestamp}.html`);
      const html = this.generateHTML();
      fs.writeFileSync(htmlPath, html);
      console.log(`📄 HTMLレポート: ${htmlPath}`);
    }

    // Markdown形式
    const mdPath = path.join(this.options.reportPath, `dependency-audit-${timestamp}.md`);
    const markdown = this.generateMarkdown();
    fs.writeFileSync(mdPath, markdown);
    console.log(`📄 Markdownレポート: ${mdPath}`);
  }

  /**
   * Markdownレポート生成
   */
  generateMarkdown() {
    let md = `# 依存関係セキュリティ監査レポート\n\n`;
    md += `**生成日時**: ${this.results.timestamp}\n`;
    md += `**プロジェクト**: ${this.results.packageInfo.name} v${this.results.packageInfo.version}\n\n`;

    md += `## 📊 サマリー\n\n`;
    md += `| 重要度 | 件数 |\n`;
    md += `|--------|------|\n`;
    md += `| **合計** | **${this.results.summary.total}** |\n`;
    md += `| Critical | ${this.results.summary.critical || 0} |\n`;
    md += `| High | ${this.results.summary.high || 0} |\n`;
    md += `| Moderate | ${this.results.summary.moderate || 0} |\n`;
    md += `| Low | ${this.results.summary.low || 0} |\n`;
    md += `| Info | ${this.results.summary.info || 0} |\n\n`;

    if (this.results.vulnerabilities.length > 0) {
      md += `## 🚨 検出された脆弱性\n\n`;
      for (const vuln of this.results.vulnerabilities) {
        md += `### ${vuln.package}\n\n`;
        md += `- **重要度**: ${vuln.severity}\n`;
        md += `- **影響範囲**: ${vuln.range}\n`;
        md += `- **修正**: ${vuln.fixAvailable ? '利用可能' : '未対応'}\n\n`;
      }
    }

    if (this.results.outdated && this.results.outdated.length > 0) {
      md += `## 📦 更新可能なパッケージ\n\n`;
      md += `| パッケージ | 現在 | 推奨 | 最新 |\n`;
      md += `|-----------|------|------|------|\n`;
      for (const pkg of this.results.outdated) {
        md += `| ${pkg.package} | ${pkg.current} | ${pkg.wanted} | ${pkg.latest} |\n`;
      }
      md += `\n`;
    }

    md += `## 💡 推奨アクション\n\n`;
    if (this.results.summary.total > 0) {
      md += `1. \`npm audit fix\` を実行して自動修正を試みる\n`;
      md += `2. 修正できない脆弱性は手動で対応する\n`;
      md += `3. 古いパッケージを \`npm update\` で更新する\n`;
    } else {
      md += `✅ 脆弱性は検出されませんでした。引き続き定期的な監視を推奨します。\n`;
    }

    return md;
  }

  /**
   * HTMLレポート生成
   */
  generateHTML() {
    const criticalClass = this.results.summary.critical > 0 ? 'critical' : '';
    const highClass = this.results.summary.high > 0 ? 'high' : '';

    return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>依存関係セキュリティ監査レポート</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #f5f5f5; }
    .critical { background: #ffe6e6; color: #c00; font-weight: bold; }
    .high { background: #fff3cd; color: #856404; }
    .moderate { background: #d1ecf1; color: #0c5460; }
    .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; text-align: center; }
    .card.critical { border-color: #c00; background: #ffe6e6; }
    .card.high { border-color: #856404; background: #fff3cd; }
    .card-value { font-size: 2em; font-weight: bold; margin: 10px 0; }
  </style>
</head>
<body>
  <h1>🔍 依存関係セキュリティ監査レポート</h1>
  <p><strong>生成日時:</strong> ${this.results.timestamp}</p>
  <p><strong>プロジェクト:</strong> ${this.results.packageInfo.name} v${this.results.packageInfo.version}</p>

  <h2>📊 サマリー</h2>
  <div class="summary">
    <div class="card ${criticalClass}">
      <div>Critical</div>
      <div class="card-value">${this.results.summary.critical || 0}</div>
    </div>
    <div class="card ${highClass}">
      <div>High</div>
      <div class="card-value">${this.results.summary.high || 0}</div>
    </div>
    <div class="card">
      <div>Moderate</div>
      <div class="card-value">${this.results.summary.moderate || 0}</div>
    </div>
    <div class="card">
      <div>Low</div>
      <div class="card-value">${this.results.summary.low || 0}</div>
    </div>
  </div>

  ${
    this.results.vulnerabilities.length > 0
      ? `
  <h2>🚨 検出された脆弱性</h2>
  <table>
    <tr>
      <th>パッケージ</th>
      <th>重要度</th>
      <th>影響範囲</th>
      <th>修正</th>
    </tr>
    ${this.results.vulnerabilities
      .map(
        v => `
    <tr class="${v.severity}">
      <td>${v.package}</td>
      <td>${v.severity}</td>
      <td>${v.range}</td>
      <td>${v.fixAvailable ? '✅ 利用可能' : '❌ 未対応'}</td>
    </tr>
    `
      )
      .join('')}
  </table>
  `
      : '<p>✅ 脆弱性は検出されませんでした</p>'
  }
</body>
</html>`;
  }

  /**
   * 自動修正試行
   */
  async attemptAutoFix() {
    console.log('\n🔧 自動修正を試行中...');

    try {
      execSync('npm audit fix', { stdio: 'inherit' });
      console.log('✅ 自動修正完了');

      // 再度audit実行
      await this.runNpmAudit();
    } catch (error) {
      console.log('⚠️  一部の脆弱性は自動修正できませんでした');
      console.log('💡 手動修正が必要な可能性があります');
    }
  }

  /**
   * サマリー表示
   */
  displaySummary() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 最終サマリー');
    console.log('='.repeat(50));

    const { summary } = this.results;
    console.log(`合計脆弱性: ${summary.total}`);

    if (summary.critical > 0) {
      console.log(`  🔴 Critical: ${summary.critical}`);
    }
    if (summary.high > 0) {
      console.log(`  🟠 High: ${summary.high}`);
    }
    if (summary.moderate > 0) {
      console.log(`  🟡 Moderate: ${summary.moderate}`);
    }
    if (summary.low > 0) {
      console.log(`  🔵 Low: ${summary.low}`);
    }

    if (this.results.outdated && this.results.outdated.length > 0) {
      console.log(`\n更新可能なパッケージ: ${this.results.outdated.length}件`);
    }

    console.log('='.repeat(50));
  }
}

// CLI実行
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    auditLevel: args.includes('--level') ? args[args.indexOf('--level') + 1] : 'moderate',
    autoFix: args.includes('--fix'),
    outputFormat: args.includes('--format') ? args[args.indexOf('--format') + 1] : 'all',
    exitOnVulnerabilities: args.includes('--exit-on-vuln')
  };

  const monitor = new DependencyMonitor(options);
  monitor.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = DependencyMonitor;
