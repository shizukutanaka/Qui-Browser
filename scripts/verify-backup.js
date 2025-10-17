'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

function printUsage() {
  console.log('Usage: node scripts/verify-backup.js <backup-file> [--home=<path>]');
  console.log('');
  console.log('Options:');
  console.log('  <backup-file>     Target backup file (.json or .json.gz)');
  console.log('  --home=<path>     Project root directory (default: current working directory)');
}

function readBackupFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }
  const data = fs.readFileSync(filePath);
  const parsed = filePath.endsWith('.gz')
    ? JSON.parse(zlib.gunzipSync(data).toString('utf8'))
    : JSON.parse(data.toString('utf8'));
  if (!parsed || !Array.isArray(parsed.files)) {
    throw new Error('Invalid backup payload: missing files array');
  }
  return parsed;
}

function computeFileHash(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function verifyBackup(backupFile, projectRoot) {
  const payload = readBackupFile(backupFile);
  const root = path.resolve(projectRoot || process.cwd());
  const result = {
    backupId: payload.backupId,
    createdAt: payload.createdAt,
    reason: payload.reason,
    totalEntries: payload.files.length,
    missing: [],
    mismatched: [],
    checked: 0
  };

  for (const entry of payload.files) {
    const filePath = path.join(root, entry.path);
    result.checked++;
    if (!fs.existsSync(filePath)) {
      result.missing.push(entry.path);
      continue;
    }
    try {
      const buffer = fs.readFileSync(filePath);
      const fileHash = computeFileHash(buffer);
      const backupHash = computeFileHash(Buffer.from(entry.data, 'base64'));
      if (fileHash !== backupHash) {
        result.mismatched.push(entry.path);
      }
    } catch (error) {
      result.mismatched.push(`${entry.path} (error: ${error.message})`);
    }
  }

  result.passed = result.missing.length === 0 && result.mismatched.length === 0;
  return result;
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }
  const backupFile = args[0];
  let home = process.cwd();
  for (const arg of args.slice(1)) {
    if (arg.startsWith('--home=')) {
      home = arg.slice('--home='.length);
    }
  }
  return { backupFile, home };
}

function main() {
  const { backupFile, home } = parseArgs();
  try {
    const result = verifyBackup(backupFile, home);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.passed ? 0 : 2);
  } catch (error) {
    console.error('Verification failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { verifyBackup };
