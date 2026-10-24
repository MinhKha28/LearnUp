import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { LookupUsersDto } from './dto/lookup-users.dto';
import { InternalUsersRepository } from './internal-users.repository';

@Injectable()
export class InternalUsersService {
  private readonly logger = new Logger(InternalUsersService.name);

  constructor(private readonly repository: InternalUsersRepository) {}

  /**
   * Chuẩn @ServiceCall (#145): tổ chức trong body phải trùng header x-organization-id, lệch thì 404.
   * Tạm chấp nhận khi thiếu header cho tới khi learning-service gửi header này.
   */
  async lookup(headerOrganizationId: string | undefined, dto: LookupUsersDto) {
    if (headerOrganizationId === undefined) {
      this.logger.warn(
        'Internal user lookup without x-organization-id; using organizationId from the body.',
      );
    } else if (
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
