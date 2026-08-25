# Publishing a Release + GitHub Pages

> ## ⚠️ REQUIRED FIRST: five workflows still reference deleted code
>
> Session 74 deleted `assets/js/` (119,698 lines of unreachable legacy code).
> **Five workflow files still reference it**, and at least one now fails:
>
> ```
> $ find assets/js -name "vr-*.js" -exec ls -lh {} \;
> find: 'assets/js': No such file or directory     # exit 1 -> deploy.yml fails
> ```
>
> Automation in this repo **cannot push `.github/workflows/**`** (403,
> `without workflows permission`), so this needs your hands. Every one of these
> steps existed to audit the legacy code that is now gone, so the fix is
> deletion, not repair:
>
> | file | what to do |
> |---|---|
> | `.github/workflows/deploy.yml` | delete the *Validate VR Modules*, *Check file sizes*, and the `npx eslint assets/js/*.js` / `MODULE_COUNT` steps (lines ~38–50, ~100, ~104) |
> | `.github/workflows/test.yml` | delete every step globbing `assets/js/**` (lines ~60, 78–99, 143, 164–177, 203–226) — the real suite is `npm test` |
> | `.github/workflows/benchmark.yml` | delete, or drop the `assets/js/vr-*.js` path trigger |
> | `.github/workflows/v5.8.0-planning.yml` | delete — it audits modules that no longer exist |
> | `.github/workflows/wasm-build.yml` | delete — there is no `assets/js/wasm/` and no WASM in the build |
>
> **A ready-to-apply patch is committed at
> `docs/patches/0001-ci-drop-assets-js-steps.patch`** — verified to apply
> cleanly to `main` and to leave zero `assets/js` references behind:
>
> ```bash
> git checkout main && git pull
> git am docs/patches/0001-ci-drop-assets-js-steps.patch
> git push
> ```
>
> (`git apply` instead of `git am` if you'd rather write your own commit message.)
>
> If you prefer to also add a job that runs what this repo actually verifies:
>
> ```yaml
>       - run: npm ci
>       - run: npm run gate        # tests + lint + build + all three verify stages
> ```
>
> Until this is done, CI results on `main` are not trustworthy.

---

The finished product is on `main` (tested, release-ready, subpath-aware build).
Two owner-side steps remain to make it a conventional public release: a
versioned **Release object** and a live **GitHub Pages** URL. Automation with
only `contents`/`pull_requests` scope cannot do these — they need `workflows`
+ tag/`actions` permission or a couple of clicks in the UI.

---

## 1. Cut the `v2.0.0` Release

**Option A — GitHub UI (fastest):**
Releases → *Draft a new release* → *Choose a tag* → type `v2.0.0` → *Create new
tag on publish* → target `main` → *Generate release notes* → **Publish release**.

**Option B — from a local clone (your own credentials):**
```bash
git tag -a v2.0.0 -m "Qui Browser VR v2.0.0"
git push origin v2.0.0
```
This triggers `.github/workflows/release.yml`, which builds `dist/`, packages a
tarball + checksum, and creates the Release. (The two docs its "Build
documentation" step checks for — `docs/QUICK_START.md`, `docs/USAGE_GUIDE.md` —
now exist, so that step passes.)

**Option C — run the workflow manually:**
Actions → *Create Release* → *Run workflow* → version `v2.0.0`.

---

## 2. Enable + deploy GitHub Pages

The app serves under the repo subpath `https://shizukutanaka.github.io/Qui-Browser/`,
so the build must set `BASE_PATH=/Qui-Browser/` (wired via `vite.config.js`
`base: process.env.BASE_PATH || '/'`). The service worker, manifest, and asset
URLs are already subpath-aware.

1. **Settings → Pages → Source: GitHub Actions.**
2. Replace `.github/workflows/deploy.yml` with the version below (the current
   one uploads raw source and has no `enablement`, so it fails at *Setup
   Pages*). Requires `workflows` write permission — commit it yourself, or grant
   the automation that scope.

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - name: Build (GitHub Pages subpath)
        run: npm run build
        env:
          BASE_PATH: /Qui-Browser/
      - uses: actions/configure-pages@v5
        with:
          enablement: true
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Reference: clean `release.yml` (optional replacement)

The existing `release.yml` works once the two docs exist, but this trimmed
version drops the legacy-asset benchmark and the raw-source Pages sub-job and
ships the built `dist/` instead:

```yaml
name: Create Release

on:
  push:
    tags: ['v*.*.*']
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v2.0.0)'
        required: true
        default: 'v2.0.0'

permissions:
  contents: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - id: version
        run: echo "value=${{ github.event.inputs.version || github.ref_name }}" >> "$GITHUB_OUTPUT"
      - name: Package built app
        run: |
          V="${{ steps.version.outputs.value }}"
          tar -czf "qui-browser-vr-${V}.tar.gz" -C dist .
          sha256sum "qui-browser-vr-${V}.tar.gz" > checksums.txt
      - uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ steps.version.outputs.value }}
          name: Qui Browser VR ${{ steps.version.outputs.value }}
          generate_release_notes: true
          files: |
            qui-browser-vr-*.tar.gz
            checksums.txt
```

---

## Why the automation stopped here

The session's GitHub integration has `contents`/`pull_requests` scope (PR create
+ merge, branch commits) but **not** `workflows`, tag push, or `actions`
dispatch — every such attempt returned `403 "not accessible by integration"`,
and no release-creation API is exposed to it. These two steps are therefore
owner-gated by design.
