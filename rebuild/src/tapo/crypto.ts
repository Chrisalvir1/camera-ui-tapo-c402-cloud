import { createHash, createDecipheriv, randomBytes } from 'node:crypto';

const md5 = (value: string) => createHash('md5').update(value).digest('hex');

/** Local Tapo stream credentials are derived from the challenge, never logged. */
export function streamPassword(password: string, encryptType: string): string {
  return createHash(encryptType === '3' ? 'sha256' : 'md5').update(password).digest('hex').toUpperCase();
}

export function parseChallenge(header: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of header.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|([^,\s]+))/g)) {
    fields[match[1]] = match[2] ?? match[3];
  }
  return fields;
}

export function digestAuthorization(challenge: string, password: string, uri = '/stream'): string {
  const fields = parseChallenge(challenge);
  if (!fields.realm || !fields.nonce) throw new Error('El desafío Tapo no contiene realm/nonce.');
  if (fields.algorithm && fields.algorithm.toUpperCase() !== 'MD5') throw new Error('Algoritmo Digest todavía no implementado.');
  const secret = streamPassword(password, fields.encrypt_type);
  const ha1 = md5(`admin:${fields.realm}:${secret}`);
  const ha2 = md5(`POST:${uri}`);
  const cnonce = randomBytes(16).toString('hex');
  const qop = fields.qop?.split(',').map(value => value.trim()).find(value => value === 'auth');
  if (fields.qop && !qop) throw new Error('El desafío Tapo no admite Digest auth.');
  const response = qop ? md5(`${ha1}:${fields.nonce}:00000001:${cnonce}:${qop}:${ha2}`) : md5(`${ha1}:${fields.nonce}:${ha2}`);
  const values = [`username="admin"`, `realm=${JSON.stringify(fields.realm)}`, `nonce=${JSON.stringify(fields.nonce)}`, `uri=${JSON.stringify(uri)}`, `response="${response}"`];
  if (qop) values.push('qop=auth', 'nc=00000001', `cnonce="${cnonce}"`);
  if (fields.opaque) values.push(`opaque=${JSON.stringify(fields.opaque)}`);
  return `Digest ${values.join(', ')}`;
}

export function decryptMedia(body: Buffer, exchange: string, password: string): Buffer {
  const fields = parseChallenge(exchange);
  if (!fields.nonce || body.length === 0 || body.length % 16 !== 0) throw new Error('Bloque multimedia Tapo inválido.');
  const secret = streamPassword(password, fields.encrypt_type);
  const key = createHash('md5').update(`${fields.nonce}:${secret}`).digest();
  const iv = createHash('md5').update(`admin:${fields.nonce}`).digest();
  const decoder = createDecipheriv('aes-128-cbc', key, iv);
  return Buffer.concat([decoder.update(body), decoder.final()]);
}
