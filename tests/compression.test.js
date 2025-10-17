/**
 * 圧縮機能テスト
 *
 * Brotli/Gzip圧縮の正常動作を検証
 */

const assert = require('assert');
const { test } = require('node:test');
const {
  isCompressible,
  negotiateEncoding,
  compress,
  shouldCompress,
  compressResponse,
  COMPRESSIBLE_TYPES
} = require('../utils/compression');

test('isCompressible - text/html should be compressible', () => {
  assert.strictEqual(isCompressible('text/html'), true);
});

test('isCompressible - text/html with charset should be compressible', () => {
  assert.strictEqual(isCompressible('text/html; charset=utf-8'), true);
});

test('isCompressible - application/javascript should be compressible', () => {
  assert.strictEqual(isCompressible('application/javascript'), true);
});

test('isCompressible - application/json should be compressible', () => {
  assert.strictEqual(isCompressible('application/json'), true);
});

test('isCompressible - image/png should not be compressible', () => {
  assert.strictEqual(isCompressible('image/png'), false);
});

test('isCompressible - image/jpeg should not be compressible', () => {
  assert.strictEqual(isCompressible('image/jpeg'), false);
});

test('isCompressible - undefined should not be compressible', () => {
  assert.strictEqual(isCompressible(undefined), false);
});

test('isCompressible - null should not be compressible', () => {
  assert.strictEqual(isCompressible(null), false);
});

test('negotiateEncoding - br should be preferred', () => {
  assert.strictEqual(negotiateEncoding('gzip, br'), 'br');
});

test('negotiateEncoding - br should be preferred (reverse order)', () => {
  assert.strictEqual(negotiateEncoding('br, gzip'), 'br');
});

test('negotiateEncoding - gzip should be selected when br is not available', () => {
  assert.strictEqual(negotiateEncoding('gzip, deflate'), 'gzip');
});

test('negotiateEncoding - identity when no compression available', () => {
  assert.strictEqual(negotiateEncoding('deflate'), 'identity');
});

test('negotiateEncoding - identity when header is empty', () => {
  assert.strictEqual(negotiateEncoding(''), 'identity');
});

test('negotiateEncoding - identity when header is undefined', () => {
  assert.strictEqual(negotiateEncoding(undefined), 'identity');
});

test('compress - brotli compression should reduce size', async () => {
  const data = Buffer.from('a'.repeat(10000));
  const compressed = await compress(data, 'br');
  assert.ok(compressed.length < data.length);
});

test('compress - gzip compression should reduce size', async () => {
  const data = Buffer.from('a'.repeat(10000));
  const compressed = await compress(data, 'gzip');
  assert.ok(compressed.length < data.length);
});

test('compress - identity should return original data', async () => {
  const data = Buffer.from('test data');
  const result = await compress(data, 'identity');
  assert.deepStrictEqual(result, data);
});

test('shouldCompress - should compress large HTML', () => {
  const data = Buffer.from('a'.repeat(2000));
  const result = shouldCompress(data, 'text/html', 'gzip, br');
  assert.strictEqual(result, true);
});

test('shouldCompress - should not compress small data', () => {
  const data = Buffer.from('small');
  const result = shouldCompress(data, 'text/html', 'gzip');
  assert.strictEqual(result, false);
});

test('shouldCompress - should not compress images', () => {
  const data = Buffer.from('a'.repeat(2000));
  const result = shouldCompress(data, 'image/png', 'gzip');
  assert.strictEqual(result, false);
});

test('shouldCompress - should not compress when no encoding accepted', () => {
  const data = Buffer.from('a'.repeat(2000));
  const result = shouldCompress(data, 'text/html', '');
  assert.strictEqual(result, false);
});

test('shouldCompress - should respect custom minSize', () => {
  const data = Buffer.from('a'.repeat(500));
  const result = shouldCompress(data, 'text/html', 'gzip', { minSize: 100 });
  assert.strictEqual(result, true);
});

test('compressResponse - should compress large HTML with brotli', async () => {
  const data = Buffer.from('a'.repeat(2000));
  const result = await compressResponse(data, 'text/html', 'br, gzip');

  assert.strictEqual(result.encoding, 'br');
  assert.ok(result.data.length < data.length);
});

test('compressResponse - should compress large HTML with gzip', async () => {
  const data = Buffer.from('a'.repeat(2000));
  const result = await compressResponse(data, 'text/html', 'gzip');

  assert.strictEqual(result.encoding, 'gzip');
  assert.ok(result.data.length < data.length);
});

test('compressResponse - should not compress small data', async () => {
  const data = Buffer.from('small');
  const result = await compressResponse(data, 'text/html', 'gzip');

  assert.strictEqual(result.encoding, 'identity');
  assert.deepStrictEqual(result.data, data);
});

test('compressResponse - should not compress images', async () => {
  const data = Buffer.from('a'.repeat(2000));
  const result = await compressResponse(data, 'image/png', 'gzip');

  assert.strictEqual(result.encoding, 'identity');
  assert.deepStrictEqual(result.data, data);
});

test('compressResponse - compression ratio for repetitive data should be high', async () => {
  const data = Buffer.from('a'.repeat(10000));
  const result = await compressResponse(data, 'text/plain', 'br');

  const ratio = data.length / result.data.length;
  assert.ok(ratio > 10, `Compression ratio ${ratio} should be > 10 for repetitive data`);
});

test('COMPRESSIBLE_TYPES should include common text types', () => {
  assert.ok(COMPRESSIBLE_TYPES.has('text/html'));
  assert.ok(COMPRESSIBLE_TYPES.has('text/css'));
  assert.ok(COMPRESSIBLE_TYPES.has('application/javascript'));
  assert.ok(COMPRESSIBLE_TYPES.has('application/json'));
  assert.ok(COMPRESSIBLE_TYPES.has('image/svg+xml'));
});

console.log('✅ All compression tests completed');
