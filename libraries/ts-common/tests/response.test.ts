import { describe, expect, it } from 'vitest';
import { createApiError, STANDARD_ERROR_CODES } from '../src/api/errors.js';
import { createPageResponse, type ApiResponse } from '../src/api/response.js';

describe('API Response & Pagination Utilities', () => {
  it('should represent a valid success response', () => {
    const data = { id: 'course-1', title: 'Microservices with NestJS' };
    const res: ApiResponse<typeof data> = {
      statusCode: 200,
      message: 'Course retrieved',
      data,
    };

    expect(res).toEqual({ statusCode: 200, message: 'Course retrieved', data });
    expect(res).not.toHaveProperty('success');
    expect(res).not.toHaveProperty('error');
  });

  it('should represent an empty success response', () => {
    const res: ApiResponse<void> = {
      statusCode: 200,
      message: 'Operation completed',
      data: undefined,
    };

    expect(res).toEqual({
      statusCode: 200,
      message: 'Operation completed',
      data: undefined,
    });
    expect(res).not.toHaveProperty('success');
    expect(res).not.toHaveProperty('error');
  });

  it('should create an API error using code, message, and details', () => {
    const error = createApiError(
      STANDARD_ERROR_CODES.RESOURCE_NOT_FOUND,
      'Learner not found',
      ['Learner ID 123 does not exist in organization']
    );

    expect(error).toEqual({
      code: 'RESOURCE_NOT_FOUND',
      message: 'Learner not found',
      details: ['Learner ID 123 does not exist in organization'],
    });
  });

  it('should compute PageResponse metadata accurately for multi-page datasets', () => {
    const items = ['Item A', 'Item B'];
    const pageRes = createPageResponse(items, 1, 2, 5);

    expect(pageRes).toEqual({
      meta: { current: 1, pageSize: 2, total: 5, pages: 3 },
      items,
    });
  });

  it('should compute PageResponse metadata accurately for single page datasets', () => {
    const items = ['Item A'];
    const pageRes = createPageResponse(items, 1, 10, 1);

    expect(pageRes).toEqual({
      meta: { current: 1, pageSize: 10, total: 1, pages: 1 },
      items,
    });
  });

  it('should create empty PageResponse', () => {
    const emptyPage = createPageResponse([], 1, 20, 0);

    expect(emptyPage).toEqual({
      meta: { current: 1, pageSize: 20, total: 0, pages: 0 },
      items: [],
    });
  });
});
