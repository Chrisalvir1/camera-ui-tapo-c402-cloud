import { test } from 'node:test';
import assert from 'node:assert/strict';
import { API_EVENT } from '@camera.ui/sdk';
import type { DeviceStorage, LoggerService, PluginAPI } from '@camera.ui/sdk';
import Plugin from '../src/index.ts';

test('v1.0.6 persisted configuration loads in v1.0.7 without mutation', async () => {
  const settings = {
    profiles: [{
      id: 'stable-device',
      name: 'Patio',
      host: 'camera.local',
      port: 8800,
      auth: 'password' as const,
      secret: 'persisted-secret',
      controlSecret: 'persisted-control-secret',
      controlPort: 443,
    }],
    telemetryEnabled: true,
    pythonPath: '/opt/camera-ui/python3',
    pollSeconds: 15,
    exposeControls: true,
  };
  const original = structuredClone(settings);
  let writes = 0;
  const storage = {
    values: settings,
    setValue: async () => { writes++; },
  } as unknown as DeviceStorage;
  const callbacks = new Map<API_EVENT, () => void>();
  const api = { on: (event: API_EVENT, callback: () => void) => { callbacks.set(event, callback); } } as unknown as PluginAPI;
  const logger = { warn: () => {} } as unknown as LoggerService;
  const plugin = new Plugin(logger, api, storage);
  try {
    const [camera] = await plugin.onDiscoverCameras();
    assert.equal(camera.id, 'stable-device');
    assert.equal(camera.name, 'Patio');
    assert.deepEqual(settings, original);
    assert.equal(writes, 0);
  } finally {
    callbacks.get(API_EVENT.SHUTDOWN)?.();
  }
});
