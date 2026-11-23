import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  Body,
  Post,
  UseInterceptors,
  UploadedFile,
  Put,
  Delete,
  Patch,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { CurrentUser } from '@learnup/ts-common';
import { ResponseMessage, User } from '@common/decorator/customize';
import { CoursesService } from '@courses/courses.service';
import { CourseListQueryDto } from '@courses/dto/course-list-query.dto';
import { CreateCourseDto } from '@courses/dto/create-course.dto';
import { CreateCourseModuleDto } from '@courses/dto/create-course-module.dto';
import { CreateCourseLessonDto } from '@courses/dto/create-course-lesson.dto';
import { OrganizationCourseListQueryDto } from '@courses/dto/organization-course-list-query.dto';
import { FileInterceptor } from '@nestjs/platform-express/multer/interceptors/file.interceptor';
import {
  COURSE_COVER_MAX_SIZE_BYTES,
  READING_UPLOAD_BUFFER_MAX_BYTES,
  VIDEO_UPLOAD_BUFFER_MAX_BYTES,
} from './course-values';
import { UpdateCourseDto } from './dto/update-course.dto';
import { UpdateCourseStructureDto } from './dto/update-course-structure.dto';
import { UpdateLessonContentDto } from './dto/update-lesson-content.dto';
import { CreateVideoMaterialDto } from './dto/create-video-material.dto';
import { memoryStorage } from 'multer';
import { CreateReadingMaterialDto } from './dto/create-reading-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { TransferCourseOwnershipDto } from './dto/transfer-course-ownership.dto';
import { RejectCourseDto } from './dto/reject-course.dto';
import {
  ReadingUploadAdmissionInterceptor,
  clientAbortSignal,
} from './reading-upload-admission';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('trash')
  @ResponseMessage('Course trash fetched successfully')
  getTrash(@User() user: CurrentUser) {
    return this.coursesService.getTrash(user);
  }

  @Get()
  @ResponseMessage('Courses fetched successfully')
  findAll(@User() user: CurrentUser, @Query() query: CourseListQueryDto) {
    return this.coursesService.findAll(user, query);
  }

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
    return this.coursesService.uploadCover(user, file);
  }

  @Get(':id/authoring-context')
  @ResponseMessage('Course authoring context retrieved successfully.')
  getAuthoringContext(
    @Param('id', ParseUUIDPipe) id: string,
    @User() user: CurrentUser,
  ) {
    return this.coursesService.getAuthoringContext(id, user.organizationId);
  }

  @Post()
  @ResponseMessage('Course created successfully')
  create(@User() user: CurrentUser, @Body() dto: CreateCourseDto) {
    return this.coursesService.create(user, dto);
  }

  @Get(':courseId/structure')
  @ResponseMessage('Course structure fetched successfully')
  getStructure(@User() user: CurrentUser, @Param('courseId') courseId: string) {
    return this.coursesService.getStructure(user, courseId);
  }

  @Post(':courseId/modules')
  @ResponseMessage('Module created successfully')
  createModule(
    @User() user: CurrentUser,
    @Param('courseId') courseId: string,
    @Body() dto: CreateCourseModuleDto,
  ) {
    return this.coursesService.createModule(user, courseId, dto);
  }

  @Post(':courseId/modules/:moduleId/lessons')
  @ResponseMessage('Lesson created successfully')
  createLesson(
    @User() user: CurrentUser,
    @Param('courseId') courseId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: CreateCourseLessonDto,
  ) {
    return this.coursesService.createLesson(user, courseId, moduleId, dto);
  }

  @Get('organization/instructors')
  @ResponseMessage('Organization Course instructors fetched successfully')
  getOrganizationCourseInstructors(@User() user: CurrentUser) {
    return this.coursesService.getOrganizationCourseInstructors(user);
  }

  @Get('organization')
  @ResponseMessage('Organization Courses fetched successfully')
  findOrganizationCourses(
    @User() user: CurrentUser,
    @Query() query: OrganizationCourseListQueryDto,
  ) {
    return this.coursesService.findOrganizationCourses(user, query);
  }

  @Put(':courseId')
  @ResponseMessage('Course updated successfully')
  update(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.coursesService.updateCourse(user, courseId, dto);
  }

  @Get(':courseId')
  @ResponseMessage('Course details fetched successfully')
  findDetail(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.findDetail(user, courseId);
  }

  @Put(':courseId/structure')
  @ResponseMessage('Course structure updated successfully')
  updateStructure(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: UpdateCourseStructureDto,
  ) {
    return this.coursesService.updateStructure(user, courseId, dto);
  }

  @Get(':courseId/lessons/:lessonId')
  @ResponseMessage('Lesson details fetched successfully')
  findLessonDetail(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.coursesService.findLessonDetail(user, courseId, lessonId);
  }

  @Get(':courseId/lessons/:lessonId/content-editability')
  @ResponseMessage('Lesson content editability retrieved successfully')
  getLessonContentEditability(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.coursesService.getLessonContentEditability(
      user,
      courseId,
      lessonId,
    );
  }

  @Put(':courseId/lessons/:lessonId/content')
  @ResponseMessage('Lesson content updated successfully')
  updateLessonContent(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonContentDto,
  ) {
    return this.coursesService.updateLessonContent(
      user,
      courseId,
      lessonId,
      dto,
    );
  }

  @Get(':courseId/lessons/:lessonId/materials/video-upload-context')
  @ResponseMessage('Video upload context fetched successfully')
  getVideoUploadContext(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.coursesService.getVideoUploadContext(user, courseId, lessonId);
  }

  @Post(':courseId/lessons/:lessonId/materials/videos')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: VIDEO_UPLOAD_BUFFER_MAX_BYTES,
        files: 1,
        fields: 2,
        parts: 3,
      },
    }),
  )
  @ResponseMessage('Video material created successfully')
  uploadVideoMaterial(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateVideoMaterialDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.coursesService.uploadVideoMaterial(
      user,
      courseId,
      lessonId,
      dto,
      file,
    );
  }

  @Get(':courseId/lessons/:lessonId/materials/reading-upload-context')
  @ResponseMessage('Reading upload context fetched successfully')
  getReadingUploadContext(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.coursesService.getReadingUploadContext(
      user,
      courseId,
      lessonId,
    );
  }

  @Post(':courseId/lessons/:lessonId/materials/readings')
  // Admission chạy trước Multer: request bị từ chối không đọc body vào bộ nhớ.
  @UseInterceptors(
    ReadingUploadAdmissionInterceptor,
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: READING_UPLOAD_BUFFER_MAX_BYTES,
        files: 1,
        fields: 2,
        parts: 3,
      },
    }),
  )
  @ResponseMessage('Reading material created successfully')
  uploadReadingMaterial(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: CreateReadingMaterialDto,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.coursesService.uploadReadingMaterial(
      user,
      courseId,
      lessonId,
      dto,
      file,
      clientAbortSignal(res),
    );
  }

  @Delete(':courseId')
  @ResponseMessage('Course moved to trash successfully')
  softDelete(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.softDelete(user, courseId);
  }

  @Post(':courseId/restore')
  @ResponseMessage('Course restored successfully')
  restore(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.restore(user, courseId);
  }

  @Delete(':courseId/permanent')
  @ResponseMessage('Course permanently deleted successfully')
  permanentDelete(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.permanentDelete(user, courseId);
  }

  @Post(':courseId/submit')
  @ResponseMessage('Course submitted for approval successfully')
  submitCourseForApproval(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.submitCourseForApproval(user, courseId);
  }

  @Post(':courseId/approve')
  @ResponseMessage('Course approved successfully')
  approveCourse(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.approveCourse(user, courseId);
  }

  @Post(':courseId/reject')
  @ResponseMessage('Course rejected successfully')
  rejectCourse(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: RejectCourseDto,
  ) {
    return this.coursesService.rejectCourse(user, courseId, dto);
  }

  @Patch(':courseId/lessons/:lessonId/materials/:materialId')
  @ResponseMessage('Learning material updated successfully')
  updateMaterial(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    return this.coursesService.updateMaterial(
      user,
      courseId,
      lessonId,
      materialId,
      dto,
    );
  }

  @Post(
    ':courseId/lessons/:lessonId/materials/:materialId/technical-replacement',
  )
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: VIDEO_UPLOAD_BUFFER_MAX_BYTES,
        files: 1,
        fields: 0,
        parts: 1,
      },
    }),
  )
  @ResponseMessage('Learning material file replaced successfully')
  replaceTechnicalFile(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
    @Res({ passthrough: true }) res: Response,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.coursesService.replaceTechnicalFile(
      user,
      courseId,
      lessonId,
      materialId,
      file,
      clientAbortSignal(res),
    );
  }

  @Get('organization/:courseId/review')
  @ResponseMessage('Course review content retrieved successfully')
  getOrganizerCourseReview(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.getOrganizerCourseReview(user, courseId);
  }

  @Get('organization/:courseId/materials/:materialId/preview')
  @ResponseMessage('Material preview retrieved successfully')
  getOrganizerMaterialPreview(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('materialId', ParseUUIDPipe) materialId: string,
  ) {
    return this.coursesService.getOrganizerMaterialPreview(
      user,
      courseId,
      materialId,
    );
  }

  @Post(':courseId/withdraw')
  @ResponseMessage('Course withdrawn successfully')
  withdrawCourseSubmission(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.withdrawCourseSubmission(user, courseId);
  }

  @Post(':courseId/transfer')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course ownership transferred successfully')
  transferCourseOwnership(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Body() dto: TransferCourseOwnershipDto,
  ) {
    return this.coursesService.transferCourseOwnership(user, courseId, dto);
  }

  @Get('organization/:courseId/transfer-context')
  @ResponseMessage('Transfer context retrieved successfully')
  getTransferContext(
    @User() user: CurrentUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ) {
    return this.coursesService.getTransferContext(user, courseId);
  }
}
