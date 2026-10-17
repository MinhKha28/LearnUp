import { Module } from '@nestjs/common';
import { UserDirectoryController } from './user-directory.controller';
import { UserDirectoryRepository } from './user-directory.repository';
import { UserDirectoryService } from './user-directory.service';

@Module({
  controllers: [UserDirectoryController],
  providers: [UserDirectoryService, UserDirectoryRepository],
})
export class UserDirectoryModule {}
