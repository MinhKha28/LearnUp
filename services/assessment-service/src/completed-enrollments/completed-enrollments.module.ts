import { Module } from '@nestjs/common';
import { CompletedEnrollmentsController } from './completed-enrollments.controller';
import { CompletedEnrollmentsService } from './completed-enrollments.service';

@Module({
  controllers: [CompletedEnrollmentsController],
  providers: [CompletedEnrollmentsService],
  exports: [CompletedEnrollmentsService],
})
export class CompletedEnrollmentsModule {}
