import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { ResponseTransformInterceptor } from '../../src/response/response-transform.interceptor';
import { createPageResponse } from '../../src/pagination/page-response.interface';

describe('ResponseTransformInterceptor', () => {
  let interceptor: ResponseTransformInterceptor<unknown>;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new ResponseTransformInterceptor(reflector);
  });

  function createMockContext(): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  }

  it('should wrap raw object return into ApiResponse', (done) => {
    const rawData = { message: 'Hello' };
    const callHandler: CallHandler = {
      handle: () => of(rawData),
    };

    interceptor.intercept(createMockContext(), callHandler).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual(rawData);
        expect(result.error).toBeNull();
        done();
      },
      error: done,
    });
  });

  it('should unwrap PageResponse items into data and meta into meta', (done) => {
    const paginated = createPageResponse(['A', 'B'], 0, 10, 2);
    const callHandler: CallHandler = {
      handle: () => of(paginated),
    };

    interceptor.intercept(createMockContext(), callHandler).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.data).toEqual(['A', 'B']);
        expect(result.meta?.totalElements).toBe(2);
        done();
      },
      error: done,
    });
  });
});
