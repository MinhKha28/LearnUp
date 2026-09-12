import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../../src/exception/business.exception';
import { ResourceNotFoundException } from '../../src/exception/resource-not-found.exception';
import { ForbiddenException } from '../../src/exception/forbidden.exception';
import { ConflictException } from '../../src/exception/conflict.exception';
import { UnauthorizedException } from '../../src/exception/unauthorized.exception';
import { InvalidInputException } from '../../src/exception/invalid-input.exception';
import { ErrorCode } from '../../src/exception/error-codes.constant';

describe('Exception Hierarchy', () => {
  it('should instantiate BusinessException with status 400', () => {
    const ex = new BusinessException('Domain constraint violated');
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ex.errorCode).toBe(ErrorCode.INVALID_INPUT);
    expect(ex.message).toBe('Domain constraint violated');
  });

  it('should instantiate ResourceNotFoundException with status 404', () => {
    const ex = new ResourceNotFoundException('Course', 'crs_100');
    expect(ex.getStatus()).toBe(HttpStatus.NOT_FOUND);
    expect(ex.errorCode).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(ex.message).toContain('crs_100');
  });

  it('should instantiate ForbiddenException with status 403', () => {
    const ex = new ForbiddenException('Unauthorized access', 'ADMIN');
    expect(ex.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(ex.errorCode).toBe(ErrorCode.FORBIDDEN);
    expect(ex.message).toContain('ADMIN');
  });

  it('should instantiate ConflictException with status 409', () => {
    const ex = new ConflictException('User', 'email', 'test@enterprise.com');
    expect(ex.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(ex.errorCode).toBe(ErrorCode.CONFLICT);
    expect(ex.message).toContain('test@enterprise.com');
  });

  it('should instantiate UnauthorizedException with status 401', () => {
    const ex = new UnauthorizedException('Token expired');
    expect(ex.getStatus()).toBe(HttpStatus.UNAUTHORIZED);
    expect(ex.errorCode).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('should instantiate InvalidInputException with details', () => {
    const details = [{ field: 'email', issue: 'Invalid format' }];
    const ex = new InvalidInputException('Validation failed', details);
    expect(ex.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(ex.details).toEqual(details);
  });
});
