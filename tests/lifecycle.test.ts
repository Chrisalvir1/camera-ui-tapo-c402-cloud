import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_EVENT } from '@camera.ui/sdk';
import type { CameraDevice, DeviceStorage, JsonSchema, LoggerService, PluginAPI } from '@camera.ui/sdk';
import Plugin from '../src/index.ts';
import { validateProfile } from '../src/profiles.ts';

function setup() {
  const profile = validateProfile({ name: 'Patio', host: 'camera.local', secret: 'test-only' }, 'stable-device');
  const settings = { profiles: [profile], telemetryEnabled: false };
  const storage = { values: settings, setValue: async (key: string, value: unknown) => {
    Object.assign(settings, { [key]: value });
  } } as unknown as DeviceStorage;
  const callbacks = new Map<API_EVENT, () => void>();
  const api = { on: (event: API_EVENT, callback: () => void) => { callbacks.set(event, callback); } } as unknown as PluginAPI;
  const logger = { warn: () => {} } as unknown as LoggerService;
  const plugin = new Plugin(logger, api, storage);
  const shutdown = () => callbacks.get(API_EVENT.SHUTDOWN)?.();
  return { profile, plugin, settings, shutdown };
}
async function submit(plugin: Plugin, key: string, values: Record<string, unknown>) {
  const field: JsonSchema | undefined = plugin.storageSchema.find(s => s.key === key);
  assert.ok(field?.type === 'submit'); return field.onClick!(values);
}
test('adoption enables continuous 1080p and contains no credential in persisted source', async () => {
  const { plugin, shutdown } = setup();
  try {
    const [discovered] = await plugin.onDiscoverCameras();
    const config = await plugin.onAdoptCamera(discovered);
    assert.equal(config.nativeId, 'stable-device'); assert.equal(config.isCloud, false);
    assert.equal(config.info?.power, 'mains');
    assert.equal(config.sources[0].hotMode, true);
    assert.equal(config.sources[0].muted, false);
    assert.equal(config.sources[0].backchannelDisabled, true);
    assert.ok(!JSON.stringify(config).includes('test-only'));
  } finally { shutdown(); }
});
test('release during probe prevents late connect and invalidates dynamic source handler', async () => {
  const { plugin, shutdown } = setup();
  let resolveProbe!: (value: unknown) => void;
  let implementation: { streamUrl: (id: string) => Promise<string> } | undefined;
  let connected = 0;
  const camera = {
    id: 'host-camera', nativeId: 'stable-device', sources: [{ _id: 'main' }],
    streamSource: { probeStream: () => new Promise(resolve => { resolveProbe = resolve; }) },
    implement: async (value: typeof implementation) => { implementation = value; },
    connect: async () => { connected++; }, disconnect: async () => {},
  } as unknown as CameraDevice;
  try {
    await plugin.onCameraAdded(camera);
    assert.match(await implementation!.streamUrl('main'), /^tapo:/);
    await assert.rejects(implementation!.streamUrl('other'), /desconocida/);
    await plugin.onCameraReleased(camera.id);
    resolveProbe({ video: [{}], audio: [] });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(connected, 0);
    await assert.rejects(implementation!.streamUrl('main'), /desasignada/);
  } finally { shutdown(); }
});
test('editing retains stable identity and secret; deletion requires explicit confirmation', async () => {
  const { plugin, settings, shutdown } = setup();
  try {
    await submit(plugin, 'saveCamera', { profileId: 'stable-device', name: 'Nuevo', host: 'new-camera.local', secret: '' });
    assert.equal(settings.profiles[0].id, 'stable-device');
    assert.equal(settings.profiles[0].secret, 'test-only');
    await submit(plugin, 'removeCamera', { profileId: 'stable-device' });
    assert.equal(settings.profiles.length, 1);
    await submit(plugin, 'removeCamera', { profileId: 'stable-device', confirmRemove: true });
    assert.equal(settings.profiles.length, 0);
  } finally { shutdown(); }
});
