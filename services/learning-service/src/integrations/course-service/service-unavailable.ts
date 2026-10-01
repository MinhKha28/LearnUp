import { createApiError } from '@learnup/ts-common';
import { ServiceUnavailableException } from '@nestjs/common';

const BUSY_MESSAGE = 'Hệ thống đang bận, vui lòng thử lại';

/** 503 chung khi service phụ thuộc (course-service, tenant) không phục vụ được request. */
export function serviceUnavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    createApiError('SERVICE_UNAVAILABLE', BUSY_MESSAGE),
  );
}
