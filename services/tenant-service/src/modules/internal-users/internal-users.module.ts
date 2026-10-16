import { Module } from '@nestjs/common';
import { InternalUsersController } from './internal-users.controller';
import { InternalUsersRepository } from './internal-users.repository';
import { InternalUsersService } from './internal-users.service';

@Module({
  controllers: [InternalUsersController],
  providers: [InternalUsersService, InternalUsersRepository],
})
export class InternalUsersModule {}
