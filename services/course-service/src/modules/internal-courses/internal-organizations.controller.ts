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
import { ResponseMessage, Roles, User } from '@common/decorator/customize';
import {
  ManagedCourseChainsDto,
  TransferredCourseChainsDto,
} from './dto/managed-course-chain.dto';
import { TransferCourseChainsDto } from './dto/transfer-course-chains.dto';
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

  // UC12.1, UC12.5 - mỗi chuỗi một phần tử, đại diện bằng phiên bản hiện hành (BR-336)
  @Get('course-chains/by-instructor/:instructorId')
  @ResponseMessage('Course chains fetched successfully')
  @ApiOkResponse({ type: ManagedCourseChainsDto })
  listByInstructor(
    @User() user: CurrentUser,
    @Param('instructorId', uuidPipe) instructorId: string,
  ) {
    return this.internalCoursesService.listCourseChainsByInstructor(
      user.organizationId,
      instructorId,
    );
  }

  // UC12.5 - tenant-service gọi khi Organizer vô hiệu hóa Instructor còn phụ trách Course (BR-41, BR-287)
  @Post('course-chains/transfer')
  @Roles('ORGANIZER')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Course chains transferred successfully')
  @ApiOkResponse({ type: TransferredCourseChainsDto })
  transfer(@User() user: CurrentUser, @Body() body: TransferCourseChainsDto) {
    return this.internalCoursesService.transferCourseChains(
      user.organizationId,
      body.fromInstructorId,
      body.toInstructorId,
    );
  }
}
