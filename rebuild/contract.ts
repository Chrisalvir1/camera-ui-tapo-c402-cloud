import { PluginInterface, PluginRole, SensorType } from '@camera.ui/sdk';
import type { PluginContract } from '@camera.ui/sdk';

export const contract = {
  name: 'Tapo C402 Cloud',
  role: PluginRole.CameraController,
  interfaces: [PluginInterface.DiscoveryProvider],
  provides: [
    SensorType.Battery,
    SensorType.Light,
    SensorType.Switch,
    SensorType.Problem,
  ],
  consumes: [],
} satisfies PluginContract;

export default contract;
