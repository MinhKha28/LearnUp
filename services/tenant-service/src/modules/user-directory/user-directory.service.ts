import { BadRequestException, Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { IUserDisplayName } from './interfaces/user-display-name.interface';
import { UserDirectoryRepository } from './user-directory.repository';

export const DELETED_STATUS = 'Deleted';

@Injectable()
export class UserDirectoryService {
  constructor(
    private readonly userDirectoryRepository: UserDirectoryRepository,
  ) {}

  async displayNames(
    organizationId: string | undefined,
    userIds: string[],
  ): Promise<IUserDisplayName[]> {
    if (!organizationId || !isUUID(organizationId)) {
      throw new BadRequestException({
        code: 'ORGANIZATION_REQUIRED',
        message: 'Thiếu tổ chức của người gọi.',
      });
    }
    const users = await this.userDirectoryRepository.findInOrganization(
      organizationId,
      userIds,
    );
    return users.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.deletedAt ? DELETED_STATUS : user.status,
    }));
  }
}
