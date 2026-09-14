import { describe, expect, it } from 'vitest';
import { STANDARD_ERROR_CODES } from '../src/api/errors.js';
import {
  createEmptyPageResponse,
  createEmptySuccessResponse,
  createErrorResponse,
  createPageResponse,
  createSuccessResponse,
} from '../src/api/response.js';

describe('API Response & Pagination Utilities', () => {
  it('should create a valid success response', () => {
    const data = { id: 'course-1', title: 'Microservices with NestJS' };
    const res = createSuccessResponse(data);

    expect(res.success).toBe(true);
    expect(res.data).toEqual(data);
    expect(res.error).toBeUndefined();
  });

  it('should create an empty success response', () => {
    const res = createEmptySuccessResponse();

    expect(res.success).toBe(true);
    expect(res.data).toBeUndefined();
    expect(res.error).toBeUndefined();
  });

  it('should create an error response using code, message, and details', () => {
    const res = createErrorResponse(
      STANDARD_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Learner not found',
      ['Learner ID 123 does not exist in organization']
    );

    expect(res.success).toBe(false);
    expect(res.data).toBeUndefined();
    expect(res.error).toEqual({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Learner not found',
      details: ['Learner ID 123 does not exist in organization'],
    });
  });

  it('should compute PageResponse metadata accurately for multi-page datasets', () => {
    const items = ['Item A', 'Item B'];
    const pageRes = createPageResponse(items, 1, 2, 5);

    expect(pageRes.items).toEqual(items);
    expect(pageRes.page).toBe(1);
    expect(pageRes.size).toBe(2);
    expect(pageRes.totalElements).toBe(5);
    expect(pageRes.totalPages).toBe(3);
    expect(pageRes.first).toBe(false);
    expect(pageRes.last).toBe(false);
  });

  it('should compute PageResponse metadata accurately for single page datasets', () => {
    const items = ['Item A'];
    const pageRes = createPageResponse(items, 0, 10, 1);

    expect(pageRes.totalPages).toBe(1);
    expect(pageRes.first).toBe(true);
    expect(pageRes.last).toBe(true);
  });

  it('should create empty PageResponse', () => {
    const emptyPage = createEmptyPageResponse(0, 20);

    expect(emptyPage.items).toEqual([]);
    expect(emptyPage.totalElements).toBe(0);
    expect(emptyPage.totalPages).toBe(0);
    expect(emptyPage.first).toBe(true);
    expect(emptyPage.last).toBe(true);
  });
});
