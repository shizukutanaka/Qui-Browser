# Competitive Advantage — Qui Browser

## What this product is not

Qui is not a browser and does not compete with Quest Browser or Wolvic.
A WebXR web app cannot composite cross-origin page pixels into a 3D
texture (X-Frame-Options / CSP frame-ancestors), so pixel-perfect page
rendering is a platform ceiling, not a roadmap item. Native browsers
sit below that ceiling because they own an engine; Qui sits above the
host browser and reads.

## Where the money is in VR browsing

No one pays for a VR browser itself. Quest Browser is a loss leader
funded by hardware and the 30% store cut. Wolvic survives on OEM
patronage (Futurewei, Lynx) and Igalia's own multi-year funding.
Mozilla exited the category entirely (Firefox Reality, 2022).
Every competitor is subsidised by someone whose business is elsewhere.

## The structural advantage

1. The host browser is the distribution channel. Qui is a URL opened
   inside Quest Browser itself: no store review, no APK, no install,
   no platform permission. A platform vendor cannot ship a replacement
   shell on top of its own browser; Qui can, because it has no
   platform to protect.
2. No data, no servers. The creator holds no personal data and runs
   no infrastructure. The optional fetch proxy is self-hosted by the
   user. There is no operating cost to recover, so there is no user
   segment too small to serve.
3. The underserved are the product. Platform browsers optimise for
   the median content-buying user. Accessibility (cross-modal
   captions + haptics + toasts, gaze dwell, comfort system) and
   Japanese IME are enforced by tests here, because the users they
   serve are the ones the subsidy model structurally deprioritises.

## What we optimise instead of browser parity

Reading comfort and first success inside the headset: fetch, extract,
present — with an honest explanation whenever a page cannot be read
and what fixes it.
