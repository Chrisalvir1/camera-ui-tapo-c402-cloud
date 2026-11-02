import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
const basePython = process.argv[2] || (process.platform === 'win32' ? 'python' : 'python3');
const envPath = resolve(process.argv[3] || '.venv-tapo');
const run = (exe, args) => new Promise((done, fail) => {
  const child = spawn(exe, args, { stdio: 'inherit', shell: false, windowsHide: true });
  child.once('error', fail);
  child.once('exit', code => code === 0 ? done() : fail(new Error(`Dependency setup exited with code ${code}`)));
});
await run(basePython, ['-m', 'venv', envPath]);
const python = join(envPath, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
await run(basePython, ['-c', 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 2)']);
await run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '-r', 'python/requirements.txt']);
await run(python, ['-c', 'from importlib.metadata import version; from kasa.transports import KlapTransport, KlapTransportV2; from pytapo import Tapo; assert version("pytapo") == "3.4.30"; assert version("python-kasa") == "0.12.0"']);
console.log(`Ejecutable Python para los ajustes de Tapo C402 Cloud: ${python}`);
