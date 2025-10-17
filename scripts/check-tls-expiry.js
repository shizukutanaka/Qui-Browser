'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { X509Certificate } = require('crypto');

/**
 * Parse command line arguments into an object.
 * @param {string[]} argv
 * @returns {Record<string, any>}
 */
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      args[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = next;
      i += 1;
    } else {
      args[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = true;
    }
  }
  return args;
}

/**
 * Inspect a TLS certificate and return status details.
 * @param {object} options
 * @param {string} options.certificatePath
 * @param {number} [options.thresholdDays]
 * @returns {{ status: 'ok' | 'warning' | 'expired', daysRemaining: number, validTo: string, subject: string }}
 */
function checkCertificate(options) {
  const { certificatePath, thresholdDays = 30 } = options;
  if (!certificatePath) {
    throw new Error('certificatePath is required');
  }

  const absolutePath = path.resolve(certificatePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Certificate file not found at ${absolutePath}`);
  }

  const pem = fs.readFileSync(absolutePath, 'utf8');
  const cert = new X509Certificate(pem);
  const validTo = new Date(cert.validTo);
  const now = new Date();
  const diffMs = validTo.getTime() - now.getTime();
  const daysRemaining = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  /** @type {'ok' | 'warning' | 'expired'} */
  let status = 'ok';
  if (daysRemaining <= 0) {
    status = 'expired';
  } else if (daysRemaining <= thresholdDays) {
    status = 'warning';
  }

  return {
    status,
    daysRemaining,
    validTo: validTo.toISOString(),
    subject: cert.subject
  };
}

/**
 * Attempt to renew using a shell command.
 * @param {string} command
 * @returns {{ success: boolean, output: string }}
 */
function runRenewCommand(command) {
  const parts = command.split(' ').filter(Boolean);
  const executable = parts.shift();
  if (!executable) {
    return { success: false, output: 'Renew command is empty.' };
  }

  const result = spawnSync(executable, parts, {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return {
    success: result.status === 0,
    output
  };
}

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    const thresholdDays = args.thresholdDays
      ? Number(args.thresholdDays)
      : Number(process.env.TLS_RENEW_THRESHOLD_DAYS || 30);
    if (!Number.isFinite(thresholdDays)) {
      throw new Error('thresholdDays must be a number');
    }

    const certificatePath = args.cert || args.certificate || process.env.TLS_CERT_PATH;
    if (!certificatePath) {
      throw new Error('Certificate path must be provided via --cert or TLS_CERT_PATH');
    }

    const result = checkCertificate({
      certificatePath,
      thresholdDays
    });

    let renewAttempt;
    const renewCommand = args.renewCommand || process.env.TLS_RENEW_COMMAND;
    if (renewCommand && result.status !== 'ok' && !args.noRenew && !process.env.TLS_SKIP_AUTORENEW) {
      renewAttempt = runRenewCommand(renewCommand);
    }

    const payload = {
      certificatePath: path.resolve(certificatePath),
      thresholdDays,
      status: result.status,
      daysRemaining: result.daysRemaining,
      validTo: result.validTo,
      subject: result.subject,
      renewAttempt
    };

    if (args.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      console.log(`Certificate: ${payload.certificatePath}`);
      console.log(`Subject: ${payload.subject}`);
      console.log(`Valid until: ${payload.validTo}`);
      console.log(`Days remaining: ${payload.daysRemaining}`);
      console.log(`Status: ${payload.status.toUpperCase()}`);
      if (renewAttempt) {
        console.log(`Renew command success: ${renewAttempt.success}`);
        if (renewAttempt.output) {
          console.log(renewAttempt.output);
        }
      }
    }

    if (renewAttempt && !renewAttempt.success) {
      process.exit(1);
    }

    if (result.status === 'expired') {
      process.exit(2);
    } else if (result.status === 'warning') {
      process.exit(3);
    }
  } catch (error) {
    console.error('TLS certificate check failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  checkCertificate,
  runRenewCommand
};
