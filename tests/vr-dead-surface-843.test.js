/**
 * Dead-surface pin — BookmarkPanel imported `truncate` but never called it:
 * row ellipsising goes through `truncateToWidth` (textWrap.js), so the import
 * was a naming-collision trap (two truncators, one dead).
 */
const { readFileSync } = require('fs');
const { join } = require('path');

const SRC = readFileSync(join(__dirname, '../src/vr/browser/BookmarkPanel.js'), 'utf8');

test('BookmarkPanel no longer imports the unused truncate helper', () => {
  // \btruncate\b does not match inside truncateToWidth (no word boundary
  // before 'ToWidth'), so any hit is the dead import or a stray call.
  expect(SRC).not.toMatch(/\btruncate\b/);
});

test('live truncator truncateToWidth is still in use', () => {
  expect(SRC).toMatch(/\btruncateToWidth\b/);
});

test('bookmarkLayout still exports truncate for its real consumers', () => {
  const mod = require('../src/vr/browser/bookmarkLayout.js');
  expect(typeof mod.truncate).toBe('function');
});
