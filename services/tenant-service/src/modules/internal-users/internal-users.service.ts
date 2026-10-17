import { Injectable } from '@nestjs/common';
import { LookupUsersDto } from './dto/lookup-users.dto';
import { InternalUsersRepository } from './internal-users.repository';

@Injectable()
export class InternalUsersService {
  constructor(private readonly repository: InternalUsersRepository) {}

  async lookup(dto: LookupUsersDto) {
    return {
      items: await this.repository.lookup(dto.organizationId, dto.userIds),
    };
  }
}
