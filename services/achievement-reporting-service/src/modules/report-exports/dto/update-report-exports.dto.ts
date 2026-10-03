import { PartialType } from '@nestjs/swagger';
import { CreateReportExportDto } from './create-report-exports.dto';

export class UpdateReportExportDto extends PartialType(CreateReportExportDto) {}
