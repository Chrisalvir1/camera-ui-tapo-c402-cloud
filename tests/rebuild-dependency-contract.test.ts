import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('distributed Camera.UI bundle and telemetry setup pin the same PyTapo version', () => {
  const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
  const activeIndex = source('rebuild/src/index.ts');
  const activeWorker = source('rebuild/src/worker-source.ts');
  const rootWorker = source('python/tapo_worker.py');
  const requirements = source('python/requirements.txt');
  const setup = source('scripts/setup-telemetry.mjs');

  assert.match(activeIndex, /pytapo==3\.4\.32/);
  assert.match(activeIndex, /pytapo-3\.4\.32-kasa-0\.12\.0/);
  assert.match(activeIndex, /version\("pytapo"\) == "3\.4\.32"/);
  assert.match(activeWorker, /version\(\\"pytapo\\"\) != \\"3\.4\.32\\"/);
  assert.match(rootWorker, /version\("pytapo"\) != "3\.4\.32"/);
  assert.match(requirements, /^pytapo==3\.4\.32$/m);
  assert.match(setup, /version\("pytapo"\) == "3\.4\.32"/);

  for (const text of [activeIndex, activeWorker, rootWorker, requirements, setup]) {
    assert.doesNotMatch(text, /3\.4\.31/);
  }
});
