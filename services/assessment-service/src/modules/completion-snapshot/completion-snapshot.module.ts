import { Module } from '@nestjs/common';
import { CompletionSnapshotController } from './completion-snapshot.controller';
import { CompletionSnapshotRepository } from './completion-snapshot.repository';
import { CompletionSnapshotService } from './completion-snapshot.service';

@Module({
  controllers: [CompletionSnapshotController],
  providers: [CompletionSnapshotService, CompletionSnapshotRepository],
})
export class CompletionSnapshotModule {}
