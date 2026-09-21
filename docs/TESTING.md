# Testing

## Commands

```bash
npm test                 # full Jest suite
npm run test:watch       # watch mode
npm run test:coverage    # coverage + thresholds (jest.config.js)
npm run test:integration # **/tests/*integration*.test.js
npm run lint             # ESLint flat config (eslint.config.js)
npm run format:check     # Prettier check
npm run verify:docs      # documentation/link verification
npm run verify:all       # every verify:* — docs, prerelease, build + Chromium boot/layout/VR harnesses
npm run ci:all           # lint + format + coverage
```

Current baseline on a clean checkout: **72 suites / 3053 tests passing**, ESLint
0 errors (~380 warnings accepted in tooling/dev paths). The repo's own runtime
harnesses (`verify:app`, `verify:layout`, `verify:vr-boot` — needs `CHROME_PATH`
on non-Linux hosts) all pass on the built bundle in real Chromium: the landing
shell boots clean, no text surface overflows, and the full VRApp — including the
default-ON browsing systems — constructs without exceptions under a stubbed
WebXR runtime (`npm run ci:verify`).

`server/` (the Express + Stripe scaffolding) was deleted; `proxy/` (the optional
reader proxy with SSRF guard) is exercised by `proxy-server.test.js` and
`ssrf-guard.test.js` instead.

## Layout

All specs live in `tests/*.test.js` and run under `testEnvironment: 'node'` with Babel
transforming ESM `src/` modules (`tests/babel-plugin-import-meta.cjs` shims
`import.meta`). `tests/setup.js` installs the shared globals.

Three tiers of test:

1. **Pure-logic tests** — `curved-geometry`, `readable-text`, `bookmark-layout`,
   `url-resolver`, `keyboard-layout`, `text-wrap`, `settings-stepper`, `debounce`.
   No mocks, fastest, highest value per line.
2. **Subsystem tests with hand-built doubles** — `gaze-interaction`, `caption-system`,
   `haptic-feedback`, `spatial-audio`, `tab-manager`, `bookmark-panel`,
   `hand-tracking`, `immersive-video`, `dev-tools`. A minimal fake Three.js
   object graph (`{ visible, parent, material: { color: { set() } } }`) is enough;
   do not pull in a real WebGL context.
3. **Wiring / integration tests** — `vr-app-wiring.test.js` binds `VRApp`'s real
   prototype methods to a hand-constructed `this`. Constructing a full `new VRApp()` is
   not possible in Node because `setupRenderer()` needs a GPU context, so the prototype
   binding pattern is deliberate.

## Conventions

- **No network, no GPU, no timers left running.** Use fake timers for dwell/caption
  aging and always `dispose()` subsystems in teardown.
- **Assert behaviour, not source text.** Never assert on exact source strings,
  indentation, or comments — those break on formatting changes without a real defect.
- **Locale-aware assertions.** i18n specs must check catalog *keys* resolve in both
  `en` and `ja` rather than hard-coding one language's output.
- **Accessibility specs are first-class.** A new interactive element needs a test that
  its hover fires a caption and its activation fires haptic + caption
  (`cross-modal-notify.test.js` is the reference).

## Coverage policy

`jest.config.js` enforces a global floor (branches 95 / functions 96 / lines 97 /
statements 96 — measured baseline is ~98% lines). The floor is a ratchet: raise it when
a subsystem gains real coverage, never lower it to make a run pass.

## Line endings

`.gitattributes` pins the worktree to LF (`* text=auto eol=lf`). On Windows a CRLF
checkout makes ESLint's `linebreak-style` rule report tens of thousands of false errors
and can mask substring-based assertions. If you see that, re-clone or run
`git add --renormalize .`.
