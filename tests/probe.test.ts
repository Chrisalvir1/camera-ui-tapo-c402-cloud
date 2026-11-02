import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { probeService } from '../src/probe.ts';

test('accepts a fragmented Digest challenge without sending credentials', async () => {
  let request = '';
  const server = createServer(socket => socket.on('data', chunk => {
    request += chunk.toString();
    socket.write('HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: ');
    setTimeout(() => socket.end('Digest realm="camera"\r\nContent-Length: 0\r\n\r\n'), 5);
  }));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    await probeService({ host: '127.0.0.1', port: address.port });
    assert.ok(!/Authorization:/i.test(request));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('rejects a normal HTTP service instead of claiming a camera works', async () => {
  const server = createServer(socket => socket.once('data', () => socket.end('HTTP/1.1 200 OK\r\nContent-Length: 0\r\n\r\n')));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address !== 'string');
    await assert.rejects(probeService({ host: '127.0.0.1', port: address.port }), /servicio Tapo esperado/);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
