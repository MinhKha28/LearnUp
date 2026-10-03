import { PartialType } from '@nestjs/swagger';
import { CreateContentReportDto } from './create-content-reports.dto';

export class UpdateContentReportDto extends PartialType(CreateContentReportDto) {}
