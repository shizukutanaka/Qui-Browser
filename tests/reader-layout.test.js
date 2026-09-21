const {
  visibleLineCount, measureEmFor, readerHitTest, fontPxFor
} = require('../src/vr/browser/readerLayout.js');

describe('readerLayout — scale/scroll arms', () => {
  test('visibleLineCount/measureEmFor/fontPxFor clamp non-positive scale to 1', () => {
    expect(visibleLineCount(0)).toBe(visibleLineCount(1));
    expect(measureEmFor(0)).toBe(measureEmFor(1));
    expect(fontPxFor('body', -1)).toBe(fontPxFor('body', 1));
  });

  test('readerHitTest hits the scroll arrow zone only when scrollable', () => {
    const { ARROW_Y0 } = require('../src/vr/browser/readerLayout.js');
    expect(readerHitTest(50, ARROW_Y0 + 5, true)).toBeTruthy();
    const r = readerHitTest(50, ARROW_Y0 + 5, false);
    expect(!r || r.kind !== 'scroll-up').toBe(true);
  });
});

describe('readerLayout — reserveBottom arm', () => {
  test('visibleLineCount shrinks when reserveBottom is set', () => {
    const open = visibleLineCount(1, false);
    const reserved = visibleLineCount(1, true);
    expect(visibleLineCount()).toBe(open); // scale defaults to 1
    expect(reserved).toBeLessThan(open);
  });
});
