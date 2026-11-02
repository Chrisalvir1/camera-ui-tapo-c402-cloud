import { test } from 'node:test';
import assert from 'node:assert/strict';
import { C402, auditFrameDimensions } from '../src/model.ts';
import { sourceUrl, validateProfile } from '../src/profiles.ts';

test('unexpected encoded dimensions do not rewrite C402 specification or measured frames', () => {
  const audit = auditFrameDimensions(2304, 1296);
  assert.deepEqual(audit.specified, { width: 1920, height: 1080 });
  assert.deepEqual(audit.observed, { width: 2304, height: 1296 });
  assert.equal(audit.matchesSpecification, false);
  assert.equal(audit.transcoding, false);
  assert.ok(auditFrameDimensions(1920, 1080).matchesSpecification);
  assert.throws(() => auditFrameDimensions(NaN, 1080));
  assert.equal(C402.fps, 15);
});

test('video source remains native Tapo without encoder or scale directives', () => {
  const url = new URL(sourceUrl(validateProfile({ name: 'test', host: 'camera.local', secret: 'test-only' })));
  assert.equal(url.protocol, 'tapo:');
  assert.deepEqual([...url.searchParams], [['subtype', '0']]);
  assert.equal(url.hash, '');
});
