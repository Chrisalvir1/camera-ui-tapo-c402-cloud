import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicProfile, sourceUrl, validateProfile } from '../src/profiles.ts';

test('credentials survive special characters and whitespace without changing identity', () => {
  const p = validateProfile({ name: 'Patio', host: 'camera.local', secret: ' p@ss:/?#% ' }, 'stable');
  const url = new URL(sourceUrl(p));
  assert.equal(decodeURIComponent(url.username), p.secret);
  assert.equal(url.hostname, 'camera.local');
  assert.equal(p.id, 'stable');
  assert.equal(url.searchParams.get('subtype'), '0');
  assert.ok(!('secret' in publicProfile(p)));
});
test('source uses the only selector validated on the C402', () => {
  const p = validateProfile({ name: 'Patio', host: 'camera.local', secret: 'private' });
  assert.equal(new URL(sourceUrl(p)).searchParams.get('subtype'), '0');
});
test('hash credentials use admin and uppercase; IPv6 is bracketed', () => {
  const p = validateProfile({ name: 'Patio', host: '::1', auth: 'sha256', secret: 'ab'.repeat(32) });
  const url = new URL(sourceUrl(p));
  assert.equal(url.username, 'admin'); assert.equal(url.password, 'AB'.repeat(32));
  assert.equal(url.hostname, '[::1]');
});
test('reject malformed destinations and credentials without reflecting secrets', () => {
  for (const host of ['http://camera', 'camera:8800', 'user@camera', 'camera/path', 'camera\r\nHost: attacker']) {
    assert.throws(() => validateProfile({ name: 'Test', host, secret: 'private' }));
  }
  assert.throws(() => validateProfile({ name: 'Test', host: 'camera', auth: 'md5', secret: 'private' }),
    e => e instanceof Error && !e.message.includes('private'));
});
