import { Client as MinioClient } from 'minio';
import { config } from '../../config/env.config.js';
import { Readable } from 'stream';

export class MinioStorageService {
  private readonly client: MinioClient;
  private readonly publicClient: MinioClient;
  private readonly bucket: string;

  constructor() {
    this.client = new MinioClient({
      endPoint: config.MINIO_ENDPOINT,
      port: config.MINIO_PORT,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
      useSSL: config.MINIO_USE_SSL,
    });
    // Client séparé, utilisé uniquement pour signer les URLs présignées destinées au navigateur
    // (voir MINIO_PUBLIC_ENDPOINT) - le client principal reste sur l'hôte interne Docker pour
    // toutes les opérations serveur->MinIO (upload/download/stat). `region` est fixé explicitement
    // (us-east-1 = région par défaut de MinIO) car sans elle, le SDK minio-js tente un VRAI appel
    // réseau (getBucketRegionAsync -> GET ?location) vers CET endpoint avant de signer - or
    // l'endpoint public (ex. "localhost" vu depuis le conteneur = sa propre boucle locale, pas
    // l'hôte Windows) n'est justement PAS joignable depuis le conteneur, d'où un ECONNREFUSED
    // sinon. Avec la région fixée, aucune requête réseau n'est nécessaire pour signer l'URL.
    this.publicClient = new MinioClient({
      endPoint: config.MINIO_PUBLIC_ENDPOINT || config.MINIO_ENDPOINT,
      port: config.MINIO_PUBLIC_PORT || config.MINIO_PORT,
      accessKey: config.MINIO_ACCESS_KEY,
      secretKey: config.MINIO_SECRET_KEY,
      useSSL: config.MINIO_USE_SSL,
      region: 'us-east-1',
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
    return this.publicClient.presignedGetObject(this.bucket, key, expirySeconds);
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
