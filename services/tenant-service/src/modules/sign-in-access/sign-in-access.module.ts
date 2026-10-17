import { Module } from '@nestjs/common';
import { SignInAccessController } from './sign-in-access.controller';
import { SignInAccessRepository } from './sign-in-access.repository';
import { SignInAccessService } from './sign-in-access.service';

@Module({
  controllers: [SignInAccessController],
  providers: [SignInAccessService, SignInAccessRepository],
})
export class SignInAccessModule {}
