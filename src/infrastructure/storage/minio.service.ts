import { Client as MinioClient } from 'minio';
import { config } from '../../config/env.config.js';
import { Readable } from 'stream';

export class MinioStorageService {
  private client: MinioClient;
  private bucket: string;

  constructor() {
    this.client = new MinioClient({
      endPoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
      useSSL: config.MINIO_USE_SSL,
    });
    this.bucket = config.MINIO_BUCKET;
  }

  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  // `size` (utilisé par DatabaseBackupUseCase avec un fichier temporaire déjà écrit sur disque) :
  // sans taille explicite pour un stream, le client MinIO bufferise en interne au lieu de faire
  // un vrai PUT/multipart en flux - confirmé par un OOM kill en conditions réelles (dump de
  // plusieurs centaines de Mo) avant que ce paramètre n'existe.
  async uploadFile(key: string, data: Buffer | Readable, contentType?: string, size?: number): Promise<string> {
    const metadata = contentType ? { 'Content-Type': contentType } : {};
    await this.client.putObject(this.bucket, key, data, size, metadata);
    return key;
  }

  async downloadFile(key: string): Promise<Readable> {
    return this.client.getObject(this.bucket, key);
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getPresignedUrl(key: string, expirySeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  async getFileInfo(key: string): Promise<{ size: number; contentType: string; lastModified: Date }> {
    const stat = await this.client.statObject(this.bucket, key);
    return {
      size: stat.size,
      contentType: stat.metaData?.['content-type'] || 'application/octet-stream',
      lastModified: stat.lastModified,
    };
  }

  /** Utilisé par DatabaseBackupUseCase pour appliquer la politique de rétention des backups. */
  async listFiles(prefix: string): Promise<{ key: string; lastModified: Date; size: number }[]> {
    return new Promise((resolve, reject) => {
      const objects: { key: string; lastModified: Date; size: number }[] = [];
      const stream = this.client.listObjectsV2(this.bucket, prefix, true);
      stream.on('data', (obj) => {
        if (obj.name && obj.lastModified) objects.push({ key: obj.name, lastModified: obj.lastModified, size: obj.size ?? 0 });
      });
      stream.on('end', () => resolve(objects));
      stream.on('error', reject);
    });
  }
}
