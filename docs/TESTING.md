# Testing

## Commands

```bash
npm test                 # full Jest suite
npm run test:watch       # watch mode
npm run test:coverage    # coverage + thresholds (jest.config.js)
npm run test:tier        # tier-system integration only
npm run test:integration # **/tests/*integration*.test.js
npm run test:e2e         # Playwright (requires a browser install)
npm run lint             # ESLint over src/ and server/
npm run format:check     # Prettier check
npm run verify:docs      # documentation/link verification
npm run ci:all           # lint + coverage + benchmarks
```

Current baseline on a clean checkout: **48 suites / 1156 tests passing**, ESLint
0 errors (180 `no-console` style warnings are accepted in tooling/dev paths).

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
   `multiplayer-system`, `hand-tracking`, `immersive-video`. A minimal fake Three.js
   object graph (`{ visible, parent, material: { color: { set() } } }`) is enough;
   do not pull in a real WebGL context.
3. **Wiring / integration tests** — `vr-app-wiring.test.js` binds `VRApp`'s real
   prototype methods to a hand-constructed `this`. Constructing a full `new VRApp()` is
   not possible in Node because `setupRenderer()` needs a GPU context, so the prototype
   binding pattern is deliberate. `server.test.js` exercises the Express app with
   supertest-style requests, including the Stripe-unconfigured `503` paths and the raw
   webhook body.

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

`jest.config.js` enforces a global floor (branches 20 / functions 25 / lines 25 /
statements 25). The floor is a ratchet: raise it when a subsystem gains real coverage,
never lower it to make a run pass.

## Line endings

`.gitattributes` pins the worktree to LF (`* text=auto eol=lf`). On Windows a CRLF
checkout makes ESLint's `linebreak-style` rule report tens of thousands of false errors
and can mask substring-based assertions. If you see that, re-clone or run
`git add --renormalize .`.
