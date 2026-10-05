const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.json'), 'utf8'));

const srcText = fs
  .readdirSync(path.join(ROOT, 'src'), { recursive: true })
  .filter((f) => f.endsWith('.js'))
  .map((f) => fs.readFileSync(path.join(ROOT, 'src', String(f)), 'utf8'))
  .join('\n');

describe('manifest shortcuts', () => {
  const shortcuts = manifest.shortcuts || [];

  test('every shortcut targets a path the static host can serve', () => {
    for (const s of shortcuts) {
      const { pathname } = new URL(s.url, 'https://x.local/');
      const asset = path.join(ROOT, 'public', pathname.replace(/^\//, ''));
      const isRoot = pathname === '/' || pathname === '';
      const isServedFile = fs.existsSync(asset);
      expect({ url: s.url, ok: isRoot || isServedFile }).toEqual({
        url: s.url,
        ok: true
      });
    }
  });

  test('every shortcut query action has a real handler', () => {
    for (const s of shortcuts) {
      const { searchParams } = new URL(s.url, 'https://x.local/');
      for (const [key, value] of searchParams) {
        expect({
          url: s.url,
          handled: srcText.includes(`${key}=${value}`)
        }).toEqual({ url: s.url, handled: true });
      }
    }
  });
});
