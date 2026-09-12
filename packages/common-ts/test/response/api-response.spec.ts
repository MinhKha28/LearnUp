import {
  createSuccessResponse,
  createErrorResponse,
} from '../../src/response/api-response.interface';
import { createPageMeta } from '../../src/pagination/page-meta.interface';
import { ApiError } from '../../src/exception/api-error.interface';
import { ErrorCode } from '../../src/exception/error-codes.constant';

describe('ApiResponse', () => {
  it('should create valid success response envelope', () => {
    const data = { id: 1, name: 'LearnUP Course' };
    const res = createSuccessResponse(data);

    expect(res.success).toBe(true);
    expect(res.data).toEqual(data);
    expect(res.meta).toBeNull();
    expect(res.error).toBeNull();
    expect(res.timestamp).toBeDefined();
  });

  it('should create success response with pagination meta', () => {
    const meta = createPageMeta(0, 20, 100);
    const res = createSuccessResponse(['item1', 'item2'], meta);

    expect(res.success).toBe(true);
    expect(res.data).toEqual(['item1', 'item2']);
    expect(res.meta?.totalElements).toBe(100);
    expect(res.meta?.totalPages).toBe(5);
  });

  it('should create valid error response envelope', () => {
    const error: ApiError = {
      code: ErrorCode.RESOURCE_NOT_FOUND,
      message: 'Resource not found',
      correlationId: 'corr_test',
    };
    const res = createErrorResponse(error);

    expect(res.success).toBe(false);
    expect(res.data).toBeNull();
    expect(res.meta).toBeNull();
    expect(res.error?.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(res.error?.correlationId).toBe('corr_test');
    expect(res.timestamp).toBeDefined();
  });
});
