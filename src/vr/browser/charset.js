/**
 * Charset sniffing and decoding for fetched markup.
 *
 * Why this exists: `Response.text()` decodes as UTF-8 unconditionally — the
 * WHATWG Fetch spec ignores both the Content-Type charset parameter and any
 * `<meta charset>` in the document. For a browser whose banner feature is
 * Japanese, that is disqualifying: Shift_JIS and EUC-JP pages are still common
 * in Japan (long-lived corporate sites, board-era pages, older government
 * pages), and every one of them rendered as mojibake in the reader — not an
 * honest "cannot be shown", but garbage text presented as the article.
 *
 * Pure and dependency-free; runs in the browser and in Node (the companion
 * proxy imports it), since `TextDecoder` with the legacy Japanese encodings is
 * required by the Encoding Standard and present in both (measured: shift_jis,
 * euc-jp and iso-2022-jp all construct in this repo's Node and in Chromium).
 *
 * Precedence follows the Encoding Standard's sniffing conventions:
 *   1. a byte-order mark wins over everything
 *   2. the transport header's `charset=` parameter
 *   3. a `<meta charset>` / `<meta http-equiv=content-type>` within the first
 *      1024 bytes (scanned as ASCII, which every declarable label is)
 *   4. utf-8
 */

/** How far into the document a meta declaration is honoured, per the spec. */
const META_SCAN_BYTES = 1024;

/** charset=… inside a content-type value (header or http-equiv content). */
const CHARSET_PARAM = /charset\s*=\s*"?'?\s*([\w!#$%&+.^`|~-]+)/i;

/**
 * Decide the encoding label for a fetched document.
 *
 * @param {string} [contentType] the Content-Type header value, if any
 * @param {Uint8Array} [bytes] the raw document bytes
 * @returns {string} an encoding label for TextDecoder (never empty)
 */
export function sniffCharset(contentType, bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);

  // 1. BOM — authoritative, whatever anything else claims.
  if (b.length >= 3 && b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) {
    return 'utf-8';
  }
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xfe) {
    return 'utf-16le';
  }
  if (b.length >= 2 && b[0] === 0xfe && b[1] === 0xff) {
    return 'utf-16be';
  }

  // 2. Transport header.
  if (typeof contentType === 'string') {
    const m = CHARSET_PARAM.exec(contentType);
    if (m) {
      return m[1].toLowerCase();
    }
  }

  // 3. Meta declaration in the prefix. Scanning as latin1 is safe: labels and
  // the surrounding markup are ASCII, and multibyte lead bytes cannot fake the
  // ASCII sequences we look for.
  let head = '';
  const n = Math.min(b.length, META_SCAN_BYTES);
  for (let i = 0; i < n; i++) {
    head += String.fromCharCode(b[i]);
  }
  const metaCharset = /<meta[^>]+charset\s*=\s*["']?\s*([\w!#$%&+.^`|~-]+)/i.exec(head);
  if (metaCharset) {
    return metaCharset[1].toLowerCase();
  }

  // 4. The modern default.
  return 'utf-8';
}

/**
 * Decode fetched markup bytes honouring the declared charset.
 *
 * Unknown or misdeclared labels fall back to UTF-8 — worst case is the
 * mojibake we always had, never a throw that turns a readable page into an
 * error screen.
 *
 * @param {Uint8Array} bytes
 * @param {string} [contentType]
 * @returns {string}
 */
export function decodeMarkup(bytes, contentType) {
  const b = bytes instanceof Uint8Array
    ? bytes
    : new Uint8Array(bytes || 0);
  const label = sniffCharset(contentType, b);
  try {
    return new TextDecoder(label).decode(b);
  } catch {
    return new TextDecoder('utf-8').decode(b);
  }
}
