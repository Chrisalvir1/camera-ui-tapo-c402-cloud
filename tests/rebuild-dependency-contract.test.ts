import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('distributed Camera.UI bundle and telemetry setup pin the same PyTapo version', () => {
  const activeIndex = readFileSync(new URL('../rebuild/src/index.ts', import.meta.url), 'utf8');
  const activeWorker = readFileSync(new URL('../rebuild/src/worker-source.ts', import.meta.url), 'utf8');
  const rootWorker = readFileSync(new URL('../python/tapo_worker.py', import.meta.url), 'utf8');
  const requirements = readFileSync(new URL('../python/requirements.txt', import.meta.url), 'utf8');
  const setup = readFileSync(new URL('../scripts/setup-telemetry.mjs', import.meta.url), 'utf8');

  assert.match(activeIndex, /pytapo==3\.4\.32/);
  assert.match(activeIndex, /pytapo-3\.4\.32-kasa-0\.12\.0/);
  assert.match(activeIndex, /version\("pytapo"\) == "3\.4\.32"/);
  assert.match(activeWorker, /version\(\\"pytapo\\"\) != \\"3\.4\.32\\"/);
  assert.match(rootWorker, /version\("pytapo"\) != "3\.4\.32"/);
  assert.match(requirements, /^pytapo==3\.4\.32$/m);
  assert.match(setup, /version\("pytapo"\) == "3\.4\.32"/);

  for (const source of [activeIndex, activeWorker, rootWorker, requirements, setup]) {
    assert.doesNotMatch(source, /3\.4\.31/);
  }
});
