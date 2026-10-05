# Publishing a Release + GitHub Pages

---

The finished product is on `main` (tested, release-ready, subpath-aware build).
Publishing is driven by `.github/workflows/cd.yml` — there is **no separate
deploy.yml or release.yml to create**. Two owner-side steps remain: push a
versioned tag for the **Release object**, and make sure **GitHub Pages** is
enabled once in repo settings.

---

## 1. Cut a `v*.*.*` Release

Every push of a tag matching `v*.*.*` runs cd.yml's `create-release` job:
`npm ci` → `npm test` → `npm run build`, then the built `dist/` is packaged as
`qui-browser-vr-<version>.tar.gz` + `checksums.txt` and published as a GitHub
Release via `softprops/action-gh-release`. The same pipeline also pushes the
`ghcr.io/shizukutanaka/qui-browser` Docker image.

**Option A — from a local clone (your own credentials):**

```bash
git tag -a v2.0.0 -m "Qui Browser VR v2.0.0"
git push origin v2.0.0
```

**Option B — GitHub UI:** Releases → _Draft a new release_ → _Choose a tag_ →
type `v2.0.0` → _Create new tag on publish_ → target `main` → _Generate release
notes_ → **Publish release**. Creating the tag on publish fires the same
`v*.*.*` trigger, so the tarball job runs and attaches its artifacts to the
draft release.

---

## 2. GitHub Pages deploy

`cd.yml`'s `deploy-github-pages` job runs on every push to `main`: it builds
`dist/` with `BASE_PATH=/Qui-Browser/` (matching the live subpath
`https://shizukutanaka.github.io/Qui-Browser/`), uploads it via
`actions/upload-pages-artifact`, and publishes it with
`actions/deploy-pages`. The service worker, manifest, and asset URLs are
already subpath-aware.

One-time setup: **Settings → Pages → Source: GitHub Actions.** After that every
push to `main` deploys automatically — no workflow file to add and no build
output to commit.

---

## Why the automation stopped here

The session's GitHub integration has `contents`/`pull_requests` scope (PR
create/merge, branch commits) but **not** `workflows`, tag push, or `actions`
dispatch — every such attempt returned `403 "not accessible by integration"`,
and no release-creation API is exposed to it. The tag push and the Pages
source toggle are therefore owner-gated by design.
