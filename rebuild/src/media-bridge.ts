import { createServer, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { receiveTapo } from './tapo/session.js';
import type { CameraProfile } from './profile.js';

export interface BridgeHandle { streamUrl: string; isRunning(): boolean; stop(): Promise<void>; }

export async function startMediaBridge(profile: CameraProfile): Promise<BridgeHandle> {
  const abort = new AbortController();
  const clients = new Set<ServerResponse>();
  const path = `/${randomBytes(24).toString('hex')}/stream.ts`;
  let active = true;
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  const server = createServer((request, response) => {
    if (request.url !== path || request.method !== 'GET') { response.writeHead(404).end(); return; }
    if (!active) { response.writeHead(503).end(); return; }
    response.writeHead(200, { 'Content-Type': 'video/mp2t', 'Cache-Control': 'no-store' });
    clients.add(response);
    response.on('close', () => clients.delete(response));
  });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No se pudo abrir el relay local.');
  const timer = setTimeout(() => { rejectReady(new Error('Tapo no entregó medios dentro del plazo.')); abort.abort(); }, 25000);
  const task = (async () => {
    try {
      for await (const packet of receiveTapo({ ...profile, signal: abort.signal })) {
        if (!packet.length) continue;
        const sync = packet.indexOf(0x47);
        if (sync < 0 || (packet.length > sync + 188 && packet[sync + 188] !== 0x47)) throw new Error('MPEG-TS inválido.');
        clearTimeout(timer); resolveReady();
        for (const client of clients) {
          if (client.writableLength > 2097152) { client.destroy(); clients.delete(client); }
          else client.write(packet);
        }
      }
      rejectReady(new Error('Tapo cerró el stream.'));
    } catch { rejectReady(new Error('No se pudo recibir video Tapo. Comprueba credenciales y disponibilidad.')); }
    finally {
      active = false; clearTimeout(timer);
      for (const client of clients) client.destroy();
      clients.clear(); server.close();
    }
  })();
  try { await ready; } catch (error) { abort.abort(); await task; throw error; }
  return { streamUrl: `http://127.0.0.1:${address.port}${path}`, isRunning: () => active,
    async stop() { abort.abort(); for (const client of clients) client.destroy(); server.close(); await task; } };
}
