import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';

export type MediaKind = 'image' | 'video';

export type StoredMedia = {
  url: string;
  key: string;
  bucket?: string;
  contentType: string;
  originalName: string;
  size: number;
  storage: 'r2' | 'local';
  localFilePath?: string;
};

type UploadedFile = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const LOCAL_UPLOAD_ROOT = join(process.cwd(), 'uploads', 'hub-media');

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly r2Bucket = process.env.R2_BUCKET;
  private readonly r2Endpoint = trimTrailingSlash(process.env.R2_ENDPOINT);
  private readonly r2PublicBaseUrl = trimTrailingSlash(
    process.env.R2_PUBLIC_BASE_URL,
  );
  private readonly r2Client = this.createR2Client();

  async save(kind: MediaKind, file: UploadedFile): Promise<StoredMedia> {
    const key = this.createObjectKey(kind, file.originalname);

    if (this.r2Client && this.r2Bucket && this.r2Endpoint) {
      this.logger.log(
        `Uploading ${kind} to R2 bucket=${this.r2Bucket} key=${key} contentType=${file.mimetype} size=${file.size}`,
      );

      await this.r2Client.send(
        new PutObjectCommand({
          Bucket: this.r2Bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      this.logger.log(
        `Uploaded ${kind} to R2 bucket=${this.r2Bucket} key=${key}`,
      );

      return {
        url: this.getPublicUrl(key),
        key,
        bucket: this.r2Bucket,
        contentType: file.mimetype,
        originalName: file.originalname,
        size: file.size,
        storage: 'r2',
      };
    }

    this.logger.warn(
      `R2 is not fully configured; saving ${kind} locally key=${key} missing=${this.getMissingR2Config().join(',')}`,
    );

    return this.saveLocally(kind, key, file);
  }

  private saveLocally(
    kind: MediaKind,
    key: string,
    file: UploadedFile,
  ): StoredMedia {
    const uploadDir = join(LOCAL_UPLOAD_ROOT, kind);

    if (!existsSync(uploadDir)) {
      mkdirSync(uploadDir, { recursive: true });
    }

    const filename = key.split('/').at(-1);

    if (!filename) {
      throw new InternalServerErrorException('Unable to build media filename.');
    }

    const localFilePath = join(uploadDir, filename);

    writeFileSync(localFilePath, file.buffer);

    this.logger.log(`Saved ${kind} locally path=${localFilePath}`);

    return {
      url: `/uploads/hub-media/${kind}/${filename}`,
      key,
      contentType: file.mimetype,
      originalName: file.originalname,
      size: file.size,
      storage: 'local',
      localFilePath,
    };
  }

  private createR2Client() {
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!this.r2Endpoint || !accessKeyId || !secretAccessKey || !this.r2Bucket) {
      this.logger.warn(
        `R2 client disabled; missing config: ${this.getMissingR2Config().join(',')}`,
      );

      return null;
    }

    this.logger.log(
      `R2 client enabled endpoint=${this.r2Endpoint} bucket=${this.r2Bucket} region=${process.env.R2_REGION || 'auto'}`,
    );

    return new S3Client({
      region: process.env.R2_REGION || 'auto',
      endpoint: this.r2Endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private createObjectKey(kind: MediaKind, filename: string) {
    return `hub-media/${kind}/${randomUUID()}${safeExtension(filename)}`;
  }

  private getPublicUrl(key: string) {
    if (this.r2PublicBaseUrl) {
      return `${this.r2PublicBaseUrl}/${key}`;
    }

    return `${this.r2Endpoint}/${this.r2Bucket}/${key}`;
  }

  private getMissingR2Config() {
    return [
      ['R2_ENDPOINT', this.r2Endpoint],
      ['R2_BUCKET', this.r2Bucket],
      ['R2_ACCESS_KEY_ID', process.env.R2_ACCESS_KEY_ID],
      ['R2_SECRET_ACCESS_KEY', process.env.R2_SECRET_ACCESS_KEY],
    ]
      .filter(([, value]) => !value)
      .map(([key]) => key);
  }
}

function safeExtension(filename: string) {
  const extension = extname(filename).toLowerCase();

  return /^[a-z0-9.]+$/.test(extension) ? extension : '';
}

function trimTrailingSlash(value: string | undefined) {
  return value?.replace(/\/+$/, '');
}
