import { IsUUID } from 'class-validator';

export class TransferReceiversQueryDto {
  @IsUUID('all')
  excludeInstructorId!: string;
}
