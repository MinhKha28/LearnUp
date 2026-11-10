import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  StorageProviderError,
  type IStorageProvider,
} from '@learnup/ts-storage';
import { createStorageProvider } from '../../src/infrastructure/storage/storage.provider';
import { MemoryStorage } from './fixtures';

const file = {
  buffer: Buffer.from('fixture'),
  originalFilename: 'fixture.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 7,
};

test('unconfigured assessment storage still rejects delete with the existing error', async () => {
  const storage = createStorageProvider(
    new ConfigService({
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    }),
  );
  await assert.rejects(
    storage.delete('fixture/key', { resourceType: 'raw' }),
    (error) =>
      error instanceof StorageProviderError &&
      error.message === 'Cloudinary credentials are not configured.',
  );
});

test('memory storage satisfies the provider contract for successful and repeated deletion', async () => {
  const memory = new MemoryStorage();
  const storage: IStorageProvider = memory;
  const stored = await storage.upload(file, {
    folder: 'fixtures',
    resourceType: 'raw',
  });
  assert.equal(stored.deliveryType, 'upload');
  assert.deepEqual(
    await storage.delete(stored.storageKey, { resourceType: 'raw' }),
    { status: 'deleted' },
  );
  assert.equal(memory.files.has(stored.storageKey), false);
  assert.deepEqual(
    await storage.delete(stored.storageKey, { resourceType: 'raw' }),
    { status: 'not_found' },
  );
  assert.deepEqual(
    await storage.delete('fixtures/missing', { resourceType: 'raw' }),
    { status: 'not_found' },
  );
  assert.deepEqual(memory.deleted, [
    stored.storageKey,
    stored.storageKey,
    'fixtures/missing',
  ]);
});

test('memory uploads retain an explicitly selected delivery type', async () => {
  const storage: IStorageProvider = new MemoryStorage();
  const stored = await storage.upload(file, {
    folder: 'fixtures',
    resourceType: 'raw',
    deliveryType: 'authenticated',
  });
  assert.equal(stored.deliveryType, 'authenticated');
});
