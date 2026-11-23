import { ServiceUnavailableException } from '@nestjs/common';

export const READING_PARSE_BUSY_CODE = 'READING_PARSE_BUSY';

// Quá tải tạm thời: client nên thử lại sau (RFC 9110 §15.6.4, Retry-After).
export const READING_PARSE_BUSY_RETRY_AFTER_SECONDS = 10;

// HttpExceptionFilter đặt header Retry-After từ retryAfterSeconds.
export const readingParseBusyException = () =>
  new ServiceUnavailableException({
    statusCode: 503,
    code: READING_PARSE_BUSY_CODE,
    message: 'Reading processing is busy. Retry later.',
    retryAfterSeconds: READING_PARSE_BUSY_RETRY_AFTER_SECONDS,
  });
