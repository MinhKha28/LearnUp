import { ApiProperty } from '@nestjs/swagger';
import { CatalogCourseDto } from './catalog-course.dto';

export class CatalogPageMetaDto {
  @ApiProperty()
  current!: number;

  @ApiProperty({ example: 12 })
  pageSize!: number;

  @ApiProperty()
  pages!: number;

  @ApiProperty()
  total!: number;
}

export class CatalogPageDto {
  @ApiProperty({ type: CatalogPageMetaDto })
  meta!: CatalogPageMetaDto;

  @ApiProperty({ type: [CatalogCourseDto] })
  items!: CatalogCourseDto[];
}
