import { readFile, writeFile } from 'node:fs/promises';
const source = await readFile(new URL('../python/tapo_worker.py', import.meta.url), 'utf8');
await writeFile(new URL('../src/worker-source.ts', import.meta.url),
  '// Generated from python/tapo_worker.py. Run npm run embed-worker after editing.\nexport const workerSource = ' + JSON.stringify(source) + ';\n');
