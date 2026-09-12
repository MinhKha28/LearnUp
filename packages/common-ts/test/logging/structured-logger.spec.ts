import { StructuredLogger } from '../../src/logging/structured-logger.service';
import { TenantContext } from '../../src/context/tenant-context';

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new StructuredLogger('test-service');
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should emit structured JSON log containing message and context', () => {
    TenantContext.runWithTenant('org_test_99', () => {
      logger.log('User login successful', 'AuthService', { userId: 'usr_123' });
    });

    expect(logSpy).toHaveBeenCalled();
    const loggedJson = JSON.parse(logSpy.mock.calls[0][0]);

    expect(loggedJson.level).toBe('INFO');
    expect(loggedJson.service).toBe('test-service');
    expect(loggedJson.organizationId).toBe('org_test_99');
    expect(loggedJson.message).toBe('User login successful');
    expect(loggedJson.context).toBe('AuthService');
    expect(loggedJson.extra).toEqual({ userId: 'usr_123' });
  });
});
