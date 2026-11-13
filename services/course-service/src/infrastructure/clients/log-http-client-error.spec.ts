import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { AxiosError, AxiosHeaders } from 'axios';
import { logHttpClientError } from './log-http-client-error';

describe('logHttpClientError', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs request metadata without headers, the query string, or the body', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const path = '/api/v1/users/batch';
    const url = `https://tenant.example${path}?token=private-query-value`;
    const config = {
      url,
      method: 'post',
      headers: new AxiosHeaders({ 'x-internal-key': 'private-fixture-key' }),
    };
    const error = new AxiosError(
      'private-error-message',
      'ERR_BAD_REQUEST',
      config,
      undefined,
      {
        config,
        data: {
          error: { code: 'FORBIDDEN', message: 'private-response-body' },
        },
        headers: {},
        status: 403,
        statusText: 'Forbidden',
      },
    );

    logHttpClientError(error, 'POST', `${path}?token=private-query-value`);

    expect(log.mock.calls).toEqual([
      [
        JSON.stringify({
          name: 'AxiosError',
          status: 403,
          code: 'FORBIDDEN',
          method: 'POST',
          path,
        }),
      ],
    ]);
  });

  it('omits status and code when there is no HTTP response', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    logHttpClientError(
      new AxiosError('Connection failed', 'ECONNREFUSED'),
      'GET',
      '/api/v1/enrollments',
    );

    expect(log.mock.calls).toEqual([
      [
        JSON.stringify({
          name: 'AxiosError',
          method: 'GET',
          path: '/api/v1/enrollments',
        }),
      ],
    ]);
  });
});
