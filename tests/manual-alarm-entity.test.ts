import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CameraDevice, SensorLike } from '@camera.ui/sdk';
import { CameraSensors } from '../rebuild/src/sensors.ts';
import { CameraTelemetry } from '../rebuild/src/telemetry-session.ts';
import { parseProfiles } from '../rebuild/src/profile.ts';
import type { ControlKey, Reading } from '../rebuild/src/telemetry.ts';

test('manual C402 alarm is an independent MQTT-compatible switch and leaves detection disarmed', async () => {
  const registered: SensorLike[] = [];
  const writes: Array<[ControlKey, boolean]> = [];
  const camera = {
    addSensor: async (sensor: SensorLike) => { registered.push(sensor); },
    removeSensor: async () => {},
  } as unknown as CameraDevice;
  const sensors = new CameraSensors(camera, 'c402-profile', async (key, value) => {
    writes.push([key, value]);
    return { control: key, value, ...(key === 'manualAlarm' && value ? { durationSeconds: 30 } : {}) };
  });
  const reading: Reading = {
    observedAt: Date.now(),
    battery: {},
    controls: { alarmArmed: false, alarmLight: true, alarmSound: false, manualAlarm: false },
    diagnostic: {},
  };

  await sensors.apply(reading, false, true);
  const manual = registered.find(sensor => sensor.nativeId === 'c402-profile:manualAlarm');
  assert.ok(manual);
  assert.equal(manual.type, 'switch');
  assert.equal(manual.name, 'Alarma manual sin detección');
  assert.equal(manual.getValue('on'), false);

  await manual.updateValue('on', true);
  assert.equal(manual.getValue('on'), true);
  assert.equal(registered.find(sensor => sensor.nativeId === 'c402-profile:alarmArmed')?.getValue('on'), false);
  await manual.updateValue('on', false);
  assert.deepEqual(writes, [['manualAlarm', true], ['manualAlarm', false]]);
  assert.equal(manual.getValue('on'), false);
  await sensors.stop();
});

test('assigned C120 can expose supported alarm controls without exposing unrelated switches', async () => {
  const registered: SensorLike[] = [];
  const camera = {
    addSensor: async (sensor: SensorLike) => { registered.push(sensor); },
    removeSensor: async () => {},
  } as unknown as CameraDevice;
  const reading: Reading = {
    observedAt: Date.now(),
    battery: { level: 80, charging: 'NOT_CHARGING', low: false },
    controls: { whiteLight: false, led: true, alarmArmed: false, alarmLight: true, alarmSound: false, manualAlarm: false },
    diagnostic: {},
  };
  const transport = {
    start: async () => reading,
    read: async () => reading,
    write: async (key: ControlKey, value: boolean) => ({ control: key, value }),
    stop: () => {},
  };
  const profile = parseProfiles([{ name: 'Tapo C120', host: 'camera', password: 'fixture' }])[0]!;
  const telemetry = new CameraTelemetry(camera, profile,
    { python: 'unused', interval: 15, exposeControls: false, exposeAlarm: true, lightOnly: true }, transport);

  await telemetry.start();
  assert.ok(registered.some(sensor => sensor.nativeId === `${profile.id}:manualAlarm`));
  assert.ok(registered.some(sensor => sensor.nativeId === `${profile.id}:whiteLight`));
  assert.ok(!registered.some(sensor => sensor.nativeId === `${profile.id}:led`));
  assert.ok(!registered.some(sensor => sensor.type === 'battery'));
  await telemetry.stop();
});
