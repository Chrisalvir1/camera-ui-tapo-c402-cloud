import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryClient } from '../src/telemetry.ts';

test('missing Python fails clearly, does not leak a credential or leave a request pending', async () => {
  const client = new TelemetryClient('/definitely-missing/python', 1000);
  await assert.rejects(client.start({ host: 'camera.local', port: 8800, controlPort: 443, secret: 'never-expose-this' }),
    error => error instanceof Error && !error.message.includes('never-expose-this'));
  await assert.rejects(client.read(), /WORKER_EXITED/);
  client.stop();
});
