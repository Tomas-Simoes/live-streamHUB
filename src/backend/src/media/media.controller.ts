import {
  BadRequestException,
  Controller,
  Logger,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { MediaKind, MediaStorageService } from './media-storage.service';

const IMAGE_MIME_TYPES = new Set([
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);
const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/ogg',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
]);

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly mediaStorage: MediaStorageService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (
        _request: unknown,
        file: { mimetype: string },
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        callback(null, IMAGE_MIME_TYPES.has(file.mimetype));
      },
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(@UploadedFile() file: any, @Req() request: any) {
    return this.uploadMedia('image', file, request);
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (
        _request: unknown,
        file: { mimetype: string },
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        callback(null, VIDEO_MIME_TYPES.has(file.mimetype));
      },
      limits: {
        fileSize: 100 * 1024 * 1024,
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: any, @Req() request: any) {
    return this.uploadMedia('video', file, request);
  }

  private async uploadMedia(kind: MediaKind, file: any, request: any) {
    if (!file) {
      this.logger.warn(`Rejected ${kind} upload because no valid file was received`);
      throw new BadRequestException(`Upload a valid ${kind} file.`);
    }

    this.logger.log(
      `Received ${kind} upload originalName=${file.originalname} contentType=${file.mimetype} size=${file.size}`,
    );

    const storedMedia = await this.mediaStorage.save(kind, file);
    const url = storedMedia.url.startsWith('/')
      ? `${request.protocol}://${request.get('host')}${storedMedia.url}`
      : storedMedia.url;

    this.logger.log(
      `Completed ${kind} upload storage=${storedMedia.storage} key=${storedMedia.key} url=${url}`,
    );

    return {
      ...storedMedia,
      url,
    };
  }
}
