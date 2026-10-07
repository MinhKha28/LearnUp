import { Controller } from '@nestjs/common';
import { ReportExportsService } from './report-exports.service';

@Controller('report-exports')
export class ReportExportsController {
  constructor(private readonly service: ReportExportsService) {}
}
