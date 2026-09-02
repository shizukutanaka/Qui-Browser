/**
 * Charset sniffing for fetched markup.
 *
 * Response.text() decodes as UTF-8 unconditionally, so every Shift_JIS or
 * EUC-JP page — still common in Japan — rendered as mojibake in the reader of
 * a browser whose banner feature is Japanese. These tests pin the sniffing
 * precedence (BOM > header > meta > utf-8) and the decode itself.
 *
 * The legacy-encoding fixtures are hand-written byte arrays, so each one is
 * first verified against TextDecoder itself — the fixture cannot silently be
 * wrong about what it encodes.
 */

const { sniffCharset, decodeMarkup } = require('../src/vr/browser/charset.js');

// こんにちは in Shift_JIS.
const SJIS_KONNICHIWA = Uint8Array.from([0x82, 0xb1, 0x82, 0xf1, 0x82, 0xc9, 0x82, 0xbf, 0x82, 0xcd]);
// 日本語 in EUC-JP.
const EUC_NIHONGO = Uint8Array.from([0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec]);

const ascii = (s) => new TextEncoder().encode(s);
const concat = (...parts) => {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

describe('the fixtures themselves', () => {
  test('the Shift_JIS bytes really decode to こんにちは', () => {
    expect(new TextDecoder('shift_jis').decode(SJIS_KONNICHIWA)).toBe('こんにちは');
  });
  test('the EUC-JP bytes really decode to 日本語', () => {
    expect(new TextDecoder('euc-jp').decode(EUC_NIHONGO)).toBe('日本語');
  });
  test('and both are mojibake when forced through UTF-8 — the defect being fixed', () => {
    expect(new TextDecoder('utf-8').decode(SJIS_KONNICHIWA)).not.toBe('こんにちは');
    expect(new TextDecoder('utf-8').decode(EUC_NIHONGO)).not.toBe('日本語');
  });
});

describe('sniffCharset precedence', () => {
  test('a UTF-8 BOM beats a header claiming otherwise', () => {
    const bytes = concat(Uint8Array.from([0xef, 0xbb, 0xbf]), ascii('<html>'));
    expect(sniffCharset('text/html; charset=shift_jis', bytes)).toBe('utf-8');
  });

  test('UTF-16 BOMs are recognised', () => {
    expect(sniffCharset('', Uint8Array.from([0xff, 0xfe, 0x41, 0x00]))).toBe('utf-16le');
    expect(sniffCharset('', Uint8Array.from([0xfe, 0xff, 0x00, 0x41]))).toBe('utf-16be');
  });

  test('the header charset parameter is honoured, case-insensitively', () => {
    expect(sniffCharset('text/html; charset=Shift_JIS', ascii('<html>'))).toBe('shift_jis');
    expect(sniffCharset('text/html;charset="EUC-JP"', ascii('<html>'))).toBe('euc-jp');
  });

  test('a <meta charset> is used when the header has no charset', () => {
    expect(sniffCharset('text/html', ascii('<html><head><meta charset="shift_jis"></head>')))
      .toBe('shift_jis');
    expect(sniffCharset(undefined, ascii('<meta charset=euc-jp>'))).toBe('euc-jp');
  });

  test('the http-equiv form works too', () => {
    const head = ascii('<meta http-equiv="Content-Type" content="text/html; charset=shift_jis">');
    expect(sniffCharset('', head)).toBe('shift_jis');
  });

  test('the header wins over a conflicting meta', () => {
    const head = ascii('<meta charset="euc-jp">');
    expect(sniffCharset('text/html; charset=shift_jis', head)).toBe('shift_jis');
  });

  test('a meta beyond the first 1024 bytes is ignored, per the sniffing limit', () => {
    const far = concat(ascii('<html>' + ' '.repeat(1100)), ascii('<meta charset="shift_jis">'));
    expect(sniffCharset('', far)).toBe('utf-8');
  });

  test('nothing declared means utf-8, and degenerate input does not throw', () => {
    expect(sniffCharset('', ascii('<html></html>'))).toBe('utf-8');
    expect(sniffCharset(undefined, undefined)).toBe('utf-8');
    expect(sniffCharset(null, new Uint8Array(0))).toBe('utf-8');
  });
});

describe('decodeMarkup', () => {
  test('decodes Shift_JIS declared in the header', () => {
    expect(decodeMarkup(SJIS_KONNICHIWA, 'text/html; charset=shift_jis')).toBe('こんにちは');
  });

  test('decodes EUC-JP declared only in a meta tag', () => {
    const page = concat(ascii('<html><head><meta charset="euc-jp"></head><body><p>'), EUC_NIHONGO);
    expect(decodeMarkup(page, 'text/html')).toContain('日本語');
  });

  test('an unknown label falls back to utf-8 instead of throwing', () => {
    const bytes = ascii('plain ascii page');
    expect(decodeMarkup(bytes, 'text/html; charset=not-a-real-charset')).toBe('plain ascii page');
  });

  test('utf-8 content is byte-identical to the old behaviour', () => {
    const page = ascii('<p>ふつうの UTF-8 ページ</p>');
    expect(decodeMarkup(page, 'text/html; charset=utf-8')).toBe('<p>ふつうの UTF-8 ページ</p>');
    expect(decodeMarkup(page, '')).toBe('<p>ふつうの UTF-8 ページ</p>');
  });
});
