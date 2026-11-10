import { Injectable, NotFoundException } from '@nestjs/common';
import { LookupUsersDto } from './dto/lookup-users.dto';
import { InternalUsersRepository } from './internal-users.repository';
import { IUserExistence } from './interfaces/user-existence.interface';

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

  /**
   * Identity hỏi trước khi cấp lại email của tài khoản cũ cho tài khoản mới (BR-38, BR-39).
   * Còn trong DB và chưa xóa mềm (kể cả Organizer Pending của đăng ký còn hạn) thì exists = true;
   * đã xóa mềm hoặc chưa từng có thì exists = false. Không đọc theo tổ chức vì identity không biết tổ chức.
   */
  async existence(userId: string): Promise<IUserExistence> {
    const user = await this.repository.findDeletedAt(userId);
    return { exists: user !== null && user.deletedAt === null };
  }
}
