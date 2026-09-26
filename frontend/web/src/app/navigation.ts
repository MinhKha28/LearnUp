import type { ParseKeys } from 'i18next';
import type { LucideIcon } from 'lucide-react';
import {
  Award,
  BookOpen,
  ClipboardList,
  Compass,
  CreditCard,
  Library,
  ListTodo,
  Presentation,
  RefreshCw,
  ScrollText,
  UserCheck,
  Users,
} from 'lucide-react';
import type { UserRole } from '@learnup/ts-common';
import { CURRENT_MILESTONE, type Milestone } from '@/config/milestone';

/** A translation key in the "nav" namespace. */
export type NavLabelKey = ParseKeys<'nav'>;

export interface NavItem {
  labelKey: NavLabelKey;
  path: string;
  icon: LucideIcon;
  /** Use case in docs/business that the page implements. */
  useCase: string;
  /** First milestone in which the item (and its route) is available. */
  availableFrom: Milestone;
}

export interface NavSection {
  id: string;
  labelKey: NavLabelKey;
  items: NavItem[];
}

export const ROLE_BASE_PATHS: Record<UserRole, string> = {
  ADMIN: '/admin',
  ORGANIZER: '/organizer',
  INSTRUCTOR: '/instructor',
  LEARNER: '/learner',
};

/**
 * Sidebar menu per role. The first item of each role is that role's home page.
 * Notifications (header bell), Profile and Change password (avatar menu) are not listed here.
 */
export const NAVIGATION: Record<UserRole, NavSection[]> = {
  ADMIN: [
    {
      id: 'platform',
      labelKey: 'sections.platform',
      items: [
        {
          labelKey: 'admin.plans',
          path: '/admin/plans',
          icon: CreditCard,
          useCase: 'UC43',
          availableFrom: 1,
        },
      ],
    },
    {
      id: 'monitoring',
      labelKey: 'sections.monitoring',
      items: [
        {
          labelKey: 'admin.auditLog',
          path: '/admin/audit-log',
          icon: ScrollText,
          useCase: 'UC51',
          availableFrom: 3,
        },
      ],
    },
  ],
  ORGANIZER: [
    {
      id: 'people',
      labelKey: 'sections.people',
      items: [
        {
          labelKey: 'organizer.instructors',
          path: '/organizer/instructors',
          icon: Presentation,
          useCase: 'UC12',
          availableFrom: 1,
        },
        {
          labelKey: 'organizer.learners',
          path: '/organizer/learners',
          icon: Users,
          useCase: 'UC13',
          availableFrom: 1,
        },
      ],
    },
    {
      id: 'training',
      labelKey: 'sections.training',
      items: [
        {
          labelKey: 'organizer.courses',
          path: '/organizer/courses',
          icon: BookOpen,
          useCase: 'UC21',
          availableFrom: 2,
        },
        {
          labelKey: 'organizer.enrollments',
          path: '/organizer/enrollments',
          icon: ClipboardList,
          useCase: 'UC24',
          availableFrom: 1,
        },
      ],
    },
    {
      id: 'monitoring',
      labelKey: 'sections.monitoring',
      items: [
        {
          labelKey: 'organizer.auditLog',
          path: '/organizer/audit-log',
          icon: ScrollText,
          useCase: 'UC50',
          availableFrom: 3,
        },
      ],
    },
  ],
  INSTRUCTOR: [
    {
      id: 'teaching',
      labelKey: 'sections.teaching',
      items: [
        {
          labelKey: 'instructor.courses',
          path: '/instructor/courses',
          icon: BookOpen,
          useCase: 'UC14',
          availableFrom: 1,
        },
      ],
    },
    {
      id: 'assessment',
      labelKey: 'sections.assessment',
      items: [
        {
          labelKey: 'instructor.peerReviewCycles',
          path: '/instructor/peer-review-cycles',
          icon: RefreshCw,
          useCase: 'UC33',
          availableFrom: 3,
        },
      ],
    },
  ],
  LEARNER: [
    {
      id: 'learning',
      labelKey: 'sections.learning',
      items: [
        {
          labelKey: 'learner.courses',
          path: '/learner/courses',
          icon: Library,
          useCase: 'UC26',
          availableFrom: 1,
        },
        {
          labelKey: 'learner.catalog',
          path: '/learner/catalog',
          icon: Compass,
          useCase: 'UC25',
          availableFrom: 1,
        },
      ],
    },
    {
      id: 'assessment',
      labelKey: 'sections.assessment',
      items: [
        {
          labelKey: 'learner.assessments',
          path: '/learner/assessments',
          icon: ListTodo,
          useCase: 'UC29',
          availableFrom: 2,
        },
        {
          labelKey: 'learner.peerReviews',
          path: '/learner/peer-reviews',
          icon: UserCheck,
          useCase: 'UC31',
          availableFrom: 3,
        },
      ],
    },
    {
      id: 'achievements',
      labelKey: 'sections.achievements',
      items: [
        {
          labelKey: 'learner.certificates',
          path: '/learner/certificates',
          icon: Award,
          useCase: 'UC34',
          availableFrom: 3,
        },
      ],
    },
  ],
};

/** The role's sections with only the items available in `milestone`; empty sections are dropped. */
export const getNavSections = (
  role: UserRole,
  milestone: Milestone = CURRENT_MILESTONE
): NavSection[] =>
  NAVIGATION[role]
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.availableFrom <= milestone),
    }))
    .filter((section) => section.items.length > 0);

export const getNavItems = (role: UserRole, milestone: Milestone = CURRENT_MILESTONE): NavItem[] =>
  getNavSections(role, milestone).flatMap((section) => section.items);

/** Where a signed-in user of `role` lands: the first menu item available in this milestone. */
export const getHomePath = (role: UserRole): string =>
  getNavItems(role)[0]?.path ?? ROLE_BASE_PATHS[role];

const isWithin = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

/** False when `path` belongs to another role's area (RoleRoute would answer 403). */
export const isPathAllowedForRole = (role: UserRole, path: string): boolean =>
  (Object.keys(ROLE_BASE_PATHS) as UserRole[]).every(
    (other) => other === role || !isWithin(path, ROLE_BASE_PATHS[other])
  );

/**
 * Where to go after signing in: the page the user was sent away from, unless it belongs to
 * another role (e.g. left over from the previous user's session); otherwise the role's home.
 */
export const getPostLoginPath = (role: UserRole, requestedPath?: string | null): string =>
  requestedPath && isPathAllowedForRole(role, requestedPath) ? requestedPath : getHomePath(role);
