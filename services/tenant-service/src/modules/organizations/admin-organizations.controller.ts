import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { OrganizationsService } from './organizations.service';

// UC44 - Admin xem mọi Organization trên nền tảng. Không xung đột với organizations/me (UC11):
// OrganizationsController đăng ký trước trong OrganizationsModule nên "me" khớp UC11 trước,
// và ParseUUIDPipe của UC44.1 cũng không nhận "me".
@ApiTags('UC44 - Admin Organizations')
@ApiSecurity('internal-key')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('organizations')
export class AdminOrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Get()
  @ResponseMessage('Lấy danh sách Organization thành công')
  findAll(@Query() query: ListOrganizationsQueryDto) {
    return this.service.findAllForAdmin(query);
  }

  // UC44.1 - Xem chi tiết Organization. id sai định dạng -> 400 (ParseUUIDPipe), không có -> 404.
  @Get(':organizationId')
  @ResponseMessage('Lấy chi tiết Organization thành công')
  findOne(
    @Param('organizationId', new ParseUUIDPipe()) organizationId: string,
  ) {
    return this.service.findOneForAdmin(organizationId);
  }
}
