import { randomUUID } from 'node:crypto';
import type { MediaType } from '@prisma/client';
import { ValidationError } from '../../../domain/errors/validation.error.js';
import { mediaKeyPrefix } from './posts.use-cases.js';

export interface MediaUploadStore {
  uploadFile(key: string, data: Buffer, contentType?: string, size?: number): Promise<string>;
  getPresignedUrl(key: string, expirySeconds?: number): Promise<string>;
}

interface DetectedFormat {
  type: MediaType;
  ext: string;
  mime: string;
  maxBytes: number;
}

const MB = 1024 * 1024;

/** Format reel d'apres les premiers octets (l'extension et le type annonce ne sont pas fiables). */
export function detectMediaFormat(buf: Buffer): DetectedFormat | null {
  const hex = buf.subarray(0, 12).toString('hex');
  if (hex.startsWith('ffd8ff')) return { type: 'IMAGE', ext: 'jpg', mime: 'image/jpeg', maxBytes: 10 * MB };
  if (hex.startsWith('89504e470d0a1a0a')) return { type: 'IMAGE', ext: 'png', mime: 'image/png', maxBytes: 10 * MB };
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') {
    return { type: 'IMAGE', ext: 'webp', mime: 'image/webp', maxBytes: 10 * MB };
  }
  // GIF anime : envoye comme un fichier, sans service tiers (ADR 0007, point 5).
  if (buf.subarray(0, 4).toString('ascii') === 'GIF8') return { type: 'GIF', ext: 'gif', mime: 'image/gif', maxBytes: 10 * MB };
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return { type: 'VIDEO', ext: 'mp4', mime: 'video/mp4', maxBytes: 50 * MB };
  if (hex.startsWith('1a45dfa3')) return { type: 'VIDEO', ext: 'webm', mime: 'video/webm', maxBytes: 50 * MB };
  return null;
}

/**
 * Televersement d'un media de publication (etape « contenu » du formulaire, maquette 52). La cle
 * renvoyee est ensuite passee a POST /instances/:id/posts, qui verifie qu'elle appartient bien a
 * l'auteur (prefixe posts/<userId>/).
 */
export class PostMediaUseCase {
  constructor(private readonly store: MediaUploadStore) {}

  async upload(userId: string, data: Buffer): Promise<{ key: string; type: MediaType; url: string }> {
    const format = detectMediaFormat(data);
    if (!format) {
      throw new ValidationError('Format non pris en charge (JPEG, PNG, WebP, GIF, MP4 ou WebM)', {});
    }
    if (data.length > format.maxBytes) {
      throw new ValidationError(`Fichier trop volumineux (${format.maxBytes / MB} Mo au plus)`, {
        maxBytes: format.maxBytes,
      });
    }
    const key = `${mediaKeyPrefix(userId)}${randomUUID()}.${format.ext}`;
    await this.store.uploadFile(key, data, format.mime, data.length);
    return { key, type: format.type, url: await this.store.getPresignedUrl(key, 6 * 3600) };
  }
}
