import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService bootstrap', () => {
  const executeRaw = jest.fn<() => Promise<number>>();
  const service = new PlatformSettingsService({
    $executeRaw: executeRaw,
  } as unknown as PrismaService);

  beforeEach(() => {
    executeRaw.mockReset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs once when it creates the default settings row', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    executeRaw.mockResolvedValue(1);

    await service.onApplicationBootstrap();

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      'Created default Course platform settings.',
    );
  });

  it('is silent when it inserts no row', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    executeRaw.mockResolvedValue(0);

    await service.onApplicationBootstrap();

    expect(executeRaw).toHaveBeenCalledTimes(1);
    expect(log).not.toHaveBeenCalled();
  });

  it('propagates database errors so startup fails', async () => {
    const log = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    const error = new Error('Database unavailable');
    executeRaw.mockRejectedValue(error);

    await expect(service.onApplicationBootstrap()).rejects.toBe(error);
    expect(log).not.toHaveBeenCalled();
  });
});
