import { Injectable, NotFoundException } from '@nestjs/common';
import { LookupUsersDto } from './dto/lookup-users.dto';
import { InternalUsersRepository } from './internal-users.repository';

@Injectable()
export class InternalUsersService {
  constructor(private readonly repository: InternalUsersRepository) {}

  /** Chuẩn @ServiceCall (#145): tổ chức trong body phải trùng header x-organization-id; thiếu hoặc lệch thì 404. */
  async lookup(headerOrganizationId: string | undefined, dto: LookupUsersDto) {
    if (
      !headerOrganizationId ||
      headerOrganizationId.toLowerCase() !== dto.organizationId.toLowerCase()
    ) {
      throw new NotFoundException({
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Không tìm thấy tổ chức.',
      });
    }

    return {
      items: await this.repository.lookup(dto.organizationId, dto.userIds),
    };
  }
}
