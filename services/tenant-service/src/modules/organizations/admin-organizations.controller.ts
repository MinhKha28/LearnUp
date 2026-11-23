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

// UC44 / UC44.1 - Admin xem mọi Organization trên nền tảng và chi tiết từng Organization.
// Tiền tố admin/ tách hẳn khỏi organizations/me (UC11) như UC43 (admin/subscription-plans),
// nên route không phụ thuộc thứ tự đăng ký controller.
@ApiTags('UC44 - Admin Organizations')
@ApiSecurity('internal-key')
@UseGuards(RolesGuard)
@Roles('ADMIN')
@Controller('admin/organizations')
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
