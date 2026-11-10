import { Module } from '@nestjs/common';
import { QuizAttemptsModule } from '../quiz-attempts/quiz-attempts.module';
import { CompletionSnapshotController } from './completion-snapshot.controller';
import { CompletionSnapshotRepository } from './completion-snapshot.repository';
import { CompletionSnapshotService } from './completion-snapshot.service';

@Module({
  imports: [QuizAttemptsModule],
  controllers: [CompletionSnapshotController],
  providers: [CompletionSnapshotService, CompletionSnapshotRepository],
})
export class CompletionSnapshotModule {}
