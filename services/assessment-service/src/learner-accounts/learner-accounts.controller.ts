import { Controller } from '@nestjs/common';
import { LearnerAccountsService } from './learner-accounts.service';

@Controller('learner-accounts')
export class LearnerAccountsController {
  constructor(private readonly service: LearnerAccountsService) {}
}
