import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export interface Profile {
  id: string;
  name: string;
  host: string;
  port: number;
  auth: 'password' | 'md5' | 'sha256';
  secret: string;
  controlSecret?: string;
  controlPort?: number;
}

export function validateProfile(input: Record<string, unknown>, id: string = randomUUID()): Profile {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  const host = typeof input.host === 'string' ? input.host.trim() : '';
  const auth = input.auth ?? 'password';
  const port = Number(input.port ?? 8800);
  const secret = typeof input.secret === 'string' ? input.secret : '';
  const controlPort = Number(input.controlPort ?? 443);
  if (!Number.isInteger(controlPort) || controlPort < 1 || controlPort > 65535) throw new Error('Puerto de control inválido.');
  if (!name || name.length > 100) throw new Error('Indica un nombre de hasta 100 caracteres.');
  if (!host || host.length > 253 || (!isIP(host) && !/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host))) {
    throw new Error('Indica una IP o nombre de host, sin protocolo, puerto ni ruta.');
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Puerto inválido.');
  if (auth !== 'password' && auth !== 'md5' && auth !== 'sha256') throw new Error('Modo de credenciales inválido.');
  if (!secret) throw new Error('Configura las credenciales Tapo.');
  if (auth !== 'password' && !new RegExp(`^[A-Fa-f0-9]{${auth === 'md5' ? 32 : 64}}$`).test(secret)) {
    throw new Error('El hash no tiene el formato esperado.');
  }
  return { id, name, host, port, auth, secret: auth === 'password' ? secret : secret.toUpperCase(), controlPort,
    ...(typeof input.controlSecret === 'string' && input.controlSecret ? { controlSecret: input.controlSecret } : {}) };
}

export function sourceUrl(profile: Profile): string {
  const host = isIP(profile.host) === 6 ? `[${profile.host}]` : profile.host;
  const credential = encodeURIComponent(profile.secret);
  // subtype=0 is the only stream selector validated on the real C402.
  return `tapo://${profile.auth === 'password' ? '' : 'admin:'}${credential}@${host}:${profile.port}?subtype=0`;
}

export function publicProfile(profile: Profile) {
  return { id: profile.id, name: profile.name, host: profile.host, port: profile.port, auth: profile.auth };
}
