#!/usr/bin/env node

/**
 * Qui Browser CLI Tool
 * Command-line interface for server management and operations
 * 開発者体験を向上させる統合CLIツール
 */

const { program } = require('commander');
const packageJson = require('./package.json');
const { generateOperationsGuide } = require('./utils/docs-generator.js');
const { runDiagnostics } = require('./scripts/doctor.js');
const { runEnvCheck } = require('./scripts/check-env.js');
const { main: runClean } = require('./scripts/clean.js');

let serverModule;

function getServerModule() {
  if (!serverModule) {
    serverModule = require('./server-lightweight.js');
  }
  return serverModule;
}

function collectListOption(value, previous = []) {
  if (!value) {
    return previous;
  }
  const parts = Array.isArray(value) ? value : [value];
  const tokens = [];
  for (const part of parts) {
    if (typeof part === 'string') {
      part.split(',').forEach(token => {
        const trimmed = token.trim();
        if (trimmed) {
          tokens.push(trimmed);
        }
      });
    }
  }
  return [...previous, ...tokens];
}

function toErrorMessage(error, fallback = 'Unexpected error') {
  if (error instanceof Error && typeof error.message === 'string' && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

program
  .name('qui-browser')
  .description('Qui Browser CLI - Enterprise-grade web browser server management')
  .version(packageJson.version);

program
  .command('doctor')
  .description('Run Qui Browser diagnostic checks')
  .option('--json', 'Output diagnostics as JSON')
  .option('--check-tls', 'Include TLS certificate expiry check')
  .option('--tls-cert <path>', 'Path to TLS certificate (defaults to TLS_CERT_PATH env)')
  .option('--tls-threshold-days <days>', 'Warn when certificate expires within N days')
  .option('--tls-renew-command <command>', 'Command to run when certificate is near expiry')
  .action(options => {
    try {
      const tlsThreshold = options.tlsThresholdDays ? Number(options.tlsThresholdDays) : undefined;
      const result = runDiagnostics({
        silent: Boolean(options.json),
        checkTls: Boolean(options.checkTls),
        tlsCertificatePath: options.tlsCert,
        tlsThresholdDays: Number.isFinite(tlsThreshold) ? tlsThreshold : undefined,
        tlsRenewCommand: options.tlsRenewCommand
      });

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              hostname: result.hostname,
              os: result.os,
              hasErrors: result.hasErrors,
              hasWarnings: result.hasWarnings,
              checks: result.checks
            },
            null,
            2
          )
        );
      }

      process.exit(result.hasErrors ? 1 : 0);
    } catch (error) {
      console.error('Doctor failed:', toErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command('docs:generate-operations')
  .description('Generate an operations guide for a locale using the template')
  .requiredOption('-l, --locale <locale>', 'Locale directory name (e.g. fr)')
  .requiredOption('-L, --language <language>', 'Language display name (e.g. Français)')
  .option('-o, --output <path>', 'Optional output file path')
  .option('-f, --force', 'Overwrite existing file if present')
  .action(options => {
    try {
      const result = generateOperationsGuide({
        locale: options.locale,
        language: options.language,
        output: options.output,
        force: Boolean(options.force)
      });
      console.log(`Operations guide generated at ${result.outputPath}`);
    } catch (error) {
      console.error('Failed to generate operations guide:', toErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command('env:check')
  .description('Validate environment configuration using scripts/check-env.js')
  .option('--json', 'Output JSON result instead of human-readable report')
  .option('--env-file <path>', 'Path to .env file (defaults to project root .env)')
  .action(options => {
    try {
      const result = runEnvCheck({
        envPath: options.envFile || undefined,
        silent: Boolean(options.json)
      });

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              errorCount: result.errorCount,
              warningCount: result.warningCount,
              exitCode: result.exitCode,
              results: result.results
            },
            null,
            2
          )
        );
        process.exit(result.exitCode);
        return;
      }

      if (result.exitCode === 0) {
        console.log('[OK] Environment configuration passed without errors.');
        if (result.warningCount > 0) {
          console.log(`[WARN] Detected ${result.warningCount} warning(s). Review details above.`);
        }
      } else {
        console.log(
          `[ERR] Environment configuration reported ${result.errorCount} error(s) and ${result.warningCount} warning(s).`
        );
        console.log('Run with --json or review npm run check:env for full output.');
      }

      process.exit(result.exitCode);
    } catch (error) {
      console.error('Environment check failed:', toErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command('csp:generate')
  .description('Generate Content-Security-Policy header from presets and options')
  .option('-p, --preset <preset>', 'Preset name to use', 'strict')
  .option('--allow-inline-scripts', 'Allow inline scripts in CSP')
  .option('--allow-inline-styles', 'Allow inline styles in CSP')
  .option('--allow-eval', 'Allow unsafe-eval in scripts')
  .option('--script-host <host>', 'Additional script host (repeatable or comma-separated)', collectListOption, [])
  .option('--style-host <host>', 'Additional style host (repeatable or comma-separated)', collectListOption, [])
  .option('--connect-host <host>', 'Additional connect host (repeatable or comma-separated)', collectListOption, [])
  .option('--image-host <host>', 'Additional image host (repeatable or comma-separated)', collectListOption, [])
  .option('--frame-ancestor <host>', 'Additional frame ancestor (repeatable or comma-separated)', collectListOption, [])
  .option('--report-uri <uri>', 'Reporting URI for CSP violations')
  .option('--nonce-placeholder <placeholder>', 'Placeholder value replaced at runtime')
  .option('--enable-trusted-types', 'Enable Trusted Types directives')
  .option('--trusted-types-policy <policy>', 'Trusted Types policy names', collectListOption, [])
  .option('--extra-directives <json>', 'JSON object with additional directives')
  .option('--json', 'Output JSON result instead of header string')
  .action(options => {
    try {
      const extra = options.extraDirectives ? JSON.parse(options.extraDirectives) : undefined;
      const { generateCspHeader } = require('./config/csp-presets.js');
      const result = generateCspHeader({
        preset: options.preset,
        allowInlineScripts: Boolean(options.allowInlineScripts),
        allowInlineStyles: Boolean(options.allowInlineStyles),
        allowEval: Boolean(options.allowEval),
        allowedScriptHosts: options.scriptHost,
        allowedStyleHosts: options.styleHost,
        allowedConnectHosts: options.connectHost,
        allowedImageHosts: options.imageHost,
        allowedFrameAncestors: options.frameAncestor,
        reportUri: options.reportUri,
        noncePlaceholder: options.noncePlaceholder,
        enableTrustedTypes: Boolean(options.enableTrustedTypes),
        trustedTypesPolicies: options.trustedTypesPolicy,
        extraDirectives: extra
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(result.header);
      }
    } catch (error) {
      console.error('Failed to generate CSP header:', toErrorMessage(error));
      process.exit(1);
    }
  });

program
  .command('maintenance:clean')
  .description('Remove cache, log, backup, and data directories')
  .action(() => {
    try {
      runClean();
      console.log('Maintenance clean completed.');
    } catch (error) {
      console.error('Maintenance clean failed:', toErrorMessage(error));
      process.exit(1);
    }
  });

// Start server command
program
  .command('start')
  .description('Start the Qui Browser server')
  .option('-p, --port <port>', 'Server port', '8000')
  .option('-e, --env <environment>', 'Environment (development/production)', 'production')
  .option('-d, --daemon', 'Run as daemon')
  .option('--allow-daemon-insecure', 'Allow daemon mode in non-production environments without checks')
  .action(async options => {
    const { LightweightBrowserServer } = getServerModule();
    console.log('Starting Qui Browser server...');
    console.log(`Port: ${options.port}`);
    console.log(`Environment: ${options.env}`);

    process.env.PORT = options.port;
    process.env.NODE_ENV = options.env;

    if (options.daemon && options.env !== 'production' && !options.allowDaemonInsecure) {
      console.error('Refusing to start daemon outside production without --allow-daemon-insecure');
      process.exit(1);
    }

    if (options.daemon) {
      console.log('Running in daemon mode...');
      const { spawn } = require('child_process');
      const child = spawn(process.execPath, ['server-lightweight.js'], {
        detached: true,
        stdio: 'ignore'
      });
      child.unref();
      console.log(`Server started with PID: ${child.pid}`);
    } else {
      const server = new LightweightBrowserServer();
      await server.start();
    }
  });

// Billing diagnostics command
program
  .command('billing:diagnostics')
  .description('Inspect billing configuration validation output')
  .action(async () => {
    try {
      const { createServer } = getServerModule();
      const server = createServer();
      if (!server.billingConfigurationIssues) {
        console.log('No billing configuration issues reported.');
        if (server.cleanupTimer) {
          clearInterval(server.cleanupTimer);
        }
        process.exit(0);
      }

      const { errors = [], warnings = [] } = server.billingConfigurationIssues;

      if (errors.length === 0 && warnings.length === 0) {
        console.log('Billing configuration passed all checks.');
        if (server.cleanupTimer) {
          clearInterval(server.cleanupTimer);
        }
        process.exit(0);
      }

      if (errors.length > 0) {
        console.log('❌ Billing configuration errors:');
        errors.forEach(item => console.log(`  - ${item}`));
      }

      if (warnings.length > 0) {
        console.log('⚠️  Billing configuration warnings:');
        warnings.forEach(item => console.log(`  - ${item}`));
      }

      if (server.cleanupTimer) {
        clearInterval(server.cleanupTimer);
      }
      process.exit(errors.length > 0 ? 1 : 0);
    } catch (error) {
      console.error('Failed to inspect billing configuration:', toErrorMessage(error));
      process.exit(1);
    }
  });

// Health check command
program
  .command('health')
  .description('Check server health status')
  .option('-H, --host <host>', 'Server host', 'localhost')
  .option('-p, --port <port>', 'Server port', '8000')
  .option('-j, --json', 'Output as JSON')
  .action(async options => {
    const http = require('http');

    const url = `http://${options.host}:${options.port}/health`;

    http
      .get(url, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const health = JSON.parse(data);

            if (options.json) {
              console.log(JSON.stringify(health, null, 2));
            } else {
              console.log('\n=== Server Health Status ===\n');
              console.log(`Status: ${health.status}`);
              console.log(`Uptime: ${Math.floor(health.uptimeSeconds / 60)} minutes`);
              console.log(`Version: ${health.version}`);

              if (health.metrics) {
                console.log('\n--- Server Metrics ---');
                console.log(`Total Requests: ${health.metrics.server.totalRequests}`);
                console.log(`Total Errors: ${health.metrics.server.totalErrors}`);
                console.log(`Avg Response Time: ${health.metrics.server.avgResponseTimeMs}ms`);

                console.log('\n--- System Metrics ---');
                console.log(`CPU: ${(health.metrics.system.cpu.percent * 100).toFixed(1)}%`);
                console.log(`Memory: ${(health.metrics.system.memory.usagePercent * 100).toFixed(1)}%`);
                console.log(`Event Loop Lag: ${health.metrics.system.eventLoop.lagMs}ms`);
              }
            }

            process.exit(health.status === 'healthy' ? 0 : 1);
          } catch (error) {
            console.error('Failed to parse health response:', error);
            process.exit(1);
          }
        });
      })
      .on('error', error => {
        console.error('Health check failed:', error.message);
        process.exit(1);
      });
  });

// Metrics command
program
  .command('metrics')
  .description('Display server metrics')
  .option('-H, --host <host>', 'Server host', 'localhost')
  .option('-p, --port <port>', 'Server port', '8000')
  .option('-w, --watch', 'Watch mode (update every 5s)')
  .action(async options => {
    const http = require('http');

    const fetchMetrics = () => {
      const url = `http://${options.host}:${options.port}/api/stats`;

      http
        .get(url, res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const stats = JSON.parse(data);
              const server = stats.server || {};
              const system = stats.system || {};
              const rateLimiting = stats.rateLimiting || {};
              const connections = stats.connections || {};
              const health = stats.health || {};

              if (options.watch) {
                console.clear(); // eslint-disable-line no-console
              }

              console.log('\n=== Qui Browser Metrics ===\n');
              console.log(`Timestamp: ${stats.timestamp || new Date().toISOString()}`);

              console.log('\n--- Server ---');
              console.log(`Start Time: ${server.startTime || 'unknown'}`);
              console.log(
                `Uptime: ${typeof server.uptime === 'number' ? Math.floor(server.uptime / 1000) + 's' : 'unknown'}`
              );
              console.log(`Total Requests: ${server.totalRequests ?? 'unknown'}`);
              console.log(`Total Errors: ${server.totalErrors ?? 'unknown'}`);
              console.log(`Average Response Time: ${server.averageResponseTime ?? 'unknown'} ms`);
              console.log(`Active Connections: ${server.activeConnections ?? connections.active ?? 'unknown'}`);
              console.log(`Peak Connections: ${server.peakConnections ?? connections.peak ?? 'unknown'}`);

              console.log('\n--- Rate Limiting ---');
              console.log(`Tracked Clients: ${rateLimiting.activeClients ?? 'unknown'}`);
              console.log(`Max Requests/Window: ${rateLimiting.maxRequests ?? 'unknown'}`);
              console.log(`Window (ms): ${rateLimiting.windowMs ?? 'unknown'}`);
              console.log(`Blocked Requests: ${rateLimiting.blockedRequests ?? 'unknown'}`);

              console.log('\n--- System ---');
              if (system.memory) {
                console.log(`Memory RSS: ${system.memory.rss ?? 'unknown'}`);
              }
              if (system.cpu) {
                console.log(`CPU User/System: ${system.cpu.user ?? 'unknown'} / ${system.cpu.system ?? 'unknown'}`);
              }
              console.log(`Platform: ${system.platform || 'unknown'}`);
              console.log(`Node Version: ${system.nodeVersion || 'unknown'}`);

              if (health.status) {
                console.log('\n--- Health Snapshot ---');
                console.log(`Status: ${health.status}`);
                if (health.metrics?.memory) {
                  console.log(`Memory Usage: ${(health.metrics.memory.percent * 100).toFixed(1)}%`);
                }
              }
            } catch (error) {
              console.error('Failed to parse metrics:', toErrorMessage(error));
            }
          });
        })
        .on('error', error => {
          console.error('Metrics fetch failed:', error.message);
          if (!options.watch) {
            process.exit(1);
          }
        });
    };

    fetchMetrics();

    if (options.watch) {
      setInterval(fetchMetrics, 5000);
    }
  });

// Config validation command
program
  .command('validate')
  .description('Validate server configuration')
  .option('-f, --file <file>', 'Config file path', '.env')
  .action(async options => {
    const fs = require('fs');
    const path = require('path');

    console.log(`Validating configuration file: ${options.file}\n`);

    try {
      // Check if file exists
      const configPath = path.resolve(options.file);
      if (!fs.existsSync(configPath)) {
        console.error(`❌ Configuration file not found: ${configPath}`);
        process.exit(1);
      }

      // Parse .env file
      const content = fs.readFileSync(configPath, 'utf8');
      const lines = content.split('\n');
      const config = {};
      const warnings = [];
      const errors = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();

        config[key] = value;
      }

      // Validate critical settings
      if (config.NODE_ENV === 'production') {
        if (config.ENABLE_SECURITY_HEADERS !== 'true') {
          warnings.push('ENABLE_SECURITY_HEADERS should be true in production');
        }

        if (!config.RATE_LIMIT_MAX) {
          warnings.push('RATE_LIMIT_MAX is not set');
        }

        if (parseInt(config.PORT) < 1024) {
          warnings.push('PORT < 1024 requires elevated privileges');
        }
      }

      // Validate numeric values
      const numericFields = ['PORT', 'RATE_LIMIT_MAX', 'RATE_LIMIT_WINDOW'];
      for (const field of numericFields) {
        if (config[field] && isNaN(parseInt(config[field]))) {
          errors.push(`${field} must be a number`);
        }
      }

      // Display results
      console.log('✓ Configuration file parsed successfully\n');

      if (Object.keys(config).length > 0) {
        console.log('Configuration:');
        for (const [key, value] of Object.entries(config)) {
          // Mask sensitive values
          const displayValue = key.includes('KEY') || key.includes('SECRET') ? '********' : value;
          console.log(`  ${key}: ${displayValue}`);
        }
        console.log('');
      }

      if (warnings.length > 0) {
        console.log('⚠️  Warnings:');
        warnings.forEach(w => console.log(`  - ${w}`));
        console.log('');
      }

      if (errors.length > 0) {
        console.log('❌ Errors:');
        errors.forEach(e => console.log(`  - ${e}`));
        console.log('');
        process.exit(1);
      } else {
        console.log('✓ Configuration is valid');
      }
    } catch (error) {
      console.error('Validation failed:', toErrorMessage(error));
      process.exit(1);
    }
  });

// Logs command
program
  .command('logs')
  .description('View server logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .option('-t, --type <type>', 'Log type (audit/error/all)', 'all')
  .action(async options => {
    const fs = require('fs');
    const path = require('path');

    const logPaths = {
      audit: 'logs/audit',
      error: 'logs'
    };

    const viewLogs = () => {
      try {
        let logContent = '';

        if (options.type === 'all' || options.type === 'error') {
          const errorLogPath = path.join(logPaths.error, 'error.log');
          if (fs.existsSync(errorLogPath)) {
            logContent += fs.readFileSync(errorLogPath, 'utf8');
          }
        }

        if (options.type === 'all' || options.type === 'audit') {
          const auditDir = logPaths.audit;
          if (fs.existsSync(auditDir)) {
            const auditFiles = fs
              .readdirSync(auditDir)
              .filter(f => f.endsWith('.jsonl'))
              .sort()
              .slice(-5); // Last 5 files

            for (const file of auditFiles) {
              logContent += fs.readFileSync(path.join(auditDir, file), 'utf8');
            }
          }
        }

        const lines = logContent.split('\n').filter(Boolean);
        const displayLines = options.follow ? lines : lines.slice(-parseInt(options.lines));

        console.clear(); // eslint-disable-line no-console
        console.log(`=== Qui Browser Logs (${options.type}) ===\n`);
        displayLines.forEach(line => console.log(line));
      } catch (error) {
        console.error('Failed to read logs:', toErrorMessage(error));
      }
    };

    viewLogs();

    if (options.follow) {
      setInterval(viewLogs, 2000);
    }
  });

// Benchmark command
program
  .command('benchmark')
  .description('Run performance benchmark')
  .option('-H, --host <host>', 'Server host', 'localhost')
  .option('-p, --port <port>', 'Server port', '8000')
  .option('-c, --concurrency <number>', 'Concurrent requests', '10')
  .option('-n, --requests <number>', 'Total requests', '1000')
  .action(async options => {
    console.log('\n=== Qui Browser Benchmark ===\n');
    console.log(`Host: ${options.host}:${options.port}`);
    console.log(`Concurrency: ${options.concurrency}`);
    console.log(`Total Requests: ${options.requests}\n`);

    const http = require('http');
    const startTime = Date.now();
    let completed = 0;
    let errors = 0;
    const responseTimes = [];

    const makeRequest = () => {
      return new Promise(resolve => {
        const reqStart = Date.now();

        http
          .get(`http://${options.host}:${options.port}/`, res => {
            let data = '';
            res.on('data', chunk => (data += chunk));
            res.on('end', () => {
              completed++;
              responseTimes.push(Date.now() - reqStart);
              resolve(undefined);
            });
          })
          .on('error', () => {
            errors++;
            completed++;
            resolve(undefined);
          });
      });
    };

    const concurrency = parseInt(options.concurrency);
    const totalRequests = parseInt(options.requests);

    // Run benchmark
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(
        (async () => {
          while (completed < totalRequests) {
            await makeRequest();
          }
        })()
      );
    }

    await Promise.all(workers);

    const duration = (Date.now() - startTime) / 1000;
    const sorted = responseTimes.sort((a, b) => a - b);

    console.log('\n=== Results ===\n');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Requests/sec: ${(totalRequests / duration).toFixed(2)}`);
    console.log(`Completed: ${completed}`);
    console.log(`Errors: ${errors}`);
    console.log(`\nResponse Times:`);
    console.log(`  Min: ${sorted[0]}ms`);
    console.log(`  Max: ${sorted[sorted.length - 1]}ms`);
    console.log(`  Avg: ${(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2)}ms`);
    console.log(`  P50: ${sorted[Math.floor(sorted.length * 0.5)]}ms`);
    console.log(`  P95: ${sorted[Math.floor(sorted.length * 0.95)]}ms`);
    console.log(`  P99: ${sorted[Math.floor(sorted.length * 0.99)]}ms\n`);
  });

// Parse CLI arguments
program.parse();

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
