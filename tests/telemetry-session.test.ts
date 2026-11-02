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
