import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '@common/decorator/customize';
import { CatalogService } from './catalog.service';
import { CatalogPageDto } from './dto/catalog-page.dto';
import { CourseIntroductionDto } from './dto/course-introduction.dto';
import { ParsePagePipe } from './pipes/parse-page.pipe';

@ApiTags('catalog')
@ApiSecurity('internal-key')
@Controller('courses')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // Đọc riêng tham số page: các tham số query khác (kể cả size) bị bỏ qua, trang luôn 12 Course
  @Get('catalog')
  @ResponseMessage('Course catalog fetched successfully')
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiOkResponse({ type: CatalogPageDto })
  findCatalog(
    @User() user: CurrentUser,
    @Query('page', ParsePagePipe) page: number,
  ) {
    return this.catalogService.findCatalog(user, page);
  }

  // Không dùng ParseUUIDPipe: courseId sai định dạng phải trả 404 giống mọi trường hợp khác
  @Get(':courseId/introduction')
  @ResponseMessage('Course introduction fetched successfully')
  @ApiOkResponse({ type: CourseIntroductionDto })
  findIntroduction(
    @User() user: CurrentUser,
    @Param('courseId') courseId: string,
  ) {
    return this.catalogService.findIntroduction(user, courseId);
  }
}
