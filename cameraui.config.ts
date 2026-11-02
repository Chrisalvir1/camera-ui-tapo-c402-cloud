import type { CameraUiBuildOptions } from '@camera.ui/cli';
export default {
  input: ['src/index.ts'], mode: 'production', external: [],
  additionalFiles: [{ source: 'python/requirements.txt', target: 'requirements-telemetry.txt' }],
} satisfies CameraUiBuildOptions;
