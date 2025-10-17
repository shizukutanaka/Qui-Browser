'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = 'backups';
const DEFAULT_KEEP = 10;
const DEFAULT_LIMIT = 500;

function printUsage() {
  console.log(
    'Usage: node scripts/prune-backups.js [--dir=<backups>] [--keep=<n>] [--max-age-days=<d>] [--limit=<n>] [--include=<substring>] [--sort=mtime|size] [--dry-run] [--json]'
  );
  console.log('');
  console.log('Options:');
  console.log(`  --dir=<path>         Directory containing backups (default: ${DEFAULT_DIR})`);
  console.log(`  --keep=<n>           Minimum number of newest backups to retain (default: ${DEFAULT_KEEP})`);
  console.log('  --max-age-days=<d>   Remove backups older than <d> days (optional)');
  console.log(`  --limit=<n>          Inspect up to <n> backups (default: ${DEFAULT_LIMIT})`);
  console.log('  --include=<substring> Only inspect backups whose filenames include the substring');
  console.log('  --sort=mtime|size    Sort inspection order by modification time (default) or size');
  console.log('  --dry-run            Show what would be deleted without removing files');
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
    keep: DEFAULT_KEEP,
    maxAgeDays: null,
    limit: DEFAULT_LIMIT,
    dryRun: false,
    json: false,
    include: null,
    sort: 'mtime'
  };

  for (const arg of args) {
    if (arg.startsWith('--dir=')) {
      options.dir = arg.slice('--dir='.length);
    } else if (arg.startsWith('--keep=')) {
      const parsed = parseInt(arg.slice('--keep='.length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        options.keep = parsed;
      }
    } else if (arg.startsWith('--max-age-days=')) {
      const parsed = parseFloat(arg.slice('--max-age-days='.length));
      if (Number.isFinite(parsed) && parsed > 0) {
        options.maxAgeDays = parsed;
      }
    } else if (arg.startsWith('--limit=')) {
      const parsed = parseInt(arg.slice('--limit='.length), 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        options.limit = parsed;
      }
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg.startsWith('--include=')) {
      const value = arg.slice('--include='.length).trim();
      if (value) {
        options.include = value.toLowerCase();
      }
    } else if (arg.startsWith('--sort=')) {
      const sortValue = arg.slice('--sort='.length).toLowerCase();
      if (sortValue === 'mtime' || sortValue === 'size') {
        options.sort = sortValue;
      }
    }
  }

  if (!Number.isFinite(options.keep) || options.keep < 0) {
    options.keep = DEFAULT_KEEP;
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) {
    options.limit = DEFAULT_LIMIT;
  }

  return options;
}

function ensureAbsoluteDirectory(dirPath) {
  return path.resolve(dirPath);
}

function selectBackupsForDeletion(entries, keepCount, maxAgeDays) {
  const now = Date.now();
  const deleteSet = new Set();

  entries.forEach((entry, index) => {
    if (index >= keepCount) {
      deleteSet.add(entry.path);
    }
  });

  if (maxAgeDays) {
    const thresholdMs = maxAgeDays * 24 * 60 * 60 * 1000;
    entries.forEach(entry => {
      const modified = Date.parse(entry.modifiedAt || entry.createdAt || 0);
      if (Number.isFinite(modified) && now - modified > thresholdMs) {
        deleteSet.add(entry.path);
      }
    });
  }

  const candidates = entries.filter(entry => deleteSet.has(entry.path));
  const totalSizeBytes = candidates.reduce((acc, entry) => acc + (entry.sizeBytes || 0), 0);

  return {
    candidates,
    totalSizeBytes
  };
}

function deleteBackups(backups, dryRun) {
  const removed = [];
  const failed = [];

  backups.forEach(entry => {
    if (dryRun) {
      removed.push({ file: entry.file, path: entry.path, dryRun: true });
      return;
    }
    try {
      fs.unlinkSync(entry.path);
      removed.push({ file: entry.file, path: entry.path, dryRun: false });
    } catch (error) {
      failed.push({ file: entry.file, path: entry.path, error: error.message });
    }
  });

  return { removed, failed };
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

  const { candidates, totalSizeBytes } = selectBackupsForDeletion(entries, options.keep, options.maxAgeDays);
  const { removed, failed } = deleteBackups(candidates, options.dryRun);

  const summary = {
    inspected: entries.length,
    toRemove: candidates.length,
    removed: removed.length,
    failed: failed.length,
    dryRun: options.dryRun,
    keep: options.keep,
    maxAgeDays: options.maxAgeDays,
    include: options.include,
    sort: options.sort,
    totalRemovalSizeBytes: totalSizeBytes,
    removedFiles: removed,
    failedFiles: failed
  };

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log(`Directory: ${backupDir}`);
  console.log(`Sort order: ${options.sort}`);
  if (options.include) {
    console.log(`Filter: filenames containing "${options.include}"`);
  }
  console.log(`Inspecting up to ${options.limit} backups`);
  console.log(`Inspected backups: ${summary.inspected}`);
  console.log(`Backups selected for removal: ${summary.toRemove}`);
  console.log(`Removed: ${summary.removed}`);
  console.log(`Failed: ${summary.failed}`);
  console.log(`Dry run: ${summary.dryRun}`);
  if (summary.totalRemovalSizeBytes) {
    console.log(`Size to reclaim: ${(summary.totalRemovalSizeBytes / 1024 / 1024).toFixed(2)} MB`);
  }
  summary.removedFiles.forEach(item => {
    const marker = item.dryRun ? ' (dry-run)' : '';
    console.log(`  removed -> ${item.file}${marker}`);
  });
  summary.failedFiles.forEach(item => {
    console.log(`  failed -> ${item.file}: ${item.error}`);
  });
}

if (require.main === module) {
  main();
}
