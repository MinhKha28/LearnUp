import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles, User } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ImageSizeLimitInterceptor } from '../../infrastructure/storage/upload-limit';
import type { IUploadedImage } from '../profile/interfaces/uploaded-image.interface';
import { UpdateOrganizationProfileDto } from './dto/update-organization-profile.dto';
import {
  LOGO_MAX_SIZE_BYTES,
  OrganizationsService,
} from './organizations.service';

@ApiTags('UC11 / UC11.1 - Organization')
@ApiSecurity('internal-key')
@UseGuards(RolesGuard)
@Roles('ORGANIZER')
@Controller('organizations/me')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  @ResponseMessage('Lấy thông tin tổ chức thành công')
  getMine(@User() user: CurrentUser) {
    return this.service.getMine(user);
  }

  @Patch()
  @ResponseMessage('Cập nhật thông tin tổ chức thành công')
  updateMine(
    @User() user: CurrentUser,
    @Body() dto: UpdateOrganizationProfileDto,
  ) {
    return this.service.updateMine(user, dto);
  }

  @Put('logo')
  @UseInterceptors(
    new ImageSizeLimitInterceptor(LOGO_MAX_SIZE_BYTES),
    FileInterceptor('file', { limits: { fileSize: LOGO_MAX_SIZE_BYTES } }),
  )
  @ResponseMessage('Cập nhật logo thành công')
  replaceLogo(
    @User() user: CurrentUser,
    @UploadedFile() file?: IUploadedImage,
  ) {
    return this.service.replaceLogo(user, file);
  }

  @Delete('logo')
  @ResponseMessage('Đã gỡ logo')
  removeLogo(@User() user: CurrentUser) {
    return this.service.removeLogo(user);
  }
}
