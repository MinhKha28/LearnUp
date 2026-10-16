import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '../../common/decorator/customize';
import { UpdateProfileDto } from './dto/update-profile.dto';
import type { IUploadedImage } from './interfaces/uploaded-image.interface';
import { AVATAR_MAX_SIZE_BYTES, ProfileService } from './profile.service';

@ApiTags('UC09 - Profile')
@Controller('users/me')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  @ResponseMessage('Lấy hồ sơ cá nhân thành công')
  getMine(@User() user: CurrentUser) {
    return this.profileService.getMine(user.userId);
  }

  @Patch()
  @ResponseMessage('Cập nhật hồ sơ cá nhân thành công')
  updateMine(@User() user: CurrentUser, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateMine(user.userId, dto);
  }

  @Put('avatar')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: AVATAR_MAX_SIZE_BYTES } }),
  )
  @ResponseMessage('Cập nhật ảnh đại diện thành công')
  replaceAvatar(
    @User() user: CurrentUser,
    @UploadedFile() file?: IUploadedImage,
  ) {
    return this.profileService.replaceAvatar(user.userId, file);
  }

  @Delete('avatar')
  @ResponseMessage('Đã gỡ ảnh đại diện')
  removeAvatar(@User() user: CurrentUser) {
    return this.profileService.removeAvatar(user.userId);
  }
}
