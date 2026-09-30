import { PartialType } from '@nestjs/swagger';
import { CreateAccountTokenDto } from './create-account-tokens.dto';

export class UpdateAccountTokenDto extends PartialType(CreateAccountTokenDto) {}
