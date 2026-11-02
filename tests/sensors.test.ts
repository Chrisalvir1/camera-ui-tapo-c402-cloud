import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { CameraDevice, SensorLike } from '@camera.ui/sdk';
import { CameraSensors } from '../src/sensors.ts';
import type { Reading } from '../src/telemetry.ts';

const reading = (): Reading => ({ observedAt: Date.now(), battery: { level: 100, charging: 'NOT_CHARGING', low: false },
  controls: { led: true, privacy: false, whiteLight: false }, diagnostic: {} });

test('real battery state is set before registration, preserving explicit charging capability', async () => {
  const registered: SensorLike[] = [];
  const camera = { addSensor: async (sensor: SensorLike) => { registered.push(sensor); }, removeSensor: async () => {} } as unknown as CameraDevice;
  const sensors = new CameraSensors(camera, 'stable', async () => {});
  await sensors.apply(reading());
  assert.equal(registered[0].getValue('level'), 100);
  assert.equal(registered[0].getValue('charging'), 'NOT_CHARGING');
  assert.ok(registered[0].capabilities.includes('charging'));
  assert.equal(registered[0].nativeId, 'stable:battery');
  const next = reading(); next.battery = { level: 99, charging: 'CHARGING', low: false };
  await sensors.apply(next);
  assert.equal(sensors.battery?.charging, 'CHARGING');
  assert.equal(registered.filter(s => s.type === 'battery').length, 1);
  sensors.unavailable(); assert.equal(sensors.battery?.sourceState, 'unavailable');
  await sensors.stop();
});
test('incomplete or stale telemetry never registers a fake battery', async () => {
  let count = 0;
  const camera = { addSensor: async () => { count++; }, removeSensor: async () => {} } as unknown as CameraDevice;
  const sensors = new CameraSensors(camera, 'stable', async () => {});
  const partial = reading(); partial.battery = { level: 50 }; partial.controls = {};
  await sensors.apply(partial); assert.equal(count, 0);
  const stale = reading(); stale.observedAt -= 180000;
  await sensors.apply(stale); assert.equal(count, 0);
  await sensors.stop(); await sensors.apply(reading()); assert.equal(count, 0);
});
test('poll updates do not actuate hardware; writable controls await confirmation', async () => {
  const registered: SensorLike[] = [];
  const writes: unknown[] = [];
  const camera = { addSensor: async (s: SensorLike) => { registered.push(s); }, removeSensor: async () => {} } as unknown as CameraDevice;
  const sensors = new CameraSensors(camera, 'stable', async (key, value) => { writes.push([key, value]); });
  await sensors.apply(reading()); assert.equal(writes.length, 0);
  const privacy = registered.find(s => s.nativeId === 'stable:privacy')!;
  await privacy.updateValue('on', true);
  assert.deepEqual(writes, [['privacy', true]]);
  assert.equal(privacy.getValue('on'), true);
  await sensors.stop();
});
test('failed hardware confirmation does not optimistically change the HomeKit-facing property', async () => {
  const registered: SensorLike[] = [];
  const camera = { addSensor: async (s: SensorLike) => { registered.push(s); }, removeSensor: async () => {} } as unknown as CameraDevice;
  const sensors = new CameraSensors(camera, 'stable', async () => { throw new Error('not confirmed'); });
  await sensors.apply(reading());
  const privacy = registered.find(s => s.nativeId === 'stable:privacy')!;
  await assert.rejects(Promise.resolve(privacy.updateValue('on', true)), /not confirmed/);
  assert.equal(privacy.getValue('on'), false);
  await sensors.stop();
});
