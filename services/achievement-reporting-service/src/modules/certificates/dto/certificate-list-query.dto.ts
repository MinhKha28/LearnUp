import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
export class CertificateListQuery {
  @IsOptional()
  @IsString()
  @Matches(/^(?:[1-9][0-9]?|100)$/)
  size?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  cursor?: string;
}
