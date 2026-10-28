const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { test } = require('node:test');
const {
  InternalOrganizationsService,
} = require('../dist/src/modules/internal-organizations/internal-organizations.service');
const {
  organizerReadOnlyEndsAt,
  ORGANIZER_READ_ONLY_DAYS,
} = require('../dist/src/common/utils/organizer-read-only.util');

const DAY_MS = 24 * 60 * 60 * 1000;
const organizationId = randomUUID();
const organization = {
  id: organizationId,
  name: 'Org',
  status: 'Active',
  timezone: 'Asia/Ho_Chi_Minh',
  logoFileKey: null,
};

const createService = ({ org = organization, subscription = null } = {}) => {
  const calls = [];
  const service = new InternalOrganizationsService({
    findOrganization: async (id) => {
      calls.push(['findOrganization', id]);
      return org;
    },
    findCurrentSubscription: async (id) => {
      calls.push(['findCurrentSubscription', id]);
      return subscription;
    },
  });
  return { service, calls };
};

for (const status of ['Active', 'Grace']) {
  test(`access: ${status} subscription has no read-only end`, async () => {
    const { service } = createService({
      subscription: { status, readOnlyEndsAt: null, suspendedAt: null },
    });
    assert.deepEqual(await service.access(organizationId, organizationId), {
      organizationId,
      organizationStatus: 'Active',
      subscriptionStatus: status,
      readOnlyEndsAt: null,
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });
}

test('access: Suspended returns the Organizer read-only end (BR-24), 30 days after suspension', async () => {
  const suspendedAt = new Date('2026-10-01T00:00:00Z');
  const { service } = createService({
    subscription: { status: 'Suspended', readOnlyEndsAt: null, suspendedAt },
  });
  const result = await service.access(organizationId, organizationId);
  assert.equal(result.subscriptionStatus, 'Suspended');
  assert.equal(
    result.readOnlyEndsAt.getTime(),
    suspendedAt.getTime() + 30 * DAY_MS,
  );
});

test('access: Suspended prefers the frozen read_only_ends_at, even when it has passed', async () => {
  const frozen = new Date('2026-09-01T00:00:00Z');
  const { service } = createService({
    subscription: {
      status: 'Suspended',
      readOnlyEndsAt: frozen,
      suspendedAt: new Date('2026-08-01T00:00:00Z'),
    },
  });
  assert.equal(
    (await service.access(organizationId, organizationId)).readOnlyEndsAt,
    frozen,
  );
});

test('access: no current subscription is reported as Ended', async () => {
  const { service } = createService({
    org: { ...organization, status: 'Suspended', timezone: 'Asia/Tokyo' },
  });
  assert.deepEqual(await service.access(organizationId, organizationId), {
    organizationId,
    organizationStatus: 'Suspended',
    subscriptionStatus: 'Ended',
    readOnlyEndsAt: null,
    timezone: 'Asia/Tokyo',
  });
});

test('access: header matching is case-insensitive', async () => {
  const { service } = createService();
  const result = await service.access(
    organizationId.toUpperCase(),
    organizationId,
  );
  assert.equal(result.organizationId, organizationId);
});

for (const [name, header] of [
  ['a missing header', undefined],
  ['an empty header', ''],
  ['another organization', randomUUID()],
]) {
  test(`access: 404 without querying for ${name}`, async () => {
    const { service, calls } = createService();
    await assert.rejects(
      service.access(header, organizationId),
      (error) =>
        error.getStatus() === 404 &&
        error.getResponse().code === 'ORGANIZATION_NOT_FOUND',
    );
    assert.equal(calls.length, 0);
  });
}

test('access: 404 for an unknown organization, without reading subscriptions', async () => {
  const { service, calls } = createService({ org: null });
  await assert.rejects(
    service.access(organizationId, organizationId),
    (error) => error.getStatus() === 404,
  );
  assert.deepEqual(calls, [['findOrganization', organizationId]]);
});

test('organizerReadOnlyEndsAt: frozen value, else suspended_at + 30 days, else null', () => {
  const suspendedAt = new Date('2026-10-10T05:00:00Z');
  const frozen = new Date('2026-11-01T00:00:00Z');
  assert.equal(ORGANIZER_READ_ONLY_DAYS, 30);
  assert.equal(
    organizerReadOnlyEndsAt({ readOnlyEndsAt: frozen, suspendedAt }),
    frozen,
  );
  assert.equal(
    organizerReadOnlyEndsAt({ readOnlyEndsAt: null, suspendedAt }).getTime(),
    suspendedAt.getTime() + 30 * DAY_MS,
  );
  assert.equal(
    organizerReadOnlyEndsAt({ readOnlyEndsAt: null, suspendedAt: null }),
    null,
  );
});

const profileService = ({ org = organization, getUrl } = {}) => {
  const urls = [];
  const service = new InternalOrganizationsService(
    { findOrganization: async () => org },
    {
      getUrl:
        getUrl ??
        ((key, type) => {
          urls.push([key, type]);
          return `https://cdn.test/${key}.png`;
        }),
    },
  );
  return { service, urls };
};

test('certificate profile: no logo gives logo null, with name and timezone', async () => {
  const { service, urls } = profileService({
    org: { ...organization, name: 'Công ty ABC', timezone: 'Asia/Tokyo' },
  });
  assert.deepEqual(
    await service.certificateProfile(organizationId, organizationId),
    {
      organizationId,
      name: 'Công ty ABC',
      logo: null,
      timezone: 'Asia/Tokyo',
    },
  );
  assert.equal(urls.length, 0);
});

test('certificate profile: a logo key becomes a public URL with null expiry, type and size (#148)', async () => {
  const { service, urls } = profileService({
    org: { ...organization, logoFileKey: 'logos/abc' },
  });
  const profile = await service.certificateProfile(
    organizationId,
    organizationId,
  );
  assert.deepEqual(profile.logo, {
    url: 'https://cdn.test/logos/abc.png',
    expiresAt: null,
    mimeType: null,
    sizeBytes: null,
  });
  assert.deepEqual(urls, [['logos/abc', 'image']]);
});

test('certificate profile: a storage failure is 503 STORAGE_UNAVAILABLE, never logo null', async () => {
  const { service } = profileService({
    org: { ...organization, logoFileKey: 'logos/abc' },
    getUrl: () => {
      throw new Error('Cloudinary credentials are not configured.');
    },
  });
  await assert.rejects(
    service.certificateProfile(organizationId, organizationId),
    (error) =>
      error.getStatus() === 503 &&
      error.getResponse().code === 'STORAGE_UNAVAILABLE',
  );
});

test('certificate profile: returned whatever the organization status is', async () => {
  for (const status of ['Active', 'Suspended', 'Cancelled']) {
    const { service } = profileService({ org: { ...organization, status } });
    const profile = await service.certificateProfile(
      organizationId,
      organizationId,
    );
    assert.equal(profile.organizationId, organizationId);
  }
});

for (const [name, header, org] of [
  ['a missing header', undefined, organization],
  ['another organization', randomUUID(), organization],
  ['an unknown organization', organizationId, null],
]) {
  test(`certificate profile: 404 for ${name}`, async () => {
    const { service } = profileService({ org });
    await assert.rejects(
      service.certificateProfile(header, organizationId),
      (error) =>
        error.getStatus() === 404 &&
        error.getResponse().code === 'ORGANIZATION_NOT_FOUND',
    );
  });
}
