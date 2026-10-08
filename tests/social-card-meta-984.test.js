/**
 * Social-card image meta must resolve to a served asset (round 984).
 *
 * index.html declares og:image and twitter:image so link unfurlers can render
 * a card. Both pointed at `https://shizukutanaka.github.io/Qui-Browser/...` —
 * the GitHub Pages deploy target that has never been deployed (cd.yml's
 * deploy-github-pages job exists but has never run; the whole origin 404s).
 * The PNGs themselves are committed under public/assets/images/, so the card
 * is broken only because the meta URL dereferences to a 404.
 *
 * Invariant: every og:image / twitter:image URL must be fetchable today —
 * hosted on an origin that actually serves the repo's files. The repo is the
 * source of truth, so the URL must point at raw.githubusercontent.com and the
 * path segment must map to a real committed file. og:url/twitter:url are
 * deliberately left as the Pages deploy target (the declared canonical site
 * URL, consistent with DEPLOYMENT_GUIDE's "deploy target" labelling) — only
 * the image fetches were broken.
 */

const { readFileSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

function metaContent(prop) {
  const m = html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]+)"`));
  return m ? m[1] : null;
}

// A URL "resolves today" iff it sits on raw.githubusercontent.com under this
// repo and its path maps to a committed file — the only origin guaranteed to
// serve the asset before Pages ever deploys.
function resolveRepoFile(url) {
  const m = url.match(/^https:\/\/raw\.githubusercontent\.com\/shizukutanaka\/Qui-Browser\/[^/]+\/(.+)$/);
  if (!m) {
    return null;
  }
  const repoPath = join(ROOT, m[1]);
  return existsSync(repoPath) ? repoPath : null;
}

describe('social-card image meta', () => {
  test('og:image is declared', () => {
    expect(metaContent('og:image')).not.toBeNull();
  });

  test('twitter:image is declared', () => {
    expect(metaContent('twitter:image')).not.toBeNull();
  });

  test('og:image URL resolves to a committed, served file (not the 404 Pages origin)', () => {
    const url = metaContent('og:image');
    expect(url).not.toBeNull();
    expect(url).not.toContain('github.io');
    expect(resolveRepoFile(url)).not.toBeNull();
  });

  test('twitter:image URL resolves to a committed, served file (not the 404 Pages origin)', () => {
    const url = metaContent('twitter:image');
    expect(url).not.toBeNull();
    expect(url).not.toContain('github.io');
    expect(resolveRepoFile(url)).not.toBeNull();
  });
});
