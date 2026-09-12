import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../../src/exception/http-exception.filter';
import { ResourceNotFoundException } from '../../src/exception/resource-not-found.exception';
import { ErrorCode } from '../../src/exception/error-codes.constant';
import { HeaderConstants } from '../../src/context/header.constants';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  function createMockHost(headers: Record<string, string> = {}) {
    const jsonMock = jest.fn();
    const statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({ status: statusMock }),
        getRequest: () => ({ headers }),
      }),
    } as unknown as ArgumentsHost;

    return { host, statusMock, jsonMock };
  }

  it('should transform ResourceNotFoundException into standard ApiError response', () => {
    const { host, statusMock, jsonMock } = createMockHost({
      [HeaderConstants.X_CORRELATION_ID]: 'corr_abc',
    });

    const ex = new ResourceNotFoundException('Course', 'crs_123');
    filter.catch(ex, host);

    expect(statusMock).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          code: ErrorCode.RESOURCE_NOT_FOUND,
          correlationId: 'corr_abc',
        }),
      }),
    );
  });
});
