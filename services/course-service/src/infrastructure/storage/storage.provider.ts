import { CloudinaryStorageProvider } from '@learnup/ts-storage';
import { ConfigService } from '@nestjs/config';

export const createStorageProvider = (configService: ConfigService) =>
  new CloudinaryStorageProvider({
    cloudName: configService.getOrThrow<string>('CLOUDINARY_CLOUD_NAME'),
    apiKey: configService.getOrThrow<string>('CLOUDINARY_API_KEY'),
    apiSecret: configService.getOrThrow<string>('CLOUDINARY_API_SECRET'),
  });
