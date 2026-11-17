import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../python/tapo_worker.py', import.meta.url), 'utf8');
const generated = '// Generated from python/tapo_worker.py. Run npm run embed-worker after editing.\nexport const workerSource = ' + JSON.stringify(source) + ';\n';
await Promise.all([
  '../src/worker-source.ts',
  '../rebuild/src/worker-source.ts',
].map(path => writeFile(new URL(path, import.meta.url), generated)));
