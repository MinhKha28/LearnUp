import { describe, expect, it, jest } from '@jest/globals';
import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const respond = (exception: HttpException) => {
  const response = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  response.status.mockReturnValue(response);

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/api/v1/courses/x' }),
    }),
  } as unknown as ArgumentsHost;

  new HttpExceptionFilter().catch(exception, host);

  return response;
};

describe('HttpExceptionFilter Retry-After', () => {
  it('sets Retry-After from retryAfterSeconds in the error body', () => {
    const response = respond(
      new ServiceUnavailableException({
        statusCode: 503,
        code: 'READING_PARSE_BUSY',
        message: 'Reading processing is busy. Retry later.',
        retryAfterSeconds: 10,
      }),
    );

    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '10');
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it.each([
    ['a string body', new BadRequestException('Unable to read PDF.')],
    [
      'an object body without retryAfterSeconds',
      new ServiceUnavailableException({ code: 'OTHER', message: 'Down.' }),
    ],
    [
      'a non-integer retryAfterSeconds',
      new HttpException({ retryAfterSeconds: '10' }, 503),
    ],
    [
      'a negative retryAfterSeconds',
      new HttpException({ retryAfterSeconds: -1 }, 503),
    ],
  ])('does not set Retry-After for %s', (_name, exception) => {
    expect(respond(exception).setHeader).not.toHaveBeenCalled();
  });
});
