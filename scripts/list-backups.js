'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DEFAULT_LIMIT = 10;
const DEFAULT_DIR = 'backups';

function printUsage() {
  console.log(
    'Usage: node scripts/list-backups.js [--dir=<path>] [--limit=<n>] [--json] [--details] [--include=<substring>] [--sort=mtime|size]'
  );
  console.log('');
  console.log('Options:');
  console.log(`  --dir=<path>          Backup directory (default: ${DEFAULT_DIR})`);
  console.log(`  --limit=<n>           Limit number of entries (default: ${DEFAULT_LIMIT})`);
  console.log('  --json                Output JSON instead of table');
  console.log('  --details             Read payload metadata (may be slower)');
  console.log('  --include=<substring> Filter backups whose filenames contain the substring');
  console.log('  --sort=mtime|size     Sort by modification time (default) or size');
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
    json: false,
    details: false,
    include: null,
    sort: 'mtime'
  };

  for (const arg of args) {
    if (arg.startsWith('--dir=')) {
      options.dir = arg.slice('--dir='.length);
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.slice('--limit='.length), 10);
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--details') {
      options.details = true;
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

  return options;
}

function readFileMetadata(filePath, readDetails) {
  const stats = fs.statSync(filePath);
  const entry = {
    file: path.basename(filePath),
    path: filePath,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };

  if (!readDetails) {
    return entry;
  }

  try {
    const data = fs.readFileSync(filePath);
    const payload = filePath.endsWith('.gz')
      ? JSON.parse(zlib.gunzipSync(data).toString('utf8'))
      : JSON.parse(data.toString('utf8'));
    entry.backupId = payload.backupId;
    entry.reason = payload.reason;
    entry.createdAt = payload.createdAt;
    entry.files = Array.isArray(payload.files) ? payload.files.length : undefined;
  } catch (error) {
    entry.error = `Failed to read payload: ${error.message}`;
  }

  return entry;
}

function listBackups(options) {
  const dirPath = path.resolve(options.dir);
  if (!fs.existsSync(dirPath)) {
    throw new Error(`Backup directory not found: ${dirPath}`);
  }

  const files = fs
    .readdirSync(dirPath)
    .filter(file => file.startsWith('backup-') && (file.endsWith('.json') || file.endsWith('.json.gz')))
    .filter(file => {
      if (!options.include) {
        return true;
      }
      return file.toLowerCase().includes(options.include);
    })
    .map(file => path.join(dirPath, file))
    .sort((a, b) => {
      const aStats = fs.statSync(a);
      const bStats = fs.statSync(b);
      if (options.sort === 'size') {
        return bStats.size - aStats.size;
      }
      return bStats.mtimeMs - aStats.mtimeMs;
    })
    .slice(0, options.limit);

  return files.map(file => readFileMetadata(file, options.details));
}

function printTable(entries) {
  if (entries.length === 0) {
    console.log('No backups found.');
    return;
  }

  const headers = ['File', 'Size (KB)', 'Modified'];
  const rows = entries.map(entry => [entry.file, (entry.sizeBytes / 1024).toFixed(1), entry.modifiedAt]);

  const columnWidths = headers.map((header, index) => {
    const values = [header, ...rows.map(row => row[index])];
    return Math.max(...values.map(value => String(value).length));
  });

  const printRow = row => {
    const cells = row.map((cell, index) => {
      const value = String(cell);
      return value.padEnd(columnWidths[index]);
    });
    console.log(cells.join('  '));
  };

  printRow(headers);
  console.log(columnWidths.map(width => '-'.repeat(width)).join('  '));
  rows.forEach(printRow);

  entries.forEach(entry => {
    if (entry.error) {
      console.log(`! ${entry.file}: ${entry.error}`);
    }
    if (entry.backupId) {
      console.log(`  backupId=${entry.backupId} reason=${entry.reason || 'n/a'} files=${entry.files ?? 'n/a'}`);
    }
  });
}

function main() {
  const options = parseArgs();

  try {
    const entries = listBackups(options);
    if (options.json) {
      console.log(JSON.stringify(entries, null, 2));
      return;
    }

    console.log(`Directory: ${path.resolve(options.dir)}`);
    console.log(`Sort order: ${options.sort}`);
    if (options.include) {
      console.log(`Filter: filenames containing "${options.include}"`);
    }
    console.log(`Inspecting up to ${options.limit} backups`);

    printTable(entries);
  } catch (error) {
    console.error('Failed to list backups:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { listBackups };
