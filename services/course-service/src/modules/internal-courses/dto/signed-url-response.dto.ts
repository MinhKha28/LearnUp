import { ApiProperty } from '@nestjs/swagger';

export class SignedUrlResponseDto {
  @ApiProperty()
  url!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;

  @ApiProperty()
  mimeType!: string;
}
