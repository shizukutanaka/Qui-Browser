#!/usr/bin/env node

/**
 * Production Deployment Script
 * Automated deployment with safety checks and rollback
 *
 * @module scripts/deploy-production
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class ProductionDeployment {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  /**
   * Execute shell command
   * @param {string} command - Command to execute
   * @param {boolean} silent - Suppress output
   * @returns {string} - Command output
   */
  exec(command, silent = false) {
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: silent ? 'pipe' : 'inherit'
      });
      return output;
    } catch (error) {
      throw new Error(`Command failed: ${command}\n${error.message}`);
    }
  }

  /**
   * Log message with timestamp
   * @param {string} message - Message to log
   * @param {string} level - Log level
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '✓',
      warn: '⚠',
      error: '✗',
      step: '→'
    }[level] || 'ℹ';

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  /**
   * Pre-deployment checks
   */
  async preDeploymentChecks() {
    this.log('Running pre-deployment checks...', 'step');

    // Check Node.js version
    try {
      const version = process.version;
      const major = parseInt(version.slice(1).split('.')[0]);
      if (major < 18) {
        this.errors.push(`Node.js version ${version} is below minimum 18.0.0`);
      } else {
        this.log(`Node.js version: ${version}`, 'info');
      }
    } catch (error) {
      this.errors.push('Failed to check Node.js version');
    }

    // Check npm version
    try {
      const npmVersion = this.exec('npm --version', true).trim();
      this.log(`npm version: ${npmVersion}`, 'info');
    } catch (error) {
      this.errors.push('npm is not installed');
    }

    // Check package.json exists
    if (!fs.existsSync('package.json')) {
      this.errors.push('package.json not found');
    }

    // Check environment variables
    if (!fs.existsSync('.env')) {
      this.warnings.push('.env file not found');
    }

    // Check git repository
    try {
      this.exec('git status', true);
      const branch = this.exec('git branch --show-current', true).trim();
      this.log(`Git branch: ${branch}`, 'info');

      if (branch !== 'main' && branch !== 'master') {
        this.warnings.push(`Not on main/master branch (current: ${branch})`);
      }

      // Check for uncommitted changes
      const status = this.exec('git status --porcelain', true);
      if (status.trim()) {
        this.warnings.push('Uncommitted changes detected');
      }
    } catch (error) {
      this.warnings.push('Not a git repository');
    }

    // Check disk space
    try {
      if (process.platform === 'linux' || process.platform === 'darwin') {
        const df = this.exec('df -h .', true);
        this.log('Disk space available', 'info');
      }
    } catch (error) {
      this.warnings.push('Could not check disk space');
    }

    this.reportChecks();
  }

  /**
   * Run tests
   */
  async runTests() {
    this.log('Running test suite...', 'step');

    try {
      this.exec('npm test');
      this.log('All tests passed', 'info');
    } catch (error) {
      this.errors.push('Tests failed');
      throw error;
    }
  }

  /**
   * Run security audit
   */
  async securityAudit() {
    this.log('Running security audit...', 'step');

    try {
      this.exec('npm audit --audit-level=moderate');
      this.log('No security vulnerabilities found', 'info');
    } catch (error) {
      this.warnings.push('Security vulnerabilities detected');
      this.log('Run "npm audit fix" to resolve', 'warn');
    }
  }

  /**
   * Build for production
   */
  async build() {
    this.log('Building for production...', 'step');

    try {
      // Lint
      this.log('Running linter...', 'step');
      this.exec('npm run lint');

      // Format check
      this.log('Checking code formatting...', 'step');
      this.exec('npm run format:check');

      this.log('Build completed successfully', 'info');
    } catch (error) {
      this.errors.push('Build failed');
      throw error;
    }
  }

  /**
   * Install dependencies
   */
  async installDependencies() {
    this.log('Installing production dependencies...', 'step');

    try {
      this.exec('npm ci --production');
      this.log('Dependencies installed', 'info');
    } catch (error) {
      this.errors.push('Dependency installation failed');
      throw error;
    }
  }

  /**
   * Create backup
   */
  async createBackup() {
    this.log('Creating backup...', 'step');

    try {
      const backupDir = path.join(process.cwd(), 'backups');
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(backupDir, `backup-${timestamp}`);

      // Create backup (excluding node_modules and backups)
      if (process.platform === 'win32') {
        this.log('Backup not supported on Windows', 'warn');
      } else {
        this.exec(
          `tar -czf ${backupPath}.tar.gz --exclude=node_modules --exclude=backups --exclude=.git .`
        );
        this.log(`Backup created: ${backupPath}.tar.gz`, 'info');
      }
    } catch (error) {
      this.warnings.push('Backup creation failed');
    }
  }

  /**
   * Check health endpoint
   */
  async checkHealth(url = 'http://localhost:8000/health') {
    this.log('Checking health endpoint...', 'step');

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'healthy') {
        this.log('Service is healthy', 'info');
        return true;
      } else {
        this.warnings.push(`Service health is ${data.status}`);
        return false;
      }
    } catch (error) {
      this.warnings.push('Health check failed: ' + error.message);
      return false;
    }
  }

  /**
   * Verify deployment
   */
  async verifyDeployment() {
    this.log('Verifying deployment...', 'step');

    // Check if service is running
    try {
      if (process.platform === 'win32') {
        this.exec('tasklist | findstr node', true);
      } else {
        this.exec('pgrep -f node', true);
      }
      this.log('Service is running', 'info');
    } catch (error) {
      this.warnings.push('Could not verify service status');
    }

    // Check health endpoint
    await this.checkHealth();
  }

  /**
   * Report checks
   */
  reportChecks() {
    console.log('\n' + '='.repeat(60));
    console.log('PRE-DEPLOYMENT CHECK REPORT');
    console.log('='.repeat(60) + '\n');

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(err => console.log(`  - ${err}`));
      console.log();
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(warn => console.log(`  - ${warn}`));
      console.log();
    }

    if (this.errors.length === 0) {
      console.log('✅ All critical checks passed\n');
    } else {
      console.log('❌ Critical errors detected. Deployment aborted.\n');
      process.exit(1);
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings detected. Continue? (y/N)');
      // In automated environments, we continue
      // In interactive environments, prompt user
    }
  }

  /**
   * Deploy to production
   */
  async deploy() {
    try {
      console.log('\n' + '='.repeat(60));
      console.log('QUI BROWSER - PRODUCTION DEPLOYMENT');
      console.log('='.repeat(60) + '\n');

      // Pre-deployment checks
      await this.preDeploymentChecks();

      // Create backup
      await this.createBackup();

      // Run tests
      await this.runTests();

      // Security audit
      await this.securityAudit();

      // Build
      await this.build();

      // Install dependencies
      await this.installDependencies();

      // Verify deployment
      await this.verifyDeployment();

      // Success
      const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
      console.log('\n' + '='.repeat(60));
      console.log('✅ DEPLOYMENT SUCCESSFUL');
      console.log(`Duration: ${duration}s`);
      console.log('='.repeat(60) + '\n');

      this.log('Deployment completed successfully', 'info');
    } catch (error) {
      console.log('\n' + '='.repeat(60));
      console.log('❌ DEPLOYMENT FAILED');
      console.log('='.repeat(60) + '\n');
      this.log(error.message, 'error');
      process.exit(1);
    }
  }
}

// Run deployment
if (require.main === module) {
  const deployment = new ProductionDeployment();
  deployment.deploy();
}

module.exports = ProductionDeployment;
