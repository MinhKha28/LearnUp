import { Module } from '@nestjs/common';
import { EnrollmentStatusIntervalsController } from './enrollment-status-intervals.controller';
import { EnrollmentStatusIntervalsService } from './enrollment-status-intervals.service';

@Module({
  controllers: [EnrollmentStatusIntervalsController],
  providers: [EnrollmentStatusIntervalsService],
  exports: [EnrollmentStatusIntervalsService],
})
export class EnrollmentStatusIntervalsModule {}
