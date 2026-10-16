import { HEADER_NAMES } from '@learnup/ts-common';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage, ServiceCall } from '../../common/decorator/customize';
import { DisplayNamesDto } from './dto/display-names.dto';
import { UserDirectoryService } from './user-directory.service';

@ApiTags('Internal - User directory')
@Controller('internal/users')
export class UserDirectoryController {
  constructor(private readonly userDirectoryService: UserDirectoryService) {}

  @ServiceCall()
  @Post('display-names')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Display names fetched')
  displayNames(
    @Headers(HEADER_NAMES.ORGANIZATION_ID) organizationId: string | undefined,
    @Body() dto: DisplayNamesDto,
  ) {
    return this.userDirectoryService.displayNames(organizationId, dto.userIds);
  }
}
