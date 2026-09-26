import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { createErrorResponse, type ApiResponseError } from '@learnup/ts-common';
import { apiClient } from '@/services/apiClient';
import { applyServerFieldErrors, SERVER_ERROR_TYPE } from '@/lib/form';
import { server } from '@/mocks/node';

type Form = { email: string; password: string; organization: { taxCode: string } };
const FIELDS = ['email', 'password', 'organization.taxCode'] as const;

const VALIDATION_ALERT = 'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường được đánh dấu.';

/** Makes POST /api/test answer `body` and returns the error apiClient throws. */
const failWith = async (body: ApiResponseError, status = 400): Promise<unknown> => {
  server.use(http.post('*/api/test', () => HttpResponse.json(body, { status })));
  return apiClient.post('/api/test', {}).then(
    () => {
      throw new Error('request should have failed');
    },
    (err: unknown) => err
  );
};

const validationError = (details: string[]) =>
  failWith(createErrorResponse('VALIDATION_ERROR', 'Request validation failed', details));

describe('applyServerFieldErrors', () => {
  it('sets each "field: message" detail on its field, focuses the first and returns null', async () => {
    const setError = vi.fn();
    const err = await validationError([
      'email: Email must be a valid email address',
      'organization.taxCode: Tax code is invalid',
    ]);

    expect(applyServerFieldErrors<Form>(err, setError, FIELDS)).toBeNull();
    expect(setError).toHaveBeenCalledTimes(2);
    expect(setError).toHaveBeenNthCalledWith(
      1,
      'email',
      { type: SERVER_ERROR_TYPE, message: 'Email must be a valid email address' },
      { shouldFocus: true }
    );
    expect(setError).toHaveBeenNthCalledWith(
      2,
      'organization.taxCode',
      { type: SERVER_ERROR_TYPE, message: 'Tax code is invalid' },
      { shouldFocus: false }
    );
  });

  it('maps a server field name to a different form field', async () => {
    const setError = vi.fn();
    const err = await validationError(['username: Username or email is required']);

    expect(
      applyServerFieldErrors<Form>(err, setError, FIELDS, { fieldMap: { username: 'email' } })
    ).toBeNull();
    expect(setError).toHaveBeenCalledWith(
      'email',
      expect.objectContaining({ message: 'Username or email is required' }),
      { shouldFocus: true }
    );
  });

  it('keeps only the first message when a field is reported twice', async () => {
    const setError = vi.fn();
    const err = await validationError(['password: Too short', 'password: Too weak']);

    applyServerFieldErrors<Form>(err, setError, FIELDS);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError.mock.calls[0][1].message).toBe('Too short');
  });

  it('returns the Alert message when a detail has no known field, and still sets the others', async () => {
    const setError = vi.fn();
    const err = await validationError(['email: Bad email', 'plan: Plan is closed', 'no field']);

    expect(applyServerFieldErrors<Form>(err, setError, FIELDS)).toBe(VALIDATION_ALERT);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('email', expect.anything(), { shouldFocus: true });
  });

  it('returns the Alert message for VALIDATION_ERROR without details', async () => {
    const setError = vi.fn();
    const err = await validationError([]);

    expect(applyServerFieldErrors<Form>(err, setError, FIELDS)).toBe(VALIDATION_ALERT);
    expect(setError).not.toHaveBeenCalled();
  });

  it('returns the server message for other error codes', async () => {
    const setError = vi.fn();
    const err = await failWith(
      createErrorResponse('UNAUTHORIZED', 'Invalid username or password'),
      401
    );

    expect(applyServerFieldErrors<Form>(err, setError, FIELDS)).toBe(
      'Invalid username or password'
    );
    expect(setError).not.toHaveBeenCalled();
  });

  it('returns the fallback, or errors:generic, when there is no server response', async () => {
    const setError = vi.fn();
    server.use(http.post('*/api/test', () => HttpResponse.error()));
    const err = await apiClient.post('/api/test', {}).catch((e: unknown) => e);

    expect(applyServerFieldErrors<Form>(err, setError, FIELDS, { fallback: 'Thử lại sau' })).toBe(
      'Thử lại sau'
    );
    expect(applyServerFieldErrors<Form>(new Error('boom'), setError, FIELDS)).toBe(
      'Đã có lỗi xảy ra. Vui lòng thử lại.'
    );
    expect(setError).not.toHaveBeenCalled();
  });
});
