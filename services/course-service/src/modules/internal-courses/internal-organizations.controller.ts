import type { CurrentUser } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ResponseMessage, User } from '@common/decorator/customize';
import { InstructorCourseCountsDto } from './dto/instructor-course-counts.dto';
import { InstructorCourseCountsQueryDto } from './dto/instructor-course-counts-query.dto';
import { OrganizationUsageDto } from './dto/organization-usage.dto';
import { InternalCoursesService } from './internal-courses.service';

const uuidPipe = new ParseUUIDPipe();

@ApiTags('internal')
@ApiSecurity('internal-key')
@Controller('internal')
export class InternalOrganizationsController {
  constructor(
    private readonly internalCoursesService: InternalCoursesService,
  ) {}

  @Get('organizations/:organizationId/usage')
  @ResponseMessage('Organization usage fetched successfully')
  @ApiOkResponse({ type: OrganizationUsageDto })
  getUsage(
    @User() user: CurrentUser,
    @Param('organizationId', uuidPipe) organizationId: string,
  ) {
    return this.internalCoursesService.getOrganizationUsage(
      user.organizationId,
      organizationId,
    );
  }

  @Post('course-chains/count-by-instructors')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course chains counted successfully')
  @ApiOkResponse({ type: InstructorCourseCountsDto })
  countByInstructors(
    @User() user: CurrentUser,
    @Body() body: InstructorCourseCountsQueryDto,
  ) {
    return this.internalCoursesService.countCourseChainsByInstructors(
      user.organizationId,
      body.instructorIds,
    );
  }
}
