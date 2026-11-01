import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { HEADER_NAMES } from '@learnup/ts-common';
import { ServiceCall } from '@common/decorator/customize';

import { InternalCoursesService } from './internal-courses.service';
import { SignedUrlRequestDto } from './dto/signed-url-request.dto';
import { SignedUrlResponseDto } from './dto/signed-url-response.dto';

@ApiTags('internal')
@ApiSecurity('internal-key')
@Controller('internal/materials')
export class InternalMaterialsController {
  constructor(private readonly service: InternalCoursesService) {}

  @Post(':materialId/signed-url')
  @ServiceCall()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: SignedUrlResponseDto })
  signedUrl(
    @Headers(HEADER_NAMES.ORGANIZATION_ID)
    organizationId: string,
    @Param('materialId', new ParseUUIDPipe())
    materialId: string,
    @Body() body: SignedUrlRequestDto,
  ): Promise<SignedUrlResponseDto> {
    return this.service.getMaterialSignedUrl(
      organizationId,
      body.courseId,
      materialId,
    );
  }
}
