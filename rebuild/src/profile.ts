import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export interface CameraProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  password: string;
}

export function parseProfiles(value: unknown): CameraProfile[] {
  if (!Array.isArray(value)) return [];
  const profiles: CameraProfile[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name.trim() : '';
    const host = typeof entry.host === 'string' ? entry.host.trim() : '';
    const password = typeof entry.password === 'string' ? entry.password : '';
    const port = Number(entry.port ?? 8800);
    if (!name || name.length > 100) throw new Error('Cada cámara necesita un nombre de hasta 100 caracteres.');
    if (!validHost(host)) throw new Error(`La IP o nombre local de «${name}» no es válido.`);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`El puerto de «${name}» debe estar entre 1 y 65535.`);
    if (!password) throw new Error(`Escribe la contraseña de la cuenta Tapo de «${name}».`);
    const id = createHash('sha256').update(`${host.toLowerCase()}:${port}`).digest('hex').slice(0, 20);
    if (profiles.some(profile => profile.id === id)) throw new Error(`La cámara «${name}» repite la misma IP y puerto.`);
    profiles.push({ id, name, host, port, password });
  }
  return profiles;
}

export function validHost(host: string): boolean {
  return host.length > 0 && host.length <= 253 && (
    isIP(host) !== 0 || /^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host)
  );
}

export function tapoSource(profile: CameraProfile, resolution: string): string {
  const password = encodeURIComponent(profile.password).replace(/[!'()*]/g, ch => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
  const host = isIP(profile.host) === 6 ? `[${profile.host}]` : profile.host;
  return `tapo://${password}@${host}:${profile.port}?resolution=${encodeURIComponent(resolution)}`;
}

export function cameraNativeId(profile: CameraProfile): string {
  return `tapo-c402:${profile.id}`;
}
