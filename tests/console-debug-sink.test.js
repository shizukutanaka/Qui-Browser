// Regression: unsilenced console.debug from src/ (one per voice-command
// registration) made the CI Unit Tests job time out. tests/setup.js must
// sink it so Jest neither prints nor buffers those calls.
describe('test-env console.debug sink', () => {
  test('console.debug reaches neither Jest output streams nor its buffer', () => {
    const streams = [console._stdout, console._stderr, process.stdout, process.stderr].filter(Boolean);
    const originals = streams.map((s) => s.write);
    const writes = [];
    streams.forEach((s) => {
      s.write = (chunk) => {
        writes.push(String(chunk));
        return true;
      };
    });
    const bufLen = () => (typeof console.getBuffer === 'function' ? (console.getBuffer() || []).length : 0);
    const before = bufLen();
    try {
      console.debug('debug-sink-probe');
    } finally {
      streams.forEach((s, i) => {
        s.write = originals[i];
      });
    }
    expect(writes.filter((w) => w.includes('debug-sink-probe'))).toEqual([]);
    expect(bufLen()).toBe(before);
  });

  test('jest.spyOn(console, "debug") still observes calls', () => {
    const spy = jest.spyOn(console, 'debug');
    console.debug('probe', 1);
    expect(spy).toHaveBeenCalledWith('probe', 1);
    spy.mockRestore();
  });
});
