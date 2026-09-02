# Reader proxy (optional companion)

The VR reader can fetch pages itself **only from origins that send
`Access-Control-Allow-Origin`**. That was measured, not assumed:

| site | ACAO on the HTML document |
|---|---|
| `en.wikipedia.org/wiki/WebXR` | none |
| `developer.mozilla.org/…` | none |
| `example.com` | none |
| `www.nhk.or.jp` | none |

**4 of 4 send none.** So without a proxy the reader reaches only CORS-enabled
origins; for anything else the viewport explains the cause and points here.
(Browsing itself is enabled by default as of Session 74 — the failure state is
honest guidance, not a dead end.)

There are two ways to close that gap.

## 1. A deployment that carries its own proxy (no setup at all)

The app **finds a same-origin proxy by itself**: at startup it probes
`<base>api/reader/health`, and if that answers it routes reader fetches through
it. Nothing to configure, nothing to type.

That detection is **platform-neutral** — it looks for a path, not a host. Any
deployment that answers these two routes works:

| route | behaviour |
|---|---|
| `GET <base>api/reader/health` | `200 {"ok":true}` |
| `GET <base>api/reader/fetch?url=<encoded>` | the page's markup as `text/plain`, or `400 {"error": reason}` |

Two ways to provide them:

- **Netlify**: `netlify/functions/reader.mjs` is already wired to `/api/reader`
  by `netlify.toml`, so a deploy ships with one and nothing else is needed.
- **Anywhere else** (Vercel, Cloudflare, your own box, a container): run
  `proxy/server.js` and reverse-proxy `/api/reader/*` to it — it serves
  `/fetch` and `/health` at its root, which is the same contract with the
  prefix stripped. Or set the proxy URL by hand, below.

A proxy URL you typed always wins over the detected one — including when you
deliberately cleared it — and the detection is never persisted, because it
describes the deployment rather than a preference.

On a static host such as GitHub Pages the probe 404s and nothing changes: the
reader falls back to direct fetch exactly as before. If you do not want your
deployment to carry an outbound fetch surface, delete the file; the app works
without it.

## 2. `proxy/server.js`, run yourself

The standalone server is **not bundled into the app**, on purpose:

- GitHub Pages, one of this repo's deploy targets, is static and cannot run it —
  bundling it would imply a capability that deployment does not have
- it is an outbound network surface, and nobody should get one they did not ask for

Run it yourself and the reader reads the real web. Don't, and nothing changes.

## Running it

```bash
node proxy/server.js                 # 127.0.0.1:8080
PORT=9000 ALLOW_ORIGIN=https://your-app.example node proxy/server.js
```

Zero dependencies — Node's own `http`/`https`/`dns`.

Endpoints:

| | |
|---|---|
| `GET /fetch?url=<encoded>` | returns the page's markup as `text/plain`, or `400 {"error": reason}` |
| `GET /health` | `200 {"ok":true}` |

## Pointing the app at it

In VR: **Settings → Browsing → Reader Proxy**, then type the proxy's base URL
on the VR keyboard (e.g. `http://192.168.x.x:8080` for a proxy on your LAN
machine) and confirm. Empty input clears it. The value is validated (http/https
only, no credentials), persisted, and applied to every open tab immediately —
no reload, no taking the headset off.

`readerFetchUrl(target, proxyUrl)` (in `src/vr/browser/urlDisplay.js`) is the
single place that decides; with no proxy set it returns the target unchanged, so
the no-proxy path is byte-identical to the previous behaviour.

Note for Quest: the headset and the proxy machine must be on the same network,
and the page is HTTPS while a LAN proxy is usually HTTP — browsers may block
that as mixed content unless the proxy is served over HTTPS or via localhost
ADB forwarding (`adb reverse tcp:8080 tcp:8080`, then `http://127.0.0.1:8080`
works from the headset itself).

## Security

A fetch proxy is a confused-deputy risk: it turns a user-supplied string into an
outbound request from a machine the user does not control. Every access decision
lives in `proxy/ssrfGuard.js`, kept pure so it can be tested exhaustively
without opening a socket (`tests/ssrf-guard.test.js`, 51 tests). The Netlify
function imports the same `fetchThroughGuard` verbatim rather than
reimplementing it — a second copy of SSRF logic is a second thing to get wrong.

Defences, in order:

1. **Scheme allowlist** — `http:`/`https:` only, so `file:`, `gopher:` and
   `data:` never reach a socket.
2. **No credentials in the URL** — `https://user:pass@host` also disguises which
   host is really contacted.
3. **Port allowlist** — 80 / 443 / 8080 / 8443. An internal service on 6379 is
   not a web page.
4. **Literal-IP rejection** — loopback, `10/8`, `172.16/12`, `192.168/16`,
   CGNAT `100.64/10`, link-local `169.254/16` (cloud metadata), `0/8`,
   benchmark `198.18/15`, reserved `240/4`; IPv6 loopback, unique-local,
   link-local, and IPv4-mapped forms such as `::ffff:127.0.0.1`.
5. **Post-DNS re-check** — the hostname is resolved and **every** returned
   address is re-checked. This is the defence that actually matters:
   `evil.example.com` is an ordinary public name that may carry an A record of
   `127.0.0.1`. Checking the URL string alone does not stop it.
6. **Redirects re-checked at every hop** — a public URL is free to redirect to
   `http://169.254.169.254/`, and a client that follows redirects automatically
   would take it. Max 3 hops.
7. **Response limits** — `text/html`, `application/xhtml+xml` or `text/plain`
   only (so it is not a general file relay), 5 MB cap, 10 s timeout, `GET` only.
8. **No credential forwarding** — cookies, `authorization` and
   `x-forwarded-*` are dropped; only a self-identifying UA, `accept`, and a
   length-bounded `accept-language` go upstream.

### Verified, not just asserted

With a "secret" service listening on **8080 — an allowed port**, so the host
check is the only thing standing in the way:

```
REFUSED  loopback IP  :8080  -> 400 {"error":"host-blocked:loopback"}
REFUSED  localhost    :8080  -> 400 {"error":"host-blocked:localhost"}
REFUSED  v4-mapped v6 :8080  -> 400 {"error":"dns-failed"}
REFUSED  0.0.0.0      :8080  -> 400 {"error":"host-blocked:this-network"}

control: direct fetch of the victim = 200 "<h1>INTERNAL SECRET</h1>"
```

The control line matters: the victim really was reachable, so the refusals mean
something.

## What it does not do

- **No authentication.** Anyone who can reach the proxy can fetch through it.
  Bind it to loopback, or put it behind your own auth, before exposing it.
- **No rate limiting.** Add one if it is reachable by anyone but you.
- **No caching.** Every request goes upstream.
- **It does not make this a web browser.** It fetches markup for the reader to
  extract text from. A WebXR web app still cannot composite a live cross-origin
  page into a 3D texture — see `docs/OUTSTANDING_ISSUES.md` F-1.
