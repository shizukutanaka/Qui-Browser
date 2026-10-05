/**
 * Docker surface honesty — the image cd.yml pushes to ghcr.io must serve the
 * Vite build (dist/), not the raw source tree (unbundled bare-specifier
 * imports cannot run in a browser), and nginx/compose must match the real
 * shipped layout.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('docker surface honesty', () => {
  test('Dockerfile builds dist/ and ships only the build output', () => {
    const dockerfile = read('Dockerfile');
    // vite/terser are devDependencies — production-only install cannot build
    expect(dockerfile).not.toMatch(/--only=production/);
    expect(dockerfile).toMatch(/npm run build/);
    expect(dockerfile).toMatch(/COPY --from=builder \/app\/dist \/usr\/share\/nginx\/html/);
    expect(dockerfile).not.toMatch(/COPY --from=builder \/app \/usr\/share\/nginx\/html/);
  });

  test('Dockerfile lockfile install is reproducible', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toMatch(/COPY package\.json package-lock\.json/);
    expect(dockerfile).toMatch(/RUN npm ci\b/);
    const dockerignore = read('.dockerignore');
    expect(dockerignore).not.toMatch(/^package-lock\.json$/m);
  });

  test('nginx routes the live service worker, not the deleted sw.js', () => {
    const nginx = read('docker/nginx.conf');
    expect(nginx).toMatch(/location = \/service-worker\.js/);
    expect(nginx).not.toMatch(/sw\\\.js|public\/sw/);
    expect(nginx).toMatch(/Service-Worker-Allowed/);
    expect(nginx).toMatch(/no-cache, no-store, must-revalidate/);
  });

  test('nginx has no location blocks for directories absent from dist/', () => {
    const nginx = read('docker/nginx.conf');
    expect(nginx).not.toMatch(/location \/examples\//);
    expect(nginx).not.toMatch(/location \/docs\//);
  });

  test('docker-compose does not mount raw source over the served root', () => {
    const compose = read('docker-compose.yml');
    expect(compose).not.toMatch(/- \.:\/usr\/share\/nginx\/html/);
    expect(compose).not.toMatch(/- \.\/dist:\/usr\/share\/nginx\/html/);
    expect(compose).not.toMatch(/nginx-cache/);
    expect(compose).not.toMatch(/depends_on/);
  });

  test('Dockerfile exposes only the port nginx actually listens on', () => {
    const dockerfile = read('Dockerfile');
    expect(dockerfile).toMatch(/^EXPOSE 80$/m);
    expect(dockerfile).not.toMatch(/^EXPOSE .*443/m);
  });
});
