import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, Roles } from '../../common/decorator/customize';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ListOrganizationsQueryDto } from './dto/list-organizations-query.dto';
import { OrganizationsService } from './organizations.service';

// UC44 - Admin xem mọi Organization trên nền tảng. Không xung đột với organizations/me (UC11)
// vì chỉ khai báo GET gốc; route dạng :id (UC44.1) phải xử lý được "me".
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
}
