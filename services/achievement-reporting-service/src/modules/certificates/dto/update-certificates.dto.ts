import { PartialType } from '@nestjs/swagger';
import { CreateCertificateDto } from './create-certificates.dto';

export class UpdateCertificateDto extends PartialType(CreateCertificateDto) {}
