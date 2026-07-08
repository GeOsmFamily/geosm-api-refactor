import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config } from '../../config/env.config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  if (!config.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not configured - cannot encrypt/decrypt secrets at rest');
  }
  return Buffer.from(config.ENCRYPTION_KEY, 'hex');
}

/** Chiffre une chaîne (ex: token OAuth OSM) pour stockage en base - format: iv:authTag:ciphertext (hex). */
export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, authTagHex, dataHex] = payload.split(':');
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]);
  return decrypted.toString('utf8');
}
