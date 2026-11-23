import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CameraDevice } from '@camera.ui/sdk';
import { CameraTelemetry } from '../src/telemetry-session.ts';
import { validateProfile } from '../src/profiles.ts';
import type { Reading } from '../src/telemetry.ts';

test('stopping during initial authentication prevents late sensor registration', async () => {
  let registered = 0;
  const camera = { addSensor: async () => { registered++; }, removeSensor: async () => {} } as unknown as CameraDevice;
  let complete!: (reading: Reading) => void;
  const transport = {
    start: () => new Promise<Reading>(resolve => { complete = resolve; }),
    read: async () => { throw new Error('not used'); }, write: async () => {}, stop: () => {},
  };
  const session = new CameraTelemetry(camera, validateProfile({ name: 'Test', host: 'camera', secret: 'fixture' }),
    { python: 'unused', interval: 15, exposeControls: true }, transport);
  const started = session.start();
  const stopped = session.stop();
  complete({ observedAt: Date.now(), battery: { level: 70, charging: 'NOT_CHARGING', low: false }, controls: {}, diagnostic: {} });
  await started; await stopped;
  assert.equal(registered, 0);
});

test('initial authentication error stops rather than repeatedly trying credentials', async context => {
  context.mock.timers.enable({ apis: ['setTimeout'] });
  let starts = 0;
  const camera = { addSensor: async () => {}, removeSensor: async () => {} } as unknown as CameraDevice;
  const transport = {
    start: async () => { starts++; throw new Error('fixture sensitive upstream response'); },
    read: async () => { throw new Error('not used'); }, write: async () => {}, stop: () => {},
  };
  const session = new CameraTelemetry(camera, validateProfile({ name: 'Test', host: 'camera', secret: 'fixture' }),
    { python: 'unused', interval: 15, exposeControls: true }, transport);
  await session.start();
  context.mock.timers.tick(600000);
  assert.equal(starts, 1);
  assert.ok(!session.status.includes('sensitive'));
  await session.stop();
});

test('shipped telemetry reconnects after a previously responsive camera drops offline', async context => {
  const { CameraTelemetry: ShippedTelemetry } = await import('../rebuild/src/telemetry-session.ts');
  context.mock.timers.enable({ apis: ['setTimeout'] });
  const flush = async () => { for (let step = 0; step < 12; step++) await Promise.resolve(); };
  let starts = 0; let stops = 0; let reads = 0;
  const reading = { observedAt: Date.now(), battery: {}, controls: {}, diagnostic: {} };
  const camera = {} as CameraDevice;
  const session = new ShippedTelemetry(camera, { id: 'spot', name: 'Spot', host: 'camera', port: 8800, password: 'fixture' },
    { python: 'unused', interval: 1, exposeControls: false }, {
      start: async () => { starts++; return reading; },
      read: async () => { reads++; throw new Error('camera offline'); },
      write: async () => { throw new Error('unexpected write'); },
      stop: () => { stops++; },
    });
  try {
    await session.start();
    for (let attempt = 0; attempt < 3; attempt++) {
      context.mock.timers.tick(1000);
      await flush();
    }
    assert.equal(reads, 3);
    assert.equal(stops, 1);
    assert.equal(starts, 1);
    context.mock.timers.tick(60_000);
    await flush();
    assert.equal(starts, 2);
    assert.equal(session.status, 'conectada');
  } finally { await session.stop(); }
});
