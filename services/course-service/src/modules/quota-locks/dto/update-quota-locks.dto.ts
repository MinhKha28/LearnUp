import { PartialType } from '@nestjs/swagger';
import { CreateQuotaLockDto } from './create-quota-locks.dto';

export class UpdateQuotaLockDto extends PartialType(CreateQuotaLockDto) {}
