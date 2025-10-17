'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');
const TARGETS = ['logs', 'data', 'backups', path.join('node_modules', '.cache')];

function resolveTarget(target) {
  return path.resolve(PROJECT_ROOT, target);
}

function removeEntry(targetPath) {
  try {
    if (!fs.existsSync(targetPath)) {
      return { path: targetPath, status: 'skipped', message: 'Not found' };
    }

    fs.rmSync(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    return { path: targetPath, status: 'removed' };
  } catch (error) {
    return {
      path: targetPath,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function main() {
  const results = TARGETS.map(target => removeEntry(resolveTarget(target)));
  let hasFailure = false;

  for (const result of results) {
    if (result.status === 'removed') {
      console.log(`[OK] Removed ${result.path}`);
    } else if (result.status === 'skipped') {
      console.log(`[SKIP] ${result.path} ${result.message}`);
    } else {
      hasFailure = true;
      console.error(`[ERR] Failed to remove ${result.path}: ${result.message}`);
    }
  }

  if (hasFailure) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
