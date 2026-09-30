import { Controller } from '@nestjs/common';
import { ContentReportsService } from './content-reports.service';

@Controller('content-reports')
export class ContentReportsController {
  constructor(private readonly service: ContentReportsService) {}
}
