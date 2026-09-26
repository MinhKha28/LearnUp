import type { UserRole } from '@learnup/ts-common';

/** i18n key (common namespace) of each role's display name. */
export const ROLE_LABEL_KEYS = {
  ADMIN: 'roles.admin',
  ORGANIZER: 'roles.organizer',
  INSTRUCTOR: 'roles.instructor',
  LEARNER: 'roles.learner',
} as const satisfies Record<UserRole, string>;
