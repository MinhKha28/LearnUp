const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Logger } = require('@nestjs/common');
const { event, delivery, directory, config } = require('./fixtures.cjs');
const { isolatedDatabase } = require('./postgres.cjs');
const {
  IssuanceWorker,
} = require('../dist/src/modules/certificates/issuance.worker');
const {
  CompletionConsumer,
} = require('../dist/src/modules/certificates/completion.consumer');
const storage = {
  upload: async () => {
    throw new Error('Unexpected storage call');
  },
  delete: async () => {},
};
test('real PostgreSQL certificate transactions, constraints, leases and quarantine', async (t) => {
  const fixture = await isolatedDatabase();
  const { pool, db, repository: repo } = fixture;
  try {
    const initial = event(),
      receive = (e = initial, offset = '0', gen) =>
        repo.receive(e, delivery(e, offset), e, gen);
    const received = await receive();
    const certificateId = received.id;
    const directInsert = async (changes = {}) => {
      const e = event();
      const values = {
        id: randomUUID(),
        organizationId: e.data.organizationId,
        enrollmentId: e.data.enrollmentId,
        learnerId: e.data.learnerId,
        courseId: e.data.courseId,
        code: 'ABCD23456789',
        snapshot: JSON.stringify(e.data.scoreSnapshot),
        ...changes,
      };
      return pool.query(
        `INSERT INTO certificates(id,organization_id,enrollment_id,learner_id,course_id,certificate_code,issued_at,completed_late,score_snapshot,completion_fingerprint,next_attempt_at,updated_at)
      VALUES($1,$2,$3,$4,$5,$6,clock_timestamp(),false,$7::jsonb,$8,clock_timestamp(),clock_timestamp())`,
        [
          values.id,
          values.organizationId,
          values.enrollmentId,
          values.learnerId,
          values.courseId,
          values.code,
          values.snapshot,
          '0'.repeat(64),
        ],
      );
    };
    await t.test(
      'database unique enrollment and learner/version constraints reject direct conflicting inserts',
      async () => {
        await assert.rejects(
          directInsert({ enrollmentId: initial.data.enrollmentId }),
          (e) => e.code === '23505',
        );
        await assert.rejects(
          directInsert({
            learnerId: initial.data.learnerId,
            courseId: initial.data.courseId,
          }),
          (e) => e.code === '23505',
        );
        const code = (
          await pool.query(
            'SELECT certificate_code FROM certificates WHERE id=$1',
            [certificateId],
          )
        ).rows[0].certificate_code;
        await assert.rejects(directInsert({ code }), (e) => e.code === '23505');
      },
    );
    await t.test(
      'database CHECK rejects non-Crockford codes and array snapshots on direct insert',
      async () => {
        await assert.rejects(
          directInsert({ code: 'U'.repeat(12) }),
          (e) => e.code === '23514',
        );
        await assert.rejects(
          directInsert({ snapshot: '[]' }),
          (e) => e.code === '23514',
        );
      },
    );
    await t.test(
      'duplicate event delivered concurrently produces one certificate and receipt',
      async () => {
        await Promise.all(Array.from({ length: 12 }, () => receive()));
        assert.equal(
          (await pool.query('SELECT count(*)::int AS n FROM certificates'))
            .rows[0].n,
          1,
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int AS n FROM processed_completion_events',
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      'new event ID same completion is idempotent; changed event payload quarantined',
      async () => {
        await receive({ ...initial, eventId: randomUUID() }, '1');
        const changed = structuredClone(initial);
        changed.data.completedLate = true;
        assert.equal(
          (await receive(changed, '2')).conflict,
          'EVENT_ID_CONFLICT',
        );
        changed.eventId = randomUUID();
        assert.equal(
          (await receive(changed, '3')).conflict,
          'COMPLETION_CONFLICT',
        );
        assert.equal(
          (await pool.query('SELECT count(*)::int AS n FROM certificates'))
            .rows[0].n,
          1,
        );
      },
    );
    await t.test(
      'code collision regenerates; collision exhaustion rolls back receipt and certificate',
      async () => {
        const code = (
          await pool.query(
            'SELECT certificate_code FROM certificates WHERE id=$1',
            [certificateId],
          )
        ).rows[0].certificate_code;
        const second = event();
        let calls = 0;
        await receive(second, '4', () =>
          ++calls === 1 ? code : '0123456789AB',
        );
        assert.equal(calls, 2);
        const before = (
          await pool.query('SELECT count(*)::int AS n FROM certificates')
        ).rows[0].n;
        await assert.rejects(
          receive(event(), '5', () => code),
          /COLLISION_LIMIT/,
        );
        assert.equal(
          (await pool.query('SELECT count(*)::int AS n FROM certificates'))
            .rows[0].n,
          before,
        );
      },
    );
    const invalidWrites = [
      [
        'event IDs',
        'UPDATE certificates SET learner_id=$2 WHERE id=$1',
        randomUUID(),
      ],
      [
        'organization',
        'UPDATE certificates SET organization_id=$2 WHERE id=$1',
        randomUUID(),
      ],
      [
        'course',
        'UPDATE certificates SET course_id=$2 WHERE id=$1',
        randomUUID(),
      ],
      [
        'enrollment',
        'UPDATE certificates SET enrollment_id=$2 WHERE id=$1',
        randomUUID(),
      ],
      [
        'code',
        'UPDATE certificates SET certificate_code=$2 WHERE id=$1',
        '0123456789AC',
      ],
      [
        'issued date',
        'UPDATE certificates SET issued_at=$2 WHERE id=$1',
        new Date(0),
      ],
      [
        'late flag',
        'UPDATE certificates SET completed_late=$2 WHERE id=$1',
        true,
      ],
      [
        'snapshot',
        'UPDATE certificates SET score_snapshot=$2::jsonb WHERE id=$1',
        '[]',
      ],
      [
        'fingerprint',
        'UPDATE certificates SET completion_fingerprint=$2 WHERE id=$1',
        'f'.repeat(64),
      ],
      [
        'early name',
        'UPDATE certificates SET learner_name=$2 WHERE id=$1',
        'Premature',
      ],
      [
        'negative attempts',
        'UPDATE certificates SET issue_attempts=$2 WHERE id=$1',
        -1,
      ],
      [
        'unknown state',
        'UPDATE certificates SET status=$2 WHERE id=$1',
        'Failed',
      ],
    ];
    for (const [name, sql, value] of invalidWrites)
      await t.test(`PostgreSQL blocks Pending change: ${name}`, () =>
        assert.rejects(
          pool.query(sql, [certificateId, value]),
          (e) => e.code === '23514',
        ),
      );
    await t.test('PostgreSQL blocks deleting Pending certificate', () =>
      assert.rejects(
        pool.query('DELETE FROM certificates WHERE id=$1', [certificateId]),
        (e) => e.code === '23514',
      ),
    );
    await t.test('PostgreSQL blocks incomplete Issued transition', () =>
      assert.rejects(
        pool.query(
          "UPDATE certificates SET status='Issued',next_attempt_at=NULL WHERE id=$1",
          [certificateId],
        ),
        (e) => e.code === '23514',
      ),
    );
    await t.test(
      'concurrent SKIP LOCKED claims are disjoint; stale lease cannot issue; expiry permits reclaim',
      async () => {
        const claimed = await Promise.all([
          repo.claimDueAcrossOrganizations(1, 10000),
          repo.claimDueAcrossOrganizations(1, 10000),
        ]);
        assert.equal(claimed[0].length, 1);
        assert.equal(claimed[1].length, 1);
        assert.notEqual(claimed[0][0].id, claimed[1][0].id);
        const r = claimed[0][0];
        await pool.query(
          "UPDATE certificates SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1",
          [r.id],
        );
        assert.equal(
          await repo.issue(r, {
            learnerName: 'Fixture',
            organizationName: 'Fixture',
            courseName: 'Fixture',
            versionNumber: 1,
            chainId: randomUUID(),
            logo: null,
          }),
          false,
        );
        const reclaimed = await repo.claimDueAcrossOrganizations(1, 10000);
        assert.equal(reclaimed[0].id, r.id);
        assert.notEqual(reclaimed[0].lease_token, r.lease_token);
        await pool.query(
          "UPDATE certificates SET lease_until=clock_timestamp()-interval '1 second'",
        );
      },
    );
    await t.test(
      'dependency failure keeps Pending, recovery issues with no signer/logo and original completedAt',
      async () => {
        const dir = directory();
        let fail = true;
        dir.learnerName = async () => {
          if (fail) throw new Error('Tenant unavailable');
          return 'Nguyễn Văn Kiểm (deleted account fixture)';
        };
        const worker = new IssuanceWorker(
          repo,
          config(),
          dir,
          storage,
          new (require('../dist/src/modules/certificates/signer.repository').SignerRepository)(
            db,
          ),
        );
        const oldWarn = Logger.prototype.warn;
        Logger.prototype.warn = () => {};
        try {
          await worker.tick();
        } finally {
          Logger.prototype.warn = oldWarn;
        }
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM certificates WHERE status='Pending'",
            )
          ).rows[0].n,
          2,
        );
        await pool.query(
          "UPDATE certificates SET next_attempt_at=clock_timestamp()-interval '1 second' WHERE status='Pending'",
        );
        fail = false;
        await worker.tick();
        const r = (
          await pool.query('SELECT * FROM certificates WHERE id=$1', [
            certificateId,
          ])
        ).rows[0];
        assert.equal(r.status, 'Issued');
        assert.equal(r.issued_at.toISOString(), initial.data.completedAt);
        assert.ok(r.issued_recorded_at >= r.issued_at);
        assert.equal(r.signer_name, null);
        assert.equal(r.signature_asset_key, null);
        assert.equal(r.logo_asset_key, null);
        assert.deepEqual(r.score_snapshot, initial.data.scoreSnapshot);
      },
    );
    for (const [name, sql] of [
      [
        'edit name',
        "UPDATE certificates SET learner_name='Changed' WHERE id=$1",
      ],
      ['reverse state', "UPDATE certificates SET status='Pending' WHERE id=$1"],
      ['no-op update', 'UPDATE certificates SET status=status WHERE id=$1'],
      ['delete', 'DELETE FROM certificates WHERE id=$1'],
    ])
      await t.test(`PostgreSQL blocks Issued ${name}`, () =>
        assert.rejects(
          pool.query(sql, [certificateId]),
          (e) => e.code === '23514',
        ),
      );
    await t.test(
      'quarantine persists malformed and incompatible JSON, commits offset, next completion proceeds',
      async () => {
        const consumer = new CompletionConsumer(repo, { kick() {} }, config());
        let committed = 0;
        const oldWarn = Logger.prototype.warn;
        Logger.prototype.warn = () => {};
        try {
          for (const [offset, value] of [
            ['10', Buffer.from('{bad')],
            ['11', Buffer.from('"\\u0000"')],
            ['12', Buffer.from('"\\ud800"')],
          ])
            await consumer.handle(
              { ...delivery(null, offset), value },
              async () => {
                committed++;
              },
            );
          const next = event();
          await consumer.handle(delivery(next, '13'), async () => committed++);
          await consumer.handle(
            { ...delivery(null, '10'), value: Buffer.from('{bad') },
            async () => committed++,
          );
        } finally {
          Logger.prototype.warn = oldWarn;
        }
        assert.equal(committed, 5);
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int AS n FROM completion_event_quarantine WHERE "offset">=10',
            )
          ).rows[0].n,
          3,
        );
      },
    );
    await t.test(
      'same learner/version unique prevents a second enrollment certificate',
      async () => {
        const other = structuredClone(initial);
        other.eventId = randomUUID();
        other.data.enrollmentId = randomUUID();
        assert.equal(
          (await receive(other, '20')).conflict,
          'COMPLETION_CONFLICT',
        );
        assert.equal(
          (
            await pool.query(
              'SELECT count(*)::int AS n FROM certificates WHERE learner_id=$1 AND course_id=$2',
              [initial.data.learnerId, initial.data.courseId],
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      'metrics expose technical issuance delay and Pending backlog',
      async () => {
        const m = await repo.metricsAcrossOrganizations();
        assert.equal(m.issued, 2);
        assert.equal(m.backlog, 1);
        assert.ok(m.p50 >= 0);
        assert.ok(m.p99 >= m.p50);
      },
    );
  } finally {
    await fixture.cleanup();
  }
});
