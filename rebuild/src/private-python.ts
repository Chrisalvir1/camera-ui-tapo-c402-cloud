import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const release = '20261110';
const version = '3.11.18';
const macRuntimes = {
  arm64: { target: 'aarch64', sha256: '3afb0567b2a2b30b3a7341bd143cb4e8a69f3d8e95d4641218eaa45f0fabbd07' },
  x64: { target: 'x86_64', sha256: 'c2e4b51e535ead2e526b8974909a1b1e00fbc2ebe2281087b9b8b14dad0cad5d' },
};
const installs = new Map<string, Promise<string>>();

export async function privateMacPython(storagePath: string): Promise<string> {
  if (process.platform !== 'darwin' || (process.arch !== 'arm64' && process.arch !== 'x64')) {
    throw new Error('Configura un Python 3.11 o posterior con pip para los sensores Tapo.');
  }
  let installation = installs.get(storagePath);
  if (!installation) {
    installation = install(storagePath, process.arch);
    installs.set(storagePath, installation);
    void installation.catch(() => installs.delete(storagePath));
  }
  return await installation;
}

async function install(storagePath: string, arch: keyof typeof macRuntimes): Promise<string> {
  const runtime = macRuntimes[arch];
  const directory = join(storagePath, `python-${version}-${arch}`);
  const binary = join(directory, 'bin', 'python3');
  const usable = (candidate: string) =>
    spawnSync(candidate, ['-I', '-m', 'pip', '--version'], { timeout: 8000 }).status === 0;
  if (usable(binary)) return binary;

  await mkdir(storagePath, { recursive: true, mode: 0o700 });
  const stage = await mkdtemp(join(storagePath, '.python-'));
  try {
    const name = `cpython-${version}+${release}-${runtime.target}-apple-darwin-install_only_stripped.tar.gz`;
    const url = `https://github.com/astral-sh/python-build-standalone/releases/download/${release}/${name}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(55_000) });
    if (!response.ok) throw new Error(`No se pudo descargar el Python privado (HTTP ${response.status}).`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== runtime.sha256) {
      throw new Error('La descarga de Python no pasó la verificación de integridad.');
    }
    const archive = join(stage, 'runtime.tar.gz');
    await writeFile(archive, bytes, { mode: 0o600 });
    const extract = spawnSync('/usr/bin/tar', ['-xzf', archive, '-C', stage], { timeout: 25000 });
    if (extract.status !== 0 || !usable(join(stage, 'python', 'bin', 'python3'))) {
      throw new Error('El Python privado no pudo ejecutar pip.');
    }
    await rm(directory, { recursive: true, force: true });
    await rename(join(stage, 'python'), directory);
    return binary;
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
