import { describe, it, expect, afterEach } from 'vitest';
import { authApi } from '@/auth/authApi';
import { authStorage } from '@/auth/authStorage';
import { apiClient, getApiErrorMessage } from '@/services/apiClient';
import { defaultHandlers, getHandlers, optionalHandlers, parseMockGroups } from '@/mocks/handlers';
import { MOCK_PASSWORD } from '@/mocks/handlers/auth';
import { server } from '@/mocks/node';

afterEach(() => authStorage.clearTokens());

describe('mock handler selection', () => {
  it('parses VITE_MOCKS_INCLUDE and ignores unknown groups', () => {
    expect(parseMockGroups(undefined)).toEqual([]);
    expect(parseMockGroups('')).toEqual([]);
    expect(parseMockGroups(' auth , nope')).toEqual(['auth']);
  });

  it('leaves the backend auth endpoints unmocked unless "auth" is included', () => {
    expect(getHandlers()).toEqual(defaultHandlers);
    for (const handler of optionalHandlers.auth) {
      expect(getHandlers()).not.toContain(handler);
    }
    expect(getHandlers(['auth'])).toEqual([...defaultHandlers, ...optionalHandlers.auth]);
  });
});

describe('MSW in tests (msw/node)', () => {
  it('fails a request that no handler answers', async () => {
    // onUnhandledRequest: 'error' in tests/setup.ts — auth is not mocked by default
    await expect(apiClient.post('/api/auth/login', {})).rejects.toThrow();
  });

  it('runs the optional auth handlers through apiClient: login then /users/me', async () => {
    server.use(...optionalHandlers.auth);

    const tokens = await authApi.login({ username: 'organizer1', password: MOCK_PASSWORD });
    expect(tokens.tokenType).toBe('Bearer');

    authStorage.setTokens(tokens.accessToken, tokens.refreshToken);
    const me = await authApi.getMe();
    expect(me).toMatchObject({ username: 'organizer1', role: 'ORGANIZER' });
  });

  it('answers wrong credentials like identity-service', async () => {
    server.use(...optionalHandlers.auth);

    const err = await authApi
      .login({ username: 'learner1@learnup.test', password: 'wrong' })
      .catch((e: unknown) => e);
    expect(getApiErrorMessage(err)).toBe('Invalid username or password');
  });

  it('answers missing credentials with VALIDATION_ERROR details', async () => {
    server.use(...optionalHandlers.auth);

    const err = await authApi.login({ username: '', password: '' }).catch((e: unknown) => e);
    expect(getApiErrorMessage(err)).toBe(
      'Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các trường được đánh dấu.'
    );
  });
});
