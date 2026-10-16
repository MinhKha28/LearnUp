import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ResponseMessage, ServiceCall } from '../../common/decorator/customize';
import { SignInAccessService } from './sign-in-access.service';

@ApiTags('UC05 - Sign-in access (internal)')
@Controller('internal/users')
export class SignInAccessController {
  constructor(private readonly signInAccessService: SignInAccessService) {}

  @ServiceCall()
  @Get(':userId/sign-in-access')
  @ResponseMessage('Sign-in access checked')
  check(@Param('userId', new ParseUUIDPipe()) userId: string) {
    return this.signInAccessService.check(userId);
  }
}
