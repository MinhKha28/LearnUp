import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { InternalAuthGuard } from './common/guards/internal-auth.guard';
import { AssessmentActivityModule } from './modules/assessment-activity/assessment-activity.module';
import { CompletionSnapshotModule } from './modules/completion-snapshot/completion-snapshot.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { IntegrationsModule } from './infrastructure/clients/integrations.module';
import { InstructorSubmissionsModule } from './modules/instructor-submissions/instructor-submissions.module';
import { LearnerAssessmentsModule } from './modules/learner-assessments/learner-assessments.module';
import { LearnerSubmissionsModule } from './modules/learner-submissions/learner-submissions.module';
import { PeerReviewModule } from './modules/peer-review/peer-review.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { QuizModule } from './modules/quiz/quiz.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    IntegrationsModule,
    AssessmentActivityModule,
    CompletionSnapshotModule,
    InstructorSubmissionsModule,
    LearnerAssessmentsModule,
    LearnerSubmissionsModule,
    AssessmentsModule,
    PeerReviewModule,
    QuizModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalAuthGuard,
    },
  ],
})
export class AppModule {}
