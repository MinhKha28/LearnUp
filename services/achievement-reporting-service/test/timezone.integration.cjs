const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { isolatedDatabase } = require('./postgres.cjs');
const {
  user,
  headers,
  httpApp,
  seed,
  services,
} = require('./certificate-read.helpers.cjs');

test('forward timezone migration backfills existing Issued rows and restores immutability', async (t) => {
  const issuedId = randomUUID(),
    pendingId = randomUUID();
  const fixture = await isolatedDatabase({
    beforeTimezoneMigration: async (pool) => {
      for (const [id, code] of [
        [issuedId, '0123456789AB'],
        [pendingId, '0123456789AC'],
      ]) {
        await pool.query(
          `INSERT INTO certificates(id,organization_id,enrollment_id,learner_id,course_id,certificate_code,
        issued_at,completed_late,score_snapshot,completion_fingerprint,next_attempt_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,clock_timestamp(),false,'{"schemaVersion":1,"eligible":true}',
          $7,clock_timestamp(),clock_timestamp())`,
          [
            id,
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
            code,
            '0'.repeat(64),
          ],
        );
      }
      await pool.query(
        `UPDATE certificates SET status='Issued',learner_name='Learner',organization_name='Organization',
      course_name='Course',version_number=1,chain_id=course_id,issued_recorded_at=clock_timestamp(),next_attempt_at=NULL WHERE id=$1`,
        [issuedId],
      );
      assert.equal(
        (
          await pool.query(
            `SELECT count(*)::int AS n FROM certificates WHERE status='Issued'`,
          )
        ).rows[0].n,
        1,
      );
    },
  });
  const { pool } = fixture;
  try {
    await t.test(
      'backfill preserves Pending NULL and uses documented historical default for Issued',
      async () => {
        const rows = (
          await pool.query('SELECT id,organization_timezone FROM certificates')
        ).rows;
        assert.equal(
          rows.find((r) => r.id === issuedId).organization_timezone,
          'Asia/Ho_Chi_Minh',
        );
        assert.equal(
          rows.find((r) => r.id === pendingId).organization_timezone,
          null,
        );
      },
    );
    await t.test(
      'immutability trigger is enabled and rejects changes to backfilled Issued rows',
      async () => {
        const trigger = (
          await pool.query(
            `SELECT tgenabled FROM pg_trigger WHERE tgrelid='certificates'::regclass AND tgname='trg_certificates_guard'`,
          )
        ).rows[0];
        assert.equal(trigger.tgenabled, 'O');
        for (const sql of [
          `UPDATE certificates SET organization_timezone='UTC' WHERE id=$1`,
          'UPDATE certificates SET status=status WHERE id=$1',
        ])
          await assert.rejects(
            pool.query(sql, [issuedId]),
            (e) => e.code === '23514' && /immutable/.test(e.message),
          );
      },
    );
    for (const zone of [null, '', '   ']) {
      await t.test(
        `CHECK rejects Issued timezone ${JSON.stringify(zone)}`,
        async () => {
          await assert.rejects(
            pool.query(
              `UPDATE certificates SET status='Issued',learner_name='Learner',organization_name='Organization',
          course_name='Course',version_number=1,chain_id=course_id,issued_recorded_at=clock_timestamp(),next_attempt_at=NULL,
          organization_timezone=$2 WHERE id=$1`,
              [pendingId, zone],
            ),
            (e) =>
              e.code === '23514' &&
              e.constraint === 'ck_certificates_organization_timezone',
          );
        },
      );
    }
    await t.test(
      'valid timezone can only be frozen on the Pending to Issued transition',
      async () => {
        await assert.rejects(
          pool.query(
            `UPDATE certificates SET organization_timezone='UTC' WHERE id=$1`,
            [pendingId],
          ),
          (e) => e.code === '23514',
        );
        await pool.query(
          `UPDATE certificates SET status='Issued',learner_name='Learner',organization_name='Organization',
        course_name='Course',version_number=1,chain_id=course_id,issued_recorded_at=clock_timestamp(),next_attempt_at=NULL,
        organization_timezone='UTC' WHERE id=$1`,
          [pendingId],
        );
        assert.equal(
          (
            await pool.query(
              'SELECT organization_timezone FROM certificates WHERE id=$1',
              [pendingId],
            )
          ).rows[0].organization_timezone,
          'UTC',
        );
        await assert.rejects(
          pool.query(
            `UPDATE certificates SET organization_timezone='Asia/Ho_Chi_Minh' WHERE id=$1`,
            [pendingId],
          ),
          (e) => e.code === '23514',
        );
      },
    );
  } finally {
    await fixture.cleanup();
  }
});

test('list, detail and PDF use each frozen timezone for the same UTC instant', async () => {
  const f = await isolatedDatabase();
  let app;
  try {
    const u = user(),
      at = '2026-10-31T23:00:00.000Z';
    const vietnam = await seed(f, u, { at, timezone: 'Asia/Ho_Chi_Minh' });
    const losAngeles = await seed(f, u, {
      at,
      timezone: 'America/Los_Angeles',
    });
    const http = await httpApp(services(f).service);
    app = http.app;
    const base = http.base + '/api/v1/certificates/me';
    const listResponse = await fetch(base, { headers: headers(u) });
    assert.equal(listResponse.status, 200);
    const list = (await listResponse.json()).data.items;
    assert.equal(list.length, 2);
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    for (const [id, date, printed] of [
      [vietnam, '2026-11-01', '01/11/2026'],
      [losAngeles, '2026-10-31', '31/10/2026'],
    ]) {
      assert.equal(list.find((r) => r.id === id).issuedDate, date);
      const detailResponse = await fetch(base + '/' + id, {
        headers: headers(u),
      });
      assert.equal(detailResponse.status, 200);
      const detail = (await detailResponse.json()).data;
      assert.equal(detail.issuedDate, date);
      assert.equal(detail.issuedAt, at);
      const pdfResponse = await fetch(base + '/' + id + '/pdf', {
        headers: headers(u),
      });
      assert.equal(pdfResponse.status, 200);
      const doc = await pdfjs.getDocument({
        data: new Uint8Array(await pdfResponse.arrayBuffer()),
        useSystemFonts: false,
        isEvalSupported: false,
      }).promise;
      try {
        const content = (await (await doc.getPage(1)).getTextContent()).items
          .map((i) => i.str)
          .join('');
        assert.ok(content.includes(printed));
      } finally {
        await doc.cleanup();
      }
    }
  } finally {
    await app?.close();
    await f.cleanup();
  }
});
