import type { CurrentUser } from '@learnup/ts-common';
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiQuery, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '@common/decorator/customize';
import { CatalogService } from './catalog.service';
import { CatalogPageDto } from './dto/catalog-page.dto';
import { CourseIntroductionDto } from './dto/course-introduction.dto';
import { ParseCatalogKeywordPipe } from './pipes/parse-catalog-keyword.pipe';
import { ParsePagePipe } from './pipes/parse-page.pipe';

@ApiTags('catalog')
@ApiSecurity('internal-key')
@Controller('courses')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  // Các tham số query ngoài page và q (kể cả size) bị bỏ qua.
  @Get('catalog')
  @ResponseMessage('Course catalog fetched successfully')
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'q', required: false, type: String, maxLength: 200 })
  @ApiOkResponse({ type: CatalogPageDto })
  findCatalog(
    @User() user: CurrentUser,
    @Query('page', ParsePagePipe) page: number,
    @Query('q', ParseCatalogKeywordPipe) keyword: unknown,
  ) {
    return this.catalogService.findCatalog(user, page, keyword as string | undefined);
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
