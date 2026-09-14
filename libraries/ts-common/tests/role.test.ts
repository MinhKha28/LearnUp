import { describe, expect, it } from 'vitest';
import {
  isValidUserRole,
  parseUserRole,
  requireUserRole,
  USER_ROLES,
  UserRole,
} from '../src/auth/role.js';

describe('UserRole Utilities', () => {
  it('should define exactly four valid roles', () => {
    expect(USER_ROLES).toEqual(['ADMIN', 'ORGANIZER', 'INSTRUCTOR', 'LEARNER']);
  });

  it('should validate valid roles with isValidUserRole', () => {
    expect(isValidUserRole('ADMIN')).toBe(true);
    expect(isValidUserRole('ORGANIZER')).toBe(true);
    expect(isValidUserRole('INSTRUCTOR')).toBe(true);
    expect(isValidUserRole('LEARNER')).toBe(true);
    expect(isValidUserRole('admin')).toBe(true);
    expect(isValidUserRole(' organizer ')).toBe(true);
  });

  it('should reject invalid roles with isValidUserRole', () => {
    expect(isValidUserRole('SUPER_ADMIN')).toBe(false);
    expect(isValidUserRole('TENANT_ADMIN')).toBe(false);
    expect(isValidUserRole('ORG_ADMIN')).toBe(false);
    expect(isValidUserRole('HACKER')).toBe(false);
    expect(isValidUserRole('')).toBe(false);
    expect(isValidUserRole(null)).toBe(false);
    expect(isValidUserRole(undefined)).toBe(false);
    expect(isValidUserRole(123)).toBe(false);
  });

  it('should parse valid roles from headers', () => {
    expect(parseUserRole('ADMIN')).toBe('ADMIN');
    expect(parseUserRole('organizer')).toBe('ORGANIZER');
    expect(parseUserRole(' Instructor ')).toBe('INSTRUCTOR');
    expect(parseUserRole('learner')).toBe('LEARNER');
  });

  it('should return null for empty, null, or invalid roles in parseUserRole', () => {
    expect(parseUserRole(null)).toBeNull();
    expect(parseUserRole(undefined)).toBeNull();
    expect(parseUserRole('')).toBeNull();
    expect(parseUserRole('   ')).toBeNull();
    expect(parseUserRole('SUPER_ADMIN')).toBeNull();
    expect(parseUserRole('MANAGER')).toBeNull();
  });

  it('should parse valid role with requireUserRole or throw on invalid role', () => {
    expect(requireUserRole('ORGANIZER')).toBe('ORGANIZER');
    expect(() => requireUserRole('INVALID_ROLE')).toThrowError(/Invalid user role: 'INVALID_ROLE'/);
  });
});
