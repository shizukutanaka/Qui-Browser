/**
 * TLS Certificate Manager
 * TLS証明書の自動管理と更新
 *
 * 機能:
 * - 証明書の有効期限監視
 * - 自動更新アラート
 * - Let's Encrypt統合準備
 * - 証明書検証
 */

const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class TLSCertManager {
  constructor(options = {}) {
    this.options = {
      certPath: options.certPath || './certs/cert.pem',
      keyPath: options.keyPath || './certs/key.pem',
      checkInterval: options.checkInterval || 24 * 60 * 60 * 1000, // 24時間
      renewalThresholdDays: options.renewalThresholdDays || 30, // 30日前
      warningThresholdDays: options.warningThresholdDays || 7, // 7日前
      alertCallbacks: options.alertCallbacks || [],
      autoRenew: options.autoRenew || false,
      domain: options.domain || '',
      email: options.email || '',
      ...options
    };

    this.certInfo = null;
    this.checkInterval = null;
    this.lastCheck = null;
  }

  /**
   * 監視開始
   */
  start() {
    this.checkInterval = setInterval(() => {
      this.checkCertificate().catch(err => {
        console.error('[TLSCertManager] Check error:', err);
      });
    }, this.options.checkInterval);

    // 即座に1回実行
    this.checkCertificate();
  }

  /**
   * 監視停止
   */
  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * 証明書チェック
   */
  async checkCertificate() {
    try {
      this.lastCheck = new Date();

      // 証明書ファイルの存在確認
      const certExists = await this.fileExists(this.options.certPath);
      const keyExists = await this.fileExists(this.options.keyPath);

      if (!certExists || !keyExists) {
        this.triggerAlert({
          level: 'critical',
          message: 'TLS certificate or key file not found',
          details: {
            certPath: this.options.certPath,
            keyPath: this.options.keyPath,
            certExists,
            keyExists
          }
        });
        return {
          status: 'error',
          message: 'Certificate files not found'
        };
      }

      // 証明書情報取得
      const certInfo = await this.getCertificateInfo();
      this.certInfo = certInfo;

      if (certInfo.error) {
        this.triggerAlert({
          level: 'error',
          message: 'Failed to parse certificate',
          details: certInfo
        });
        return certInfo;
      }

      // 有効期限チェック
      const daysUntilExpiry = this.getDaysUntilExpiry(certInfo.expiryDate);

      if (daysUntilExpiry < 0) {
        this.triggerAlert({
          level: 'critical',
          message: `TLS certificate expired ${Math.abs(daysUntilExpiry)} days ago`,
          details: certInfo
        });
        return {
          status: 'critical',
          message: 'Certificate expired',
          daysUntilExpiry,
          certInfo
        };
      }

      if (daysUntilExpiry <= this.options.warningThresholdDays) {
        this.triggerAlert({
          level: 'critical',
          message: `TLS certificate expires in ${daysUntilExpiry} days`,
          details: certInfo
        });

        // 自動更新が有効な場合
        if (this.options.autoRenew && daysUntilExpiry <= this.options.renewalThresholdDays) {
          await this.attemptRenewal();
        }

        return {
          status: 'critical',
          message: `Certificate expires soon: ${daysUntilExpiry} days`,
          daysUntilExpiry,
          certInfo
        };
      }

      if (daysUntilExpiry <= this.options.renewalThresholdDays) {
        this.triggerAlert({
          level: 'warning',
          message: `TLS certificate expires in ${daysUntilExpiry} days - renewal recommended`,
          details: certInfo
        });
        return {
          status: 'warning',
          message: `Certificate should be renewed: ${daysUntilExpiry} days remaining`,
          daysUntilExpiry,
          certInfo
        };
      }

      return {
        status: 'healthy',
        message: `Certificate valid for ${daysUntilExpiry} days`,
        daysUntilExpiry,
        certInfo
      };
    } catch (error) {
      console.error('[TLSCertManager] Check failed:', error);
      return {
        status: 'error',
        message: error.message,
        error: error.stack
      };
    }
  }

  /**
   * 証明書情報取得
   */
  async getCertificateInfo() {
    try {
      // opensslコマンドで証明書情報を取得
      const { stdout, stderr } = await execAsync(
        `openssl x509 -in "${this.options.certPath}" -noout -subject -issuer -dates -fingerprint`
      );

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      // 出力をパース
      const lines = stdout.split('\n');
      const info = {};

      for (const line of lines) {
        if (line.startsWith('subject=')) {
          info.subject = line.replace('subject=', '').trim();
        } else if (line.startsWith('issuer=')) {
          info.issuer = line.replace('issuer=', '').trim();
        } else if (line.startsWith('notBefore=')) {
          info.validFrom = new Date(line.replace('notBefore=', '').trim());
        } else if (line.startsWith('notAfter=')) {
          info.expiryDate = new Date(line.replace('notAfter=', '').trim());
        } else if (line.startsWith('SHA256 Fingerprint=')) {
          info.fingerprint = line.replace('SHA256 Fingerprint=', '').trim();
        }
      }

      // ドメイン名抽出
      const cnMatch = info.subject?.match(/CN\s*=\s*([^,]+)/);
      info.commonName = cnMatch ? cnMatch[1].trim() : 'unknown';

      return info;
    } catch (error) {
      // opensslが使えない場合の簡易チェック
      try {
        const certData = await fs.readFile(this.options.certPath, 'utf8');

        return {
          status: 'limited',
          message: 'OpenSSL not available - limited certificate info',
          fileSize: certData.length,
          fileExists: true,
          error: error.message
        };
      } catch (readError) {
        return {
          status: 'error',
          message: 'Cannot read certificate file',
          error: readError.message
        };
      }
    }
  }

  /**
   * 有効期限までの日数計算
   */
  getDaysUntilExpiry(expiryDate) {
    if (!expiryDate || !(expiryDate instanceof Date)) {
      return null;
    }

    const now = new Date();
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
  }

  /**
   * ファイル存在確認
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 証明書更新試行（Let's Encrypt想定）
   */
  async attemptRenewal() {
    if (!this.options.domain || !this.options.email) {
      console.warn('[TLSCertManager] Auto-renewal requires domain and email');
      return {
        status: 'skipped',
        message: 'Auto-renewal configuration incomplete'
      };
    }

    try {
      console.log('[TLSCertManager] Attempting certificate renewal...');

      // certbotコマンド例（実際の環境に応じて調整が必要）
      const certbotCmd = `certbot renew --domain ${this.options.domain} --email ${this.options.email} --agree-tos --non-interactive`;

      // 注意: 実際の本番環境では慎重に実行すること
      // const { stdout, stderr } = await execAsync(certbotCmd);

      console.log('[TLSCertManager] Auto-renewal command prepared (not executed in this version)');
      console.log('[TLSCertManager] Please run manually:', certbotCmd);

      this.triggerAlert({
        level: 'info',
        message: 'Manual certificate renewal recommended',
        details: {
          command: certbotCmd,
          domain: this.options.domain
        }
      });

      return {
        status: 'manual_action_required',
        message: 'Please renew certificate manually',
        command: certbotCmd
      };
    } catch (error) {
      console.error('[TLSCertManager] Renewal failed:', error);

      this.triggerAlert({
        level: 'error',
        message: 'Certificate renewal failed',
        details: {
          error: error.message
        }
      });

      return {
        status: 'error',
        message: 'Renewal failed',
        error: error.message
      };
    }
  }

  /**
   * 証明書検証
   */
  async validateCertificate() {
    try {
      const { stdout, stderr } = await execAsync(
        `openssl x509 -in "${this.options.certPath}" -noout -text`
      );

      if (stderr && !stdout) {
        return {
          valid: false,
          error: stderr
        };
      }

      // 基本的な検証
      const certData = await fs.readFile(this.options.certPath, 'utf8');
      const hasBegin = certData.includes('-----BEGIN CERTIFICATE-----');
      const hasEnd = certData.includes('-----END CERTIFICATE-----');

      return {
        valid: hasBegin && hasEnd,
        format: 'PEM',
        size: certData.length
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * 証明書とキーのペア検証
   */
  async validateKeyPair() {
    try {
      // 証明書の公開鍵のハッシュ
      const { stdout: certHash } = await execAsync(
        `openssl x509 -in "${this.options.certPath}" -noout -modulus | openssl md5`
      );

      // 秘密鍵の公開鍵のハッシュ
      const { stdout: keyHash } = await execAsync(
        `openssl rsa -in "${this.options.keyPath}" -noout -modulus | openssl md5`
      );

      const match = certHash.trim() === keyHash.trim();

      return {
        valid: match,
        message: match ? 'Certificate and key pair match' : 'Certificate and key do not match',
        certHash: certHash.trim(),
        keyHash: keyHash.trim()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * アラート送信
   */
  triggerAlert(alert) {
    for (const callback of this.options.alertCallbacks) {
      try {
        callback(alert);
      } catch (error) {
        console.error('[TLSCertManager] Alert callback error:', error);
      }
    }
  }

  /**
   * ステータス取得
   */
  getStatus() {
    return {
      certInfo: this.certInfo,
      lastCheck: this.lastCheck,
      monitoring: this.checkInterval !== null
    };
  }

  /**
   * 更新手順ガイド生成
   */
  getRenewalGuide() {
    return {
      manual: {
        steps: [
          '1. Stop the server',
          '2. Run: certbot renew',
          '3. Copy new certificates to certs directory',
          '4. Restart the server',
          '5. Verify with: npm run tls:check'
        ],
        commands: [
          'sudo systemctl stop qui-browser',
          `sudo certbot renew --domain ${this.options.domain}`,
          `sudo cp /etc/letsencrypt/live/${this.options.domain}/fullchain.pem ./certs/`,
          `sudo cp /etc/letsencrypt/live/${this.options.domain}/privkey.pem ./certs/`,
          'sudo chown $USER:$USER ./certs/*.pem',
          'sudo systemctl start qui-browser'
        ]
      },
      automated: {
        description: 'Set up automatic renewal with systemd timer',
        commands: [
          '# Create systemd service',
          'sudo nano /etc/systemd/system/certbot-renew.service',
          '',
          '# Create systemd timer',
          'sudo nano /etc/systemd/system/certbot-renew.timer',
          '',
          '# Enable timer',
          'sudo systemctl enable certbot-renew.timer',
          'sudo systemctl start certbot-renew.timer'
        ]
      }
    };
  }
}

module.exports = TLSCertManager;
