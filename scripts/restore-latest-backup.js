'use strict';

const path = require('path');

const DEFAULT_DIR = 'backups';

function printUsage() {
  console.log('Usage: node scripts/restore-latest-backup.js [--dir=<backups>] [--target=<destination>] [--dry-run]');
  console.log('');
  console.log('Options:');
  console.log(`  --dir=<path>      Directory containing backup files (default: ${DEFAULT_DIR})`);
  console.log('  --target=<path>   Directory to restore into (default: current working directory)');
  console.log('  --dry-run         Validate and report planned restore without writing files');
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const options = {
    dir: DEFAULT_DIR,
    target: process.cwd(),
    dryRun: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--dir=')) {
      options.dir = arg.slice('--dir='.length);
    } else if (arg.startsWith('--target=')) {
      options.target = arg.slice('--target='.length);
    }
  }

  return options;
}

function ensureAbsoluteDirectory(dirPath) {
  return path.resolve(dirPath);
}

function main() {
  const { listBackups } = require('./list-backups');
  const { restoreBackup } = require('./restore-backup');
  const options = parseArgs();

  const backupDir = ensureAbsoluteDirectory(options.dir);
  const entries = listBackups({ dir: backupDir, limit: 1, json: false, details: true });

  if (!entries || entries.length === 0) {
    console.error(`No backups found in ${backupDir}`);
    process.exit(1);
  }

  const latest = entries[0];
  const backupPath = latest.path;
  const targetDir = ensureAbsoluteDirectory(options.target);

  console.log(`Restoring latest backup: ${latest.file}`);
  console.log(`Source: ${backupPath}`);
  console.log(`Destination: ${targetDir}`);
  console.log(`Dry run: ${options.dryRun}`);

  try {
    const summary = restoreBackup(backupPath, targetDir, { dryRun: options.dryRun });
    const resultHeading = options.dryRun ? 'Restore dry-run summary:' : 'Restore summary:';
    console.log(resultHeading);
    console.log(JSON.stringify(summary, null, 2));
    if (!options.dryRun && summary.errors.length > 0) {
      console.error('Restore completed with errors. Inspect summary for details.');
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('Failed to restore backup:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
