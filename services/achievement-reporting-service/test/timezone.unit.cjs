const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { Logger } = require('@nestjs/common');
const { config, row, directory } = require('./fixtures.cjs');
const {
  HttpIssuanceDirectory,
} = require('../dist/src/modules/certificates/issuance.clients');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const {
  SignerAccess,
} = require('../dist/src/modules/certificates/signer.access');
const {
  issuanceConfig,
} = require('../dist/src/modules/certificates/issuance.config');
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  mock.restoreAll();
});

for (const [label, timezone, expected] of [
  ['valid', 'America/Los_Angeles', 'America/Los_Angeles'],
  ['missing', undefined, 'Pacific/Auckland'],
  ['invalid', 'Invalid/Zone', 'Pacific/Auckland'],
  ['null', null, 'Pacific/Auckland'],
  ['non-string', 7, 'Pacific/Auckland'],
]) {
  test(`profile ${label} timezone is frozen; fallback logs only safe context`, async () => {
    const pending = row(),
      logs = [],
      snapshots = [];
    mock.method(Logger.prototype, 'error', (entry) => logs.push(entry));
    const cfg = config({ fallbackTimezone: 'Pacific/Auckland' });
    global.fetch = async (url, options) => {
      assert.equal(
        url,
        `http://tenant.invalid/api/v1/internal/organizations/${pending.organization_id}/certificate-profile`,
      );
      assert.equal(
        options.headers['x-organization-id'],
        pending.organization_id,
      );
      assert.equal(options.headers['x-internal-key'], cfg.internalKey);
      return Response.json({
        data: {
          organizationId: pending.organization_id.toUpperCase(),
          name: 'Private fixture name',
          logo: null,
          timezone,
          privateField: 'never-log-this-response',
        },
      });
    };
    const client = new HttpIssuanceDirectory(cfg);
    const profile = await client.profile(pending.organization_id);
    assert.equal(profile.timezone, expected);
    assert.deepEqual(
      logs,
      label === 'valid'
        ? []
        : [
            {
              code: 'CERTIFICATE_TIMEZONE_FALLBACK',
              organizationId: pending.organization_id,
            },
          ],
    );
    const dir = directory();
    dir.profile = async () => profile;
    const worker = new IssuanceWorker(
      {
        issue: async (_row, snapshot) => {
          snapshots.push(snapshot);
          return true;
        },
        retry: async () => assert.fail('Timezone must never fail issuance'),
      },
      cfg,
      dir,
      {},
      { get: async () => null },
    );
    await worker.process(pending);
    assert.equal(snapshots.length, 1);
    assert.equal(snapshots[0].organizationTimezone, expected);
  });
}
test('fallback zone defaults explicitly and invalid configured fallback fails startup', () => {
  assert.equal(
    issuanceConfig(() => undefined).fallbackTimezone,
    'Asia/Ho_Chi_Minh',
  );
  assert.throws(
    () =>
      issuanceConfig((k) =>
        k === 'CERTIFICATE_DISPLAY_TIMEZONE' ? 'bad zone' : undefined,
      ),
    /Invalid CERTIFICATE_DISPLAY_TIMEZONE/,
  );
});
for (const casing of ['upper request', 'upper response']) {
  test(`both Tenant clients accept case-insensitive organization IDs: ${casing}`, async () => {
    const org = row().organization_id;
    const requested = casing === 'upper request' ? org.toUpperCase() : org;
    global.fetch = async () =>
      Response.json({
        data: {
          organizationId: casing === 'upper request' ? org : org.toUpperCase(),
          name: 'Organization',
          logo: null,
          timezone: 'UTC',
          organizationStatus: 'Active',
          subscriptionStatus: 'Active',
        },
      });
    assert.equal(
      (await new HttpIssuanceDirectory(config()).profile(requested)).timezone,
      'UTC',
    );
    await new SignerAccess(config(), { accessMode: 'http' }).assertWritable(
      requested,
    );
  });
}
for (const status of [
  'PendingPayment',
  'Active',
  'Suspended',
  'Cancelled',
  'Unknown',
  undefined,
  123,
]) {
  test(`access validates Organization status enum: ${status}`, async () => {
    const org = row().organization_id;
    global.fetch = async () =>
      Response.json({
        data: {
          organizationId: org,
          organizationStatus: status,
          subscriptionStatus: 'Active',
          // Unused contract fields deliberately remain unvalidated.
          timezone: 123,
          readOnlyEndsAt: { ignored: true },
        },
      });
    const access = new SignerAccess(config(), { accessMode: 'http' });
    if (status === 'Active') await access.assertWritable(org);
    else
      await assert.rejects(
        access.assertWritable(org),
        (e) =>
          e.getStatus() ===
            (['PendingPayment', 'Suspended', 'Cancelled'].includes(status)
              ? 403
              : 503) &&
          e.getResponse().code ===
            (['PendingPayment', 'Suspended', 'Cancelled'].includes(status)
              ? 'ORGANIZATION_READ_ONLY'
              : 'TENANT_UNAVAILABLE'),
      );
  });
}
