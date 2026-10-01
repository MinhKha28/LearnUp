import { Module } from '@nestjs/common';
import { ReportExportsController } from './report-exports.controller';
import { ReportExportsService } from './report-exports.service';

@Module({
  controllers: [ReportExportsController],
  providers: [ReportExportsService],
  exports: [ReportExportsService],
})
export class ReportExportsModule {}
