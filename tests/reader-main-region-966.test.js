/**
 * Invariants for the role="main" content-region candidate in
 * readableText.mainRegion — the third narrowing path after <article>/<main>.
 *
 * Defect class: the candidate's close-tag was a free `</[a-z]+>` instead of a
 * backreference to the opening element, so the lazily-captured region ended at
 * the FIRST inner closing tag. For pages that mark their main column with
 * `<div role="main">` (the common ARIA pattern), the captured fragment held an
 * *unclosed* first element — which either yielded zero reader blocks (the
 * block extractor needs a complete open/close pair) or silently dropped every
 * element after the first. A page using the accessibility-correct landmark
 * got an *empty* reader view.
 */

const { extractReadableText } = require('../src/vr/browser/readableText.js');

const para = (ch, n = 300) => `<p>${ch.repeat(n)}</p>`;

describe('role="main" region extraction', () => {
  test('a role="main" container yields ALL its inner prose, not zero blocks', () => {
    const html = `<html><body><div role="main">${para('a')}${para('b')}${para('c')}</div><aside>nav</aside></body></html>`;
    const { blocks } = extractReadableText(html);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].text).toContain('a'.repeat(300));
    expect(blocks[1].text).toContain('b'.repeat(300));
    expect(blocks[2].text).toContain('c'.repeat(300));
  });

  test('role="main" on non-div elements (section, figure) still narrows', () => {
    const html = `<div id="sidebar">x</div><section role="main"><p>${'s'.repeat(400)}</p></section>`;
    const { blocks } = extractReadableText(html);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('s'.repeat(400));
  });

  test('single-quoted role attribute is honoured', () => {
    const html = `<div role='main'><p>${'q'.repeat(400)}</p><h2>head</h2></div>`;
    const { blocks } = extractReadableText(html);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });

  test('a short role="main" region still falls back to the whole document', () => {
    const html = `<div role="main"><p>tiny</p></div><p>${'z'.repeat(400)}</p>`;
    const { blocks } = extractReadableText(html);
    expect(blocks.some((b) => b.text === 'z'.repeat(400))).toBe(true);
  });

  test('<article> and <main> narrowing is unchanged (regression pin)', () => {
    const html = `<article>${para('a')}${para('b')}</article>`;
    expect(extractReadableText(html).blocks).toHaveLength(2);
    const html2 = `<main>${para('x')}${para('y')}</main>`;
    expect(extractReadableText(html2).blocks).toHaveLength(2);
  });
});
