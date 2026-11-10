import { ApiProperty } from '@nestjs/swagger';

export class OrganizationUsageDto {
  @ApiProperty({ format: 'uuid' })
  organizationId!: string;

  @ApiProperty({
    minimum: 0,
    description: 'Version chains that still have at least one version (BR-1)',
  })
  courseChains!: number;

  @ApiProperty({
    description:
      'Bytes of Ready, not released media files (BR-74), as a string',
    example: '1048576',
  })
  storageBytes!: string;
}
