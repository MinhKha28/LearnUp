import { Controller } from '@nestjs/common';
import { AccountTokensService } from './account-tokens.service';

@Controller('account-tokens')
export class AccountTokensController {
  constructor(private readonly service: AccountTokensService) {}
}
