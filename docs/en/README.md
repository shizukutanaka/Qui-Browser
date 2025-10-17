# Qui Browser Overview (English)

## Product Vision

Qui Browser is a VR-focused lightweight web experience with Chrome extension
compatibility, optimized media streaming, and subscription enforcement through
Stripe.

## Key Capabilities

- **Extension compatibility**: Install, update, and remove Chrome-compatible
  extensions through `/api/extensions`.
- **Media pipeline**: Adaptive streaming with range requests handled by
  `utils/media-pipeline.js` for smooth VR playback.
- **Subscription gating**: Stripe-backed access checks integrated in
  `server-lightweight.js`.

## Quick Start

1. Install dependencies: `npm install`.
2. Configure environment variables: copy `.env.example` to `.env` and fill
   Stripe keys.
3. Launch the lightweight server: `npm start`.
4. Open the VR browser UI on your headset or emulator.

## Directory Guide

- `server-lightweight.js`: Core HTTP server and routing logic.
- `utils/stripe-service.js`: Stripe Checkout and webhook handling.
- `extensions/manager.js`: Persistent management of installed extensions.
- `docs/`: Documentation in English and Japanese.

## Support & Feedback

Submit issues or improvement ideas via the project tracker. Align requests with
the VR-first roadmap.
