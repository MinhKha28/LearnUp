import { PartialType } from '@nestjs/swagger';
import { CreateOutboxEventDto } from './create-outbox.dto';

export class UpdateOutboxEventDto extends PartialType(CreateOutboxEventDto) {}
