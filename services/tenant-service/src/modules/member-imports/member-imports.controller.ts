import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiProduces,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UserRoleValue } from '../../common/constants/tenant.constants';
import { ResponseMessage, Roles, User } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ConfirmMemberImportDto } from './dto/confirm-member-import.dto';
import { ImportFileSizeInterceptor } from './import-file-size.interceptor';
import type { IUploadedImportFile } from './interfaces/uploaded-import-file.interface';
import {
  IMPORT_MULTER_CEILING_BYTES,
  XLSX_MIME_TYPE,
} from './member-import.constants';
import { MemberImportsService } from './member-imports.service';

const importFileInterceptor = () =>
  FileInterceptor('file', {
    limits: { fileSize: IMPORT_MULTER_CEILING_BYTES, files: 1, fields: 5 },
  });

const fileBodySchema = (withDigest: boolean) => ({
  schema: {
    type: 'object',
    required: withDigest ? ['file', 'previewDigest'] : ['file'],
    properties: {
      file: { type: 'string', format: 'binary' },
      ...(withDigest && { previewDigest: { type: 'string' } }),
    },
  },
});

// Route 3 đoạn ({instructors|learners}/imports/...) để không đụng {instructors|learners}/:id (ParseUUIDPipe)
// của UsersController. UC13.8 dùng cùng service với role Learner.
@ApiTags('Member imports') // UC12.8, UC13.8
@ApiSecurity('internal-key')
@UseGuards(RolesGuard)
@Controller('users')
export class MemberImportsController {
  constructor(private readonly service: MemberImportsService) {}

  // UC12.8 - tệp mẫu
  @Roles('ORGANIZER')
  @Get('instructors/imports/template')
  @ApiProduces(XLSX_MIME_TYPE)
  async downloadInstructorTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.service.template(UserRoleValue.Instructor);
    res
      .status(200)
      .set({
        'Content-Type': XLSX_MIME_TYPE,
        'Content-Disposition':
          'attachment; filename="learnup-instructor-import-template.xlsx"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  // UC12.8 - BR-32: xem trước, không ghi DB
  @Roles('ORGANIZER')
  @Post('instructors/imports/preview')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBodySchema(false))
  @UseInterceptors(ImportFileSizeInterceptor, importFileInterceptor())
  @ResponseMessage('Đã kiểm tra tệp import Instructor')
  previewInstructorImport(
    @User() user: CurrentUser,
    @UploadedFile() file?: IUploadedImportFile,
  ) {
    return this.service.preview(user, UserRoleValue.Instructor, file);
  }

  // UC12.8 - BR-32, BR-33: xác nhận, gửi lại cùng tệp + previewDigest
  @Roles('ORGANIZER')
  @Post('instructors/imports')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBodySchema(true))
  @UseInterceptors(ImportFileSizeInterceptor, importFileInterceptor())
  @ResponseMessage('Import Instructor thành công')
  confirmInstructorImport(
    @User() user: CurrentUser,
    @Body() dto: ConfirmMemberImportDto,
    @UploadedFile() file?: IUploadedImportFile,
  ) {
    return this.service.confirm(user, UserRoleValue.Instructor, file, dto);
  }

  // UC13.8 - tệp mẫu (cột Vai trò chỉ nhận "Learner")
  @Roles('ORGANIZER')
  @Get('learners/imports/template')
  @ApiProduces(XLSX_MIME_TYPE)
  async downloadLearnerTemplate(@Res() res: Response): Promise<void> {
    const buffer = await this.service.template(UserRoleValue.Learner);
    res
      .status(200)
      .set({
        'Content-Type': XLSX_MIME_TYPE,
        'Content-Disposition':
          'attachment; filename="learnup-learner-import-template.xlsx"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      })
      .send(buffer);
  }

  // UC13.8 - BR-32: xem trước, không ghi DB
  @Roles('ORGANIZER')
  @Post('learners/imports/preview')
  @HttpCode(200)
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBodySchema(false))
  @UseInterceptors(ImportFileSizeInterceptor, importFileInterceptor())
  @ResponseMessage('Đã kiểm tra tệp import Learner')
  previewLearnerImport(
    @User() user: CurrentUser,
    @UploadedFile() file?: IUploadedImportFile,
  ) {
    return this.service.preview(user, UserRoleValue.Learner, file);
  }

  // UC13.8 - BR-32, BR-33: xác nhận, gửi lại cùng tệp + previewDigest
  @Roles('ORGANIZER')
  @Post('learners/imports')
  @ApiConsumes('multipart/form-data')
  @ApiBody(fileBodySchema(true))
  @UseInterceptors(ImportFileSizeInterceptor, importFileInterceptor())
  @ResponseMessage('Import Learner thành công')
  confirmLearnerImport(
    @User() user: CurrentUser,
    @Body() dto: ConfirmMemberImportDto,
    @UploadedFile() file?: IUploadedImportFile,
  ) {
    return this.service.confirm(user, UserRoleValue.Learner, file, dto);
  }
}
