import type { UserRole } from '@learnup/ts-common';
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Chỉ cho các role đã liệt kê gọi handler (hoặc cả controller). */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
