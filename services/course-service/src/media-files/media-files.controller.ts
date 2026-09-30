import { Controller } from '@nestjs/common';
import { MediaFilesService } from './media-files.service';

@Controller('media-files')
export class MediaFilesController {
  constructor(private readonly service: MediaFilesService) {}
}
