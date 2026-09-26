import { describe, it, expect } from 'vitest';
import { USER_ROLES, type UserRole } from '@learnup/ts-common';
import {
  getHomePath,
  getNavItems,
  getNavSections,
  getPostLoginPath,
  isPathAllowedForRole,
  NAVIGATION,
  ROLE_BASE_PATHS,
  type NavLabelKey,
} from '@/app/navigation';
import { CURRENT_MILESTONE, type Milestone } from '@/config/milestone';
import { i18n } from '@/i18n';

const paths = (role: UserRole, milestone: Milestone) =>
  getNavItems(role, milestone).map((item) => item.path);

describe('navigation config', () => {
  it('defines a menu for exactly the roles of @learnup/ts-common', () => {
    expect(Object.keys(NAVIGATION).sort()).toEqual([...USER_ROLES].sort());
  });

  it('starts at milestone 1', () => {
    expect(CURRENT_MILESTONE).toBe(1);
  });

  it.each([
    ['ADMIN', 1, ['/admin/plans']],
    ['ADMIN', 3, ['/admin/plans', '/admin/audit-log']],
    ['ORGANIZER', 1, ['/organizer/instructors', '/organizer/learners', '/organizer/enrollments']],
    [
      'ORGANIZER',
      2,
      [
        '/organizer/instructors',
        '/organizer/learners',
        '/organizer/courses',
        '/organizer/enrollments',
      ],
    ],
    [
      'ORGANIZER',
      3,
      [
        '/organizer/instructors',
        '/organizer/learners',
        '/organizer/courses',
        '/organizer/enrollments',
        '/organizer/audit-log',
      ],
    ],
    ['INSTRUCTOR', 1, ['/instructor/courses']],
    ['INSTRUCTOR', 3, ['/instructor/courses', '/instructor/peer-review-cycles']],
    ['LEARNER', 1, ['/learner/courses', '/learner/catalog']],
    ['LEARNER', 2, ['/learner/courses', '/learner/catalog', '/learner/assessments']],
    [
      'LEARNER',
      3,
      [
        '/learner/courses',
        '/learner/catalog',
        '/learner/assessments',
        '/learner/peer-reviews',
        '/learner/certificates',
      ],
    ],
  ] as const)('%s at milestone %i shows %j', (role, milestone, expected) => {
    expect(paths(role, milestone)).toEqual(expected);
  });

  it('defaults to CURRENT_MILESTONE', () => {
    for (const role of USER_ROLES) {
      expect(getNavItems(role)).toEqual(getNavItems(role, CURRENT_MILESTONE));
    }
  });

  it('drops sections left without items', () => {
    expect(getNavSections('LEARNER', 1).map((section) => section.id)).toEqual(['learning']);
    expect(getNavSections('LEARNER', 3).map((section) => section.id)).toEqual([
      'learning',
      'assessment',
      'achievements',
    ]);
  });

  it('keeps every item inside its role area, with a use case and a translated label', () => {
    for (const role of USER_ROLES) {
      for (const item of getNavItems(role, 3)) {
        expect(item.path.startsWith(`${ROLE_BASE_PATHS[role]}/`), item.path).toBe(true);
        expect(item.useCase).toMatch(/^UC\d+$/);
        for (const lng of ['vi', 'en']) {
          expect(i18n.exists(`nav:${item.labelKey}`, { lng }), `${lng} nav:${item.labelKey}`).toBe(
            true
          );
        }
      }
    }
  });

  it('only accepts existing nav keys as labels', () => {
    // @ts-expect-error — not a key of the nav namespace
    const invalid: NavLabelKey = 'learner.doesNotExist';
    expect(invalid).toBeTruthy();
  });
});

describe('getHomePath', () => {
  it.each([
    ['ADMIN', '/admin/plans'],
    ['ORGANIZER', '/organizer/instructors'],
    ['INSTRUCTOR', '/instructor/courses'],
    ['LEARNER', '/learner/courses'],
  ] as const)('%s → %s', (role, home) => {
    expect(getHomePath(role)).toBe(home);
  });

  it('is the first item of each role, available from milestone 1', () => {
    for (const role of USER_ROLES) {
      const first = NAVIGATION[role][0].items[0];
      expect(first.availableFrom).toBe(1);
      expect(getHomePath(role)).toBe(first.path);
    }
  });
});

describe('getPostLoginPath', () => {
  it('keeps a requested page the role may open', () => {
    expect(getPostLoginPath('LEARNER', '/learner/catalog')).toBe('/learner/catalog');
    expect(getPostLoginPath('LEARNER', '/account/profile')).toBe('/account/profile');
  });

  it("replaces a page in another role's area with the role home", () => {
    expect(isPathAllowedForRole('LEARNER', '/admin/plans')).toBe(false);
    expect(getPostLoginPath('LEARNER', '/admin/plans')).toBe('/learner/courses');
  });

  it('does not mistake a longer segment for a role area', () => {
    expect(isPathAllowedForRole('LEARNER', '/administration')).toBe(true);
  });

  it('falls back to the role home without a requested page', () => {
    expect(getPostLoginPath('INSTRUCTOR', undefined)).toBe('/instructor/courses');
  });
});
