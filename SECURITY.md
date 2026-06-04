# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 2.0.x   | ✅        |
| < 2.0   | ❌        |

## Reporting a Vulnerability

If you discover a security vulnerability in Qui Browser VR, please report it
**privately** so it can be addressed before public disclosure.

- Preferred: open a [GitHub Security Advisory](https://github.com/shizukutanaka/qui-browser/security/advisories/new)
  (Security → Advisories → "Report a vulnerability").
- Alternatively, open a regular issue **without** sensitive exploit details and
  request a private channel.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof of concept where possible).
- Affected version(s) and environment (browser, headset, OS).

### What to expect

- Acknowledgement of your report within a reasonable timeframe.
- An assessment and, where confirmed, a fix targeting the next patch release.
- Credit in the changelog/advisory unless you prefer to remain anonymous.

Please do not publicly disclose the issue until a fix has been released.

## Scope

This is a client-side WebXR application. Reports of particular interest:

- Cross-site scripting (XSS) or injection in rendered content.
- Service worker / cache poisoning.
- Insecure handling of WebRTC signaling or peer data (multiplayer features).
- Exposure of secrets in the build output.

Out of scope: vulnerabilities in third-party browsers/headsets themselves, and
issues that require a already-compromised host.
