'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function printUsage() {
  console.log('Usage: node scripts/restore-backup.js <backup-file> [--target=<dir>] [--dry-run]');
  console.log('');
  console.log('Arguments:');
  console.log('  <backup-file>        Path to backup file (.json or .json.gz)');
  console.log('');
  console.log('Options:');
  console.log('  --target=<dir>       Destination root directory (default: current working directory)');
  console.log('  --dry-run            Decode payload and validate paths without writing files');
}

function parseArgs(argv) {
  const options = {
    backupFile: null,
    targetDir: process.cwd(),
    dryRun: false
  };

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--target=')) {
      options.targetDir = arg.slice('--target='.length);
    } else if (arg.startsWith('--')) {
      console.warn(`Ignoring unknown option: ${arg}`);
    } else if (!options.backupFile) {
      options.backupFile = arg;
    } else {
      options.targetDir = arg;
    }
  }

  return options;
}

function readBackupFile(filePath) {
  if (!filePath) {
    throw new Error('Backup file path is required');
  }
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Backup file not found: ${resolved}`);
  }

  const data = fs.readFileSync(resolved);
  if (resolved.endsWith('.gz')) {
    return JSON.parse(zlib.gunzipSync(data).toString('utf8'));
  }
  return JSON.parse(data.toString('utf8'));
}

function ensureDirectory(filePath) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function resolveEntryPath(targetRoot, entryPath) {
  if (typeof entryPath !== 'string' || entryPath.trim() === '') {
    throw new Error('Invalid entry path');
  }

  const sanitized = entryPath.replace(/^([/\\])+/, '');
  const normalized = path.normalize(sanitized);
  if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
    throw new Error(`Entry path escapes target root: ${entryPath}`);
  }

  const destination = path.join(targetRoot, normalized);
  const relative = path.relative(targetRoot, destination);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Entry path escapes target root: ${entryPath}`);
  }

  return destination;
}

function decodeEntryData(entry) {
  if (!entry || typeof entry.data !== 'string') {
    throw new Error('Entry payload missing base64 data');
  }

  try {
    return Buffer.from(entry.data, 'base64');
  } catch (error) {
    throw new Error(`Failed to decode entry data: ${error.message}`);
  }
}

function restoreFile(entry, targetRoot, buffer, options) {
  const targetPath = resolveEntryPath(targetRoot, entry.path);

  if (options.dryRun) {
    return { path: targetPath, bytes: buffer.length, dryRun: true };
  }

  ensureDirectory(targetPath);
  fs.writeFileSync(targetPath, buffer);
  if (entry.modifiedAt) {
    try {
      fs.utimesSync(targetPath, new Date(), new Date(entry.modifiedAt));
    } catch (error) {
      // Non-fatal; record as warning at caller.
      return { path: targetPath, bytes: buffer.length, dryRun: false, warning: error.message };
    }
  }

  return { path: targetPath, bytes: buffer.length, dryRun: false };
}

function restoreBackup(backupFile, targetDir, options = {}) {
  const payload = readBackupFile(backupFile);
  if (!payload || !Array.isArray(payload.files)) {
    throw new Error('Invalid backup payload');
  }

  const destination = path.resolve(targetDir || process.cwd());
  const dryRun = Boolean(options.dryRun);

  const summary = {
    backupId: payload.backupId,
    reason: payload.reason,
    createdAt: payload.createdAt,
    destination,
    dryRun,
    filesTotal: payload.files.length,
    filesPlanned: 0,
    filesRestored: 0,
    filesSkipped: 0,
    bytesPlanned: 0,
    bytesWritten: 0,
    warnings: [],
    errors: []
  };

  for (const entry of payload.files) {
    try {
      const buffer = decodeEntryData(entry);
      summary.filesPlanned += 1;
      summary.bytesPlanned += buffer.length;

      const result = restoreFile(entry, destination, buffer, { dryRun });
      if (result.warning) {
        summary.warnings.push({ path: entry.path, warning: result.warning });
      }

      if (!dryRun) {
        summary.filesRestored += 1;
        summary.bytesWritten += buffer.length;
      }
    } catch (error) {
      summary.filesSkipped += 1;
      summary.errors.push({ path: entry?.path, error: error.message });
    }
  }

  return summary;
}

function main() {
  const { backupFile, targetDir, dryRun } = parseArgs(process.argv.slice(2));

  if (!backupFile) {
    printUsage();
    process.exit(1);
  }

  try {
    const summary = restoreBackup(backupFile, targetDir, { dryRun });
    const heading = dryRun ? 'Restore dry-run completed.' : 'Restore completed successfully.';
    console.log(heading);
    console.log(JSON.stringify(summary, null, 2));
    if (summary.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('Restore failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { restoreBackup };
