import type { CurrentUser } from '@learnup/ts-common';
import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResponseMessage, User } from '@/common/decorator/customize';
import { CourseMediaService } from './course-media.service';
import { COURSE_COVER_MAX_SIZE_BYTES } from './course-media.constants';
@Controller('courses')
export class CourseMediaController {
  constructor(private readonly courseMediaService: CourseMediaService) {}

  @Post('cover')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: COURSE_COVER_MAX_SIZE_BYTES },
    }),
  )
  @ResponseMessage('Course cover uploaded successfully')
  uploadCover(
    @User() user: CurrentUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.courseMediaService.uploadCover(user, file);
  }
}
