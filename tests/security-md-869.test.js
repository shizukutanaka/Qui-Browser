const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SECURITY = path.join(ROOT, 'SECURITY.md');
const SRC = path.join(ROOT, 'src');

const read = (p) => fs.readFileSync(p, 'utf8');

// SECURITY.md scopes incoming reports; a scope bullet pointing at a feature
// that does not exist sends reporters hunting a phantom attack surface.
describe('SECURITY.md report scope stays honest', () => {
  it('does not scope reports to multiplayer/WebRTC — no such implementation exists', () => {
    const src = fs
      .readdirSync(SRC, { recursive: true })
      .filter((f) => f.endsWith('.js'))
      .map((f) => read(path.join(SRC, f)))
      .join('\n');
    // Guard the premise: the doc may only drop the bullet while the app has
    // no peer/signaling code; if WebRTC is ever added, revisit the scope.
    expect(src).not.toMatch(/RTCPeerConnection|signaling/i);
    expect(read(SECURITY)).not.toMatch(/webrtc|multiplayer/i);
  });

  it('still lists a real service-worker surface (public/service-worker.js)', () => {
    expect(fs.existsSync(path.join(ROOT, 'public', 'service-worker.js'))).toBe(true);
    expect(read(SECURITY)).toMatch(/[Ss]ervice [Ww]orker/);
  });
});
