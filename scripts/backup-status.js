'use strict';

const path = require('path');

const DEFAULT_DIR = 'backups';
const DEFAULT_LIMIT = 20;
const DEFAULT_STALE_HOURS = 24;

function printUsage() {
  console.log(
    'Usage: node scripts/backup-status.js [--dir=<backups>] [--limit=<n>] [--stale-hours=<h>] [--include=<substring>] [--sort=mtime|size] [--json]'
  );
  console.log('');
  console.log('Options:');
  console.log(`  --dir=<path>         Directory containing backups (default: ${DEFAULT_DIR})`);
  console.log(`  --limit=<n>          Number of recent backups to inspect (default: ${DEFAULT_LIMIT})`);
  console.log(`  --stale-hours=<h>    Threshold in hours to flag stale backups (default: ${DEFAULT_STALE_HOURS})`);
  console.log('  --include=<substring> Only inspect backups whose filenames contain the substring');
  console.log('  --sort=mtime|size    Sort by modification time (default) or file size');
  console.log('  --json               Output JSON summary');
}

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const options = {
    dir: DEFAULT_DIR,
    limit: DEFAULT_LIMIT,
    staleHours: DEFAULT_STALE_HOURS,
    json: false,
    include: null,
    sort: 'mtime'
  };

  for (const arg of args) {
    if (arg.startsWith('--dir=')) {
      options.dir = arg.slice('--dir='.length);
    } else if (arg.startsWith('--limit=')) {
      const parsed = parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
      }
    } else if (arg.startsWith('--stale-hours=')) {
      const parsed = parseFloat(arg.slice('--stale-hours='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        options.staleHours = parsed;
      }
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--include=')) {
      const value = arg.slice('--include='.length).trim();
      if (value) {
        options.include = value.toLowerCase();
      }
    } else if (arg.startsWith('--sort=')) {
      const value = arg.slice('--sort='.length).toLowerCase();
      if (value === 'mtime' || value === 'size') {
        options.sort = value;
      }
    }
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    options.limit = DEFAULT_LIMIT;
  }

  if (!Number.isFinite(options.staleHours) || options.staleHours <= 0) {
    options.staleHours = DEFAULT_STALE_HOURS;
  }

  return options;
}

function ensureAbsoluteDirectory(dirPath) {
  return path.resolve(dirPath);
}

function summarizeBackups(entries, staleHours) {
  const now = Date.now();
  const staleThresholdMs = staleHours * 60 * 60 * 1000;

  const latest = entries[0] || null;
  const stale = entries.filter(entry => {
    const modified = Date.parse(entry.modifiedAt || entry.createdAt || 0);
    return Number.isFinite(modified) && now - modified > staleThresholdMs;
  });

  const totalSizeBytes = entries.reduce((acc, entry) => acc + (entry.sizeBytes || 0), 0);

  return {
    inspected: entries.length,
    latest: latest
      ? {
          file: latest.file,
          path: latest.path,
          modifiedAt: latest.modifiedAt,
          createdAt: latest.createdAt,
          reason: latest.reason,
          sizeBytes: latest.sizeBytes
        }
      : null,
    staleThresholdHours: staleHours,
    staleCount: stale.length,
    staleFiles: stale.map(entry => ({
      file: entry.file,
      modifiedAt: entry.modifiedAt,
      createdAt: entry.createdAt,
      sizeBytes: entry.sizeBytes
    })),
    totalSizeBytes
  };
}

function printSummary(summary) {
  if (!summary.latest) {
    console.log('No backups available.');
    return;
  }

  console.log(`Latest backup: ${summary.latest.file}`);
  console.log(`  Path: ${summary.latest.path}`);
  console.log(`  Modified: ${summary.latest.modifiedAt}`);
  if (summary.latest.reason) {
    console.log(`  Reason: ${summary.latest.reason}`);
  }
  console.log(`Total inspected: ${summary.inspected}`);
  console.log(`Stale threshold: ${summary.staleThresholdHours} hours`);
  console.log(`Stale backups: ${summary.staleCount}`);
  console.log(`Total size: ${(summary.totalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  if (summary.staleCount > 0) {
    summary.staleFiles.forEach(item => {
      const sizeText = item.sizeBytes ? ` size=${(item.sizeBytes / 1024 / 1024).toFixed(2)}MB` : '';
      console.log(`  - ${item.file} (modified ${item.modifiedAt})${sizeText}`);
    });
  }
}

function main() {
  const { listBackups } = require('./list-backups');
  const options = parseArgs();
  const backupDir = ensureAbsoluteDirectory(options.dir);

  let entries;
  try {
    entries = listBackups({
      dir: backupDir,
      limit: options.limit,
      json: false,
      details: true,
      include: options.include,
      sort: options.sort
    });
  } catch (error) {
    console.error('Failed to read backups:', error.message);
    process.exit(1);
  }

  if (!entries || entries.length === 0) {
    console.log(`No backups found in ${backupDir}`);
    process.exit(0);
  }

  if (options.include) {
    console.log(`Filter: filenames containing "${options.include}"`);
  }
  console.log(`Sort order: ${options.sort}`);

  const summary = summarizeBackups(entries, options.staleHours);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    printSummary(summary);
  }
}

if (require.main === module) {
  main();
}
