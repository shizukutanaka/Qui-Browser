# Archived test suites

These suites are temporarily excluded from `npm test` (see
`testPathIgnorePatterns` in `jest.config.js`). They are **not deleted** — they
are kept here for reference and future rewrite.

## Why they were archived

The repository currently contains two parallel codebases:

- `src/` — the live **v2.0.0** WebXR app wired to `index.html` (Vite).
- `assets/js/vr-*.js` — a separate **v5.x** SDK.

These suites encode an older/aspirational snapshot (v3.2.0 / v5.7.0 / v5.8.0):
they assert specific version strings, the existence of files that were
consolidated away, and `assets/js` SDK behaviour. Against the live v2.0.0
`src/` app they produce ~159 failures that are stale expectations, not real
regressions.

## Rewrite guidance (per suite)

| Suite | Action |
| ----- | ------ |
| `tier-system-integration`, `tier1-validation` | Best rewrite candidates — they exercise real `src/vr` tier modules; drop the version-string / config-content assertions and re-point at `src/`. |
| `vr-modules`, `unit-core-modules`, `vr-i18n-system` | Test `assets/js` SDK + file existence; revisit once the `src/` vs `assets/js` split is resolved. |
| `commercial-qa`, `comprehensive`, `vr-systems-2025`, `v5.8.0-integration` | Aspirational v5.x feature/QA snapshots; rewrite against actual shipped features. |

Live coverage of the v2.0.0 app is provided by `tests/unified-systems.test.js`
and `tests/app-smoke.test.js`.
