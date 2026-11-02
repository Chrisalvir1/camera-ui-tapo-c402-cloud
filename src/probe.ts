import { createConnection } from 'node:net';
import type { Profile } from './profiles.ts';

/** Only checks service availability. Never authenticates or claims video is working. */
export async function probeService(profile: Pick<Profile, 'host' | 'port'>, timeoutMs = 4000): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = createConnection({ host: profile.host, port: profile.port });
    let response = '';
    const finish = (error?: Error) => {
      socket.removeAllListeners();
      socket.destroy();
      if (error) reject(error); else resolve();
    };
    socket.setTimeout(timeoutMs, () => finish(new Error('El servicio Tapo no respondió a tiempo.')));
    socket.once('error', () => finish(new Error('No se pudo acceder al servicio Tapo desde este equipo.')));
    socket.once('connect', () => socket.write(
      `POST /stream HTTP/1.1\r\nHost: ${profile.host}\r\nContent-Length: 0\r\nContent-Type: multipart/mixed; boundary=--client-stream-boundary--\r\nConnection: close\r\n\r\n`,
    ));
    socket.on('data', chunk => {
      response += chunk.toString('latin1');
      if (response.length > 16384) return finish(new Error('Respuesta inesperada del servicio Tapo.'));
      if (response.includes('\r\n\r\n')) {
        if (/^HTTP\/1\.[01] 401\b/.test(response) && /www-authenticate:\s*Digest/i.test(response)) finish();
        else finish(new Error('El dispositivo no presenta el servicio Tapo esperado.'));
      }
    });
    socket.once('end', () => finish(new Error('El dispositivo cerró la conexión antes de responder.')));
  });
}
