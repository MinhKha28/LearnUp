import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { PlatformRoleType } from './roles.constant';

export const ROLES_KEY = 'learnup:roles';

/**
 * Decorator to declare required platform roles on NestJS controllers or route handlers.
 *
 * Example:
 *   @Roles(PlatformRole.ORGANIZER, PlatformRole.ADMIN)
 *   @Get('org-settings')
 *   getOrgSettings() { ... }
 */
export const Roles = (...roles: PlatformRoleType[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
