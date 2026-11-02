import { createConnection, type Socket } from 'node:net';
import { digestAuthorization, decryptMedia } from './crypto.js';

/** Bounded byte reader preserves bytes beyond each header or multipart body. */
class WireReader {
  private buffer = Buffer.alloc(0);
  private readonly iterator: AsyncIterator<Buffer>;
  constructor(private socket: Socket) { this.iterator = socket[Symbol.asyncIterator](); }
  private async more(): Promise<void> {
    const next = await this.iterator.next();
    if (next.done) throw new Error('Tapo cerró la conexión.');
    this.buffer = Buffer.concat([this.buffer, next.value]);
    if (this.buffer.length > 16 * 1024 * 1024) throw new Error('Respuesta Tapo demasiado grande.');
  }
  async until(marker: Buffer, limit = 65536): Promise<Buffer> {
    for (;;) {
      const end = this.buffer.indexOf(marker);
      if (end >= 0) {
        const result = this.buffer.subarray(0, end);
        this.buffer = this.buffer.subarray(end + marker.length);
        return result;
      }
      if (this.buffer.length > limit) throw new Error('Cabecera Tapo demasiado grande.');
      await this.more();
    }
  }
  async bytes(size: number): Promise<Buffer> {
    if (!Number.isInteger(size) || size < 0 || size > 8 * 1024 * 1024) throw new Error('Longitud Tapo inválida.');
    while (this.buffer.length < size) await this.more();
    const value = this.buffer.subarray(0, size);
    this.buffer = this.buffer.subarray(size);
    return value;
  }
}

function headers(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split('\r\n')) {
    const split = line.indexOf(':');
    if (split > 0) result[line.slice(0, split).toLowerCase()] = line.slice(split + 1).trim();
  }
  return result;
}

export interface TapoSessionOptions { host: string; port: number; password: string; signal: AbortSignal; }

/** Direct LAN transport. Emits decrypted original MPEG-TS, without a codec stage. */
export async function* receiveTapo(options: TapoSessionOptions): AsyncGenerator<Buffer> {
  const socket = createConnection({ host: options.host, port: options.port });
  const abort = () => socket.destroy();
  options.signal.addEventListener('abort', abort, { once: true });
  socket.setTimeout(20_000, () => socket.destroy(new Error('Tapo no entregó datos dentro del plazo.')));
  try {
    if (options.signal.aborted) throw new Error('Conexión cancelada.');
    await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('error', reject); });
    const reader = new WireReader(socket);
    const request = (authorization?: string) => socket.write([
      'POST /stream HTTP/1.1', `Host: ${options.host}:${options.port}`,
      'Content-Type: multipart/mixed; boundary=--client-stream-boundary--',
      ...(authorization ? [`Authorization: ${authorization}`] : []), '', '',
    ].join('\r\n'));
    request();
    const first = (await reader.until(Buffer.from('\r\n\r\n'))).toString('latin1');
    if (!/^HTTP\/1\.[01] 401\b/.test(first)) throw new Error('Tapo no presentó el desafío esperado.');
    const challenge = headers(first);
    if (challenge['transfer-encoding']) throw new Error('Respuesta de desafío chunked no implementada.');
    await reader.bytes(Number(challenge['content-length'] ?? 0));
    request(digestAuthorization(challenge['www-authenticate'] ?? '', options.password));
    const authenticated = (await reader.until(Buffer.from('\r\n\r\n'))).toString('latin1');
    if (!/^HTTP\/1\.[01] 200\b/.test(authenticated)) throw new Error('La cámara rechazó la autenticación Tapo.');
    const response = headers(authenticated);
    const boundary = /boundary="?([^";\s]+)/i.exec(response['content-type'] ?? '')?.[1];
    if (!boundary) throw new Error('Falta el delimitador multimedia Tapo.');
    // HD is a protocol selector, not a claim about measured frame dimensions.
    const body = Buffer.from(JSON.stringify({ params: { preview: { audio: ['default'], channels: [0], resolutions: ['HD'] }, method: 'get' }, seq: 1, type: 'request' }));
    socket.write(Buffer.concat([Buffer.from(`----client-stream-boundary--\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n`), body, Buffer.from('\r\n')]));
    while (!options.signal.aborted) {
      await reader.until(Buffer.from(`--${boundary}\r\n`));
      const part = headers((await reader.until(Buffer.from('\r\n\r\n'))).toString('latin1'));
      const payload = await reader.bytes(Number(part['content-length']));
      if (part['content-type']?.split(';')[0] !== 'video/mp2t') continue;
      if (part['x-if-encrypt'] === '0') yield payload;
      else yield decryptMedia(payload, response['key-exchange'] ?? '', options.password);
    }
  } finally {
    options.signal.removeEventListener('abort', abort);
    socket.destroy();
  }
}
