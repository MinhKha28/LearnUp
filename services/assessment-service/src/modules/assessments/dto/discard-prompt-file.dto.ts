import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** UC19.2 / UC19.3 — the key of an uploaded prompt file the Instructor did not keep. */
export class DiscardPromptFileDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  fileKey!: string;
}
